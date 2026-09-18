import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { businessDate, uuidv7 } from "@simon/shared";
import { replay } from "../domain/stock-replay.ts";
import { runStockDriftCheck } from "../jobs/stock-drift.ts";
import { bearer, createTestApp, PINS, type TestApp } from "../test/app.ts";
import { get, makeProduct, openShift, post, saleBody, type FixtureProduct } from "../test/fixtures.ts";

const today = () => businessDate(new Date(), "Asia/Yerevan");

async function reauth(t: TestApp, action: string) {
  return (await post(t, "/auth/reauth", { name: t.users.OWNER.name, pin: PINS.OWNER, action })).body.grant as string;
}
async function supplier(t: TestApp, name: string, paymentTerms = 0) {
  const res = await post(t, "/suppliers", { id: uuidv7(), name, paymentTerms }, "OWNER");
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  if (paymentTerms) await request(t.server).patch(`/api/suppliers/${res.body.id}`).set(bearer(t.tokens.OWNER)).send({ paymentTerms });
  return res.body.id as string;
}
function receipt(supplierId: string, lines: Array<{ product: FixtureProduct; qty: number; costDram: number; uom?: string; factor?: number }>, landedCostTotal = 0, receivedAt?: string) {
  return {
    id: uuidv7(), supplierId, supplierInvoiceNo: "INV-1", landedCostTotal, receivedAt,
    lines: lines.map((l) => ({ id: uuidv7(), productId: l.product.id, uom: l.uom ?? l.product.stockUom, factorToStockUom: l.factor ?? 1, qty: l.qty, invoiceUnitCostMdram: l.costDram * 1000 })),
  };
}
const avg = async (t: TestApp, id: string) => (await t.db.product.findUniqueOrThrow({ where: { id } })).avgCostMdram;

describe("receiving — §27.3, §27.31, §27.29", () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.close(); });

  it("3 spools of 50 m add 150 m and move the average including the delivery charge; the receipt still reads 3 spools", async () => {
    const cable = await makeProduct(t, { name: "Մալուխ", priceDram: 1200, decimalPlaces: 2, uom: "մ" });
    expect((await post(t, `/products/${cable.id}/units`, { uom: "կոճ", factorToStockUom: 50, role: "PURCHASE" }, "OWNER")).status).toBe(201);
    const s = await supplier(t, "Էլեկտրոտեխնիկա");
    const body = receipt(s, [{ product: cable, qty: 3000, costDram: 25_000, uom: "կոճ", factor: 50 }], 1_500);
    const res = await post(t, "/goods-receipts", body, "STOCK");
    expect(res.status).toBe(200);
    expect((await t.db.product.findUniqueOrThrow({ where: { id: cable.id } })).stockQty).toBe(150_000);
    expect(await avg(t, cable.id)).toBe(510_000); // (75 000 + 1 500) ֏ ÷ 150 m
    expect(res.body.lines[0]).toMatchObject({ qty: 3000, uom: "կոճ", factorToStockUom: 50, invoiceUnitCostMdram: 25_000_000 });
    expect(res.body.lines[0]).not.toHaveProperty("landedUnitCostMdram"); // STOCK sees only the invoice cost it typed (§16.5)
    // There is no route that edits a factor: a new packaging is a new unit (§27.31).
    expect((await request(t.server).patch(`/api/products/${cable.id}/units/x`).set(bearer(t.tokens.OWNER)).send({ factorToStockUom: 100 })).status).toBe(404);
    const again = await get(t, `/goods-receipts/${body.id}`, "OWNER");
    expect(again.body.lines[0]).toMatchObject({ qty: 3000, uom: "կոճ", landedUnitCostMdram: 25_500_000 });
  });

  it("a product sold before it was ever received reports no margin, and the first receipt seeds its cost", async () => {
    const sand = await makeProduct(t, { name: "Ավազ", priceDram: 100 });
    const shiftId = await openShift(t, "WORKER");
    expect((await post(t, "/sales", saleBody({ shiftId, lines: [{ product: sand, qty: 3000, taxRateBp: 0 }] }))).status).toBe(200);
    const report = (await get(t, `/reports/margin?from=${today()}&to=${today()}`, "OWNER")).body;
    const row = report.rows.find((i: { productId: string }) => i.productId === sand.id);
    expect(row).toMatchObject({ revenueWithoutCost: 300, netRevenue: 0, marginBooked: null });
    await post(t, "/goods-receipts", receipt(await supplier(t, "Քար"), [{ product: sand, qty: 10_000, costDram: 60 }]), "STOCK");
    expect(await avg(t, sand.id)).toBe(60_000);
  });

  it("a cost far from the last one is flagged for the owner (§13.2)", async () => {
    const bolt = await makeProduct(t, { name: "Հեղույս", priceDram: 30 });
    const s = await supplier(t, "Մետաղ");
    await post(t, "/goods-receipts", receipt(s, [{ product: bolt, qty: 100_000, costDram: 14 }]), "STOCK");
    const typo = await post(t, "/goods-receipts", receipt(s, [{ product: bolt, qty: 100_000, costDram: 140 }]), "STOCK");
    expect(typo.body.warnings.map((w: { type: string }) => w.type)).toContain("cost-variance");
  });
});

