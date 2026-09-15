/**
 * Weighted-average costing over the stock ledger. PRD §10.4 (per-type table), §10.5.
 *
 * `applyMovement` is the one rule for how a movement changes the two cached projections,
 * `stockQty` and `avgCostMdram`. The ledger service calls it when posting and the replay
 * calls it when checking, so the two cannot disagree.
 */
import { newAverageCost, roundHalfUp, type MilliDram, type MilliUnit, type MovementType } from "@simon/shared";

export interface StockState {
  stockQty: MilliUnit;
  /** Null means no cost basis was ever established — never zero (§10.5). */
  avgCostMdram: MilliDram | null;
}

export interface MovementInput {
  type: MovementType;
  qtyDelta: MilliUnit;
  unitCostMdram: MilliDram | null;
}

export interface CostBand {
  minMdram: MilliDram;
  maxMdram: MilliDram;
}

/** The four types that may move the average (§10.4). */
export const AVERAGE_MOVING_TYPES: ReadonlySet<MovementType> = new Set([
  "OPENING_BALANCE", "PURCHASE_RECEIPT", "SALE_RETURN", "PURCHASE_RETURN",
]);

export function requiresOwnCost(type: MovementType): boolean {
  return type === "PURCHASE_RECEIPT" || type === "PURCHASE_RETURN";
}

export function applyMovement(state: StockState, m: MovementInput, band?: CostBand): StockState {
  if (!Number.isInteger(m.qtyDelta)) throw new RangeError("qtyDelta must be an integer");
  if (requiresOwnCost(m.type) && m.unitCostMdram === null) {
    throw new RangeError(`${m.type} requires a unit cost`);
  }
  const stockQty = state.stockQty + m.qtyDelta;
  if (!AVERAGE_MOVING_TYPES.has(m.type) || m.unitCostMdram === null) {
    return { stockQty, avgCostMdram: state.avgCostMdram };
  }
  const cost = m.unitCostMdram;

  if (m.type === "PURCHASE_RETURN") {
    const avg = purchaseReturnAverage(state, m, band);
    return { stockQty, avgCostMdram: avg ?? state.avgCostMdram };
  }

  // Seeding: a null average is not a number and never averages against zero.
  if (state.avgCostMdram === null) return { stockQty, avgCostMdram: cost };
  // newAverageCost guards the zero/negative denominator by taking the incoming cost.
  return { stockQty, avgCostMdram: newAverageCost(state.stockQty, state.avgCostMdram, m.qtyDelta, cost) };
}

/**
 * §13.7: remove the returned units at the landed cost they came in at — but only store the result
 * when it lies inside the band of costs this product's stock has actually entered at. Outside the
 * band, with no band at all, or with nothing left on the shelf, return null: the average stands
 * and the caller flags it. Refused, never clamped: a clamped figure is still one nobody paid.
 */
export function purchaseReturnAverage(state: StockState, m: MovementInput, band: CostBand | null | undefined): MilliDram | null {
  if (m.type !== "PURCHASE_RETURN" || m.unitCostMdram === null) return null;
  const remaining = state.stockQty + m.qtyDelta;
  if (state.avgCostMdram === null || remaining <= 0 || !band) return null;
  const avg = roundHalfUp(state.stockQty * state.avgCostMdram + m.qtyDelta * m.unitCostMdram, remaining);
  return avg < band.minMdram || avg > band.maxMdram ? null : avg;
}

/** The band a purchase return is checked against: costs on stock-adding movements that carried one (§13.7, §10.4). */
export function widenBand(band: CostBand | null, m: MovementInput): CostBand | null {
  if ((m.type !== "PURCHASE_RECEIPT" && m.type !== "OPENING_BALANCE") || m.unitCostMdram === null) return band;
  return band ? { minMdram: Math.min(band.minMdram, m.unitCostMdram), maxMdram: Math.max(band.maxMdram, m.unitCostMdram) } : { minMdram: m.unitCostMdram, maxMdram: m.unitCostMdram };
}

/** Whether the ≤ 0 denominator guard fired, which the ledger flags (§10.5). */
export function hitNegativeStockGuard(state: StockState, m: MovementInput): boolean {
  return m.type === "PURCHASE_RECEIPT" && state.avgCostMdram !== null && state.stockQty <= 0;
}
