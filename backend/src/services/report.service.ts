/**
 * The report catalogue. PRD §20.2 lists it once; this file implements that list and nothing else.
 * §6.10 owns presentation, so every report returns the same shape — columns, rows, totals — and the
 * screen renders and exports any of them without knowing which it is.
 *
 * Rows carry codes, not Armenian: the client holds the words (§4.2). Money is integer drams and
 * quantities milli-units, formatted only at the edge (§10.1).
 */
import { apportionByValue, businessDate, daysBetween, lineTotal, type Dram, type MovementType } from "@simon/shared";
import { agePayables } from "../domain/payables-aging.ts";
import type { Db } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { allProjections } from "./debt.service.ts";
import { marginReport } from "./margin.service.ts";
import { shiftFigures } from "./shift.service.ts";
import { readSettings } from "./settings.service.ts";
import { supplierBooks } from "./supplier.service.ts";
import { productStatuses } from "./stock-status.service.ts";

export const REPORT_NAMES = [
  "sales", "margin", "valuation", "debtor-aging", "payables-aging", "item-history",
  "z-reports", "discounts", "write-offs", "stock-turnover", "voids-returns", "cash-out",
  "movements-by-person", "cash-out-by-person", "audit",
] as const;
export type ReportName = (typeof REPORT_NAMES)[number];

export const SALES_GROUPINGS = ["day", "sale", "product", "category", "worker"] as const;
export type SalesGrouping = (typeof SALES_GROUPINGS)[number];

/** A report cell is a scalar, plus the one composite a screen needs: a margin row's corrections (§20.2). */
type Cell = string | number | null | ReadonlyArray<Record<string, unknown>>;

export interface ReportColumn {
  key: string;
  /** How the screen formats it, and how the CSV writes it. */
  kind: "text" | "code" | "money" | "qty" | "int" | "date" | "datetime" | "days" | "percent";
  /** For `code`: which set of Armenian labels the client should read it against. */
  codeSet?: string;
}

export interface ReportResult {
  name: ReportName;
  from: string;
  to: string;
  groupBy?: string;
  columns: ReportColumn[];
  rows: Array<Record<string, Cell>>;
  totals?: Record<string, number | null>;
  /** Resource keys the screen renders as footnotes, with their numbers. */
  notes?: Array<{ key: string; vars?: Record<string, string | number> }>;
}

export interface ReportParams {
  from: string;
  to: string;
  groupBy?: string;
  productId?: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
}

const sum = <T>(rows: readonly T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);
const byKeyDesc = (a: { sortKey: number }, b: { sortKey: number }) => b.sortKey - a.sortKey;

/** A wide `createdAt` window, narrowed by business date afterwards — the table stores an instant, the report asks for a shop day. */
const instantWindow = (from: string, to: string) => ({
  gte: new Date(Date.parse(`${from}T00:00:00Z`) - 86_400_000).toISOString(),
  lte: new Date(Date.parse(`${to}T00:00:00Z`) + 2 * 86_400_000).toISOString(),
});

export async function runReport(db: Db, name: ReportName, params: ReportParams): Promise<ReportResult> {
  const settings = await readSettings(db);
  const tz = settings["shop.timezone"];
  const ctx = { db, tz, ...params };
  switch (name) {
    case "sales": return salesReport(ctx);
    case "margin": return marginByProduct(ctx);
    case "valuation": return valuationReport(ctx);
    case "debtor-aging": return debtorAging(ctx);
    case "payables-aging": return payablesAging(ctx);
    case "item-history": return itemHistory(ctx);
    case "z-reports": return zReports(ctx);
    case "discounts": return discountsByWorker(ctx);
    case "write-offs": return writeOffsByReason(ctx);
    case "stock-turnover": return stockTurnover(ctx);
    case "voids-returns": return voidsAndReturns(ctx);
    case "cash-out": return cashOutByReason(ctx);
    case "movements-by-person": return movementsByPerson(ctx);
    case "cash-out-by-person": return cashOutByPerson(ctx);
    case "audit": return auditTrail(ctx);
  }
}

type Ctx = ReportParams & { db: Db; tz: string };

// ── Sales, by period, product, category or worker (and the sales themselves) ──

