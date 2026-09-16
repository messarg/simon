/**
 * Stocktake. PRD §6.8, §13.4, §11 `Stocktake`/`StocktakeLine`.
 *
 * Counting happens while the shop trades, so a line's expectation is not the snapshot alone: it is
 * the snapshot plus whatever the ledger recorded between the snapshot and the moment that line was
 * counted. Otherwise two bags of cement sold after the snapshot and before the count would be
 * booked as two bags stolen. The PRD's field list stores only the snapshot; the ledger's `seq`
 * is what makes the rest recoverable (§10.4), so a count records the `seq` it was taken at.
 *
 * Lines never counted are not adjusted — an uncounted item is not an item found to be missing.
 */
import { lineTotal, type Dram, type MilliDram, type MilliUnit } from "@simon/shared";

export interface CountedLine {
  productId: string;
  snapshotQty: MilliUnit;
  countedQty: MilliUnit | null;
  /** Net stock change recorded between the snapshot and the count, stocktake postings excluded. */
  movedSinceSnapshot: MilliUnit;
  avgCostMdram: MilliDram | null;
}

export interface LineVariance {
  productId: string;
  expectedAtCount: MilliUnit;
  varianceQty: MilliUnit;
  /** Drams at cost; null when the product has no cost basis (§10.5 — never reported as zero). */
  varianceValue: Dram | null;
}

export function lineVariance(line: CountedLine): LineVariance | null {
  if (line.countedQty === null) return null;
  const expectedAtCount = line.snapshotQty + line.movedSinceSnapshot;
  const varianceQty = line.countedQty - expectedAtCount;
  return {
    productId: line.productId,
    expectedAtCount,
    varianceQty,
    varianceValue: line.avgCostMdram === null ? null : lineTotal(varianceQty, line.avgCostMdram),
  };
}

/** §6.8: only the lines that differ, the costliest discrepancy first — nobody scrolls past 900 correct items. */
export function reviewOrder(lines: readonly LineVariance[]): LineVariance[] {
  return lines
    .filter((l) => l.varianceQty !== 0)
    .sort((a, b) => Math.abs(b.varianceValue ?? 0) - Math.abs(a.varianceValue ?? 0) || Math.abs(b.varianceQty) - Math.abs(a.varianceQty));
}

export interface StocktakeSummary {
  counted: number;
  uncounted: number;
  differing: number;
  shortage: Dram;
  surplus: Dram;
  /** Surplus minus shortage, at cost — the figure that makes shrinkage actionable (§6.8). */
  net: Dram;
  withoutCost: number;
}

export function summarize(lines: ReadonlyArray<CountedLine>): StocktakeSummary {
  const out: StocktakeSummary = { counted: 0, uncounted: 0, differing: 0, shortage: 0, surplus: 0, net: 0, withoutCost: 0 };
  for (const line of lines) {
    const v = lineVariance(line);
    if (!v) { out.uncounted++; continue; }
    out.counted++;
    if (v.varianceQty === 0) continue;
    out.differing++;
    if (v.varianceValue === null) { out.withoutCost++; continue; }
    if (v.varianceValue < 0) out.shortage += -v.varianceValue;
    else out.surplus += v.varianceValue;
  }
  out.net = out.surplus - out.shortage;
  return out;
}

export type StocktakeStatus = "COUNTING" | "REVIEW" | "APPROVED" | "ABANDONED";

/** §11 Lifecycles: COUNTING → REVIEW → APPROVED, or ABANDONED from either of the first two. */
export function canTransition(from: StocktakeStatus, to: StocktakeStatus): boolean {
  if (to === "REVIEW") return from === "COUNTING";
  if (to === "APPROVED") return from === "REVIEW";
  if (to === "ABANDONED") return from === "COUNTING" || from === "REVIEW";
  return false;
}

/** Counts are taken until approval; a recount during review is the point of reviewing. */
export const acceptsCounts = (status: StocktakeStatus) => status === "COUNTING" || status === "REVIEW";
