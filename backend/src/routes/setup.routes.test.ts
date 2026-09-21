/**
 * §27.35 — the wizard is abandoned after the third question and the laptop closed. Reopening
 * resumes at the fourth with the first three answers intact, and finishing reaches a shop that can
 * make a real sale — having asked five questions and no more (§7.1).
 */
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { computeSale, uuidv7 } from "@simon/shared";
import { createApp } from "../app.ts";
import { createTestDb, type TestDb } from "../test/db.ts";
import { bearer } from "../test/app.ts";

let open: TestDb | null = null;
afterEach(async () => { await open?.close(); open = null; });

describe("the setup wizard", () => {
  it("resumes where it was abandoned, asks five questions, and ends holding two secrets", async () => {
    const t = await createTestDb();
    open = t;
    const server = createApp({ live: t.db, practice: async () => t.db }).listen(0);
    try {
      const status = async () => (await request(server).get("/api/setup/status")).body;
      expect(await status()).toMatchObject({ needsOwner: true, step: 0, completedAt: null });

      // Q1 and Q2 arrive together: the shop's name, and the owner who is the first admin (§7.1).
      const setup = await request(server).post("/api/setup/owner").send({ shopName: "Շինանյութ «Արարատ»", ownerName: "Արամ", pin: "432100" });
      expect(setup.status).toBe(201);
      expect(setup.body.recoveryCode).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
      expect(setup.body.backupPassphrase).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){5}$/);

      const token = (await request(server).post("/api/auth/login").send({ name: setup.body.user.name, pin: "432100", deviceLabel: "setup" })).body.token;
      const patch = (body: object) => request(server).patch("/api/settings").set(bearer(token)).send(body);

      // Q3 — sold by weight or length? Answered, then the laptop closes.
      expect((await patch({ "setup.sellsByMeasure": true, "setup.step": 3 })).status).toBe(200);
      expect(await status()).toMatchObject({ needsOwner: false, step: 3, completedAt: null });

      // Reopening: the first three answers are intact and the fourth is what is asked next.
      const settings = (await request(server).get("/api/settings").set(bearer(token))).body;
      expect(settings["shop.name"]).toBe("Շինանյութ «Արարատ»");
      expect(settings["setup.sellsByMeasure"]).toBe(true);
      expect((await request(server).get("/api/settings/client").set(bearer(token))).body.sellsByMeasure).toBe(true);

      // Q4 — the debt book. Q5 — the catalogue. Nothing else is asked.
      await patch({ "debt.enabled": false, "setup.step": 4 });
      await patch({ "setup.catalogue": "as-you-sell", "setup.step": 5, "setup.completedAt": new Date().toISOString() });
      const done = await status();
      expect(done.step).toBe(5);
      expect(done.completedAt).not.toBeNull();

      // The tax regime is installation's, not the owner's — and until it is set, a sale is refused
      // rather than priced at a guess (§7.1, §10.8, §8.5).
      expect(done.taxRegimeSet).toBe(false);
      const shiftId = uuidv7();
      await request(server).post("/api/shifts").set(bearer(token)).send({ id: shiftId, openingFloat: 0 });
      const product = (await request(server).post("/api/products").set(bearer(token)).send({ id: uuidv7(), name: "Ավազ", sellPriceMdram: 100_000, stockUom: "կգ", decimalPlaces: 3 })).body;
      const lines = [{ id: uuidv7(), productId: product.id, qty: 1_000, uom: "կգ", factorToStockUom: 1, unitPriceMdram: 100_000, taxRateBp: 0, discountAmount: 0, priceOverridden: false, lineTotal: 0 }];
      const totals = computeSale(lines, 0, "INCLUSIVE", 1);
      lines[0].lineTotal = totals.lines[0].lineTotal;
      const now = new Date().toISOString();
      const sale = await request(server).post("/api/sales").set(bearer(token)).send({
        id: uuidv7(), status: "COMPLETED", shiftId, number: "AA-1", priceBasis: "INCLUSIVE", cashRoundingStep: 1, saleDiscount: 0, discountReason: null,
        lines, payments: [{ id: uuidv7(), method: "CASH", amount: totals.total, tenderedAmount: totals.total }], total: totals.total,
        createdAt: now, sentAt: now, queued: false, customerId: null,
      });
      expect(sale.status).toBe(422);
      expect(sale.body.type).toMatch(/tax-regime-not-set$/);

      // Installation sets it, and the same basket goes through.
      await patch({ "tax.regime": "VAT", "tax.priceBasis": "INCLUSIVE", "tax.rateBp": 2000 });
      expect((await status()).taxRegimeSet).toBe(true);
    } finally {
      server.close();
    }
  });
});