async function salesReport(c: Ctx): Promise<ReportResult> {
  const groupBy = (SALES_GROUPINGS as readonly string[]).includes(c.groupBy ?? "") ? (c.groupBy as SalesGrouping) : "day";
  // `userId` narrows every grouping to one person rather than changing the grouping (§6.11.1).
  const where = { status: "COMPLETED", businessDate: { gte: c.from, lte: c.to }, userId: c.userId };
  const [sales, returns, products, categories] = await Promise.all([
    c.db.sale.findMany({ where, include: { lines: { orderBy: { id: "asc" } }, user: { select: { name: true } }, payments: true } }),
    c.db.saleReturn.findMany({ where: { businessDate: { gte: c.from, lte: c.to }, userId: c.userId }, include: { lines: true, user: { select: { name: true } } } }),
    c.db.product.findMany({ select: { id: true, name: true, stockUom: true, decimalPlaces: true, categoryId: true } }),
    c.db.category.findMany({ select: { id: true, name: true } }),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const categoryName = new Map(categories.map((x) => [x.id, x.name]));

  if (groupBy === "product" || groupBy === "category") {
    type Row = { key: string; label: string; uom: string | null; decimalPlaces: number; qty: number; revenue: Dram; returnedQty: number; returned: Dram; sortKey: number };
    const rows = new Map<string, Row>();
    const rowFor = (key: string, label: string, uom: string | null, decimalPlaces: number) => {
      const existing = rows.get(key);
      if (existing) return existing;
      const created: Row = { key, label, uom, decimalPlaces, qty: 0, revenue: 0, returnedQty: 0, returned: 0, sortKey: 0 };
      rows.set(key, created);
      return created;
    };
    for (const sale of sales) {
      const shares = apportionByValue(sale.lines.map((l) => l.lineTotal), sale.discountTotal);
      for (const [i, l] of sale.lines.entries()) {
        const p = productById.get(l.productId);
        const key = groupBy === "product" ? l.productId : (p?.categoryId ?? "");
        const label = groupBy === "product" ? (p?.name ?? l.productName) : (categoryName.get(p?.categoryId ?? "") ?? "");
        const row = rowFor(key, label, groupBy === "product" ? (p?.stockUom ?? l.uom) : null, p?.decimalPlaces ?? 0);
        row.qty += l.qty * l.factorToStockUom;
        row.revenue += l.lineTotal - shares[i];
      }
    }
    for (const r of returns) {
      for (const l of r.lines) {
        const p = productById.get(l.productId);
        const key = groupBy === "product" ? l.productId : (p?.categoryId ?? "");
        const row = rowFor(key, groupBy === "product" ? (p?.name ?? "") : (categoryName.get(p?.categoryId ?? "") ?? ""), groupBy === "product" ? (p?.stockUom ?? null) : null, p?.decimalPlaces ?? 0);
        row.returnedQty += l.qty;
        row.returned += l.refundAmount;
      }
    }
    const out = [...rows.values()].map((r) => ({ ...r, net: r.revenue - r.returned, sortKey: r.revenue - r.returned })).sort(byKeyDesc);
    return {
      name: "sales", from: c.from, to: c.to, groupBy,
      columns: [
        { key: "label", kind: "text" }, ...(groupBy === "product" ? [{ key: "qty", kind: "qty" as const }] : []),
        { key: "revenue", kind: "money" }, { key: "returned", kind: "money" }, { key: "net", kind: "money" },
      ],
      rows: out.map(({ sortKey: _sortKey, ...r }) => ({ ...r, label: r.label || "—" })),
      // No quantity total: metres and pieces do not add up, and a number that cannot be read is worse than none (§10.3).
      totals: { qty: null, revenue: sum(out, (r) => r.revenue), returned: sum(out, (r) => r.returned), net: sum(out, (r) => r.net) },
    };
  }

  if (groupBy === "sale") {
    const rows = sales
      .map((s) => ({
        key: s.id, number: s.number, at: s.completedAt ?? s.createdAt, worker: s.user.name,
        items: s.lines.length, discount: s.discountTotal + sum(s.lines, (l) => l.discountAmount),
        methods: [...new Set(s.payments.map((p) => p.method))].join("+"), total: s.total,
        sortKey: Date.parse(s.completedAt ?? s.createdAt),
      }))
      .sort(byKeyDesc);
    return {
      name: "sales", from: c.from, to: c.to, groupBy,
      columns: [{ key: "at", kind: "datetime" }, { key: "number", kind: "text" }, { key: "worker", kind: "text" }, { key: "items", kind: "int" }, { key: "methods", kind: "text" }, { key: "discount", kind: "money" }, { key: "total", kind: "money" }],
      rows: rows.map(({ sortKey: _sortKey, ...r }) => r),
      totals: { discount: sum(rows, (r) => r.discount), total: sum(rows, (r) => r.total) },
    };
  }

  // day or worker
  type Group = { key: string; label: string; salesCount: number; gross: Dram; discount: Dram; returned: Dram };
  const groups = new Map<string, Group>();
  const groupFor = (key: string, label: string) => {
    const existing = groups.get(key);
    if (existing) return existing;
    const created: Group = { key, label, salesCount: 0, gross: 0, discount: 0, returned: 0 };
    groups.set(key, created);
    return created;
  };
  for (const s of sales) {
    const g = groupFor(groupBy === "day" ? s.businessDate : s.userId, groupBy === "day" ? s.businessDate : s.user.name);
    g.salesCount++;
    g.gross += s.total;
    g.discount += s.discountTotal + sum(s.lines, (l) => l.discountAmount);
  }
  for (const r of returns) groupFor(groupBy === "day" ? r.businessDate : r.userId, groupBy === "day" ? r.businessDate : r.user.name).returned += r.total;
  const rows = [...groups.values()]
    .map((g) => ({ ...g, net: g.gross - g.returned, sortKey: groupBy === "day" ? Date.parse(`${g.key}T00:00:00Z`) : g.gross }))
    .sort(byKeyDesc);
  return {
    name: "sales", from: c.from, to: c.to, groupBy,
    columns: [{ key: "label", kind: groupBy === "day" ? "date" : "text" }, { key: "salesCount", kind: "int" }, { key: "gross", kind: "money" }, { key: "discount", kind: "money" }, { key: "returned", kind: "money" }, { key: "net", kind: "money" }],
    rows: rows.map(({ sortKey: _sortKey, ...r }) => r),
    totals: { salesCount: sum(rows, (r) => r.salesCount), gross: sum(rows, (r) => r.gross), discount: sum(rows, (r) => r.discount), returned: sum(rows, (r) => r.returned), net: sum(rows, (r) => r.net) },
  };
}

// ── Margin by product, as booked and restated (§20.2, §10.5) ─────────────────

async function marginByProduct(c: Ctx): Promise<ReportResult> {
  const report = await marginReport(c.db, c.from, c.to);
  const corrected = report.items.some((i) => i.corrections.length > 0);
  const withoutCost = report.items.filter((i) => i.revenueWithoutCost > 0);
  return {
    name: "margin", from: c.from, to: c.to,
    columns: [
      { key: "productName", kind: "text" }, { key: "qtySold", kind: "qty" }, { key: "netRevenue", kind: "money" },
      { key: "cogsBooked", kind: "money" }, { key: "marginBooked", kind: "money" },
      ...(corrected ? [{ key: "cogsRestated", kind: "money" as const }, { key: "marginRestated", kind: "money" as const }] : []),
      { key: "revenueWithoutCost", kind: "money" },
    ],
    rows: report.items.map((i) => ({
      key: i.productId, productId: i.productId, corrections: i.corrections, productName: i.productName, qtySold: i.qtySold,
      uom: i.uom, decimalPlaces: i.decimalPlaces, netRevenue: i.netRevenue,
      cogsBooked: i.cogsBooked, marginBooked: i.marginBooked, cogsRestated: i.cogsRestated, marginRestated: i.marginRestated,
      revenueWithoutCost: i.revenueWithoutCost,
    })),
    totals: { netRevenue: report.totals.netRevenue, cogsBooked: report.totals.cogsBooked, marginBooked: report.totals.marginBooked, cogsRestated: report.totals.cogsRestated, marginRestated: report.totals.marginRestated, revenueWithoutCost: report.totals.revenueWithoutCost },
    notes: [
      ...(withoutCost.length ? [{ key: "noCostBasis", vars: { n: withoutCost.length } }] : []),
      ...report.items.flatMap((i) => i.corrections.map((x) => ({ key: "correction", vars: { product: i.productName, reason: x.reason } }))),
    ],
  };
}

// ── COGS and stock valuation at cost ─────────────────────────────────────────

async function valuationReport(c: Ctx): Promise<ReportResult> {
  const [products, soldLines] = await Promise.all([
    c.db.product.findMany({ where: { trackStock: 1 }, select: { id: true, name: true, stockUom: true, decimalPlaces: true, stockQty: true, avgCostMdram: true } }),
    c.db.saleLine.findMany({ where: { sale: { status: "COMPLETED", businessDate: { gte: c.from, lte: c.to } } }, select: { qty: true, unitCostMdram: true } }),
  ]);
  const rows = products
    .filter((p) => p.stockQty !== 0)
    .map((p) => ({
      key: p.id, productName: p.name, uom: p.stockUom, decimalPlaces: p.decimalPlaces, onHand: p.stockQty,
      avgCost: p.avgCostMdram === null ? null : Math.round(p.avgCostMdram / 1000),
      value: p.avgCostMdram === null ? null : lineTotal(p.stockQty, p.avgCostMdram),
      sortKey: p.avgCostMdram === null ? 0 : lineTotal(p.stockQty, p.avgCostMdram),
    }))
    .sort(byKeyDesc);
  const unknown = rows.filter((r) => r.value === null).length;
  return {
    name: "valuation", from: c.from, to: c.to,
    columns: [{ key: "productName", kind: "text" }, { key: "onHand", kind: "qty" }, { key: "avgCost", kind: "money" }, { key: "value", kind: "money" }],
    rows: rows.map(({ sortKey: _sortKey, ...r }) => r),
    totals: {
      value: sum(rows, (r) => r.value ?? 0),
      cogs: sum(soldLines, (l) => (l.unitCostMdram === null ? 0 : lineTotal(l.qty, l.unitCostMdram))),
    },
    notes: unknown ? [{ key: "noCostBasis", vars: { n: unknown } }] : [],
  };
}

// ── Debtor aging (§10.6) and payables aged against terms (§13.8) ─────────────

async function debtorAging(c: Ctx): Promise<ReportResult> {
  const [projections, customers] = await Promise.all([allProjections(c.db), c.db.customer.findMany({ select: { id: true, fullName: true, phone: true } })]);
  const nameOf = new Map(customers.map((x) => [x.id, x]));
  const rows = [...projections.entries()]
    .filter(([, p]) => p.outstanding > 0)
    .map(([id, p]) => ({
      key: id, customer: nameOf.get(id)?.fullName ?? "", phone: nameOf.get(id)?.phone ?? null, outstanding: p.outstanding,
      d0_30: p.buckets.d0_30, d31_60: p.buckets.d31_60, d61_90: p.buckets.d61_90, d90plus: p.buckets.d90plus,
      oldestDays: p.buckets.oldestChargeDays, sortKey: p.outstanding,
    }))
    .sort(byKeyDesc);
  const total = (k: "outstanding" | "d0_30" | "d31_60" | "d61_90" | "d90plus") => sum(rows, (r) => r[k]);
  return {
    name: "debtor-aging", from: c.from, to: c.to,
    columns: [{ key: "customer", kind: "text" }, { key: "phone", kind: "text" }, { key: "outstanding", kind: "money" }, { key: "d0_30", kind: "money" }, { key: "d31_60", kind: "money" }, { key: "d61_90", kind: "money" }, { key: "d90plus", kind: "money" }, { key: "oldestDays", kind: "days" }],
    rows: rows.map(({ sortKey: _sortKey, ...r }) => ({ ...r, customer: r.customer || "—" })),
    totals: { outstanding: total("outstanding"), d0_30: total("d0_30"), d31_60: total("d31_60"), d61_90: total("d61_90"), d90plus: total("d90plus") },
  };
}

async function payablesAging(c: Ctx): Promise<ReportResult> {
  const suppliers = await c.db.supplier.findMany({ select: { id: true, name: true, paymentTerms: true } });
  const rows: Array<{ key: string; supplier: string; terms: number; outstanding: Dram; notYetDue: Dram; d1_30: Dram; d31_60: Dram; d61_90: Dram; d90plus: Dram; sortKey: number }> = [];
  for (const s of suppliers) {
    const books = await supplierBooks(c.db, s.id);
    if (books.outstanding === 0 && books.receipts.every((r) => r.unpaid === 0)) continue;
    const bands = agePayables(books.receipts.map((r) => ({ unpaid: r.unpaid, daysPastDue: r.daysPastDue })));
    rows.push({ key: s.id, supplier: s.name, terms: s.paymentTerms, outstanding: books.outstanding, ...bands, sortKey: books.outstanding });
  }
  rows.sort(byKeyDesc);
  const total = (k: "outstanding" | "notYetDue" | "d1_30" | "d31_60" | "d61_90" | "d90plus") => sum(rows, (r) => r[k]);
  return {
    name: "payables-aging", from: c.from, to: c.to,
    columns: [{ key: "supplier", kind: "text" }, { key: "terms", kind: "days" }, { key: "outstanding", kind: "money" }, { key: "notYetDue", kind: "money" }, { key: "d1_30", kind: "money" }, { key: "d31_60", kind: "money" }, { key: "d61_90", kind: "money" }, { key: "d90plus", kind: "money" }],
    rows: rows.map(({ sortKey: _sortKey, ...r }) => r),
    totals: { outstanding: total("outstanding"), notYetDue: total("notYetDue"), d1_30: total("d1_30"), d31_60: total("d31_60"), d61_90: total("d61_90"), d90plus: total("d90plus") },
  };
}

// ── Item history: what changed, when and who (§20.2, §6.16) ──────────────────

async function itemHistory(c: Ctx): Promise<ReportResult> {
  if (!c.productId) throw problem("malformed-request", { field: "productId" });
  const product = await c.db.product.findUnique({ where: { id: c.productId }, select: { id: true, name: true, stockUom: true, decimalPlaces: true } });
  if (!product) throw problem("not-found");
  const [movements, prices, audits] = await Promise.all([
    c.db.stockMovement.findMany({ where: { productId: product.id }, orderBy: { seq: "desc" }, take: 200, include: { user: { select: { name: true } } } }),
    c.db.priceHistory.findMany({ where: { productId: product.id }, orderBy: { effectiveFrom: "desc" }, take: 50, include: { user: { select: { name: true } } } }),
    c.db.auditLog.findMany({ where: { entityType: "Product", entityId: product.id }, orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { name: true } } } }),
  ]);
  const rows = [
    ...movements.map((m) => ({ key: m.id, at: m.createdAt, what: m.type, change: m.qtyDelta, balance: m.balanceAfter, price: null as number | null, who: m.user.name, detail: m.reasonCode ?? m.note ?? "", sortKey: Date.parse(m.createdAt) })),
    ...prices.map((p) => ({ key: p.id, at: p.effectiveFrom, what: "PRICE_CHANGE", change: null as number | null, balance: null as number | null, price: Math.round(p.sellPriceMdram / 1000), who: p.user.name, detail: "", sortKey: Date.parse(p.effectiveFrom) })),
    ...audits.filter((a) => a.action !== "product.priceChange").map((a) => ({ key: a.id, at: a.createdAt, what: a.action, change: null as number | null, balance: null as number | null, price: null as number | null, who: a.user.name, detail: a.reason ?? "", sortKey: Date.parse(a.createdAt) })),
  ].sort(byKeyDesc);
  return {
    name: "item-history", from: c.from, to: c.to,
    columns: [{ key: "at", kind: "datetime" }, { key: "what", kind: "code", codeSet: "history" }, { key: "change", kind: "qty" }, { key: "balance", kind: "qty" }, { key: "price", kind: "money" }, { key: "who", kind: "text" }, { key: "detail", kind: "text" }],
    rows: rows.map(({ sortKey: _sortKey, ...r }) => ({ ...r, uom: product.stockUom, decimalPlaces: product.decimalPlaces })),
    notes: [{ key: "itemHistoryFor", vars: { product: product.name } }],
  };
}

