import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { uuidv7 } from "@simon/shared";
import { replay } from "../domain/stock-replay.ts";
import { runStockDriftCheck } from "../jobs/stock-drift.ts";
import { ConsolePrinter, printer, type Printer } from "../lib/hardware/printer.ts";
import { clock } from "../lib/time.ts";
import { writeSettings } from "../services/settings.service.ts";
import { createTestApp, PINS, type TestApp } from "../test/app.ts";
import { get, makeProduct, openShift, post, saleBody, type FixtureProduct } from "../test/fixtures.ts";

const printDir = mkdtempSync(path.join(tmpdir(), "simon-prints-"));
printer.set(new ConsolePrinter(printDir));

async function reauth(t: TestApp, action: string) {
  const res = await post(t, "/auth/reauth", { adminUserId: t.users.ADMIN.id, pin: PINS.ADMIN, action });
  return res.body.grant as string;
}

describe("checkout", () => {
  let t: TestApp;
  let cable: FixtureProduct;
  let screw: FixtureProduct;
  let shiftId: string;
  beforeAll(async () => {
    t = await createTestApp();
    cable = await makeProduct(t, { name: "Մալուխ 3x2.5", priceDram: 1200, decimalPlaces: 1, uom: "մ", stock: 100_000, costMdram: 800_000, barcode: "4820024700016" });
    screw = await makeProduct(t, { name: "Պտուտակ 4x40", priceDram: 50, stock: 500_000, costMdram: 20_000 });
    shiftId = await openShift(t, "WORKER");
  });
  afterAll(async () => { await t.close(); });

  it("finds a product by barcode and by Latin-typed search (§27.44, product half)", async () => {
    expect((await get(t, "/products/by-barcode/4820024700016")).body.name).toBe("Մալուխ 3x2.5");
    const found = await get(t, "/products?q=malukh");
    expect(found.body.items.map((p: { name: string }) => p.name)).toEqual(["Մալուխ 3x2.5"]);
  });

  it("§27.2 — a split payment records each tender; stock moves and cost is snapshotted", async () => {
    const body = saleBody({ shiftId, lines: [{ product: cable, qty: 2500 }, { product: screw, qty: 10_000 }], payments: [{ method: "CASH", amount: 2000, tenderedAmount: 5000 }, { method: "CARD" }] });
    const res = await post(t, "/sales", body);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3500);
    expect(res.body.payments).toEqual([
      expect.objectContaining({ method: "CASH", amount: 2000, tenderedAmount: 5000, changeGiven: 3000 }),
      expect.objectContaining({ method: "CARD", amount: 1500 }),
    ]);
    const cableRow = await t.db.product.findUniqueOrThrow({ where: { id: cable.id } });
    expect(cableRow.stockQty).toBe(97_500);
    const line = await t.db.saleLine.findFirstOrThrow({ where: { saleId: body.id, productId: cable.id } });
    expect(line.unitCostMdram).toBe(800_000);
    expect(res.body.lines[0]).not.toHaveProperty("unitCostMdram"); // §27.9 on the write path's response
  });

  it("§27.8 — the same id and status is a replay: one sale, one set of movements", async () => {
    const body = saleBody({ shiftId, lines: [{ product: screw, qty: 3000 }] });
    const first = await post(t, "/sales", body);
    const second = await post(t, "/sales", body);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(await t.db.stockMovement.count({ where: { sourceId: body.id } })).toBe(1);
  });

  it("HELD then COMPLETED is a transition, not a replay (§14.3); COMPLETED then HELD is illegal", async () => {
    const held = saleBody({ shiftId, status: "HELD", lines: [{ product: screw, qty: 1000 }] });
    expect((await post(t, "/sales", held)).body.status).toBe("HELD");
    expect(await t.db.stockMovement.count({ where: { sourceId: held.id } })).toBe(0);
    const done = saleBody({ shiftId, id: held.id, lines: [{ product: screw, qty: 2000 }] });
    const res = await post(t, "/sales", done);
    expect(res.body.status).toBe("COMPLETED");
    expect(res.body.total).toBe(100);
    const back = await post(t, "/sales", { ...held, sentAt: new Date().toISOString() });
    expect(back.status).toBe(422);
    expect(back.body.type).toMatch(/illegal-transition$/);
  });

  it("§27.28 — a forged line total is rejected and a discount above the cap needs admin re-auth", async () => {
    const forged = saleBody({ shiftId, lines: [{ product: cable, qty: 1000 }] });
    forged.lines[0].lineTotal = 1;
    expect((await post(t, "/sales", forged)).status).toBe(400);

    const overCap = saleBody({ shiftId, lines: [{ product: cable, qty: 10_000 }], saleDiscount: 1_200 }); // 10%, cap is 5%
    const refused = await post(t, "/sales", overCap);
    expect(refused.status).toBe(422);
    expect(refused.body.type).toMatch(/discount-above-cap$/);

    const override = saleBody({ shiftId, lines: [{ product: cable, qty: 1000, unitPriceMdram: 900_000, priceOverridden: true }], overrideReason: "ծանոթ" });
    expect((await post(t, "/sales", override)).status).toBe(422);

    const grant = await reauth(t, "discount");
    const allowed = saleBody({ shiftId, lines: [{ product: cable, qty: 10_000 }], saleDiscount: 1_200, reauthGrant: grant, overrideReason: "մեծածախ" });
    expect((await post(t, "/sales", allowed)).status).toBe(200);
    expect(await t.db.auditLog.count({ where: { action: "sale.discountAboveCap", entityId: allowed.id } })).toBe(1);
  });

  it("§27.36 server half — from the queue, above the cap is flagged up to the ceiling and refused past it", async () => {
    const flagged = saleBody({ shiftId, queued: true, lines: [{ product: cable, qty: 10_000 }], saleDiscount: 900 });
    const res = await post(t, "/sales", flagged);
    expect(res.status).toBe(200);
    expect(res.body.warnings.map((w: { type: string }) => w.type)).toContain("discount-above-cap-on-sync");
    const past = saleBody({ shiftId, queued: true, lines: [{ product: cable, qty: 10_000 }], saleDiscount: 1_500 });
    expect((await post(t, "/sales", past)).status).toBe(422);
  });

  it("a queued sale at a stale price stands at the quoted price and is flagged (§15.3)", async () => {
    const stale = saleBody({ shiftId, queued: true, lines: [{ product: screw, qty: 1000, unitPriceMdram: 45_000 }] });
    const res = await post(t, "/sales", stale);
    expect(res.body.total).toBe(45);
    expect(res.body.warnings.map((w: { type: string }) => w.type)).toContain("price-changed-on-sync");
  });

  it("refuses a decimal quantity on a piece-counted product", async () => {
    const bad = saleBody({ shiftId, lines: [{ product: screw, qty: 1500 }] });
    expect((await post(t, "/sales", bad)).status).toBe(400);
  });

  it("insufficient stock warns and completes; strict mode refuses at the counter but never the queue (§13.6)", async () => {
    const rare = await makeProduct(t, { name: "Ցեմենտ M400", priceDram: 3000, stock: 1000, costMdram: 2_000_000 });
    const res = await post(t, "/sales", saleBody({ shiftId, lines: [{ product: rare, qty: 2000 }] }));
    expect(res.status).toBe(200);
    expect(res.body.warnings).toEqual([expect.objectContaining({ type: "insufficient-stock", productId: rare.id })]);
    await t.db.$transaction((tx) => writeSettings(tx, { "stock.strictNegative": true }, null));
    try {
      const strict = await post(t, "/sales", saleBody({ shiftId, lines: [{ product: rare, qty: 1000 }] }));
      expect(strict.status).toBe(422);
      expect(strict.body.type).toMatch(/insufficient-stock-strict$/);
      expect((await post(t, "/sales", saleBody({ shiftId, queued: true, lines: [{ product: rare, qty: 1000 }] }))).status).toBe(200);
    } finally {
      await t.db.$transaction((tx) => writeSettings(tx, { "stock.strictNegative": false }, null));
    }
  });

  it("refuses to complete a sale while the tax regime is unset (§10.8), but still parks one", async () => {
    await t.db.setting.delete({ where: { key: "tax.regime" } });
    try {
      const res = await post(t, "/sales", saleBody({ shiftId, lines: [{ product: screw, qty: 1000 }] }));
      expect(res.body.type).toMatch(/tax-regime-not-set$/);
      expect((await post(t, "/sales", saleBody({ shiftId, status: "HELD", lines: [{ product: screw, qty: 1000 }] }))).status).toBe(200);
    } finally {
      await t.db.$transaction((tx) => writeSettings(tx, { "tax.regime": "VAT" }, null));
    }
  });
});

