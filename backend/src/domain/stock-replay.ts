/**
 * Ledger replay. PRD §10.4, FR-STK-06, §27.30, §27.43.
 *
 * Replays by `seq` — the server's insertion order — never by `createdAt`, which comes from
 * a device and would reorder every late arrival into false drift.
 */
import { applyMovement, widenBand, type CostBand, type MovementInput, type StockState } from "./costing.ts";

export interface LedgerRow extends MovementInput {
  seq: number;
}

export function replay(rows: readonly LedgerRow[]): StockState {
  const ordered = [...rows].sort((a, b) => a.seq - b.seq);
  let band: CostBand | null = null;
  let state: StockState = { stockQty: 0, avgCostMdram: null };
  // The purchase-return guard reads the band as it stood when the return posted, so the replay does too.
  for (const r of ordered) {
    state = applyMovement(state, r, band ?? undefined);
    band = widenBand(band, r);
  }
  return state;
}

export interface Drift {
  field: "stockQty" | "avgCostMdram";
  cached: number | null;
  replayed: number | null;
}

/** Reports drift; never repairs it (§10.4). */
export function detectDrift(cached: StockState, rows: readonly LedgerRow[]): Drift[] {
  const r = replay(rows);
  const out: Drift[] = [];
  if (r.stockQty !== cached.stockQty) out.push({ field: "stockQty", cached: cached.stockQty, replayed: r.stockQty });
  if (r.avgCostMdram !== cached.avgCostMdram) out.push({ field: "avgCostMdram", cached: cached.avgCostMdram, replayed: r.avgCostMdram });
  return out;
}