describe("margin — §27.4 and §27.33", () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.close(); });

  it("a product restocked twice at different costs matches a hand calculation", async () => {
    const pipe = await makeProduct(t, { name: "Խողովակ", priceDram: 20 });
    const s = await supplier(t, "Պլաստիկ");
    const shiftId = await openShift(t, "WORKER");
    await post(t, "/goods-receipts", receipt(s, [{ product: pipe, qty: 10_000, costDram: 12 }]), "STOCK");
    await post(t, "/sales", saleBody({ shiftId, lines: [{ product: pipe, qty: 5_000, taxRateBp: 0 }] }));
    await post(t, "/goods-receipts", receipt(s, [{ product: pipe, qty: 10_000, costDram: 15 }]), "STOCK");
    await post(t, "/sales", saleBody({ shiftId, lines: [{ product: pipe, qty: 5_000, taxRateBp: 0 }] }));
    const row = (await get(t, `/reports/margin?from=${today()}&to=${today()}`, "OWNER")).body.rows.find((i: { productId: string }) => i.productId === pipe.id);
    // By hand: revenue 2 × 5 × 20 = 200; cost 5 × 12 + 5 × 14 (the average after the second delivery) = 130.
    expect(row).toMatchObject({ netRevenue: 200, cogsBooked: 130, marginBooked: 70 });
  });

  it("a cost typed 14 000 instead of 1 400 and corrected later: sale lines untouched, margin as booked and restated", async () => {
    const tile = await makeProduct(t, { name: "Սալիկ", priceDram: 2_000 });
    const s = await supplier(t, "Կերամիկա");
    const shiftId = (await t.db.shift.findFirstOrThrow({ where: { userId: t.users.WORKER.id, status: "OPEN" } })).id;
    const bad = receipt(s, [{ product: tile, qty: 10_000, costDram: 14_000 }]);
    await post(t, "/goods-receipts", bad, "STOCK");
    const sale = saleBody({ shiftId, lines: [{ product: tile, qty: 2_000, taxRateBp: 0 }] });
    await post(t, "/sales", sale);
    const linesBefore = await t.db.saleLine.findMany({ where: { saleId: sale.id } });
    const res = await post(t, "/cost-corrections", { id: uuidv7(), goodsReceiptLineId: bad.lines[0].id, correctUnitCostMdram: 1_400_000, reason: "տասնորդական կետ" }, "OWNER");
    expect(res.status).toBe(201);
    expect(await t.db.saleLine.findMany({ where: { saleId: sale.id } })).toEqual(linesBefore);
    const row = (await get(t, `/reports/margin?from=${today()}&to=${today()}`, "OWNER")).body.rows.find((i: { productId: string }) => i.productId === tile.id);
    expect(row).toMatchObject({ netRevenue: 4_000, cogsBooked: 28_000, marginBooked: -24_000, cogsRestated: 2_800, marginRestated: 1_200 });
    expect(row.corrections).toEqual([expect.objectContaining({ reason: "տասնորդական կետ", wrongUnitCostMdram: 14_000_000, correctUnitCostMdram: 1_400_000 })]);
    expect((await get(t, `/reports/margin?from=${today()}&to=${today()}`, "STOCK")).status).toBe(403);
  });
});

