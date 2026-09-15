/**
 * Sale arithmetic. PRD §10.1, §10.8, §12.1, §15.3.
 *
 * The till displays what this computes and the server recomputes it on every
 * `POST /sales`; a disagreement between the two is a 400 precisely because they are the
 * same function. Nothing else in the tree may total a sale.
 *
 * Conventions this module fixes, because §11's field list leaves them implicit:
 * - `lineTotal` is the line after its own discount: round(qty × unitPrice) − discountAmount.
 * - `discountTotal` on the sale is the **sale-level** discount only. Line discounts are
 *   already inside `lineTotal`, so counting them again would break the identity.
 * - A sale-level discount is apportioned across lines by value (§10.1's remainder rule) so
 *   each line's tax is extracted from what was actually paid for it.
 */
import { apportionByValue, cashRounding, lineTotal as grossLineTotal, type Bps, type Dram, type MilliDram, type MilliUnit } from "./money.ts";
import { lineTax } from "./tax.ts";
import type { PriceBasis } from "./enums.ts";

export interface SaleLineInput {
  qty: MilliUnit;
  unitPriceMdram: MilliDram;
  taxRateBp: Bps;
  /** Whole drams off this line. 0 ≤ d ≤ gross line total. */
  discountAmount: Dram;
}

export interface SaleLineResult {
  gross: Dram;
  lineTotal: Dram;
  /** This line's share of the sale-level discount. */
  saleDiscountShare: Dram;
  lineTax: Dram;
}

export interface SaleTotals {
  lines: SaleLineResult[];
  subtotal: Dram;
  discountTotal: Dram;
  taxTotal: Dram;
  roundingAdjustment: Dram;
  total: Dram;
}

export class SaleMathError extends Error {}

export function computeSale(
  lines: readonly SaleLineInput[],
  saleDiscount: Dram,
  basis: PriceBasis,
  cashRoundingStep: number,
): SaleTotals {
  const partial = lines.map((l) => {
    if (!Number.isInteger(l.qty) || l.qty <= 0) throw new SaleMathError("qty must be a positive integer");
    if (!Number.isInteger(l.unitPriceMdram) || l.unitPriceMdram < 0) throw new SaleMathError("price must be a non-negative integer");
    const gross = grossLineTotal(l.qty, l.unitPriceMdram);
    if (!Number.isInteger(l.discountAmount) || l.discountAmount < 0 || l.discountAmount > gross) {
      throw new SaleMathError("line discount out of range");
    }
    return { gross, lineTotal: gross - l.discountAmount };
  });
  const subtotal = partial.reduce((a, l) => a + l.lineTotal, 0);
  if (!Number.isInteger(saleDiscount) || saleDiscount < 0 || saleDiscount > subtotal) {
    throw new SaleMathError("sale discount out of range");
  }
  const shares = apportionByValue(partial.map((l) => l.lineTotal), saleDiscount);
  const results: SaleLineResult[] = partial.map((l, i) => ({
    ...l,
    saleDiscountShare: shares[i],
    lineTax: lineTax(l.lineTotal - shares[i], lines[i].taxRateBp, basis),
  }));
  const taxTotal = results.reduce((a, l) => a + l.lineTax, 0);
  const beforeRounding = subtotal - saleDiscount + (basis === "EXCLUSIVE" ? taxTotal : 0);
  const { rounded, adjustment } = cashRounding(beforeRounding, cashRoundingStep);
  return { lines: results, subtotal, discountTotal: saleDiscount, taxTotal, roundingAdjustment: adjustment, total: rounded };
}

/**
 * Effective discount a line carries against the catalogue price, in drams. A price
 * override is a discount and is capped as one (§12.1).
 */
export function effectiveLineDiscount(qty: MilliUnit, catalogueMdram: MilliDram, line: SaleLineInput): Dram {
  const catalogueGross = grossLineTotal(qty, catalogueMdram);
  const charged = grossLineTotal(qty, line.unitPriceMdram) - line.discountAmount;
  return Math.max(0, catalogueGross - charged);
}
