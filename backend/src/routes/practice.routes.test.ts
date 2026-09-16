/**
 * §27.19 — a full shift spent in practice mode: opening a shift, cash and debt sales, a return and
 * a close. Every one of those succeeds, the real database gains no sale, movement or debt entry,
 * and exactly two `AuditLog` rows record that practice was entered and left (§7.2, §19.4).
 */
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { uuidv7 } from "@simon/shared";
import { bearer, createTestApp, type TestApp } from "../test/app.ts";
import { makeProduct, post, saleBody } from "../test/fixtures.ts";
import { openPractice, practicePaths } from "../services/practice.service.ts";
import { closeClient, dbFor } from "../lib/db.ts";
import { printSaleReceipt } from "../services/print.service.ts";

describe("practice mode", () => {
  let t: TestApp;
  let dir = "";
  const originalFile = practicePaths.file;

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "simon-practice-"));
    practicePaths.file = path.join(dir, "practice.db");
    t = await createTestApp({ practice: openPractice });
  });
  afterAll(async () => {
    await closeClient("PRACTICE");
    practicePaths.file = originalFile;
    rmSync(dir, { recursive: true, force: true });
    await t.close();
  });

  it("a whole shift happens in the practice file and nothing reaches the real one", async () => {
    const product = await makeProduct(t, { name: "Ցեմենտ", priceDram: 3_200, stock: 40_000, costMdram: 2_600_000, barcode: "999" });
    const liveBefore = {
      sales: await t.db.sale.count(), movements: await t.db.stockMovement.count(),
      debt: await t.db.debtEntry.count(), shifts: await t.db.shift.count(), customers: await t.db.customer.count(),
    };

    expect((await post(t, "/session/mode", { mode: "PRACTICE" })).body).toEqual({ mode: "PRACTICE" });
    expect(existsSync(practicePaths.file)).toBe(true);

    // The catalogue, the settings and the stock came across, so a practice sale prices like a real one.
    const catalogue = (await request(t.server).get("/api/products?filter=all&limit=50").set(bearer(t.tokens.WORKER))).body.items;
    expect(catalogue.find((p: { name: string }) => p.name === "Ցեմենտ")).toMatchObject({ stockQty: 40_000 });
    expect((await request(t.server).get("/api/settings/client").set(bearer(t.tokens.WORKER))).body.taxRegime).toBe("VAT");

    const shiftId = uuidv7();
    expect((await post(t, "/shifts", { id: shiftId, openingFloat: 20_000 })).status).toBe(201);

    const cash = saleBody({ shiftId, lines: [{ product, qty: 2_000, taxRateBp: 2000 }] });
    expect((await post(t, "/sales", cash)).status).toBe(200);

    const customer = (await post(t, "/customers", { id: uuidv7(), fullName: "Փորձնական հաճախորդ" })).body;
    const debt = saleBody({ shiftId, lines: [{ product, qty: 1_000, taxRateBp: 2000 }], payments: [{ method: "DEBT" }], customerId: customer.id });
    expect((await post(t, "/sales", debt)).status).toBe(200);

    const completed = (await request(t.server).get(`/api/sales/${cash.id}`).set(bearer(t.tokens.WORKER))).body;
    const ret = await post(t, "/sale-returns", {
      id: uuidv7(), originalSaleId: completed.id, shiftId, reason: "փորձ",
      lines: [{ id: uuidv7(), saleLineId: completed.lines[0].id, qty: 1_000, restock: true }],
      createdAt: new Date().toISOString(), sentAt: new Date().toISOString(), queued: false,
    });
    expect(ret.status).toBe(200);

    // The receipt is watermarked and the drawer stays shut — the money in it is real.
    expect((await post(t, "/print/receipt", { saleId: cash.id })).body).toEqual({ printed: true });
    const rendered = await printSaleReceipt(await dbFor("PRACTICE"), cash.id, { practice: true });
    expect(rendered.lines[0]).toContain("ՓՈՐՁՆԱԿԱՆ");
    expect(rendered.lines.at(-1)).toContain("ՓՈՐՁՆԱԿԱՆ");
    expect((await post(t, "/cash-drawer/open", { document: { type: "Sale", id: cash.id } })).body).toMatchObject({ decision: "practice", opened: false });

    await post(t, `/shifts/${shiftId}/begin-close`, { unsyncedAtClose: 0 });
    // 20 000 float + 6 400 cash sale − 3 200 refunded = 23 200, counted exactly.
    const closed = await post(t, `/shifts/${shiftId}/close`, {
      breakdown: [{ value: 20_000, count: 1 }, { value: 2_000, count: 1 }, { value: 1_000, count: 1 }, { value: 200, count: 1 }],
      unsyncedAtClose: 0,
    });
    expect(closed.status).toBe(200);
    expect(closed.body.kind).toBe("Z");

    // The real database is exactly where it was.
    expect({
      sales: await t.db.sale.count(), movements: await t.db.stockMovement.count(),
      debt: await t.db.debtEntry.count(), shifts: await t.db.shift.count(), customers: await t.db.customer.count(),
    }).toEqual(liveBefore);

    // A practice shift never owned a real session, so closing it leaves the worker signed in.
    expect((await post(t, "/session/mode", { mode: "LIVE" })).body).toEqual({ mode: "LIVE" });

    const audits = await t.db.auditLog.findMany({ where: { action: { in: ["session.practiceEnter", "session.practiceExit"] } }, orderBy: { createdAt: "asc" } });
    expect(audits.map((a) => a.action)).toEqual(["session.practiceEnter", "session.practiceExit"]);
    // The file dies with the last person practising.
    expect(existsSync(practicePaths.file)).toBe(false);
  });
});