describe("purchase returns — §27.22", () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.close(); });

  it("no sale in between: credits the invoice, records lost freight, the average returns to 12", async () => {
    const p = await makeProduct(t, { name: "Փական ա", priceDram: 30, stock: 10_000, costMdram: null });
    await t.db.stockMovement.updateMany({ where: { productId: p.id }, data: { unitCostMdram: 12_000 } });
    await t.db.product.update({ where: { id: p.id }, data: { avgCostMdram: 12_000 } });
    const s = await supplier(t, "Մատակարար Ա");
    const r = receipt(s, [{ product: p, qty: 10_000, costDram: 14 }], 0);
    await post(t, "/goods-receipts", r, "STOCK");
    expect(await avg(t, p.id)).toBe(13_000);
    const ret = await post(t, "/purchase-returns", { id: uuidv7(), receiptId: r.id, reason: "սխալ ապրանք", lines: [{ id: uuidv7(), receiptLineId: r.lines[0].id, qty: 10_000 }] }, "STOCK");
    expect(ret.status).toBe(200);
    expect(ret.body).toMatchObject({ total: 140, landedCostLost: 0 });
    expect(ret.body.warnings).toEqual([]);
    expect(await avg(t, p.id)).toBe(12_000);
  });

  it("freight is not refunded: the unrefunded share is recorded as lost", async () => {
    const p = await makeProduct(t, { name: "Փական բ", priceDram: 30 });
    const s = await supplier(t, "Մատակարար Բ");
    const r = receipt(s, [{ product: p, qty: 10_000, costDram: 14 }], 20);
    await post(t, "/goods-receipts", r, "STOCK");
    const ret = await post(t, "/purchase-returns", { id: uuidv7(), receiptId: r.id, reason: "վնասված", lines: [{ id: uuidv7(), receiptLineId: r.lines[0].id, qty: 5_000 }] }, "STOCK");
    expect(ret.body).toMatchObject({ total: 70, landedCostLost: 10 });
  });

  it("stock sold in between: the naive 8 ֏ is refused, the average stays 13, and it is flagged — and the replay agrees", async () => {
    const p = await makeProduct(t, { name: "Փական գ", priceDram: 30, stock: 10_000, costMdram: null });
    await t.db.stockMovement.updateMany({ where: { productId: p.id }, data: { unitCostMdram: 12_000 } });
    await t.db.product.update({ where: { id: p.id }, data: { avgCostMdram: 12_000 } });
    const s = await supplier(t, "Մատակարար Գ");
    const r = receipt(s, [{ product: p, qty: 10_000, costDram: 14 }], 0);
    await post(t, "/goods-receipts", r, "STOCK");
    const shiftId = await openShift(t, "WORKER");
    await post(t, "/sales", saleBody({ shiftId, lines: [{ product: p, qty: 8_000, taxRateBp: 0 }] }));
    const ret = await post(t, "/purchase-returns", { id: uuidv7(), receiptId: r.id, reason: "սխալ", lines: [{ id: uuidv7(), receiptLineId: r.lines[0].id, qty: 10_000 }] }, "STOCK");
    expect(ret.status).toBe(200);
    expect(await avg(t, p.id)).toBe(13_000);
    expect(ret.body.warnings.map((w: { type: string }) => w.type)).toContain("cost-variance");
    const rows = await t.db.stockMovement.findMany({ where: { productId: p.id } });
    const cached = await t.db.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(replay(rows.map((x) => ({ ...x, type: x.type as never })))).toEqual({ stockQty: cached.stockQty, avgCostMdram: cached.avgCostMdram });
    expect((await runStockDriftCheck(t.db)).flagged).toBe(0);
    expect((await post(t, "/purchase-returns", { id: uuidv7(), receiptId: r.id, reason: "x", lines: [{ id: uuidv7(), receiptLineId: r.lines[0].id, qty: 1_000 }] }, "STOCK")).status).toBe(422);
  });
});

