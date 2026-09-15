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
    // §13.7: remove the returned units at the landed cost they came in at.
    const q = -m.qtyDelta;
    if (state.avgCostMdram === null || stockQty <= 0) return { stockQty, avgCostMdram: state.avgCostMdram };
    let avg = roundHalfUp(state.stockQty * state.avgCostMdram - q * cost, stockQty);
    if (band) avg = Math.min(band.maxMdram, Math.max(band.minMdram, avg));
    return { stockQty, avgCostMdram: avg };
  }

  // Seeding: a null average is not a number and never averages against zero.
  if (state.avgCostMdram === null) return { stockQty, avgCostMdram: cost };
  // newAverageCost guards the zero/negative denominator by taking the incoming cost.
  return { stockQty, avgCostMdram: newAverageCost(state.stockQty, state.avgCostMdram, m.qtyDelta, cost) };
}

/** Whether the ≤ 0 denominator guard fired, which the ledger flags (§10.5). */
export function hitNegativeStockGuard(state: StockState, m: MovementInput): boolean {
  return m.type === "PURCHASE_RECEIPT" && state.avgCostMdram !== null && state.stockQty <= 0;
}