describe("§27.18 — tax under both bases, and a reprint reproduces the sale", () => {
  let t: TestApp;
  let item: FixtureProduct;
  let shiftId: string;
  beforeAll(async () => {
    t = await createTestApp();
    item = await makeProduct(t, { name: "Ներկ", priceDram: 6000, stock: 10_000, costMdram: 4_000_000 });
    shiftId = await openShift(t, "WORKER");
  });
  afterAll(async () => { await t.close(); });

  it("inclusive: tax inside the total; exclusive: three lines that add up and a larger total", async () => {
    const inc = await post(t, "/sales", saleBody({ shiftId, lines: [{ product: item, qty: 1000 }] }));
    expect(inc.body).toMatchObject({ total: 6000, taxTotal: 1000, priceBasis: "INCLUSIVE" });

    const exc = await post(t, "/sales", saleBody({ shiftId, basis: "EXCLUSIVE", lines: [{ product: item, qty: 1000 }] }));
    expect(exc.body).toMatchObject({ subtotal: 6000, taxTotal: 1200, total: 7200, priceBasis: "EXCLUSIVE" });

    const turnover = await post(t, "/sales", saleBody({ shiftId, lines: [{ product: item, qty: 1000, taxRateBp: 0 }] }));
    expect(turnover.body).toMatchObject({ total: 6000, taxTotal: 0 });

    const before = (await post(t, "/print/receipt", { saleId: exc.body.id })).status;
    expect(before).toBe(200);
    const files = () => readdirSync(printDir).filter((f) => f.includes(exc.body.id));
    await t.db.$transaction((tx) => writeSettings(tx, { "tax.priceBasis": "INCLUSIVE" }, null));
    await post(t, "/print/receipt", { saleId: exc.body.id });
    const [a, b] = files().map((f) => readFileSync(path.join(printDir, f), "utf8"));
    expect(b).toBe(a);
    expect(a).toContain("ԱԱՀ");
  });
});