// ── Shift Z-reports with variances ───────────────────────────────────────────

async function zReports(c: Ctx): Promise<ReportResult> {
  const window = instantWindow(c.from, c.to);
  const rows: Array<{ key: string; closedAt: string | null; worker: string; openingFloat: Dram; cashSales: Dram; cardSales: Dram; expected: Dram | null; counted: Dram | null; variance: Dram | null; unsynced: number; note: string }> = [];
  const shifts = (await c.db.shift.findMany({ where: { status: "CLOSED", closedAt: window, userId: c.userId }, include: { user: { select: { name: true } } }, orderBy: { closedAt: "desc" } }))
    .filter((s) => s.closedAt && businessDate(s.closedAt, c.tz) >= c.from && businessDate(s.closedAt, c.tz) <= c.to);
  for (const s of shifts) {
    const f = await shiftFigures(c.db, s.id);
    rows.push({
      key: s.id, closedAt: s.closedAt, worker: s.user.name, openingFloat: s.openingFloat, cashSales: f.cashSales, cardSales: f.cardSales,
      expected: s.expectedCash, counted: s.countedCash, variance: s.variance, unsynced: s.unsyncedAtClose, note: s.notes,
    });
  }
  return {
    name: "z-reports", from: c.from, to: c.to,
    columns: [{ key: "closedAt", kind: "datetime" }, { key: "worker", kind: "text" }, { key: "cashSales", kind: "money" }, { key: "cardSales", kind: "money" }, { key: "expected", kind: "money" }, { key: "counted", kind: "money" }, { key: "variance", kind: "money" }, { key: "note", kind: "text" }],
    rows,
    totals: { cashSales: sum(rows, (r) => r.cashSales), cardSales: sum(rows, (r) => r.cardSales), variance: sum(rows, (r) => r.variance ?? 0) },
  };
}

