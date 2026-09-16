/**
 * Purchase orders. PRD §11 Lifecycles, §13.2, §13.3.
 *
 * `PARTIAL` and `RECEIVED` are derived from what receipts delivered, never set by hand. Turning a
 * reorder suggestion into an order is v2's half of §13.3: the suggestion says *when*, this says
 * *how much*, and the owner still decides whether to send it.
 */
import { QTY_SCALE, type MilliDram, type MilliUnit } from "@simon/shared";

export type PurchaseOrderStatus = "DRAFT" | "OPEN" | "PARTIAL" | "RECEIVED" | "CANCELLED";

/** Hand-set transitions only; the two receipt-driven ones go through `statusFromReceipts`. */
export function canTransition(from: PurchaseOrderStatus, to: PurchaseOrderStatus): boolean {
  if (to === "OPEN") return from === "DRAFT";
  if (to === "CANCELLED") return from === "DRAFT" || from === "OPEN";
  return false;
}

export function statusFromReceipts(current: PurchaseOrderStatus, lines: ReadonlyArray<{ qtyOrdered: MilliUnit; qtyReceived: MilliUnit }>): PurchaseOrderStatus {
  if (current !== "OPEN" && current !== "PARTIAL") return current;
  const anything = lines.some((l) => l.qtyReceived > 0);
  if (!anything) return "OPEN";
  // A short delivery leaves the order open for the rest; an over-delivery still completes it.
  return lines.every((l) => l.qtyReceived >= l.qtyOrdered) ? "RECEIVED" : "PARTIAL";
}

/** Only an order that was sent and not yet closed can be received against. */
export const receivable = (status: PurchaseOrderStatus) => status === "OPEN" || status === "PARTIAL";

/**
 * Receipt quantities spread over the order's lines for the same product, oldest line first, so two
 * lines of one product on one order both fill before either is over-filled.
 */
export function applyReceipt(
  lines: ReadonlyArray<{ id: string; productId: string; qtyOrdered: MilliUnit; qtyReceived: MilliUnit }>,
  received: ReadonlyArray<{ productId: string; qty: MilliUnit }>,
): Map<string, MilliUnit> {
  const next = new Map(lines.map((l) => [l.id, l.qtyReceived]));
  for (const r of received) {
    const candidates = lines.filter((l) => l.productId === r.productId);
    if (!candidates.length) continue;
    let left = r.qty;
    for (const l of candidates) {
      const room = Math.max(0, l.qtyOrdered - next.get(l.id)!);
      const take = Math.min(room, left);
      next.set(l.id, next.get(l.id)! + take);
      left -= take;
    }
    // Whatever the order did not ask for lands on its last line: delivered is delivered.
    if (left > 0) {
      const last = candidates[candidates.length - 1];
      next.set(last.id, next.get(last.id)! + left);
    }
  }
  return next;
}

export interface OrderSuggestionInput {
  stockQty: MilliUnit;
  /** The reorder point the owner set, or the suggested one (§13.3). */
  threshold: MilliUnit;
  /** The owner's own order quantity for this product, when set. */
  reorderQty: MilliUnit;
  avgDailyQty30d: MilliUnit;
  leadTimeDays: number;
  safetyDays: number;
  /** Stock already on its way: ordered and not yet received. */
  onOrder: MilliUnit;
  /** The purchase unit's size in stock units — an order is for whole packs. */
  packFactor: number;
}

/**
 * How much to order, in stock milli-units.
 *
 * The owner's `reorderQty` wins when set. Otherwise order enough to cover the threshold again on
 * top of it — lead time and safety days twice over — which is the smallest amount that does not
 * put the product straight back on the low-stock list the day it arrives. Stock already on order
 * counts as stock. Rounded up to whole purchase packs and whole stock units: nobody orders 0.3 of
 * a spool.
 */
export function suggestedOrderQty(p: OrderSuggestionInput): MilliUnit {
  const position = p.stockQty + p.onOrder;
  if (p.threshold <= 0 || position > p.threshold) return 0;
  const target = p.threshold + Math.max(p.threshold, p.avgDailyQty30d * (p.leadTimeDays + p.safetyDays));
  const raw = p.reorderQty > 0 ? p.reorderQty : target - position;
  if (raw <= 0) return 0;
  const pack = Math.max(1, p.packFactor) * QTY_SCALE;
  return Math.ceil(raw / pack) * pack;
}

/** The cost to expect on a new order line: what this supplier last charged, else the average. */
export function expectedUnitCost(lastInvoiceFromSupplier: MilliDram | null, avgCostMdram: MilliDram | null): MilliDram {
  return lastInvoiceFromSupplier ?? avgCostMdram ?? 0;
}
