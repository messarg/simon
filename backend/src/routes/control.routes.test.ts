/**
 * The owner's control surface: home (§6.9), the report catalogue (§20.2), the audit trail (§10.7,
 * §27.41) and diagnostics (§19.5). Every figure here is drilled to by tapping it, so each report is
 * asserted against a hand-worked day rather than against itself.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { businessDate, uuidv7 } from "@simon/shared";
import { runProductStats } from "../jobs/product-stats.ts";
import { bearer, createTestApp, PINS, type TestApp } from "../test/app.ts";
import { backdatedCharge, get, makeCustomer, makeProduct, openShift, post, saleBody, type FixtureProduct } from "../test/fixtures.ts";

const today = () => businessDate(new Date(), "Asia/Yerevan");
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const report = async (t: TestApp, name: string, query = "") => (await get(t, `/reports/${name}?from=${today()}&to=${today()}${query}`, "ADMIN")).body;
const rowFor = (body: { rows: Array<Record<string, unknown>> }, key: string) => body.rows.find((r) => r.key === key) as Record<string, number>;

describe("owner home and reports — §6.9, §20.2", () => {
  let t: TestApp;
  let cable: FixtureProduct;
  let sand: FixtureProduct;
  let gravel: FixtureProduct;
  let shiftId: string;
  let debtor: { id: string };

  beforeAll(async () => {
    t = await createTestApp();
    cable = await makeProduct(t, { name: "Մալուխ", priceDram: 1_200, stock: 10_000, costMdram: 800_000, barcode: "111" });
    sand = await makeProduct(t, { name: "Ավազ", priceDram: 100, stock: 5_000 }); // quick-added: no cost basis
    gravel = await makeProduct(t, { name: "Խճաքար", priceDram: 1_500 });
    shiftId = await openShift(t, "WORKER", 20_000);

    // Two cash sales — one discounted — and one on nisya.
    const sale1 = saleBody({ shiftId, lines: [{ product: cable, qty: 2_000, taxRateBp: 0 }] });
    await post(t, "/sales", sale1);
    debtor = await makeCustomer(t, "Սմբատ");
    await post(t, "/sales", saleBody({ shiftId, lines: [{ product: sand, qty: 3_000, taxRateBp: 0 }], payments: [{ method: "DEBT" }], customerId: debtor.id }));
    await post(t, "/sales", saleBody({ shiftId, lines: [{ product: cable, qty: 1_000, taxRateBp: 0, discountAmount: 50 }] }));

    // One unit comes back, one is written off, and money leaves the drawer for a stated reason.
    const completed = (await get(t, "/sales?status=COMPLETED")).body.items.find((s: { id: string }) => s.id === sale1.id);
    await post(t, "/sale-returns", { id: uuidv7(), originalSaleId: completed.id, shiftId, reason: "չհամապատասխանեց", lines: [{ id: uuidv7(), saleLineId: completed.lines[0].id, qty: 1_000, restock: true }], createdAt: new Date().toISOString(), sentAt: new Date().toISOString(), queued: false });
    await post(t, "/write-offs", { id: uuidv7(), productId: cable.id, qty: 1_000, reasonCode: "DAMAGE" }, "STOCK");
    await post(t, "/cash-movements", { id: uuidv7(), shiftId, type: "PAY_OUT", amount: 12_000, reasonCode: "EXPENSE", reason: "ջրի վարձ", createdAt: new Date().toISOString(), queued: false });

    // A delivery entered forty days ago on thirty-day terms: ten days past term.
    const supplierRes = await post(t, "/suppliers", { id: uuidv7(), name: "Քարհանք", paymentTerms: 30, leadTimeDays: 5 }, "ADMIN");
    await request(t.server).patch(`/api/suppliers/${supplierRes.body.id}`).set(bearer(t.tokens.ADMIN)).send({ paymentTerms: 30, leadTimeDays: 5 });
    await post(t, "/goods-receipts", {
      id: uuidv7(), supplierId: supplierRes.body.id, supplierInvoiceNo: "INV-77", landedCostTotal: 0, receivedAt: daysAgo(40),
      lines: [{ id: uuidv7(), productId: gravel.id, uom: gravel.stockUom, factorToStockUom: 1, qty: 5_000, invoiceUnitCostMdram: 1_000_000 }],
    }, "STOCK");

    // An old debt, so the aging report has something in its far bucket.
    const old = await makeCustomer(t, "Վարդան");
    await backdatedCharge(t, old.id, 20_000, 120);
  });
  afterAll(async () => { await t.close(); });

  it("home answers how the day went, and is the owner's alone", async () => {
    const home = (await get(t, "/home", "ADMIN")).body;
    expect(home.today).toMatchObject({
      takings: 3_850,        // 2 400 + 300 on nisya + 1 150 discounted
      salesCount: 3,
      averageSale: 1_283,
      returns: 1_200,
      profit: 1_150,         // 3 550 of cable revenue less 2 400 of cost
      revenueWithoutCost: 300, // the quick-added sand has no cost basis (§10.5)
    });
    expect(home.receivables).toMatchObject({ outstanding: 20_300, customers: 2, over90: 20_000 });
    expect(home.payables).toMatchObject({ outstanding: 5_000, overdue: 5_000 });
    expect(home.businessDate).toBe(today());
    expect((await get(t, "/home", "WORKER")).status).toBe(403);
    expect((await get(t, "/home", "STOCK")).status).toBe(403);
  });

  it("sales read by product, by worker and as the sales themselves", async () => {
    const byProduct = await report(t, "sales", "&groupBy=product");
    expect(rowFor(byProduct, cable.id)).toMatchObject({ qty: 3_000, revenue: 3_550, returned: 1_200, net: 2_350 });
    expect(byProduct.totals).toMatchObject({ revenue: 3_850, returned: 1_200, net: 2_650 });

    const byWorker = await report(t, "sales", "&groupBy=worker");
    expect(rowFor(byWorker, t.users.WORKER.id)).toMatchObject({ salesCount: 3, gross: 3_850, discount: 50, returned: 1_200, net: 2_650 });

    const bySale = await report(t, "sales", "&groupBy=sale");
    expect(bySale.rows).toHaveLength(3);
    expect(bySale.rows[0]).toMatchObject({ worker: "Գոռ" });
    expect(bySale.totals.total).toBe(3_850);

    const byDay = await report(t, "sales");
    expect(byDay.rows).toEqual([expect.objectContaining({ label: today(), salesCount: 3, net: 2_650 })]);
  });

  it("margin, valuation and COGS carry the day's cost", async () => {
    const margin = await report(t, "margin");
    expect(rowFor(margin, cable.id)).toMatchObject({ netRevenue: 3_550, cogsBooked: 2_400, marginBooked: 1_150 });
    expect(margin.notes).toContainEqual({ key: "noCostBasis", vars: { n: 1 } });

    const valuation = await report(t, "valuation");
    // Cable: 10 − 2 − 1 + 1 returned − 1 written off = 7 at 800 ֏; gravel 5 at 1 000 ֏; sand has no cost.
    expect(rowFor(valuation, cable.id)).toMatchObject({ onHand: 7_000, avgCost: 800, value: 5_600 });
    expect(rowFor(valuation, sand.id)).toMatchObject({ value: null });
    expect(valuation.totals).toMatchObject({ value: 10_600, cogs: 2_400 });
  });

  it("both ledgers age: debtors from the charge, payables from the day the terms ran out", async () => {
    const debtors = await report(t, "debtor-aging");
    expect(rowFor(debtors, debtor.id)).toMatchObject({ outstanding: 300, d0_30: 300, d90plus: 0 });
    expect(debtors.totals).toMatchObject({ outstanding: 20_300, d0_30: 300, d90plus: 20_000 });

    const payables = await report(t, "payables-aging");
    expect(payables.rows[0]).toMatchObject({ supplier: "Քարհանք", terms: 30, outstanding: 5_000, notYetDue: 0, d1_30: 5_000 });
  });

  it("shrinkage reads the same way in both directions: goods written off and cash paid out, each by reason", async () => {
    const writeOffs = await report(t, "write-offs");
    expect(writeOffs.rows).toEqual([expect.objectContaining({ reasonCode: "DAMAGE", lines: 1, value: 800 })]);
    const cashOut = await report(t, "cash-out");
    expect(cashOut.rows).toEqual([expect.objectContaining({ reasonCode: "EXPENSE", count: 1, amount: 12_000 })]);
  });

  it("discounts, voids and returns are read per worker", async () => {
    const held = saleBody({ shiftId, lines: [{ product: sand, qty: 1_000, taxRateBp: 0 }], status: "HELD" });
    await post(t, "/sales", held);
    expect((await post(t, `/sales/${held.id}/void`, { reason: "հրաժարվեց" })).status).toBe(200);

    const discounts = await report(t, "discounts");
    expect(rowFor(discounts, t.users.WORKER.id)).toMatchObject({ sales: 3, discountedSales: 1, discount: 50, share: 3_333 });
    const vr = await report(t, "voids-returns");
    expect(rowFor(vr, t.users.WORKER.id)).toMatchObject({ voids: 1, returns: 1, returned: 1_200, blind: 0 });
  });

  it("an item's history says what changed, when and who — and never calls it a movement", async () => {
    const history = await report(t, "item-history", `&productId=${cable.id}`);
    expect(history.rows.map((r: { what: string }) => r.what)).toEqual(expect.arrayContaining(["PURCHASE_RECEIPT", "SALE", "SALE_RETURN", "WRITE_OFF"]));
    expect(history.notes).toEqual([{ key: "itemHistoryFor", vars: { product: "Մալուխ" } }]);
    expect((await get(t, `/reports/item-history?from=${today()}&to=${today()}`, "ADMIN")).status).toBe(400);
  });

  it("§27.41 — the audit trail is gated as a route, and holds the reason the person typed", async () => {
    expect((await get(t, "/audit-log", "WORKER")).status).toBe(403);
    expect((await get(t, "/audit-log", "STOCK")).status).toBe(403);
    const log = (await get(t, "/audit-log", "ADMIN")).body;
    expect(log.items.map((x: { action: string }) => x.action)).toEqual(expect.arrayContaining(["stock.writeOff", "sale.void", "goodsReceipt.create"]));

    const grant = (await post(t, "/auth/reauth", { adminUserId: t.users.ADMIN.id, pin: PINS.ADMIN, action: "stockAdjustment" })).body.grant;
    await post(t, "/adjustments", { id: uuidv7(), productId: cable.id, qtyDelta: 1_000, reauthGrant: grant, reason: "դարակում գտնվեց" }, "STOCK");
    const adjustment = (await get(t, "/audit-log?action=stock.adjustment", "ADMIN")).body.items[0];
    expect(adjustment).toMatchObject({ action: "stock.adjustment", reason: "դարակում գտնվեց", userName: "Լուսինե" }); // the person who acted, not the admin who approved

    const filtered = (await get(t, `/audit-log?entityType=Product&entityId=${cable.id}`, "ADMIN")).body;
    expect(filtered.items.every((x: { entityId: string }) => x.entityId === cable.id)).toBe(true);
    // The same rows as a report, for the screen that exports them.
    expect((await report(t, "audit")).columns.map((cx: { key: string }) => cx.key)).toContain("reason");
  });

  it("diagnostics are the owner's, and name the three settings installation sets", async () => {
    expect((await get(t, "/diagnostics", "WORKER")).status).toBe(403);
    const d = (await get(t, "/diagnostics", "ADMIN")).body;
    expect(d.installation).toMatchObject({ taxRegime: "VAT", priceBasis: "INCLUSIVE", timezone: "Asia/Yerevan" });
    expect(d).toMatchObject({ version: expect.any(String), ledgerDriftFlags: 0 });
    expect(d.queues).toMatchObject({ salesWaiting: 0, parked: 0 });
    // With no backup ever taken, the owner is told so rather than left to find out on the worst day.
    expect(d.alerts).toContainEqual({ type: "backup-stale", lastAt: null });
    expect(JSON.stringify(d)).not.toMatch(/[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}/);
  });

  it("velocity drives the reorder suggestion, and dead stock is what stopped selling", async () => {
    // Cable sold 3 in the window; the supplier of record brings goods in 5 days, safety 3.
    const forgotten = await makeProduct(t, { name: "Հին ապրանք", priceDram: 900, stock: 4_000 });
    await t.db.product.update({ where: { id: forgotten.id }, data: { createdAt: daysAgo(200) } });
    expect(await runProductStats(t.db)).toMatchObject({ computed: expect.any(Number) });

    const stats = await t.db.productStats.findUniqueOrThrow({ where: { productId: cable.id } });
    expect(stats.avgDailyQty30d).toBe(67); // 2 000 sold net of the return, over thirty days
    expect(stats.daysSinceLastSale).toBe(0);

    const dead = (await get(t, "/products?filter=dead-stock&limit=50", "ADMIN")).body.items;
    expect(dead.map((p: { id: string }) => p.id)).toEqual([forgotten.id]);
    expect(dead[0].stockStatus).toMatchObject({ dead: true, low: false });

    await request(t.server).patch(`/api/products/${cable.id}`).set(bearer(t.tokens.ADMIN)).send({ reorderPoint: 20_000 });
    const low = (await get(t, "/products?filter=low-stock&limit=50", "ADMIN")).body.items;
    expect(low.map((p: { id: string }) => p.id)).toContain(cable.id);
    expect(low.find((p: { id: string }) => p.id === cable.id).stockStatus).toMatchObject({ low: true, manual: true, threshold: 20_000, leadTimeDays: 0, safetyDays: 3 });

    const home = (await get(t, "/home", "ADMIN")).body;
    expect(home.stock).toMatchObject({ dead: 1 });
    expect(home.stock.low).toBeGreaterThanOrEqual(1);

    const turnover = await report(t, "stock-turnover");
    expect(rowFor(turnover, forgotten.id)).toMatchObject({ idleDays: null, onHand: 4_000 });
    expect(turnover.notes).toContainEqual({ key: "deadStock", vars: { n: 1 } });
  });

  it("a flag's note reaches a worker without the cost inside it", async () => {
    const bolt = await makeProduct(t, { name: "Հեղույս", priceDram: 30 });
    const s = (await post(t, "/suppliers", { id: uuidv7(), name: "Մետաղ" }, "ADMIN")).body.id;
    const line = (qty: number, cost: number) => ({ id: uuidv7(), productId: bolt.id, uom: bolt.stockUom, factorToStockUom: 1, qty, invoiceUnitCostMdram: cost });
    await post(t, "/goods-receipts", { id: uuidv7(), supplierId: s, supplierInvoiceNo: "A1", landedCostTotal: 0, lines: [line(100_000, 14_000)] }, "STOCK");
    await post(t, "/goods-receipts", { id: uuidv7(), supplierId: s, supplierInvoiceNo: "A2", landedCostTotal: 0, lines: [line(100_000, 140_000)] }, "STOCK");

    const asWorker = (await get(t, "/review-flags?type=COST_VARIANCE", "WORKER")).body.items[0];
    expect(asWorker).toMatchObject({ type: "COST_VARIANCE", productName: "Հեղույս" });
    expect(JSON.stringify(asWorker.note)).not.toMatch(/Mdram/);
    const asAdmin = (await get(t, "/review-flags?type=COST_VARIANCE", "ADMIN")).body.items[0];
    expect(asAdmin.note).toMatchObject({ lastMdram: 14_000, newMdram: 140_000 });
  });

  it("the Z-report list carries the variance each shift closed with", async () => {
    await post(t, `/shifts/${shiftId}/begin-close`, { unsyncedAtClose: 0 });
    await post(t, `/shifts/${shiftId}/close`, { breakdown: [{ value: 10_000, count: 1 }], note: "պակասորդ", unsyncedAtClose: 0 });
    const z = await report(t, "z-reports");
    expect(z.rows[0]).toMatchObject({ worker: "Գոռ", counted: 10_000, note: "պակասորդ" });
    expect(z.rows[0].variance).toBe(10_000 - z.rows[0].expected);
  });
});