// ── Discount by worker, and voids and returns by worker (§20.2) ──────────────

async function discountsByWorker(c: Ctx): Promise<ReportResult> {
  const sales = await c.db.sale.findMany({ where: { status: "COMPLETED", businessDate: { gte: c.from, lte: c.to }, userId: c.userId }, include: { lines: true, user: { select: { name: true } } } });
  const groups = new Map<string, { key: string; worker: string; sales: number; discountedSales: number; discount: Dram; overrides: number }>();
  for (const s of sales) {
    const g = groups.get(s.userId) ?? { key: s.userId, worker: s.user.name, sales: 0, discountedSales: 0, discount: 0, overrides: 0 };
    const discount = s.discountTotal + sum(s.lines, (l) => l.discountAmount);
    g.sales++;
    if (discount > 0) g.discountedSales++;
    g.discount += discount;
    g.overrides += s.lines.filter((l) => l.priceOverridden === 1).length;
    groups.set(s.userId, g);
  }
  const rows = [...groups.values()].map((g) => ({ ...g, share: g.sales ? Math.round((g.discountedSales * 10_000) / g.sales) : 0, sortKey: g.discount })).sort(byKeyDesc);
  return {
    name: "discounts", from: c.from, to: c.to,
    columns: [{ key: "worker", kind: "text" }, { key: "sales", kind: "int" }, { key: "discountedSales", kind: "int" }, { key: "share", kind: "percent" }, { key: "discount", kind: "money" }, { key: "overrides", kind: "int" }],
    rows: rows.map(({ sortKey: _sortKey, ...r }) => r),
    totals: { sales: sum(rows, (r) => r.sales), discountedSales: sum(rows, (r) => r.discountedSales), discount: sum(rows, (r) => r.discount), overrides: sum(rows, (r) => r.overrides) },
  };
}