describe("payables — §27.46", () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.close(); });

  it("overpayment becomes a credit the next receipt draws on; cash writes one PAY_OUT, card none", async () => {
    const p = await makeProduct(t, { name: "Ներկ", priceDram: 6_000 });
    const s = await supplier(t, "Ներկեր ՍՊԸ");
    const shiftId = await openShift(t, "OWNER", 100_000);
    const r1 = receipt(s, [{ product: p, qty: 10_000, costDram: 3_000 }]);
    await post(t, "/goods-receipts", r1, "STOCK");
    const pay = await post(t, "/supplier-payments", { id: uuidv7(), supplierId: s, amount: 50_000, method: "CASH", shiftId }, "OWNER");
    expect(pay.body.settled).toEqual([{ goodsReceiptId: r1.id, amount: 30_000 }]);
    expect(pay.body.outstanding).toBe(-20_000);
    expect(await t.db.cashMovement.count({ where: { shiftId, type: "PAY_OUT", reasonCode: "SUPPLIER_PAYMENT", sourceId: pay.body.payment.id } })).toBe(1);
    expect((await get(t, `/shifts/${shiftId}/x-report`, "OWNER")).body.figures.expected).toBe(50_000);

    const r2 = receipt(s, [{ product: p, qty: 5_000, costDram: 5_000 }]);
    await post(t, "/goods-receipts", r2, "STOCK");
    const ledger = (await get(t, `/suppliers/${s}/ledger`, "OWNER")).body;
    expect(ledger.receipts.find((x: { id: string }) => x.id === r2.id).unpaid).toBe(5_000);
    expect(ledger.outstanding).toBe(5_000);

    const card = await post(t, "/supplier-payments", { id: uuidv7(), supplierId: s, amount: 5_000, method: "CARD" }, "OWNER");
    expect(card.body.outstanding).toBe(0);
    expect((await get(t, `/shifts/${shiftId}/x-report`, "OWNER")).body.figures.expected).toBe(50_000);
    expect((await post(t, "/supplier-payments", { id: uuidv7(), supplierId: s, amount: 1, method: "CARD" }, "STOCK")).status).toBe(403);
  });

  it("a purchase-return credit settles the receipt it came from, in the same allocation table", async () => {
    const p = await makeProduct(t, { name: "Սոսինձ", priceDram: 900 });
    const s = await supplier(t, "Սոսինձ ՍՊԸ");
    const r = receipt(s, [{ product: p, qty: 20_000, costDram: 500 }]);
    await post(t, "/goods-receipts", r, "STOCK");
    const ret = await post(t, "/purchase-returns", { id: uuidv7(), receiptId: r.id, reason: "ավել", lines: [{ id: uuidv7(), receiptLineId: r.lines[0].id, qty: 4_000 }] }, "STOCK");
    const alloc = await t.db.supplierAllocation.findMany({ where: { goodsReceiptId: r.id } });
    expect(alloc).toEqual([expect.objectContaining({ creditType: "PURCHASE_RETURN", creditId: ret.body.id, amount: 2_000 })]);
    expect((await get(t, `/suppliers/${s}/ledger`, "OWNER")).body.outstanding).toBe(8_000);
  });

  it("a payment to the wrong supplier is reversed by a linked payment and re-entered; the drawer is untouched", async () => {
    const p = await makeProduct(t, { name: "Լար", priceDram: 100 });
    const wrong = await supplier(t, "Սխալ ՍՊԸ");
    const right = await supplier(t, "Ճիշտ ՍՊԸ");
    const rw = receipt(wrong, [{ product: p, qty: 10_000, costDram: 1_000 }]);
    const rr = receipt(right, [{ product: p, qty: 10_000, costDram: 1_000 }]);
    await post(t, "/goods-receipts", rw, "STOCK");
    await post(t, "/goods-receipts", rr, "STOCK");
    const shiftId = (await t.db.shift.findFirstOrThrow({ where: { userId: t.users.OWNER.id, status: "OPEN" } })).id;
    const pay = await post(t, "/supplier-payments", { id: uuidv7(), supplierId: wrong, amount: 10_000, method: "CASH", shiftId }, "OWNER");
    const expected = (await get(t, `/shifts/${shiftId}/x-report`, "OWNER")).body.figures.expected;
    const rev = await post(t, `/supplier-payments/${pay.body.payment.id}/reverse`, { reason: "սխալ մատակարար", reenterSupplierId: right }, "OWNER");
    expect(rev.status).toBe(200);
    expect((await t.db.supplierPayment.findUniqueOrThrow({ where: { id: pay.body.payment.id } })).supplierId).toBe(wrong); // the original row is unchanged
    expect((await get(t, `/suppliers/${wrong}/ledger`, "OWNER")).body.outstanding).toBe(10_000);
    expect((await get(t, `/suppliers/${right}/ledger`, "OWNER")).body.outstanding).toBe(0);
    expect((await get(t, `/shifts/${shiftId}/x-report`, "OWNER")).body.figures.expected).toBe(expected);
  });

  it("a receipt past its terms reads overdue — aged against the terms agreed", async () => {
    const p = await makeProduct(t, { name: "Ցանց", priceDram: 100 });
    const s = await supplier(t, "Ժամկետով ՍՊԸ", 7);
    const old = receipt(s, [{ product: p, qty: 1_000, costDram: 5_000 }], 0, new Date(Date.now() - 10 * 86_400_000).toISOString());
    const recent = receipt(s, [{ product: p, qty: 1_000, costDram: 3_000 }], 0, new Date(Date.now() - 3 * 86_400_000).toISOString());
    await post(t, "/goods-receipts", old, "STOCK");
    await post(t, "/goods-receipts", recent, "STOCK");
    const ledger = (await get(t, `/suppliers/${s}/ledger`, "OWNER")).body;
    expect(ledger.receipts.find((x: { id: string }) => x.id === old.id)).toMatchObject({ overdue: true, daysPastDue: 3 });
    expect(ledger.receipts.find((x: { id: string }) => x.id === recent.id).overdue).toBe(false);
    expect(ledger.overdue).toBe(5_000);
    const list = (await get(t, "/suppliers", "OWNER")).body.items.find((x: { id: string }) => x.id === s);
    expect(list).toMatchObject({ outstanding: 8_000, overdue: 5_000 });
    expect((await get(t, "/suppliers", "STOCK")).body.items[0]).not.toHaveProperty("paymentTerms");
  });
});

