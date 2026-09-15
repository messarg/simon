import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { lineTotal } from "@simon/shared";
import { applyMovement, widenBand, type CostBand, type StockState } from "./costing.ts";
import { detectDrift, replay, type LedgerRow } from "./stock-replay.ts";

const empty: StockState = { stockQty: 0, avgCostMdram: null };

describe("costing — §27.4 margin on a product restocked twice", () => {
  it("reproduces by hand", () => {
    // Receive 10 m at 12 ֏, sell 5, receive 10 m at 15 ֏, sell 5. Price 20 ֏/m.
    let s = applyMovement(empty, { type: "PURCHASE_RECEIPT", qtyDelta: 10_000, unitCostMdram: 12_000 });
    const cost1 = s.avgCostMdram!;
    s = applyMovement(s, { type: "SALE", qtyDelta: -5_000, unitCostMdram: cost1 });
    s = applyMovement(s, { type: "PURCHASE_RECEIPT", qtyDelta: 10_000, unitCostMdram: 15_000 });
    const cost2 = s.avgCostMdram!;
    expect(cost1).toBe(12_000);
    expect(cost2).toBe(14_000); // (5×12 + 10×15) / 15
    const revenue = lineTotal(5_000, 20_000) * 2; // 200
    const cogs = lineTotal(5_000, cost1) + lineTotal(5_000, cost2); // 60 + 70
    expect(revenue - cogs).toBe(70);
  });
});

describe("costing — §27.29 an unknown cost seeds rather than averages against zero", () => {
  it("sells with a null cost, then the first receipt seeds the average", () => {
    let s = applyMovement(empty, { type: "SALE", qtyDelta: -2_000, unitCostMdram: null });
    expect(s).toEqual({ stockQty: -2_000, avgCostMdram: null });
    s = applyMovement(s, { type: "PURCHASE_RECEIPT", qtyDelta: 10_000, unitCostMdram: 9_000 });
    expect(s).toEqual({ stockQty: 8_000, avgCostMdram: 9_000 });
  });

  it("an opening balance with a cost seeds, and one without leaves it null", () => {
    expect(applyMovement(empty, { type: "OPENING_BALANCE", qtyDelta: 10_000, unitCostMdram: 12_000 }).avgCostMdram).toBe(12_000);
    expect(applyMovement(empty, { type: "OPENING_BALANCE", qtyDelta: 10_000, unitCostMdram: null }).avgCostMdram).toBeNull();
  });

  it("zero is a legal cost, distinct from null", () => {
    const s = applyMovement(empty, { type: "PURCHASE_RECEIPT", qtyDelta: 1_000, unitCostMdram: 0 });
    expect(s.avgCostMdram).toBe(0);
  });

  it("refuses a receipt without a cost", () => {
    expect(() => applyMovement(empty, { type: "PURCHASE_RECEIPT", qtyDelta: 1_000, unitCostMdram: null })).toThrow();
  });
});

describe("costing — the bottom five never move the average (§10.4)", () => {
  it("holds for any sequence", () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 100_000 }), fc.integer({ min: 0, max: 10_000_000 }),
      fc.array(fc.record({ type: fc.constantFrom("SALE", "WRITE_OFF", "ADJUSTMENT") as fc.Arbitrary<"SALE">, qty: fc.integer({ min: -50_000, max: 50_000 }) })),
      (q, cost, moves) => {
        let s = applyMovement(empty, { type: "PURCHASE_RECEIPT", qtyDelta: q, unitCostMdram: cost });
        for (const m of moves) s = applyMovement(s, { type: m.type, qtyDelta: m.qty, unitCostMdram: s.avgCostMdram });
        expect(s.avgCostMdram).toBe(cost);
      },
    ));
  });
});

describe("replay — §27.30", () => {
  const rows: LedgerRow[] = [
    { seq: 1, type: "PURCHASE_RECEIPT", qtyDelta: 10_000, unitCostMdram: 12_000 },
    // A late offline sale: posted after the second receipt, so its seq is later even though the device clock was earlier.
    { seq: 2, type: "PURCHASE_RECEIPT", qtyDelta: 10_000, unitCostMdram: 14_000 },
    { seq: 3, type: "SALE", qtyDelta: -4_000, unitCostMdram: 13_000 },
    { seq: 4, type: "SALE_RETURN", qtyDelta: 1_000, unitCostMdram: 12_000 },
  ];

  it("reproduces stockQty and avgCostMdram, in seq order whatever the array order", () => {
    const forward = replay(rows);
    expect(replay([...rows].reverse())).toEqual(forward);
    expect(forward.stockQty).toBe(17_000);
  });

  it("reports drift on both columns and repairs nothing (§27.43)", () => {
    const truth = replay(rows);
    expect(detectDrift(truth, rows)).toEqual([]);
    const drift = detectDrift({ stockQty: truth.stockQty + 1, avgCostMdram: 1 }, rows);
    expect(drift.map((d) => d.field)).toEqual(["stockQty", "avgCostMdram"]);
  });
});

describe("purchase return — §27.22, §13.7's worked table", () => {
  const run = (moves: Array<{ type: "OPENING_BALANCE" | "PURCHASE_RECEIPT" | "SALE" | "PURCHASE_RETURN"; qty: number; cost?: number }>) => {
    let s: StockState = { stockQty: 0, avgCostMdram: null };
    let band: CostBand | null = null;
    for (const m of moves) {
      const input = { type: m.type, qtyDelta: m.qty, unitCostMdram: m.cost ?? s.avgCostMdram };
      s = applyMovement(s, input, band ?? undefined);
      band = widenBand(band, input);
    }
    return s;
  };

  it("with no sale in between, returning the delivery restores the average exactly", () => {
    expect(run([
      { type: "OPENING_BALANCE", qty: 10_000, cost: 12_000 },
      { type: "PURCHASE_RECEIPT", qty: 10_000, cost: 14_000 },
      { type: "PURCHASE_RETURN", qty: -10_000, cost: 14_000 },
    ])).toEqual({ stockQty: 10_000, avgCostMdram: 12_000 });
  });

  it("with eight sold in between, the naive 8 ֏ is refused and the average stands at 13 ֏", () => {
    expect(run([
      { type: "OPENING_BALANCE", qty: 10_000, cost: 12_000 },
      { type: "PURCHASE_RECEIPT", qty: 10_000, cost: 14_000 },
      { type: "SALE", qty: -8_000 },
      { type: "PURCHASE_RETURN", qty: -10_000, cost: 14_000 },
    ])).toEqual({ stockQty: 2_000, avgCostMdram: 13_000 });
  });

  it("the replay applies the same guard, so a refused figure is not drift", () => {
    const rows: LedgerRow[] = [
      { seq: 1, type: "OPENING_BALANCE", qtyDelta: 10_000, unitCostMdram: 12_000 },
      { seq: 2, type: "PURCHASE_RECEIPT", qtyDelta: 10_000, unitCostMdram: 14_000 },
      { seq: 3, type: "SALE", qtyDelta: -8_000, unitCostMdram: 13_000 },
      { seq: 4, type: "PURCHASE_RETURN", qtyDelta: -10_000, unitCostMdram: 14_000 },
    ];
    expect(replay(rows)).toEqual({ stockQty: 2_000, avgCostMdram: 13_000 });
  });
});