async function voidsAndReturns(c: Ctx): Promise<ReportResult> {
  const window = instantWindow(c.from, c.to);
  const [voids, returns] = await Promise.all([
    c.db.sale.findMany({ where: { status: "VOIDED", createdAt: window, userId: c.userId }, include: { user: { select: { name: true } } } }),
    c.db.saleReturn.findMany({ where: { businessDate: { gte: c.from, lte: c.to }, userId: c.userId }, include: { user: { select: { name: true } } } }),
  ]);
  const groups = new Map<string, { key: string; worker: string; voids: number; voided: Dram; returns: number; returned: Dram; blind: number }>();
  const groupFor = (userId: string, worker: string) => {
    const g = groups.get(userId) ?? { key: userId, worker, voids: 0, voided: 0, returns: 0, returned: 0, blind: 0 };
    groups.set(userId, g);
    return g;
  };
  for (const v of voids) {
    if (businessDate(v.createdAt, c.tz) < c.from || businessDate(v.createdAt, c.tz) > c.to) continue;
    const g = groupFor(v.userId, v.user.name);
    g.voids++;
    g.voided += v.total;
  }
  for (const r of returns) {
    const g = groupFor(r.userId, r.user.name);
    g.returns++;
    g.returned += r.total;
    if (r.originalSaleId === null) g.blind++;
  }
  const rows = [...groups.values()].map((g) => ({ ...g, sortKey: g.returned + g.voided })).sort(byKeyDesc);
  return {
    name: "voids-returns", from: c.from, to: c.to,
    columns: [{ key: "worker", kind: "text" }, { key: "voids", kind: "int" }, { key: "voided", kind: "money" }, { key: "returns", kind: "int" }, { key: "returned", kind: "money" }, { key: "blind", kind: "int" }],
    rows: rows.map(({ sortKey: _sortKey, ...r }) => r),
    totals: { voids: sum(rows, (r) => r.voids), voided: sum(rows, (r) => r.voided), returns: sum(rows, (r) => r.returns), returned: sum(rows, (r) => r.returned), blind: sum(rows, (r) => r.blind) },
  };
}

