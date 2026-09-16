import { describe, expect, it } from "vitest";
import { applyReceipt, canTransition, statusFromReceipts, suggestedOrderQty } from "./purchase-order.ts";

describe("purchase order lifecycle — §11", () => {
  it("allows only the hand-set transitions §11 names", () => {
    expect(canTransition("DRAFT", "OPEN")).toBe(true);
    expect(canTransition("OPEN", "CANCELLED")).toBe(true);
    expect(canTransition("PARTIAL", "CANCELLED")).toBe(false);
    expect(canTransition("OPEN", "RECEIVED")).toBe(false); // derived from receipts, never set by hand
  });

  it("derives PARTIAL and RECEIVED from what arrived", () => {
    const line = (qtyOrdered: number, qtyReceived: number) => ({ qtyOrdered, qtyReceived });
    expect(statusFromReceipts("OPEN", [line(10_000, 0)])).toBe("OPEN");
    expect(statusFromReceipts("OPEN", [line(10_000, 4_000), line(5_000, 5_000)])).toBe("PARTIAL");
    expect(statusFromReceipts("PARTIAL", [line(10_000, 12_000)])).toBe("RECEIVED");
    expect(statusFromReceipts("CANCELLED", [line(10_000, 10_000)])).toBe("CANCELLED");
  });

  it("fills an order's lines in turn, and books an over-delivery on the last", () => {
    const lines = [
      { id: "a", productId: "cement", qtyOrdered: 20_000, qtyReceived: 0 },
      { id: "b", productId: "cement", qtyOrdered: 10_000, qtyReceived: 0 },
      { id: "c", productId: "sand", qtyOrdered: 5_000, qtyReceived: 0 },
    ];
    const next = applyReceipt(lines, [{ productId: "cement", qty: 35_000 }, { productId: "nails", qty: 1_000 }]);
    expect(Object.fromEntries(next)).toEqual({ a: 20_000, b: 15_000, c: 0 });
  });
});

describe("turning a reorder suggestion into an order — §13.3", () => {
  const base = { stockQty: 6_000, threshold: 32_000, reorderQty: 0, avgDailyQty30d: 4_000, leadTimeDays: 5, safetyDays: 3, onOrder: 0, packFactor: 1 };

  it("orders enough to cover the threshold again on top of it", () => {
    // Target 32 + 32 = 64; 6 on hand → 58.
    expect(suggestedOrderQty(base)).toBe(58_000);
  });

  it("uses the owner's own quantity when set, and counts stock already on its way", () => {
    expect(suggestedOrderQty({ ...base, reorderQty: 50_000 })).toBe(50_000);
    expect(suggestedOrderQty({ ...base, onOrder: 40_000 })).toBe(0); // 46 coming or here: above the threshold
  });

  it("rounds up to whole purchase packs", () => {
    // Cable in 50 m spools: 58 m becomes two spools.
    expect(suggestedOrderQty({ ...base, packFactor: 50 })).toBe(100_000);
  });

  it("orders nothing for a product above its threshold or with none", () => {
    expect(suggestedOrderQty({ ...base, stockQty: 40_000 })).toBe(0);
    expect(suggestedOrderQty({ ...base, threshold: 0 })).toBe(0);
  });
});
