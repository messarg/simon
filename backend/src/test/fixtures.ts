/** Builders for selling tests: products with stock, open shifts, and sale bodies whose totals are right. */
import request from "supertest";
import { computeSale, uuidv7, type PriceBasis, type Role, type SaleBody } from "@simon/shared";
import { createProduct } from "../services/product.service.ts";
import { postMovement } from "../services/stock-ledger.service.ts";
import { bearer, type TestApp } from "./app.ts";

export interface FixtureProduct { id: string; name: string; sellPriceMdram: number; stockUom: string; decimalPlaces: number }

export async function makeProduct(t: TestApp, opts: { name: string; priceDram: number; decimalPlaces?: number; uom?: string; stock?: number; costMdram?: number | null; barcode?: string }): Promise<FixtureProduct> {
  const p = await createProduct(t.db, t.users.ADMIN.id, {
    id: uuidv7(), name: opts.name, sellPriceMdram: opts.priceDram * 1000, stockUom: opts.uom ?? "հատ", decimalPlaces: opts.decimalPlaces ?? 0, barcode: opts.barcode ?? null,
  });
  if (opts.stock) {
    await t.db.$transaction((tx) => postMovement(tx, {
      productId: p.id, type: opts.costMdram == null ? "OPENING_BALANCE" : "PURCHASE_RECEIPT", qtyDelta: opts.stock!, unitCostMdram: opts.costMdram ?? null,
      source: { type: "Test", id: p.id }, userId: t.users.ADMIN.id,
    }));
  }
  return p;
}

export async function openShift(t: TestApp, role: Role, openingFloat = 20_000, token = t.tokens[role]) {
  const id = uuidv7();
  const res = await request(t.server).post("/api/shifts").set(bearer(token)).send({ id, openingFloat });
  if (res.status !== 201) throw new Error(`open shift failed ${res.status} ${JSON.stringify(res.body)}`);
  return id;
}

let seq = 0;

export function saleBody(opts: {
  shiftId: string;
  lines: Array<{ product: FixtureProduct; qty: number; unitPriceMdram?: number; discountAmount?: number; priceOverridden?: boolean; taxRateBp?: number }>;
  payments?: Array<{ method: "CASH" | "CARD" | "DEBT"; amount?: number; tenderedAmount?: number }>;
  customerId?: string;
  limitGrant?: string;
  limitReason?: string;
  dueDate?: string;
  status?: "HELD" | "COMPLETED";
  saleDiscount?: number;
  basis?: PriceBasis;
  rounding?: number;
  queued?: boolean;
  prefix?: string;
  id?: string;
  overrideReason?: string;
  reauthGrant?: string;
  createdAt?: string;
}): SaleBody {
  const basis = opts.basis ?? "INCLUSIVE";
  const lines = opts.lines.map((l) => ({
    id: uuidv7(), productId: l.product.id, qty: l.qty, uom: l.product.stockUom, factorToStockUom: 1,
    unitPriceMdram: l.unitPriceMdram ?? l.product.sellPriceMdram, taxRateBp: l.taxRateBp ?? 2000, discountAmount: l.discountAmount ?? 0,
    priceOverridden: l.priceOverridden ?? false, lineTotal: 0,
  }));
  const totals = computeSale(lines, opts.saleDiscount ?? 0, basis, opts.rounding ?? 1);
  lines.forEach((l, i) => { l.lineTotal = totals.lines[i].lineTotal; });
  const status = opts.status ?? "COMPLETED";
  const payments = status === "HELD" ? [] : (opts.payments ?? [{ method: "CASH" as const }]).map((p, i, all) => {
    const amount = p.amount ?? totals.total - all.slice(0, i).reduce((a, x) => a + (x.amount ?? 0), 0);
    return { id: uuidv7(), method: p.method, amount, tenderedAmount: p.method === "CASH" ? (p.tenderedAmount ?? amount) : null };
  });
  const now = new Date().toISOString();
  return {
    id: opts.id ?? uuidv7(), status, shiftId: opts.shiftId, number: status === "COMPLETED" ? `${opts.prefix ?? "AA"}-${++seq}` : null, 
    priceBasis: basis, cashRoundingStep: opts.rounding ?? 1, saleDiscount: opts.saleDiscount ?? 0, discountReason: null,
    lines, payments, total: totals.total, createdAt: opts.createdAt ?? now, sentAt: now, queued: opts.queued ?? false,
    reauthGrant: opts.reauthGrant ?? null, overrideReason: opts.overrideReason ?? null,
    customerId: opts.customerId ?? null, limitGrant: opts.limitGrant ?? null, limitReason: opts.limitReason ?? null, dueDate: opts.dueDate ?? null,
  };
}

export const post = (t: TestApp, path: string, body: unknown, role: Role = "WORKER", token?: string) =>
  request(t.server).post(`/api${path}`).set(bearer(token ?? t.tokens[role])).send(body as object);
export const get = (t: TestApp, path: string, role: Role = "WORKER") => request(t.server).get(`/api${path}`).set(bearer(t.tokens[role]));

export async function makeCustomer(t: TestApp, fullName: string, phone: string | null = null, role: Role = "WORKER") {
  const res = await request(t.server).post("/api/customers").set(bearer(t.tokens[role])).send({ id: uuidv7(), fullName, phone });
  if (res.status !== 201) throw new Error(`customer failed ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: string; fullName: string };
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** A charge with its original date, as an opening-debt import writes one (§19.1). */
export async function backdatedCharge(t: TestApp, customerId: string, amount: number, days: number) {
  const id = uuidv7();
  await t.db.debtEntry.create({ data: { id, customerId, type: "CHARGE", amount, createdAt: daysAgo(days), userId: t.users.ADMIN.id } });
  return id;
}

export function repayment(customerId: string, amount: number, method: "CASH" | "CARD", shiftId: string | null, queued = false) {
  return { id: uuidv7(), customerId, amount, method, shiftId, createdAt: new Date().toISOString(), queued };
}