// ── Write-offs by reason, and cash out by reason (§13.5, §20.2) ──────────────

async function writeOffsByReason(c: Ctx): Promise<ReportResult> {
  const window = instantWindow(c.from, c.to);
  const movements = (await c.db.stockMovement.findMany({ where: { type: "WRITE_OFF", createdAt: window, userId: c.userId }, include: { product: { select: { name: true } } } }))
    .filter((m) => businessDate(m.createdAt, c.tz) >= c.from && businessDate(m.createdAt, c.tz) <= c.to);
  const groups = new Map<string, { key: string; reasonCode: string; lines: number; value: Dram; unknownCost: number }>();
  for (const m of movements) {
    const code = m.reasonCode ?? "OTHER";
    const g = groups.get(code) ?? { key: code, reasonCode: code, lines: 0, value: 0, unknownCost: 0 };
    g.lines++;
    if (m.unitCostMdram === null) g.unknownCost++;
    else g.value += lineTotal(-m.qtyDelta, m.unitCostMdram);
    groups.set(code, g);
  }
  const rows = [...groups.values()].map((g) => ({ ...g, sortKey: g.value })).sort(byKeyDesc);
  const unknown = sum(rows, (r) => r.unknownCost);
  return {
    name: "write-offs", from: c.from, to: c.to,
    columns: [{ key: "reasonCode", kind: "code", codeSet: "writeOff" }, { key: "lines", kind: "int" }, { key: "value", kind: "money" }],
    rows: rows.map(({ sortKey: _sortKey, unknownCost: _unknownCost, ...r }) => r),
    totals: { lines: sum(rows, (r) => r.lines), value: sum(rows, (r) => r.value) },
    notes: unknown ? [{ key: "noCostBasis", vars: { n: unknown } }] : [],
  };
}

async function cashOutByReason(c: Ctx): Promise<ReportResult> {
  const movements = await c.db.cashMovement.findMany({ where: { type: "PAY_OUT", businessDate: { gte: c.from, lte: c.to } } });
  const reversed = new Set(movements.flatMap((m) => (m.reversesId ? [m.reversesId, m.id] : [])));
  const groups = new Map<string, { key: string; reasonCode: string; count: number; amount: Dram }>();
  for (const m of movements) {
    if (reversed.has(m.id)) continue;
    const code = m.reasonCode ?? "OTHER";
    const g = groups.get(code) ?? { key: code, reasonCode: code, count: 0, amount: 0 };
    g.count++;
    g.amount += m.amount;
    groups.set(code, g);
  }
  const rows = [...groups.values()].map((g) => ({ ...g, sortKey: g.amount })).sort(byKeyDesc);
  return {
    name: "cash-out", from: c.from, to: c.to,
    columns: [{ key: "reasonCode", kind: "code", codeSet: "cashReason" }, { key: "count", kind: "int" }, { key: "amount", kind: "money" }],
    rows: rows.map(({ sortKey: _sortKey, ...r }) => r),
    totals: { count: sum(rows, (r) => r.count), amount: sum(rows, (r) => r.amount) },
  };
}

// ── The two ledgers read by person (§20.2, §6.11.1) ──────────────────────────

/**
 * Which column a movement type lands in. The four stock-handling families are what §6.11.1's
 * Պահեստ facet asks for — *goods received, written off, adjusted* — and selling is kept apart
 * from them rather than dropped, so the count of rows a person posted still adds up.
 */
const MOVEMENT_FAMILY = {
  PURCHASE_RECEIPT: "receipts", PURCHASE_RETURN: "receipts",
  WRITE_OFF: "writeOffs",
  ADJUSTMENT: "adjustments", OPENING_BALANCE: "adjustments", TRANSFER: "adjustments",
  STOCKTAKE: "stocktake",
  SALE: "saleLines", SALE_RETURN: "saleLines",
} as const satisfies Record<MovementType, string>;

