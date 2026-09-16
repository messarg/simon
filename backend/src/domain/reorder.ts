/**
 * Reorder suggestions and dead stock. PRD §13.3, §6.9, §6.12, §11 `ProductStats`.
 *
 *   reorderPoint ≈ avgDailyQty30d × (supplier leadTimeDays + safetyDays)
 *
 * The owner sees the suggestion as a sentence and accepts or ignores it. A reorder point the owner
 * typed is the manual override §6.11 names ("auto from velocity, manual override per product"); a
 * product with none uses the suggestion, so a new shop gets low-stock warnings without filling in
 * three thousand thresholds.
 */
import { roundHalfUp, type MilliUnit } from "@simon/shared";

export const VELOCITY_WINDOW_DAYS = 30;
/** Stock on hand with no sale for this long is dead stock — capital tied up in goods that do not sell (§6.9). */
export const DEAD_STOCK_DAYS = 90;

/** Average units sold per day over the window, in milli-units. Net of customer returns, never below zero. */
export function dailyVelocity(netQtySold: MilliUnit, windowDays = VELOCITY_WINDOW_DAYS): MilliUnit {
  return Math.max(0, roundHalfUp(netQtySold, windowDays));
}

export function suggestedReorderPoint(avgDailyQty: MilliUnit, leadTimeDays: number, safetyDays: number): MilliUnit {
  return avgDailyQty * (Math.max(0, leadTimeDays) + Math.max(0, safetyDays));
}

export interface StockStatusInput {
  trackStock: boolean;
  isActive: boolean;
  stockQty: MilliUnit;
  reorderPoint: MilliUnit;
  avgDailyQty30d: MilliUnit;
  daysSinceLastSale: number | null;
  /** Days since the product was created — a product never sold is only dead once it has had time to sell. */
  ageDays: number;
}

export interface StockStatus {
  suggested: MilliUnit;
  threshold: MilliUnit;
  manual: boolean;
  low: boolean;
  dead: boolean;
  daysOfCover: number | null;
}

export function stockStatus(p: StockStatusInput, leadTimeDays: number, safetyDays: number): StockStatus {
  const suggested = suggestedReorderPoint(p.avgDailyQty30d, leadTimeDays, safetyDays);
  const manual = p.reorderPoint > 0;
  const threshold = manual ? p.reorderPoint : suggested;
  const tracked = p.trackStock && p.isActive;
  const idleDays = p.daysSinceLastSale ?? p.ageDays;
  return {
    suggested, threshold, manual,
    low: tracked && threshold > 0 && p.stockQty <= threshold,
    dead: tracked && p.stockQty > 0 && idleDays >= DEAD_STOCK_DAYS,
    daysOfCover: p.avgDailyQty30d > 0 ? Math.floor(Math.max(0, p.stockQty) / p.avgDailyQty30d) : null,
  };
}