describe("shifts, returns and the drawer", () => {
  let t: TestApp;
  let item: FixtureProduct;
  beforeEach(async () => {
    t?.close && (await t.close());
    t = await createTestApp();
    item = await makeProduct(t, { name: "Փական", priceDram: 1000, stock: 1_000_000, costMdram: 600_000 });
  });
  afterAll(async () => { await t.close(); });

  it("§27.7 — the worked figure: every term once, variance zero or −500 with a note", async () => {
    const shiftId = await openShift(t, "WORKER", 20_000);
    expect((await post(t, "/sales", saleBody({ shiftId, lines: [{ product: item, qty: 155_000 }] }))).status).toBe(200); // 155 000 cash
    // Repayments arrive with the debt book (Phase 2); the formula term is exercised with the row it would write.
    await t.db.cashMovement.create({ data: { id: uuidv7(), shiftId, businessDate: "2026-09-15", type: "REPAYMENT", amount: 15_000, sourceType: "DebtEntry", sourceId: uuidv7(), userId: t.users.WORKER.id, createdAt: new Date().toISOString() } });
    const cash = (type: string, amount: number, reasonCode: string | null = null) => post(t, "/cash-movements", { id: uuidv7(), shiftId, type, amount, reasonCode, reason: "թեստ", createdAt: new Date().toISOString(), queued: false });
    expect((await cash("PAY_IN", 5_000)).status).toBe(200);
    expect((await cash("PAY_OUT", 12_000, "EXPENSE")).status).toBe(200);
    expect((await cash("DROP", 50_000)).status).toBe(200);
    // A cash refund of 8 000 (§27.25) against the 155 000 sale: return 8 items.
    const sale = (await get(t, "/sales?status=COMPLETED")).body.items[0];
    const ret = await post(t, "/sale-returns", { id: uuidv7(), originalSaleId: sale.id, shiftId, reason: "չհամապատասխանեց", lines: [{ id: uuidv7(), saleLineId: sale.lines[0].id, qty: 8000, restock: true }], createdAt: new Date().toISOString(), sentAt: new Date().toISOString(), queued: false });
    expect(ret.status).toBe(200);
    expect(ret.body.tenders).toEqual([{ method: "CASH", amount: 8_000 }]);

    const begin = await post(t, `/shifts/${shiftId}/begin-close`, { unsyncedAtClose: 0 });
    expect(begin.body.figures).toMatchObject({ openingFloat: 20_000, cashSales: 155_000, repayments: 15_000, payIns: 5_000, refunds: 8_000, payOuts: 12_000, drops: 50_000, expected: 125_000 });

    // −500 needs a note.
    const noNote = await post(t, `/shifts/${shiftId}/close`, { breakdown: [{ value: 20_000, count: 6 }, { value: 1_000, count: 4 }, { value: 500, count: 1 }], unsyncedAtClose: 0 });
    expect(noNote.status).toBe(400);
    expect(noNote.body.field).toBe("note");
    const closed = await post(t, `/shifts/${shiftId}/close`, { breakdown: [{ value: 20_000, count: 6 }, { value: 1_000, count: 4 }, { value: 500, count: 1 }], note: "մանր", unsyncedAtClose: 0 });
    expect(closed.body).toMatchObject({ kind: "Z", counted: 124_500, variance: -500 });
  });

  it("§27.6 — a partial return restocks the quantity at the original cost, after the average has moved", async () => {
    const shiftId = await openShift(t, "WORKER");
    const sale = (await post(t, "/sales", saleBody({ shiftId, lines: [{ product: item, qty: 5000 }] }))).body;
    await t.db.$transaction(async (tx) => {
      const { postMovement } = await import("../services/stock-ledger.service.ts");
      await postMovement(tx, { productId: item.id, type: "PURCHASE_RECEIPT", qtyDelta: 995_000, unitCostMdram: 900_000, source: { type: "Test", id: "r2" }, userId: t.users.ADMIN.id });
    });
    const before = await t.db.product.findUniqueOrThrow({ where: { id: item.id } });
    const res = await post(t, "/sale-returns", { id: uuidv7(), originalSaleId: sale.id, shiftId, reason: "ավել", lines: [{ id: uuidv7(), saleLineId: sale.lines[0].id, qty: 2000, restock: true }], createdAt: new Date().toISOString(), sentAt: new Date().toISOString(), queued: false });
    expect(res.status).toBe(200);
    const movement = await t.db.stockMovement.findFirstOrThrow({ where: { sourceId: res.body.id, type: "SALE_RETURN" } });
    expect(movement).toMatchObject({ qtyDelta: 2000, unitCostMdram: 600_000 });
    const after = await t.db.product.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.stockQty).toBe(before.stockQty + 2000);
    // Per line, not per sale: returning the remaining 3 is fine, a fourth is not.
    const rest = await post(t, "/sale-returns", { id: uuidv7(), originalSaleId: sale.id, shiftId, reason: "ավել", lines: [{ id: uuidv7(), saleLineId: sale.lines[0].id, qty: 4000, restock: true }], createdAt: new Date().toISOString(), sentAt: new Date().toISOString(), queued: false });
    expect(rest.status).toBe(422);
    expect(rest.body).toMatchObject({ remaining: 3000 });
  });

  it("§27.23 — a basket parked on one till and completed on another reconciles on the second", async () => {
    const workerShift = await openShift(t, "WORKER");
    const stockShift = await openShift(t, "STOCK");
    const held = saleBody({ shiftId: workerShift, status: "HELD", lines: [{ product: item, qty: 3000 }] });
    await post(t, "/sales", held);
    expect((await post(t, `/shifts/${workerShift}/begin-close`, { unsyncedAtClose: 0 })).body.type).toMatch(/shift-has-open-baskets$/);
    expect((await post(t, `/sales/${held.id}/resume`, { shiftId: stockShift }, "STOCK")).body.status).toBe("DRAFT");
    const done = saleBody({ shiftId: stockShift, id: held.id, lines: [{ product: item, qty: 3000 }], prefix: "AB" });
    expect((await post(t, "/sales", done, "STOCK")).status).toBe(200);
    const x = (await get(t, `/shifts/${stockShift}/x-report`, "STOCK")).body;
    expect(x.figures.cashSales).toBe(3000);
    expect(x.transfers).toEqual([expect.objectContaining({ saleId: held.id, direction: "in", fromShiftId: workerShift, toShiftId: stockShift })]);
    expect((await post(t, `/shifts/${workerShift}/begin-close`, { unsyncedAtClose: 0 })).status).toBe(200);
  });

  it("§27.24 and §27.30 — a sale synced after its shift closed posts, is stated late, and causes no drift", async () => {
    const shiftId = await openShift(t, "WORKER", 0);
    await post(t, `/shifts/${shiftId}/begin-close`, { unsyncedAtClose: 1 });
    const z = await post(t, `/shifts/${shiftId}/close`, { breakdown: [], unsyncedAtClose: 1 });
    expect(z.body.variance).toBe(0);
    const worker = await t.loginAs("WORKER"); // the close ended the old session (§27.40)
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const late = saleBody({ shiftId, queued: true, createdAt: hourAgo, lines: [{ product: item, qty: 4000 }] });
    const res = await post(t, "/sales", late, "WORKER", worker.token);
    expect(res.status).toBe(200);
    expect(res.body.shiftId).toBe(shiftId);
    const report = (await get(t, `/shifts/${shiftId}/z-report`, "ADMIN")).body;
    expect(report.variance).toBe(0);
    expect(report.figures.expected).toBe(0);
    expect(report.lateArrivals).toEqual([expect.objectContaining({ sourceId: late.id, amount: 4000 })]);
    const rows = await t.db.stockMovement.findMany({ where: { productId: item.id } });
    const cached = await t.db.product.findUniqueOrThrow({ where: { id: item.id } });
    expect(replay(rows.map((r) => ({ ...r, type: r.type as never })))).toEqual({ stockQty: cached.stockQty, avgCostMdram: cached.avgCostMdram });
    expect((await runStockDriftCheck(t.db)).flagged).toBe(0);
  });

  it("§27.40 — the session that closed a shift needs a PIN before the next sale", async () => {
    const shiftId = await openShift(t, "WORKER");
    await post(t, `/shifts/${shiftId}/begin-close`, { unsyncedAtClose: 0 });
    await post(t, `/shifts/${shiftId}/close`, { breakdown: [{ value: 20_000, count: 1 }], unsyncedAtClose: 0 });
    expect((await get(t, "/auth/me")).status).toBe(401);
  });

  it("§27.37 — print after commit; a jam leaves the sale; the drawer opens once per cash sale", async () => {
    const shiftId = await openShift(t, "WORKER");
    const sale = (await post(t, "/sales", saleBody({ shiftId, lines: [{ product: item, qty: 2000 }] }))).body;
    const kicks: string[] = [];
    const recording: Printer = { print: async () => { kicks.push("print"); }, kick: async () => { kicks.push("kick"); } };
    printer.set(recording);
    try {
      expect((await post(t, "/print/receipt", { saleId: sale.id })).status).toBe(200);
      expect((await post(t, "/print/receipt", { saleId: sale.id })).status).toBe(200);
      expect(kicks).toEqual(["print", "print"]); // no print call ever opens the drawer

      printer.set({ print: async () => { throw new Error("jam"); }, kick: async () => {} });
      const jam = await post(t, "/print/receipt", { saleId: sale.id });
      expect(jam.status).toBe(500);
      expect(jam.body.component).toBe("printer");
      expect((await get(t, `/sales/${sale.id}`)).body.status).toBe("COMPLETED");

      printer.set(recording);
      expect((await post(t, "/cash-drawer/open", { document: { type: "Sale", id: sale.id } })).body.decision).toBe("free");
      const second = await post(t, "/cash-drawer/open", { document: { type: "Sale", id: sale.id } });
      expect(second.status).toBe(403);
      expect(second.body.type).toMatch(/reauth-required$/);
      const grant = await reauth(t, "noSaleDrawer");
      const noSale = await post(t, "/cash-drawer/open", { document: { type: "Sale", id: sale.id }, reauthGrant: grant, reason: "մանր" });
      expect(noSale.body.decision).toBe("no-sale");
      expect(await t.db.cashMovement.count({ where: { type: "NO_SALE", shiftId } })).toBe(1);

      const ret = await post(t, "/sale-returns", { id: uuidv7(), originalSaleId: sale.id, shiftId, reason: "x", lines: [{ id: uuidv7(), saleLineId: sale.lines[0].id, qty: 1000, restock: false }], createdAt: new Date().toISOString(), sentAt: new Date().toISOString(), queued: false });
      expect((await post(t, "/cash-drawer/open", { document: { type: "SaleReturn", id: ret.body.id } })).body.decision).toBe("free");
      expect(await t.db.auditLog.count({ where: { action: "cashDrawer.open" } })).toBe(3);
      expect(kicks.filter((k) => k === "kick")).toHaveLength(3);
    } finally {
      printer.set(new ConsolePrinter(printDir));
    }
  });

  it("a damaged return writes the goods back and off again, leaving the shelf count true", async () => {
    const shiftId = await openShift(t, "WORKER");
    const sale = (await post(t, "/sales", saleBody({ shiftId, lines: [{ product: item, qty: 2000 }] }))).body;
    const before = (await t.db.product.findUniqueOrThrow({ where: { id: item.id } })).stockQty;
    const ret = await post(t, "/sale-returns", { id: uuidv7(), originalSaleId: sale.id, shiftId, reason: "կոտրված", lines: [{ id: uuidv7(), saleLineId: sale.lines[0].id, qty: 2000, restock: false }], createdAt: new Date().toISOString(), sentAt: new Date().toISOString(), queued: false });
    const types = (await t.db.stockMovement.findMany({ where: { OR: [{ sourceId: ret.body.id }, { note: `SaleReturn ${ret.body.id}` }] }, orderBy: { seq: "asc" } })).map((m) => [m.type, m.reasonCode]);
    expect(types).toEqual([["SALE_RETURN", null], ["WRITE_OFF", "DAMAGE"]]);
    expect((await t.db.product.findUniqueOrThrow({ where: { id: item.id } })).stockQty).toBe(before);
  });
});

