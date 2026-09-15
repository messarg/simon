/**
 * Completing and parking a basket. PRD §12.1, §14.4.
 *
 * Both write to the outbox and return at once — the UI never awaits the network. The counter
 * checks (tax regime, shift, strict stock, the discount cap) happen before this is called,
 * from cached settings, because the queue must not be where a sale is refused (§14.4).
 */
import { uuidv7, type ClientSettings, type SaleBody } from "@simon/shared";
import { adjustCachedStock } from "@/lib/catalogue.ts";
import { nextReceiptNumber } from "@/lib/device.ts";
import { money } from "@/lib/format.ts";
import { outbox } from "@/lib/outbox.ts";
import { basketStore, basketTotals, type Basket } from "./basket.ts";

export interface TenderInput {
  method: "CASH" | "CARD";
  amount: number;
  tenderedAmount?: number;
}

function bodyFor(basket: Basket, settings: ClientSettings, shiftId: string, status: "HELD" | "COMPLETED", number: string | null, payments: TenderInput[]): SaleBody {
  const totals = basketTotals(basket, settings);
  const now = new Date().toISOString();
  return {
    id: basket.id, status, shiftId, number, customerId: null, priceBasis: settings.priceBasis, cashRoundingStep: settings.cashRoundingStep,
    saleDiscount: totals.discountTotal, discountReason: basket.discountReason,
    lines: basket.lines.map((l, i) => ({
      id: l.id, productId: l.productId, qty: l.qty, uom: l.uom, factorToStockUom: l.factorToStockUom, unitPriceMdram: l.unitPriceMdram,
      taxRateBp: l.taxRateBp, discountAmount: l.discountAmount, discountReason: null, priceOverridden: l.priceOverridden, lineTotal: totals.lines[i].lineTotal,
    })),
    payments: payments.map((p) => ({ id: uuidv7(), method: p.method, amount: p.amount, tenderedAmount: p.method === "CASH" ? (p.tenderedAmount ?? p.amount) : null })),
    total: totals.total, createdAt: basket.createdAt, sentAt: now, queued: false,
    reauthGrant: basket.reauthGrant, overrideReason: basket.overrideReason,
  };
}

export async function completeSale(basket: Basket, settings: ClientSettings, shiftId: string, payments: TenderInput[]) {
  const number = await nextReceiptNumber();
  const body = bodyFor(basket, settings, shiftId, "COMPLETED", number, payments);
  const change = payments.filter((p) => p.method === "CASH").reduce((a, p) => a + ((p.tenderedAmount ?? p.amount) - p.amount), 0);
  await outbox.enqueue("sale", basket.id, body, {
    afterSync: { print: true, drawer: payments.some((p) => p.method === "CASH") },
    label: `№ ${number} · ${money(body.total)}`,
  });
  await adjustCachedStock(basket.lines.filter((l) => l.trackStock).map((l) => ({ productId: l.productId, delta: -(l.qty * l.factorToStockUom) })));
  basketStore.clear();
  return { id: body.id, number, total: body.total, change };
}

export async function holdBasket(basket: Basket, settings: ClientSettings, shiftId: string) {
  const body = bodyFor(basket, settings, shiftId, "HELD", null, []);
  await outbox.enqueue("sale", basket.id, body, { isParkedBasket: true, label: `${basket.lines[0]?.name ?? ""} · ${money(body.total)}` });
  basketStore.clear();
}
