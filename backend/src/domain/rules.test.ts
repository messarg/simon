import { describe, expect, it } from "vitest";
import { evaluateDiscount } from "./discount-cap.ts";
import { decideDrawerOpen } from "./drawer.ts";
import { afterAttempt, DeviceRateLimiter, isLocked, type LockState } from "./pin-policy.ts";
import { computeReturn, type OriginalSale } from "./returns.ts";
import { countedTotal, expectedCash, needsVarianceNote } from "./shift-cash.ts";

describe("returns", () => {
  it("§27.27 — a 10% discounted basket refunds the discounted share", () => {
    const sale: OriginalSale = {
      priceBasis: "INCLUSIVE", discountTotal: 10_000, roundingAdjustment: 0, total: 90_000,
      lines: [{ id: "a", qty: 1000, lineTotal: 80_000, lineTax: 0, taxRateBp: 0 }, { id: "b", qty: 1000, lineTotal: 20_000, lineTax: 0, taxRateBp: 0 }],
      payments: [{ method: "CASH", amount: 90_000 }],
    };
    const r = computeReturn(sale, [{ saleLineId: "b", qty: 1000, alreadyReturned: 0 }]);
    expect(r.total).toBe(18_000);
    expect(r.lines[0].discountShare).toBe(2_000);
  });

  it("§27.26 — 30 000 cash + 20 000 nisya, 25 000 returned, refunds 15 000 + 10 000", () => {
    const sale: OriginalSale = {
      priceBasis: "INCLUSIVE", discountTotal: 0, roundingAdjustment: 0, total: 50_000,
      lines: [{ id: "a", qty: 2000, lineTotal: 50_000, lineTax: 8_333, taxRateBp: 2000 }],
      payments: [{ method: "CASH", amount: 30_000 }, { method: "DEBT", amount: 20_000 }],
    };
    const r = computeReturn(sale, [{ saleLineId: "a", qty: 1000, alreadyReturned: 0 }]);
    expect(r.total).toBe(25_000);
    expect(r.tenders).toEqual([{ method: "CASH", amount: 15_000 }, { method: "DEBT_REDUCTION", amount: 10_000 }]);
    expect(r.lines[0].lineTax).toBe(4_167);
  });

  it("flags a line returned beyond what is left (per line, not per sale)", () => {
    const sale: OriginalSale = {
      priceBasis: "INCLUSIVE", discountTotal: 0, roundingAdjustment: 0, total: 1000,
      lines: [{ id: "a", qty: 2000, lineTotal: 1000, lineTax: 0, taxRateBp: 0 }], payments: [{ method: "CASH", amount: 1000 }],
    };
    expect(computeReturn(sale, [{ saleLineId: "a", qty: 1000, alreadyReturned: 1000 }]).lines[0].exceedsSold).toBe(false);
    expect(computeReturn(sale, [{ saleLineId: "a", qty: 1500, alreadyReturned: 1000 }]).lines[0].exceedsSold).toBe(true);
  });
});

describe("shift cash — §12.5", () => {
  it("counts refunds and repayments once, and NO_SALE not at all", () => {
    expect(expectedCash({
      openingFloat: 20_000, cashSales: 100_000,
      movements: [{ type: "REPAYMENT", amount: 5_000 }, { type: "PAY_IN", amount: 1_000 }, { type: "REFUND", amount: 8_000 }, { type: "PAY_OUT", amount: 2_000 }, { type: "DROP", amount: 50_000 }, { type: "NO_SALE", amount: 0 }],
    })).toBe(66_000);
  });
  it("totals the denomination counter and prompts a note at the threshold (§27.7)", () => {
    expect(countedTotal([{ value: 5000, count: 30 }, { value: 1000, count: 32 }, { value: 500, count: 9 }, { value: 100, count: 5 }])).toBe(187_000);
    expect(needsVarianceNote(-500, 500)).toBe(true);
    expect(needsVarianceNote(-499, 500)).toBe(false);
  });
});

describe("discount cap — §15.3", () => {
  const base = { base: 10_000, maxBp: 500, offlineCeilingBp: 1000, reauthorised: false };
  it("is a 422 online, a flag from the queue up to the ceiling, refused above it", () => {
    expect(evaluateDiscount({ ...base, discount: 500, drained: false })).toBe("ok");
    expect(evaluateDiscount({ ...base, discount: 800, drained: false })).toBe("reject-cap");
    expect(evaluateDiscount({ ...base, discount: 800, drained: true })).toBe("flag");
    expect(evaluateDiscount({ ...base, discount: 1_500, drained: true })).toBe("reject-ceiling");
    expect(evaluateDiscount({ ...base, discount: 1_500, drained: false, reauthorised: true })).toBe("ok");
  });
});

describe("cash drawer — §15.4", () => {
  it("opens free once per cash document and during counting; otherwise a no-sale open", () => {
    expect(decideDrawerOpen({ document: { kind: "sale", hasCash: true }, alreadySpent: false, shiftCounting: false })).toBe("free");
    expect(decideDrawerOpen({ document: { kind: "sale", hasCash: true }, alreadySpent: true, shiftCounting: false })).toBe("no-sale");
    expect(decideDrawerOpen({ document: { kind: "sale", hasCash: false }, alreadySpent: false, shiftCounting: false })).toBe("no-sale");
    expect(decideDrawerOpen({ document: { kind: "none" }, alreadySpent: false, shiftCounting: true })).toBe("free");
  });
});

describe("PIN policy — §27.39", () => {
  const now = new Date("2026-09-15T10:00:00Z");
  it("four wrong PINs leave the worker able to sign in; the fifth locks for 15 minutes", () => {
    let s: LockState = { failedAttempts: 0, lockedUntil: null };
    for (let i = 0; i < 4; i++) s = afterAttempt(s, false, now);
    expect(isLocked(s, now)).toBe(false);
    s = afterAttempt(s, false, now);
    expect(isLocked(s, now)).toBe(true);
    expect(isLocked(s, new Date(now.getTime() + 15 * 60_000 + 1))).toBe(false);
  });
  it("rate limits per device at 10 a minute", () => {
    const rl = new DeviceRateLimiter();
    for (let i = 0; i < 10; i++) expect(rl.take("d", 0)).toBe(0);
    expect(rl.take("d", 1000)).toBeGreaterThan(0);
    expect(rl.take("other", 1000)).toBe(0);
  });
});
