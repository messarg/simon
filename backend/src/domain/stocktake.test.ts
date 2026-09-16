import { describe, expect, it } from "vitest";
import { canTransition, lineVariance, reviewOrder, summarize } from "./stocktake.ts";

const line = (o: Partial<Parameters<typeof lineVariance>[0]> = {}) => ({
  productId: "p", snapshotQty: 40_000, countedQty: 40_000, movedSinceSnapshot: 0, avgCostMdram: 2_600_000, ...o,
});

describe("stocktake — §6.8, §13.4", () => {
  it("counts against the snapshot plus what moved before the count, so a sale in between is not shrinkage", () => {
    // 40 on the books at the snapshot; 2 sold before this aisle was counted; 38 on the shelf.
    expect(lineVariance(line({ movedSinceSnapshot: -2_000, countedQty: 38_000 }))).toMatchObject({ expectedAtCount: 38_000, varianceQty: 0, varianceValue: 0 });
    // Against the bare snapshot the same count would have read as two bags missing.
    expect(lineVariance(line({ countedQty: 38_000 }))).toMatchObject({ varianceQty: -2_000, varianceValue: -5_200 });
  });

  it("values the difference at cost, and refuses to value what has no cost basis", () => {
    expect(lineVariance(line({ countedQty: 41_500 }))?.varianceValue).toBe(3_900);
    expect(lineVariance(line({ countedQty: 39_000, avgCostMdram: null }))?.varianceValue).toBeNull();
  });

  it("does not treat an uncounted line as missing", () => {
    expect(lineVariance(line({ countedQty: null }))).toBeNull();
  });

  it("reviews only the lines that differ, the costliest first", () => {
    const lines = [
      lineVariance(line({ productId: "same" }))!,
      lineVariance(line({ productId: "small", countedQty: 39_000, avgCostMdram: 100_000 }))!,
      lineVariance(line({ productId: "big", countedQty: 35_000 }))!,
      lineVariance(line({ productId: "nocost", countedQty: 30_000, avgCostMdram: null }))!,
    ];
    expect(reviewOrder(lines).map((l) => l.productId)).toEqual(["big", "small", "nocost"]);
  });

  it("summarises shortage, surplus and the net at cost", () => {
    expect(summarize([
      line({ countedQty: 38_000 }),               // −2 × 2 600
      line({ countedQty: 41_000 }),               // +1 × 2 600
      line({ countedQty: null }),
      line({ countedQty: 10_000, avgCostMdram: null }),
    ])).toEqual({ counted: 3, uncounted: 1, differing: 3, shortage: 5_200, surplus: 2_600, net: -2_600, withoutCost: 1 });
  });

  it("follows §11's lifecycle and nothing else", () => {
    expect(canTransition("COUNTING", "REVIEW")).toBe(true);
    expect(canTransition("REVIEW", "APPROVED")).toBe(true);
    expect(canTransition("COUNTING", "APPROVED")).toBe(false);
    expect(canTransition("APPROVED", "ABANDONED")).toBe(false);
    expect(canTransition("REVIEW", "ABANDONED")).toBe(true);
  });
});
