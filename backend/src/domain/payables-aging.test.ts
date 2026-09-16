import { describe, expect, it } from "vitest";
import { agePayables, payablesBand } from "./payables-aging.ts";

describe("payables aging — §20.2", () => {
  it("puts each boundary day in exactly one band", () => {
    expect([0, 1, 30, 31, 60, 61, 90, 91].map(payablesBand)).toEqual(["notYetDue", "d1_30", "d1_30", "d31_60", "d31_60", "d61_90", "d61_90", "d90plus"]);
    expect(payablesBand(-12)).toBe("notYetDue");
  });

  it("sums only what is still unpaid", () => {
    expect(agePayables([{ unpaid: 5_000, daysPastDue: -3 }, { unpaid: 2_000, daysPastDue: 45 }, { unpaid: 0, daysPastDue: 120 }, { unpaid: 700, daysPastDue: 120 }]))
      .toEqual({ notYetDue: 5_000, d1_30: 0, d31_60: 2_000, d61_90: 0, d90plus: 700 });
  });
});
