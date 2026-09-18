/**
 * Phase 6 — the owner counts stock without closing the shop (§23's exit criterion), orders from
 * suppliers and receives against the order, prints shelf labels, and issues fiscal receipts
 * through the seam §17 reserved.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { uuidv7 } from "@simon/shared";
import { fiscal, FileFiscalDevice, NoFiscalDevice, type FiscalDevice } from "../lib/hardware/fiscal.ts";
import { labelPrinter, renderZpl, type Label, type LabelPrinter } from "../lib/hardware/label-printer.ts";
import { bearer, createTestApp, type TestApp } from "../test/app.ts";
import { get, makeProduct, openShift, post, saleBody, type FixtureProduct } from "../test/fixtures.ts";
import { fiscalSince, issueFiscalReceipt, retryPendingFiscal } from "../services/fiscal.service.ts";
import { diagnostics } from "../services/diagnostics.service.ts";
import { clock } from "../lib/time.ts";

const put = (t: TestApp, p: string, body: object, role: "WORKER" | "STOCK" | "OWNER" = "STOCK") =>
  request(t.server).put(`/api${p}`).set(bearer(t.tokens[role])).send(body);

describe("stocktake — §6.8, §13.4", () => {
  let t: TestApp;
  let cement: FixtureProduct;
  let sand: FixtureProduct;
  let lamp: FixtureProduct;
  let shiftId: string;

  beforeAll(async () => {
    t = await createTestApp();
    cement = await makeProduct(t, { name: "Ցեմենտ", priceDram: 3_200, stock: 40_000, costMdram: 2_600_000, barcode: "4850001234567" });
    sand = await makeProduct(t, { name: "Ավազ", priceDram: 25, decimalPlaces: 3, uom: "կգ", stock: 1_200_000, costMdram: 15_000 });
    lamp = await makeProduct(t, { name: "Լամպ", priceDram: 900, stock: 10_000, costMdram: 560_000 });
    shiftId = await openShift(t, "WORKER");
    // A sale beyond what the books say, so a recount is flagged before the count starts (§13.6).
    await post(t, "/sales", saleBody({ shiftId, lines: [{ product: lamp, qty: 12_000, taxRateBp: 0 }] }));
  });
  afterAll(async () => { await t.close(); });

  it("counts while the shop keeps selling, and a sale between snapshot and count is not shrinkage", async () => {
    const start = await post(t, "/stocktakes", { id: uuidv7() }, "STOCK");
    expect(start.status).toBe(201);
    const id = start.body.id;
    expect(start.body.progress).toEqual({ total: 3, counted: 0 });
    // A blind count: the person counting is not told what the books say.
    expect(start.body.lines[0]).not.toHaveProperty("expectedQty");
    expect((await post(t, "/stocktakes", { id: uuidv7() }, "STOCK")).status).toBe(422); // one count at a time

    // Two bags sold after the snapshot and before the aisle is counted; 38 on the shelf is right.
    await post(t, "/sales", saleBody({ shiftId, lines: [{ product: cement, qty: 2_000, taxRateBp: 0 }] }));
    expect((await put(t, `/stocktakes/${id}/counts/${cement.id}`, { countedQty: 38_000 })).status).toBe(200);
    // Sand: 1 150 kg found where the books say 1 200 — a real 50 kg shortage.
    await put(t, `/stocktakes/${id}/counts/${sand.id}`, { countedQty: 1_150_000 });
    // Lamps counted by scanning, one at a time: three found.
    for (let i = 0; i < 3; i++) await put(t, `/stocktakes/${id}/counts/${lamp.id}`, { countedQty: 1_000, mode: "add" });
    // A quantity finer than the product is refused.
    expect((await put(t, `/stocktakes/${id}/counts/${cement.id}`, { countedQty: 38_500 })).status).toBe(400);

    // Another sale after the count is not part of it either.
    await post(t, "/sales", saleBody({ shiftId, lines: [{ product: cement, qty: 1_000, taxRateBp: 0 }] }));

    const review = await post(t, `/stocktakes/${id}/review`, {}, "STOCK");
    expect(review.body.status).toBe("REVIEW");
    const cementLine = review.body.lines.find((l: { productId: string }) => l.productId === cement.id);
    expect(cementLine).toMatchObject({ expectedQty: 38_000, varianceQty: 0 });
    expect(cementLine).not.toHaveProperty("varianceValue"); // shrinkage at cost is the owner's (§16.5)
    expect(review.body.differing).toEqual([lamp.id, sand.id]); // the costliest discrepancy first

    const owner = (await get(t, `/stocktakes/${id}`, "OWNER")).body;
    // Lamp: −2 on the books after the oversell, 3 on the shelf → +5 × 560; sand: −50 kg × 15.
    expect(owner.summary).toMatchObject({ counted: 3, differing: 2, shortage: 750, surplus: 2_800, net: 2_050 });
    expect(owner.lines.find((l: { productId: string }) => l.productId === sand.id)).toMatchObject({ varianceQty: -50_000, varianceValue: -750 });

    expect((await post(t, `/stocktakes/${id}/approve`, {}, "STOCK")).status).toBe(403);
    const approved = await post(t, `/stocktakes/${id}/approve`, {}, "OWNER");
    expect(approved.body.status).toBe("APPROVED");

    // Stock is what was on the shelf, adjusted by what sold after the count.
    const stock = async (p: FixtureProduct) => (await t.db.product.findUniqueOrThrow({ where: { id: p.id } })).stockQty;
    expect(await stock(cement)).toBe(37_000);
    expect(await stock(sand)).toBe(1_150_000);
    expect(await stock(lamp)).toBe(3_000);
    const movements = await t.db.stockMovement.findMany({ where: { type: "STOCKTAKE" }, orderBy: { seq: "asc" } });
    expect(movements.map((m) => [m.qtyDelta, m.unitCostMdram])).toEqual([[-50_000, 15_000], [5_000, 560_000]]);
    // A stocktake never moves the average (§10.4).
    expect((await t.db.product.findUniqueOrThrow({ where: { id: lamp.id } })).avgCostMdram).toBe(560_000);
    // The recount the oversell asked for has happened.
    expect(await t.db.reviewFlag.count({ where: { type: "INSUFFICIENT_STOCK", productId: lamp.id, resolvedAt: null } })).toBe(0);
    // Approving twice changes nothing.
    await post(t, `/stocktakes/${id}/approve`, {}, "OWNER");
    expect(await t.db.stockMovement.count({ where: { type: "STOCKTAKE" } })).toBe(2);
    expect(await t.db.auditLog.count({ where: { action: "stocktake.approve" } })).toBe(1);
    // Closed: no more counts.
    expect((await put(t, `/stocktakes/${id}/counts/${cement.id}`, { countedQty: 1_000 })).status).toBe(422);

    const history = (await get(t, "/stocktakes", "OWNER")).body.items;
    expect(history[0]).toMatchObject({ id, status: "APPROVED", varianceTotal: 2_050 });
  });

  it("an abandoned count posts nothing, and counting is not a worker's job", async () => {
    expect((await post(t, "/stocktakes", { id: uuidv7() }, "WORKER")).status).toBe(403);
    const id = (await post(t, "/stocktakes", { id: uuidv7() }, "STOCK")).body.id;
    await put(t, `/stocktakes/${id}/counts/${cement.id}`, { countedQty: 1_000 });
    const before = await t.db.stockMovement.count();
    expect((await post(t, `/stocktakes/${id}/abandon`, {}, "STOCK")).status).toBe(403);
    expect((await post(t, `/stocktakes/${id}/abandon`, {}, "OWNER")).body.status).toBe("ABANDONED");
    expect(await t.db.stockMovement.count()).toBe(before);
    expect((await get(t, "/stocktakes/current", "STOCK")).body).toBeNull();
  });
});

describe("purchase orders — §11, §13.2, §13.3", () => {
  let t: TestApp;
  let cable: FixtureProduct;
  let supplierId: string;

  beforeAll(async () => {
    t = await createTestApp();
    cable = await makeProduct(t, { name: "Մալուխ", priceDram: 1_200, decimalPlaces: 2, uom: "մ", stock: 20_000, costMdram: 800_000 });
    await post(t, `/products/${cable.id}/units`, { uom: "կոճ", factorToStockUom: 50, role: "PURCHASE" }, "OWNER");
    supplierId = (await post(t, "/suppliers", { id: uuidv7(), name: "Էլեկտրոտեխնիկա" }, "OWNER")).body.id;
    await request(t.server).patch(`/api/suppliers/${supplierId}`).set(bearer(t.tokens.OWNER)).send({ leadTimeDays: 5 });
  });
  afterAll(async () => { await t.close(); });

  const order = (lines: Array<{ qty: number; cost: number }>) => ({
    id: uuidv7(), supplierId, note: "",
    lines: lines.map((l) => ({ id: uuidv7(), productId: cable.id, uom: "կոճ", factorToStockUom: 50, qty: l.qty, unitCostMdram: l.cost })),
  });
  const receipt = (poId: string | null, qty: number, uom = "կոճ", factor = 50) => ({
    id: uuidv7(), supplierId, supplierInvoiceNo: "INV-9", landedCostTotal: 0, poId,
    lines: [{ id: uuidv7(), productId: cable.id, uom, factorToStockUom: factor, qty, invoiceUnitCostMdram: 40_000_000 }],
  });

  it("is drafted by the owner, sent, received in two deliveries, and closes itself", async () => {
    const body = order([{ qty: 4_000, cost: 40_000_000 }]); // 4 spools at 40 000
    expect((await post(t, "/purchase-orders", body, "STOCK")).status).toBe(403);
    const draft = await post(t, "/purchase-orders", body, "OWNER");
    expect(draft.status).toBe(201);
    expect(draft.body).toMatchObject({ status: "DRAFT", total: 160_000 });
    expect(draft.body.lines[0]).toMatchObject({ qtyOrdered: 200_000, uom: "կոճ" });
    expect(draft.body.number).toMatch(/^P-\d{6}$/);

    // STOCK does not see drafts, and never sees what an order costs.
    expect((await get(t, `/purchase-orders/${body.id}`, "STOCK")).status).toBe(404);
    expect((await post(t, "/goods-receipts", receipt(body.id, 1_000), "STOCK")).status).toBe(422); // not sent yet

    // A draft can be revised; once sent, it is a document the supplier holds.
    const revised = await request(t.server).put(`/api/purchase-orders/${body.id}`).set(bearer(t.tokens.OWNER)).send(order([{ qty: 5_000, cost: 40_000_000 }]));
    expect(revised.body).toMatchObject({ total: 200_000 });
    expect((await post(t, `/purchase-orders/${body.id}/open`, {}, "OWNER")).body.status).toBe("OPEN");
    expect((await request(t.server).put(`/api/purchase-orders/${body.id}`).set(bearer(t.tokens.OWNER)).send(order([{ qty: 1_000, cost: 1 }]))).status).toBe(422);

    const asStock = (await get(t, `/purchase-orders/${body.id}`, "STOCK")).body;
    expect(asStock).not.toHaveProperty("total");
    expect(asStock.lines[0]).not.toHaveProperty("unitCostMdram");
    expect((await get(t, "/purchase-orders", "STOCK")).body.items.map((p: { id: string }) => p.id)).toEqual([body.id]);

    // Two spools arrive: partial.
    expect((await post(t, "/goods-receipts", receipt(body.id, 2_000), "STOCK")).status).toBe(200);
    let po = (await get(t, `/purchase-orders/${body.id}`, "OWNER")).body;
    expect(po).toMatchObject({ status: "PARTIAL" });
    expect(po.lines[0].qtyReceived).toBe(100_000);
    // Partial orders cannot be cancelled by hand; they are finished by delivery.
    expect((await post(t, `/purchase-orders/${body.id}/cancel`, {}, "OWNER")).status).toBe(422);

    // The rest arrives counted in metres rather than spools: the order still recognises it.
    const metres = await post(t, `/products/${cable.id}/units`, { uom: "մետր", factorToStockUom: 1, role: "PURCHASE" }, "OWNER");
    expect(metres.status).toBe(201);
    expect((await post(t, "/goods-receipts", receipt(body.id, 150_000, "մետր", 1), "STOCK")).status).toBe(200);
    po = (await get(t, `/purchase-orders/${body.id}`, "OWNER")).body;
    expect(po).toMatchObject({ status: "RECEIVED" });
    expect(po.receipts).toHaveLength(2);
    expect((await get(t, "/purchase-orders", "STOCK")).body.items).toEqual([]);
    expect((await post(t, "/goods-receipts", receipt(body.id, 1_000), "STOCK")).status).toBe(422);
  });

  it("refuses a delivery against another supplier's order, and receiving without an order still works", async () => {
    const other = (await post(t, "/suppliers", { id: uuidv7(), name: "Ուրիշ" }, "OWNER")).body.id;
    const body = order([{ qty: 1_000, cost: 40_000_000 }]);
    await post(t, "/purchase-orders", body, "OWNER");
    await post(t, `/purchase-orders/${body.id}/open`, {}, "OWNER");
    expect((await post(t, "/goods-receipts", { ...receipt(body.id, 1_000), supplierId: other }, "STOCK")).status).toBe(400);
    expect((await post(t, "/goods-receipts", receipt(null, 1_000), "STOCK")).status).toBe(200);
    expect((await post(t, `/purchase-orders/${body.id}/cancel`, {}, "OWNER")).body.status).toBe("CANCELLED");
  });

  it("turns a reorder suggestion into a draft for the right supplier, in whole spools", async () => {
    await request(t.server).patch(`/api/products/${cable.id}`).set(bearer(t.tokens.OWNER)).send({ reorderPoint: 1_000_000 });
    const suggestions = (await get(t, "/purchase-orders/suggestions", "OWNER")).body.items;
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ productId: cable.id, supplierId, uom: "կոճ", factorToStockUom: 50 });
    expect(suggestions[0].orderQty % 50_000).toBe(0);

    const made = await post(t, "/purchase-orders/from-suggestions", {}, "OWNER");
    expect(made.status).toBe(201);
    expect(made.body.created).toHaveLength(1);
    expect(made.body.created[0]).toMatchObject({ status: "DRAFT", supplierId });
    // A draft is not yet on its way, so the suggestion stands until the owner sends it.
    expect((await get(t, "/purchase-orders/suggestions", "OWNER")).body.items).toHaveLength(1);
    await post(t, `/purchase-orders/${made.body.created[0].id}/open`, {}, "OWNER");
    expect((await get(t, "/purchase-orders/suggestions", "OWNER")).body.items).toEqual([]);
  });
});

describe("labels — §18", () => {
  let t: TestApp;
  const printed: Label[][] = [];
  const recorder: LabelPrinter = { print: async (labels) => { printed.push([...labels]); } };
  const original = labelPrinter.get();
  beforeAll(async () => { t = await createTestApp(); labelPrinter.set(recorder); });
  afterAll(async () => { labelPrinter.set(original); await t.close(); });

  it("gives an unbarcoded product an internal code on the way, and prints the copies asked for", async () => {
    const sand = await makeProduct(t, { name: "Ավազ", priceDram: 25, uom: "կգ", decimalPlaces: 3 });
    const cement = await makeProduct(t, { name: "Ցեմենտ", priceDram: 3_200, barcode: "4850001234567" });
    const labels = (await get(t, `/labels?ids=${sand.id},${cement.id}`, "STOCK")).body;
    expect(labels.items.find((l: { productId: string }) => l.productId === sand.id)).toMatchObject({ name: "Ավազ", priceDram: 25, unit: "կգ", barcode: "S0000001" });
    expect(labels.items.find((l: { productId: string }) => l.productId === cement.id).barcode).toBe("4850001234567");
    // Asking again does not mint a second code.
    await get(t, `/labels?ids=${sand.id}`, "STOCK");
    expect(await t.db.productBarcode.count({ where: { productId: sand.id } })).toBe(1);

    const res = await post(t, "/print/labels", { items: [{ productId: sand.id, copies: 3 }, { productId: cement.id, copies: 1 }] }, "STOCK");
    expect(res.body).toEqual({ printed: 4 });
    expect(printed.at(-1)!.map((l) => l.barcode)).toEqual(["S0000001", "S0000001", "S0000001", "4850001234567"]);
    expect((await post(t, "/print/labels", { items: [{ productId: sand.id, copies: 1 }] }, "WORKER")).status).toBe(403);
  });

  it("renders ZPL a product name cannot issue commands through", () => {
    const zpl = renderZpl([{ name: "Սոսինձ ^XZ^XA~JR", priceDram: 1_500, unit: "հատ", barcode: "S0000009" }]);
    expect(zpl.match(/\^XA/g)).toHaveLength(1);
    expect(zpl).not.toContain("~JR");
    expect(zpl).toContain("^CI28");
    expect(zpl).toContain("^FDS0000009^FS");
    expect(zpl).toContain("1 500 ֏ / հատ");
  });
});

describe("fiscal receipts — §17", () => {
  let t: TestApp;
  let dir = "";
  let item: FixtureProduct;
  let shiftId: string;
  const original = fiscal.get();

  beforeAll(async () => {
    t = await createTestApp();
    dir = mkdtempSync(path.join(tmpdir(), "simon-fiscal-"));
    item = await makeProduct(t, { name: "Ցեմենտ", priceDram: 3_200, stock: 40_000, costMdram: 2_600_000 });
    shiftId = await openShift(t, "WORKER");
  });
  afterAll(async () => {
    fiscal.set(original);
    rmSync(dir, { recursive: true, force: true });
    await t.close();
  });

  it("issues nothing while no device is configured", async () => {
    fiscal.set(new NoFiscalDevice());
    const sale = saleBody({ shiftId, lines: [{ product: item, qty: 1_000 }] });
    await post(t, "/sales", sale);
    expect(await issueFiscalReceipt(t.db, sale.id)).toBeNull();
    expect((await t.db.sale.findUniqueOrThrow({ where: { id: sale.id } })).fiscalReceiptId).toBeNull();
  });

  it("issues one receipt per sale once a device exists — never for the history before it", async () => {
    const before = saleBody({ shiftId, lines: [{ product: item, qty: 1_000 }] });
    await post(t, "/sales", before);
    clock.advance(1_000);
    try {
      fiscal.set(new FileFiscalDevice(dir));
      await fiscalSince(t.db); // what the server does on starting with a device
      const sale = saleBody({ shiftId, lines: [{ product: item, qty: 2_000 }] });
      clock.advance(1_000);
      await post(t, "/sales", { ...sale, createdAt: clock.iso() });
      // The print route waits for the number and puts it on the paper.
      const printed = await post(t, "/print/receipt", { saleId: sale.id });
      expect(printed.body).toEqual({ printed: true });
      const stored = await t.db.sale.findUniqueOrThrow({ where: { id: sale.id } });
      expect(stored.fiscalReceiptId).toMatch(/^DEV-\d{6}$/);
      expect(await issueFiscalReceipt(t.db, sale.id)).toBe(stored.fiscalReceiptId); // idempotent
      const docs = readdirSync(dir);
      expect(docs).toHaveLength(1);
      expect(JSON.parse(readFileSync(path.join(dir, docs[0]), "utf8"))).toMatchObject({ saleId: sale.id, total: 6_400 });
      // Switching the device on did not fiscalise the sale made before it.
      expect(await issueFiscalReceipt(t.db, before.id)).toBeNull();
    } finally {
      clock.reset();
    }
  });

  it("a device that fails leaves the sale sold, the receipt pending and retried, and the owner told", async () => {
    let calls = 0;
    const flaky: FiscalDevice = {
      enabled: true,
      issue: async (doc) => { calls++; if (calls === 1) throw new Error("paper out"); return { receiptId: `R-${doc.saleId.slice(-4)}` }; },
    };
    fiscal.set(flaky);
    const sale = saleBody({ shiftId, lines: [{ product: item, qty: 1_000 }] });
    clock.advance(5_000);
    try {
      expect((await post(t, "/sales", { ...sale, createdAt: clock.iso() })).status).toBe(200);
      await new Promise((r) => setTimeout(r, 50));
      expect((await t.db.sale.findUniqueOrThrow({ where: { id: sale.id } })).status).toBe("COMPLETED");
      expect((await t.db.sale.findUniqueOrThrow({ where: { id: sale.id } })).fiscalReceiptId).toBeNull();

      clock.advance(11 * 60_000);
      const d = await diagnostics(t.db);
      expect(d.alerts).toContainEqual(expect.objectContaining({ type: "fiscal-pending", count: 1 }));
      expect(d.fiscal).toMatchObject({ pending: 1 });

      expect(await retryPendingFiscal(t.db)).toBe(1);
      expect((await t.db.sale.findUniqueOrThrow({ where: { id: sale.id } })).fiscalReceiptId).toBe(`R-${sale.id.slice(-4)}`);
      expect((await diagnostics(t.db)).alerts.some((a) => a.type === "fiscal-pending")).toBe(false);
    } finally {
      clock.reset();
    }
  });
});