type MovementFamily = (typeof MOVEMENT_FAMILY)[MovementType];

/**
 * The stock ledger grouped by `StockMovement.userId` instead of by product — item history asked
 * from the other end, and the answer to *what did this person move* (§20.2, §6.11.1).
 *
 * **Quantities are not added across products**: metres and pieces do not sum, and §10.3 is why the
 * sales report refuses a quantity total. So the size and direction of what someone moved is carried
 * as value at cost, which does add, **signed by `qtyDelta`** — goods in positive, goods out
 * negative. A movement whose cost was never known is counted in a note rather than silently valued
 * at zero (§10.5). Nothing here is ranked or compared between people (§6.11.1).
 */
async function movementsByPerson(c: Ctx): Promise<ReportResult> {
  const window = instantWindow(c.from, c.to);
  const movements = (await c.db.stockMovement.findMany({
    where: { createdAt: window, userId: c.userId },
    include: { user: { select: { name: true } } },
  })).filter((m) => businessDate(m.createdAt, c.tz) >= c.from && businessDate(m.createdAt, c.tz) <= c.to);

  type Row = {
    key: string; worker: string; movements: number; products: number;
    receipts: number; receiptsValue: Dram; writeOffs: number; writeOffsValue: Dram;
    adjustments: number; adjustmentsValue: Dram; stocktake: number; stocktakeValue: Dram; saleLines: number;
  };
  const groups = new Map<string, Row>();
  const seen = new Map<string, Set<string>>();
  let unknownCost = 0;
  for (const m of movements) {
    const row = groups.get(m.userId) ?? {
      key: m.userId, worker: m.user.name, movements: 0, products: 0,
      receipts: 0, receiptsValue: 0, writeOffs: 0, writeOffsValue: 0,
      adjustments: 0, adjustmentsValue: 0, stocktake: 0, stocktakeValue: 0, saleLines: 0,
    };
    const family: MovementFamily = MOVEMENT_FAMILY[m.type as MovementType] ?? "adjustments";
    row.movements++;
    row[family]++;
    if (family !== "saleLines") {
      if (m.unitCostMdram === null) unknownCost++;
      else row[`${family}Value`] += lineTotal(m.qtyDelta, m.unitCostMdram);
    }
    const products = seen.get(m.userId) ?? new Set<string>();
    products.add(m.productId);
    seen.set(m.userId, products);
    row.products = products.size;
    groups.set(m.userId, row);
  }
  const rows = [...groups.values()].map((g) => ({ ...g, sortKey: g.movements })).sort(byKeyDesc);
  const total = (k: keyof Omit<Row, "key" | "worker">) => sum(rows, (r) => r[k]);
  return {
    name: "movements-by-person", from: c.from, to: c.to,
    columns: [
      { key: "worker", kind: "text" }, { key: "movements", kind: "int" }, { key: "products", kind: "int" },
      { key: "receipts", kind: "int" }, { key: "receiptsValue", kind: "money" },
      { key: "writeOffs", kind: "int" }, { key: "writeOffsValue", kind: "money" },
      { key: "adjustments", kind: "int" }, { key: "adjustmentsValue", kind: "money" },
      { key: "stocktake", kind: "int" }, { key: "stocktakeValue", kind: "money" },
      { key: "saleLines", kind: "int" },
    ],
    rows: rows.map(({ sortKey: _sortKey, ...r }) => r),
    totals: {
      movements: total("movements"), products: total("products"),
      receipts: total("receipts"), receiptsValue: total("receiptsValue"),
      writeOffs: total("writeOffs"), writeOffsValue: total("writeOffsValue"),
      adjustments: total("adjustments"), adjustmentsValue: total("adjustmentsValue"),
      stocktake: total("stocktake"), stocktakeValue: total("stocktakeValue"),
      saleLines: total("saleLines"),
    },
    notes: unknownCost ? [{ key: "noCostBasis", vars: { n: unknownCost } }] : [],
  };
}

/** The reason columns are the reason codes themselves, so the client labels them from `cashReason` (§11). */
const CASH_OUT_REASONS = ["SUPPLIER_PAYMENT", "WAGE", "EXPENSE", "OWNER_DRAW", "CORRECTION", "OTHER"] as const;

/**
 * The same `PAY_OUT` rows as *cash out by reason*, grouped by `CashMovement.userId` instead:
 * *which reason* and *whose hand* are two different questions and the drawer answered only the
 * first (§20.2). A reversed pair leaves on both sides, and the pairs are found over the whole
 * period rather than over one person's rows — a correction may be somebody else's (§10.7).
 */
