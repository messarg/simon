import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeSale, effectiveLineDiscount, SaleMathError } from "./sale-math.ts";
import { lineTax } from "./tax.ts";

const line = fc.record({
  qty: fc.integer({ min: 1, max: 50_000 }),
  unitPriceMdram: fc.integer({ min: 0, max: 50_000_000 }),
  taxRateBp: fc.constantFrom(0, 2000),
  discountAmount: fc.constant(0),
});

describe("computeSale — §10.1's identity", () => {
  it("holds for any basket, either basis, any rounding step", () => {
    fc.assert(
      fc.property(
        fc.array(line, { minLength: 1, maxLength: 12 }),
        fc.constantFrom("INCLUSIVE", "EXCLUSIVE") as fc.Arbitrary<"INCLUSIVE" | "EXCLUSIVE">,
        fc.constantFrom(1, 10, 100),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (lines, basis, step, discountRatio) => {
          const subtotal = computeSale(lines, 0, basis, 1).subtotal;
          const saleDiscount = Math.floor(subtotal * discountRatio);
          const r = computeSale(lines, saleDiscount, basis, step);
          expect(r.subtotal).toBe(r.lines.reduce((a, l) => a + l.lineTotal, 0));
          expect(r.taxTotal).toBe(r.lines.reduce((a, l) => a + l.lineTax, 0));
          expect(r.lines.reduce((a, l) => a + l.saleDiscountShare, 0)).toBe(saleDiscount);
          const taxTerm = basis === "EXCLUSIVE" ? r.taxTotal : 0;
          expect(r.total).toBe(r.subtotal - r.discountTotal + taxTerm + r.roundingAdjustment);
          for (const v of [r.total, r.taxTotal, r.roundingAdjustment]) expect(Number.isInteger(v)).toBe(true);
        },
      ),
    );
  });

  it("extracts 20% VAT per line and sums it (§27.18)", () => {
    const r = computeSale(
      [
        { qty: 1000, unitPriceMdram: 1_200_000, taxRateBp: 2000, discountAmount: 0 },
        { qty: 3000, unitPriceMdram: 12_400, taxRateBp: 2000, discountAmount: 0 },
      ],
      0, "INCLUSIVE", 1,
    );
    expect(r.lines.map((l) => l.lineTax)).toEqual([lineTax(1200, 2000, "INCLUSIVE"), lineTax(37, 2000, "INCLUSIVE")]);
    expect(r.lines[0].lineTax).toBe(200);
    expect(r.total).toBe(1237);
  });

  it("puts cash rounding on its own line", () => {
    const r = computeSale([{ qty: 1000, unitPriceMdram: 1_234_000, taxRateBp: 0, discountAmount: 0 }], 0, "INCLUSIVE", 10);
    expect(r.total).toBe(1230);
    expect(r.roundingAdjustment).toBe(-4);
  });

  it("rejects a float quantity and an over-sized discount", () => {
    expect(() => computeSale([{ qty: 2.5, unitPriceMdram: 1, taxRateBp: 0, discountAmount: 0 }], 0, "INCLUSIVE", 1)).toThrow(SaleMathError);
    expect(() => computeSale([{ qty: 1000, unitPriceMdram: 1000, taxRateBp: 0, discountAmount: 2 }], 0, "INCLUSIVE", 1)).toThrow(SaleMathError);
  });

  it("measures a price override as a discount against the catalogue (§12.1)", () => {
    expect(effectiveLineDiscount(2000, 1_200_000, { qty: 2000, unitPriceMdram: 900_000, taxRateBp: 0, discountAmount: 0 })).toBe(600);
  });
});