describe("write-offs and adjustments — §13.5, §16.3", () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.close(); });

  it("a write-off needs a reason code and is idempotent; an adjustment needs an admin PIN and a reason", async () => {
    const p = await makeProduct(t, { name: "Ապակի", priceDram: 5_000, stock: 10_000, costMdram: 3_000_000 });
    expect((await post(t, "/write-offs", { id: uuidv7(), productId: p.id, qty: 1_000 }, "STOCK")).status).toBe(400);
    const w = { id: uuidv7(), productId: p.id, qty: 2_000, reasonCode: "DAMAGE" };
    expect((await post(t, "/write-offs", w, "STOCK")).status).toBe(200);
    await post(t, "/write-offs", w, "STOCK");
    expect((await t.db.product.findUniqueOrThrow({ where: { id: p.id } })).stockQty).toBe(8_000);
    expect((await post(t, "/write-offs", { ...w, id: uuidv7() }, "WORKER")).status).toBe(403);

    expect((await post(t, "/adjustments", { id: uuidv7(), productId: p.id, qtyDelta: 1_000, reauthGrant: "nope", reason: "հաշվարկ" }, "STOCK")).status).toBe(403);
    const grant = await reauth(t, "stockAdjustment");
    const adj = { id: uuidv7(), productId: p.id, qtyDelta: 1_000, reauthGrant: grant, reason: "դարակում գտնվեց" };
    expect((await post(t, "/adjustments", adj, "STOCK")).status).toBe(200);
    expect((await t.db.product.findUniqueOrThrow({ where: { id: p.id } })).stockQty).toBe(9_000);
    expect(await t.db.auditLog.count({ where: { action: "stock.adjustment", reason: "դարակում գտնվեց" } })).toBe(1);
  });
});
