/**
 * Sale-return arithmetic. PRD §12.4, §10.7, §27.6, §27.26, §27.27.
 *
 * A returned line refunds its share of what was actually paid — after its sale-level
 * discount share — at the original rate and basis. The refund splits across the original
 * tenders pro-rata. Every apportionment rounds once and gives the remainder to the largest.
 */
import { apportionByValue, roundHalfUp, type Dram, type MilliUnit } from "./money.ts";
import type { PaymentMethod, ReturnTenderMethod } from "./enums.ts";

export interface OriginalLine {
  id: string;
  qty: MilliUnit;
  lineTotal: Dram;
  lineTax: Dram;
  taxRateBp: number;
}

export interface OriginalSale {
  priceBasis: "INCLUSIVE" | "EXCLUSIVE";
  discountTotal: Dram;
  roundingAdjustment: Dram;
  total: Dram;
  lines: readonly OriginalLine[];
  /** Applied amounts (tendered less change), in id order. */
  payments: ReadonlyArray<{ method: PaymentMethod; amount: Dram }>;
}

export interface ReturnRequestLine {
  saleLineId: string;
  qty: MilliUnit;
  alreadyReturned: MilliUnit;
}

export interface ReturnLineResult {
  saleLineId: string;
  qty: MilliUnit;
  discountShare: Dram;
  lineTax: Dram;
  refundAmount: Dram;
  exceedsSold: boolean;
}

export interface ReturnResult {
  lines: ReturnLineResult[];
  total: Dram;
  tenders: Array<{ method: ReturnTenderMethod; amount: Dram }>;
}

const TENDER_FOR: Record<PaymentMethod, ReturnTenderMethod> = { CASH: "CASH", CARD: "CARD", DEBT: "DEBT_REDUCTION", TRANSFER: "CARD" };

export function computeReturn(sale: OriginalSale, request: readonly ReturnRequestLine[]): ReturnResult {
  const saleShares = apportionByValue(sale.lines.map((l) => l.lineTotal), sale.discountTotal);
  const byId = new Map(sale.lines.map((l, i) => [l.id, { line: l, saleShare: saleShares[i] }]));

  const lines = request.map((r) => {
    const found = byId.get(r.saleLineId);
    if (!found) throw new RangeError(`sale line ${r.saleLineId} is not on this sale`);
    if (!Number.isInteger(r.qty) || r.qty <= 0) throw new RangeError("return qty must be a positive integer");
    const { line, saleShare } = found;
    const discountShare = roundHalfUp(saleShare * r.qty, line.qty);
    const lineTax = roundHalfUp(line.lineTax * r.qty, line.qty);
    const paid = line.lineTotal - saleShare + (sale.priceBasis === "EXCLUSIVE" ? line.lineTax : 0);
    const refundAmount = roundHalfUp(paid * r.qty, line.qty);
    return {
      saleLineId: r.saleLineId, qty: r.qty, discountShare, lineTax, refundAmount,
      exceedsSold: r.qty + r.alreadyReturned > line.qty,
    };
  });

  const refunded = lines.reduce((a, l) => a + l.refundAmount, 0);
  const beforeRounding = sale.total - sale.roundingAdjustment;
  const rounding = beforeRounding > 0 ? roundHalfUp(sale.roundingAdjustment * refunded, beforeRounding) : 0;
  const total = refunded + rounding;

  const tenders = apportionByValue(sale.payments.map((p) => p.amount), total)
    .map((amount, i) => ({ method: TENDER_FOR[sale.payments[i].method], amount }))
    .filter((t) => t.amount > 0);
  return { lines, total, tenders };
}
