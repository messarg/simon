import { describe, expect, it } from "vitest";
import {
  apportionByValue, applyBps, cashRounding, formatQty, lineTotal,
  newAverageCost, parseQty, roundHalfUp, splitInclusiveTax, toStockQty,
} from "./money.ts";

describe("roundHalfUp", () => {
  it("rounds .5 away from zero, symmetrically", () => {
    expect(roundHalfUp(5, 2)).toBe(3);
    expect(roundHalfUp(-5, 2)).toBe(-3); // a return must mirror its sale exactly
    expect(roundHalfUp(4, 2)).toBe(2);
    expect(roundHalfUp(0, 2)).toBe(0);
  });
});

describe("lineTotal", () => {
  it("handles decimal quantities exactly", () => {
    // 2.5 kg at 1,200 -> 3,000. The float path (2.5 * 1200) is fine here, but
    // 0.1 + 0.2 style drift is what this representation exists to avoid.
    expect(lineTotal(2500, 1_200_000)).toBe(3000);
    expect(lineTotal(10_000, 50_000)).toBe(500);
  });

  it("rounds once, at the line total", () => {
    // 3 pieces at 12.4 dram: 37.2 -> 37, not 3 x 12 = 36.
    expect(lineTotal(3000, 12_400)).toBe(37);
  });
});

describe("splitInclusiveTax", () => {
  it("always reconciles: net + tax === gross", () => {
    for (let gross = 0; gross <= 2000; gross++) {
      const { net, tax } = splitInclusiveTax(gross, 2000);
      expect(net + tax).toBe(gross);
    }
  });
});

describe("apportionByValue", () => {
  it("sums exactly to the input cost, remainder to the largest line", () => {
    const out = apportionByValue([100, 100, 100], 10);
    expect(out.reduce((a, b) => a + b, 0)).toBe(10);
  });

  it("never loses a dram across awkward splits", () => {
    for (let cost = 0; cost <= 500; cost++) {
      const out = apportionByValue([333, 333, 334], cost);
      expect(out.reduce((a, b) => a + b, 0)).toBe(cost);
    }
  });

  it("spreads evenly when there is no value to weight by", () => {
    expect(apportionByValue([0, 0], 7).reduce((a, b) => a + b, 0)).toBe(7);
  });
});

describe("newAverageCost", () => {
  it("lands between the two input costs", () => {
    const avg = newAverageCost(10_000, 12_000, 10_000, 13_000);
    expect(avg).toBe(12_500);
  });

  it("takes the receipt cost when restocking from zero or negative", () => {
    expect(newAverageCost(0, 99_999, 5000, 12_000)).toBe(12_000);
    expect(newAverageCost(-1000, 99_999, 5000, 12_000)).toBe(12_000);
  });
});

describe("cashRounding", () => {
  it("keeps the receipt adding up", () => {
    const { rounded, adjustment } = cashRounding(2897, 10);
    expect(rounded).toBe(2900);
    expect(2897 + adjustment).toBe(rounded);
  });
});

describe("units", () => {
  it("converts purchase units to stock units", () => {
    // 3 spools of 50 m -> 150 m (PRD §25.3)
    expect(toStockQty(3000, 50)).toBe(150_000);
  });
});

describe("quantity input", () => {
  it("respects the product's precision", () => {
    expect(parseQty("2.5", 3)).toBe(2500);
    expect(parseQty("2.5", 0)).toBeNull(); // a piece count is not divisible
    expect(parseQty("", 3)).toBeNull();
    expect(parseQty("abc", 3)).toBeNull();
  });

  it("round-trips through display", () => {
    expect(formatQty(parseQty("2.5", 3)!, 1)).toBe("2.5");
  });
});

describe("applyBps", () => {
  it("computes a discount", () => {
    expect(applyBps(2900, 500)).toBe(145); // 5%
  });
});