async function cashOutByPerson(c: Ctx): Promise<ReportResult> {
  const movements = await c.db.cashMovement.findMany({
    where: { type: "PAY_OUT", businessDate: { gte: c.from, lte: c.to } },
    include: { user: { select: { name: true } } },
  });
  const reversed = new Set(movements.flatMap((m) => (m.reversesId ? [m.reversesId, m.id] : [])));
  type Row = { key: string; worker: string; count: number; amount: Dram } & Record<string, Cell>;
  const groups = new Map<string, Row>();
  for (const m of movements) {
    if (reversed.has(m.id)) continue;
    if (c.userId && m.userId !== c.userId) continue;
    const row = groups.get(m.userId) ?? {
      key: m.userId, worker: m.user.name, count: 0, amount: 0,
      ...Object.fromEntries(CASH_OUT_REASONS.map((x) => [x, 0])),
    };
    const code: string = (CASH_OUT_REASONS as readonly string[]).includes(m.reasonCode ?? "") ? m.reasonCode! : "OTHER";
    row.count++;
    row.amount += m.amount;
    row[code] = (row[code] as number) + m.amount;
    groups.set(m.userId, row);
  }
  const rows: Array<Row & { sortKey: number }> = [...groups.values()].map((g) => ({ ...g, sortKey: g.amount }));
  rows.sort(byKeyDesc);
  return {
    name: "cash-out-by-person", from: c.from, to: c.to,
    columns: [
      { key: "worker", kind: "text" }, { key: "count", kind: "int" }, { key: "amount", kind: "money" },
      ...CASH_OUT_REASONS.map((x) => ({ key: x, kind: "money" as const })),
    ],
    rows: rows.map(({ sortKey: _sortKey, ...r }) => r),
    totals: {
      count: sum(rows, (r) => r.count), amount: sum(rows, (r) => r.amount),
      ...Object.fromEntries(CASH_OUT_REASONS.map((x) => [x, sum(rows, (r) => r[x] as number)])),
    },
  };
}

// ── Stock turnover and dead stock (§6.9, §13.3) ──────────────────────────────

async function stockTurnover(c: Ctx): Promise<ReportResult> {
  const [statuses, products] = await Promise.all([
    productStatuses(c.db),
    c.db.product.findMany({ where: { trackStock: 1, isActive: 1 }, select: { id: true, name: true, stockUom: true, decimalPlaces: true, stockQty: true, avgCostMdram: true } }),
  ]);
  const rows = products
    .map((p) => {
      const s = statuses.get(p.id);
      const value = p.avgCostMdram === null ? null : lineTotal(Math.max(0, p.stockQty), p.avgCostMdram);
      return {
        key: p.id, productName: p.name, uom: p.stockUom, decimalPlaces: p.decimalPlaces, onHand: p.stockQty,
        avgDaily: s?.avgDailyQty30d ?? 0, daysOfCover: s?.daysOfCover ?? null, idleDays: s?.daysSinceLastSale ?? null,
        dead: s?.dead ? 1 : 0, low: s?.low ? 1 : 0, value,
        sortKey: (s?.dead ? 1e12 : 0) + (value ?? 0),
      };
    })
    .filter((r) => r.onHand !== 0 || r.avgDaily > 0)
    .sort(byKeyDesc);
  return {
    name: "stock-turnover", from: c.from, to: c.to,
    columns: [{ key: "productName", kind: "text" }, { key: "onHand", kind: "qty" }, { key: "avgDaily", kind: "qty" }, { key: "daysOfCover", kind: "days" }, { key: "idleDays", kind: "days" }, { key: "value", kind: "money" }],
    rows: rows.map(({ sortKey: _sortKey, ...r }) => r),
    totals: { value: sum(rows, (r) => r.value ?? 0), dead: sum(rows, (r) => r.dead), low: sum(rows, (r) => r.low) },
    notes: [{ key: "deadStock", vars: { n: sum(rows, (r) => r.dead) } }],
  };
}

// ── The audit trail, filtered by person, date or record (§10.7) ──────────────

export async function auditRows(db: Db, tz: string, params: { from?: string; to?: string; userId?: string; entityType?: string; entityId?: string; action?: string; limit?: number }) {
  const window = params.from && params.to ? instantWindow(params.from, params.to) : undefined;
  const rows = await db.auditLog.findMany({
    where: { ...(window ? { createdAt: window } : {}), userId: params.userId, entityType: params.entityType, entityId: params.entityId, action: params.action },
    orderBy: { createdAt: "desc" }, take: params.limit ?? 200, include: { user: { select: { name: true } } },
  });
  return rows.filter((a) => !params.from || !params.to || (businessDate(a.createdAt, tz) >= params.from && businessDate(a.createdAt, tz) <= params.to));
}

async function auditTrail(c: Ctx): Promise<ReportResult> {
  const rows = await auditRows(c.db, c.tz, c);
  return {
    name: "audit", from: c.from, to: c.to,
    columns: [{ key: "at", kind: "datetime" }, { key: "who", kind: "text" }, { key: "action", kind: "code", codeSet: "audit" }, { key: "record", kind: "text" }, { key: "reason", kind: "text" }],
    rows: rows.map((a) => ({ key: a.id, at: a.createdAt, who: a.user.name, action: a.action, record: `${a.entityType} ${a.entityId.slice(-6)}`, reason: a.reason ?? "", before: a.before, after: a.after })),
  };
}

/** Days between two business dates, for callers that already hold them. */
export const spanDays = (from: string, to: string) => daysBetween(from, to);
export const todayIn = (tz: string) => businessDate(clock.now(), tz);