describe("catalogue rules", () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.close(); clock.reset(); });

  it("§27.21 — decimalPlaces cannot change once movements exist; a price change needs re-auth and keeps history", async () => {
    const p = await makeProduct(t, { name: "Ավազ", priceDram: 500, decimalPlaces: 0, stock: 10_000, costMdram: 300_000 });
    const change = await t.app && (await import("supertest")).default(t.app).patch(`/api/products/${p.id}`).set({ Authorization: `Bearer ${t.tokens.ADMIN}` });
    const blocked = await change!.send({ decimalPlaces: 2 });
    expect(blocked.status).toBe(422);
    expect(blocked.body.type).toMatch(/immutable-after-movements$/);
    const req = (await import("supertest")).default(t.app);
    expect((await req.patch(`/api/products/${p.id}`).set({ Authorization: `Bearer ${t.tokens.ADMIN}` }).send({ sellPriceMdram: 550_000 })).body.type).toMatch(/reauth-required$/);
    const grant = await reauth(t, "priceChange");
    const ok = await req.patch(`/api/products/${p.id}`).set({ Authorization: `Bearer ${t.tokens.ADMIN}` }).send({ sellPriceMdram: 550_000, reauthGrant: grant });
    expect(ok.body.sellPriceMdram).toBe(550_000);
    expect(await t.db.priceHistory.count({ where: { productId: p.id } })).toBe(2);
    expect(await t.db.auditLog.count({ where: { action: "product.priceChange", entityId: p.id } })).toBe(1);
  });

  it("a barcode belongs to one product forever; a retired code still scans", async () => {
    const a = await makeProduct(t, { name: "Ա", priceDram: 1, barcode: "111" });
    const b = await makeProduct(t, { name: "Բ", priceDram: 1 });
    const dup = await post(t, `/products/${b.id}/barcodes`, { barcode: "111" }, "ADMIN");
    expect(dup.status).toBe(422);
    expect(dup.body).toMatchObject({ productId: a.id, productName: "Ա" });
    const internal = await post(t, `/products/${b.id}/barcodes`, {}, "ADMIN");
    expect(internal.body.barcodes[0].barcode).toMatch(/^S\d{7}$/);
    await post(t, `/products/${a.id}/barcodes/111/retire`, {}, "ADMIN");
    expect((await get(t, "/products/by-barcode/111")).body.id).toBe(a.id);
  });

  it("a worker can quick-add a product (§7.4) but not edit one", async () => {
    const res = await post(t, "/products", { id: uuidv7(), name: "Նոր", sellPriceMdram: 100_000, stockUom: "հատ", decimalPlaces: 0, barcode: "999" });
    expect(res.status).toBe(201);
    const req = (await import("supertest")).default(t.app);
    expect((await req.patch(`/api/products/${res.body.id}`).set({ Authorization: `Bearer ${t.tokens.WORKER}` }).send({ name: "x" })).status).toBe(403);
  });
});
