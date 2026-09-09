/**
 * Money and quantity arithmetic. PRD §10.1–10.2.
 *
 * The single implementation used by BOTH the server and the till. This file existing
 * exactly once is the reason Simon is a monorepo: two copies of these rules drift, and a
 * till that displays a total the server did not compute is the bug class this prevents.
 *
 * Nothing here uses floating point for a monetary value.
 */

/** Whole drams. What actually changes hands. */
export type Dram = number;
/** Dram x 1000. Unit prices and costs need sub-dram resolution so weighted averages
 *  do not accumulate rounding drift across restocks. */
export type MilliDram = number;
/** Quantity x 1000. 2.5 kg is 2500; 3 pieces is 3000. */
export type MilliUnit = number;
/** Percent x 100. 20% is 2000. */
export type Bps = number;

export const DRAM_SCALE = 1000;
export const QTY_SCALE = 1000;
export const BPS_SCALE = 10_000;

/**
 * Half-up division of integers, applied to the absolute value so a return of 12.5
 * rounds to the same magnitude as the sale of 12.5. Banker's rounding is wrong here:
 * a partial return must mirror its sale exactly or it leaves a one-dram ghost balance
 * that nobody can explain.
 */
export function roundHalfUp(numerator: number, denominator: number): number {
  if (denominator <= 0) throw new RangeError("denominator must be positive");
  const sign = numerator < 0 ? -1 : 1;
  return sign * Math.floor((Math.abs(numerator) + denominator / 2) / denominator);
}

/**
 * Line total in whole drams. Rounds exactly once, here — never on a unit price, a
 * factor, or an intermediate product (PRD §10.1).
 */
export function lineTotal(qty: MilliUnit, unitPrice: MilliDram): Dram {
  return roundHalfUp(qty * unitPrice, QTY_SCALE * DRAM_SCALE);
}

/** Apply a basis-point rate to a dram amount (discount, tax on a net amount). */
export function applyBps(amount: Dram, rate: Bps): Dram {
  return roundHalfUp(amount * rate, BPS_SCALE);
}

/**
 * Split a tax-inclusive gross into net + tax so that net + tax === gross exactly.
 * Extract then subtract; computing both independently leaves off-by-one drams on
 * roughly half of all receipts.
 */
export function splitInclusiveTax(gross: Dram, rate: Bps): { net: Dram; tax: Dram } {
  const net = roundHalfUp(gross * BPS_SCALE, BPS_SCALE + rate);
  return { net, tax: gross - net };
}

/**
 * Moving weighted average cost after a receipt (PRD §10.5). Landed cost must already
 * be apportioned into `receiptUnitCost` — ignoring it systematically overstates margin.
 */
export function newAverageCost(
  stockQty: MilliUnit,
  currentAvg: MilliDram,
  receivedQty: MilliUnit,
  receiptUnitCost: MilliDram,
): MilliDram {
  const totalQty = stockQty + receivedQty;
  if (totalQty <= 0) return receiptUnitCost;
  if (stockQty <= 0) return receiptUnitCost;
  return roundHalfUp(stockQty * currentAvg + receivedQty * receiptUnitCost, totalQty);
}

/**
 * Apportion a receipt-level cost (delivery, duty) across lines by value. The result
 * MUST sum to `cost` exactly; the rounding remainder goes to the largest line rather
 * than vanishing.
 */
export function apportionByValue(lineValues: readonly Dram[], cost: Dram): Dram[] {
  const total = lineValues.reduce((a, b) => a + b, 0);
  if (lineValues.length === 0) return [];
  if (total <= 0) {
    // No value to weight by: spread evenly, remainder to the first line.
    const each = Math.floor(cost / lineValues.length);
    const out = lineValues.map(() => each);
    out[0] += cost - each * lineValues.length;
    return out;
  }
  const out = lineValues.map((v) => roundHalfUp(v * cost, total));
  const drift = cost - out.reduce((a, b) => a + b, 0);
  if (drift !== 0) {
    let largest = 0;
    for (let i = 1; i < lineValues.length; i++) {
      if (lineValues[i] > lineValues[largest]) largest = i;
    }
    out[largest] += drift;
  }
  return out;
}

/** Round a cash total to the nearest `step` drams. Returns the adjustment, which is
 *  recorded as its own visible line so the receipt always adds up (PRD §10.1). */
export function cashRounding(total: Dram, step: number): { rounded: Dram; adjustment: Dram } {
  if (step <= 1) return { rounded: total, adjustment: 0 };
  const rounded = roundHalfUp(total, step) * step;
  return { rounded, adjustment: rounded - total };
}

/** Convert a purchase quantity into stock units (PRD §10.3). */
export function toStockQty(purchaseQty: MilliUnit, unitsPerPurchaseUnit: number): MilliUnit {
  return purchaseQty * unitsPerPurchaseUnit;
}

/** Display only. Never feed the output of a formatter back into arithmetic. */
export function formatDram(amount: Dram): string {
  return `${new Intl.NumberFormat("hy-AM").format(amount)} ֏`;
}

export function formatQty(qty: MilliUnit, decimalPlaces: number): string {
  return (qty / QTY_SCALE).toFixed(decimalPlaces);
}

/** Parse keypad digits into milli-units. Rejects more precision than the unit allows. */
export function parseQty(input: string, decimalPlaces: number): MilliUnit | null {
  if (!/^\d*(\.\d*)?$/.test(input) || input === "" || input === ".") return null;
  const [whole, frac = ""] = input.split(".");
  if (frac.length > decimalPlaces) return null;
  return Number(whole) * QTY_SCALE + Number(frac.padEnd(3, "0").slice(0, 3));
}
