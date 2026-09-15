import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { uuidv7 } from "@simon/shared";
import { logger } from "../lib/logger.ts";
import { writeSettings } from "../services/settings.service.ts";
import { bearer, createTestApp, PINS, type TestApp } from "../test/app.ts";
import { backdatedCharge, get, makeCustomer, makeProduct, openShift, post, repayment, saleBody, type FixtureProduct } from "../test/fixtures.ts";

async function reauth(t: TestApp, action: string) {
  return (await post(t, "/auth/reauth", { adminUserId: t.users.ADMIN.id, pin: PINS.ADMIN, action })).body.grant as string;
}
const ledger = async (t: TestApp, id: string, role: "WORKER" | "ADMIN" = "WORKER") => (await get(t, `/customers/${id}/ledger`, role)).body;
const patch = (t: TestApp, path: string, body: object) => request(t.app).patch(`/api${path}`).set(bearer(t.tokens.ADMIN)).send(body);

describe("debt sale — §27.12, §12.2, §14.6", () => {
  let t: TestApp;
  let item: FixtureProduct;
  let shiftId: string;
  beforeAll(async () => {
    t = await createTestApp();
    item = await makeProduct(t, { name: "Ցեմենտ", priceDram: 10_000, stock: 1_000_000, costMdram: 7_000_000 });
    shiftId = await openShift(t, "WORKER");
  });
  afterAll(async () => { await t.close(); });

  it("a worker creates a customer mid-sale; a duplicate phone is caught with the existing record", async () => {
    const c = await makeCustomer(t, "Դավիթ Սարգսյան", "+374 91 12-34-56");
    const dup = await post(t, "/customers", { id: uuidv7(), fullName: "Դավիթ Ս.", phone: "37491123456" });
    expect(dup.status).toBe(422);
    expect(dup.body).toMatchObject({ customerId: c.id });
    expect((await get(t, "/customers?q=Dav")).body.items.map((x: { id: string }) => x.id)).toContain(c.id); // §27.44, customer half
  });

  it("records the charge, and the balance with its age is readable before the next sale", async () => {
    const c = await makeCustomer(t, "Արմեն Կարապետյան");
    await backdatedCharge(t, c.id, 12_000, 40);
    const before = await ledger(t, c.id);
    expect(before.outstanding).toBe(12_000);
    expect(before.aging.oldestChargeDays).toBe(40);
    expect(before.customer).not.toHaveProperty("discountBp");
    const sale = saleBody({ shiftId, customerId: c.id, lines: [{ product: item, qty: 2000 }], payments: [{ method: "CASH", amount: 5_000 }, { method: "DEBT" }], dueDate: "2026-10-01" });
    expect((await post(t, "/sales", sale)).status).toBe(200);
    const after = await ledger(t, c.id);
    expect(after.outstanding).toBe(27_000);
    expect(after.entries.find((e: { type: string; saleId: string }) => e.type === "CHARGE" && e.saleId === sale.id)).toMatchObject({ amount: 15_000, dueDate: "2026-10-01", saleNumber: sale.number });
  });

  it("over the limit: refused without re-auth, allowed with an admin and a reason, refused outright in strict mode, flagged from the queue", async () => {
    const c = await makeCustomer(t, "Անի Մելքոնյան");
    await backdatedCharge(t, c.id, 45_000, 5);
    const over = () => saleBody({ shiftId, customerId: c.id, lines: [{ product: item, qty: 1000 }], payments: [{ method: "DEBT" }] });
    const refused = await post(t, "/sales", over());
    expect(refused.status).toBe(422);
    expect(refused.body).toMatchObject({ limit: 50_000, current: 45_000, wouldBe: 55_000 });

    const grant = await reauth(t, "creditLimitOverride");
    const allowed = over();
    expect((await post(t, "/sales", { ...allowed, limitGrant: grant, limitReason: "հին հաճախորդ" })).status).toBe(200);
    expect(await t.db.auditLog.count({ where: { action: "debt.creditLimitOverride", reason: "հին հաճախորդ" } })).toBe(1);

    await t.db.$transaction((tx) => writeSettings(tx, { "debt.strictLimit": true }, null));
    try {
      const strictGrant = await reauth(t, "creditLimitOverride");
      const strict = await post(t, "/sales", { ...over(), limitGrant: strictGrant, limitReason: "x" });
      expect(strict.body).toMatchObject({ status: 422, strict: true });
      const queued = await post(t, "/sales", { ...over(), queued: true });
      expect(queued.status).toBe(200);
      expect(queued.body.warnings.map((w: { type: string }) => w.type)).toContain("credit-limit-exceeded-on-sync");
    } finally {
      await t.db.$transaction((tx) => writeSettings(tx, { "debt.strictLimit": false }, null));
    }
  });

  it("a blocked customer is refused at the counter and flagged from the queue", async () => {
    const c = await makeCustomer(t, "Սամվել");
    expect((await patch(t, `/customers/${c.id}`, { isBlocked: true })).status).toBe(200);
    const sale = () => saleBody({ shiftId, customerId: c.id, lines: [{ product: item, qty: 1000 }], payments: [{ method: "DEBT" }] });
    expect((await post(t, "/sales", sale())).body.type).toMatch(/customer-blocked$/);
    expect((await post(t, "/sales", { ...sale(), queued: true })).body.warnings.map((w: { type: string }) => w.type)).toContain("customer-blocked-on-sync");
    expect((await request(t.app).patch(`/api/customers/${c.id}`).set(bearer(t.tokens.WORKER)).send({ isBlocked: false })).status).toBe(403);
  });
});

describe("repayments — §27.32, §27.7 (card), §10.6", () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.close(); });

  it("two offline tills pay one charge: settled once, the excess a credit, aging identical when run twice", async () => {
    const c = await makeCustomer(t, "Գագիկ");
    const charge = await backdatedCharge(t, c.id, 25_000, 20);
    const shiftA = await openShift(t, "WORKER");
    const shiftB = await openShift(t, "STOCK");
    expect((await post(t, "/debt-payments", repayment(c.id, 20_000, "CASH", shiftA, true))).status).toBe(200);
    expect((await post(t, "/debt-payments", repayment(c.id, 30_000, "CASH", shiftB, true), "STOCK")).status).toBe(200);
    const l = await ledger(t, c.id);
    expect(l.entries.find((e: { id: string }) => e.id === charge).balance).toBe(0);
    expect(l.outstanding).toBe(-25_000);
    const first = (await get(t, "/customers/aging")).body;
    const second = (await get(t, "/customers/aging")).body;
    expect(second).toEqual(first);
    expect(first.totals.credit).toBe(25_000);
  });

  it("a card repayment writes no cash movement; expected cash is unchanged", async () => {
    const c = await makeCustomer(t, "Կարինե");
    await backdatedCharge(t, c.id, 30_000, 3);
    const shiftId = await openShift(t, "ADMIN", 20_000);
    const res = await post(t, "/debt-payments", repayment(c.id, 30_000, "CARD", shiftId), "ADMIN");
    expect(res.body.outstanding).toBe(0);
    expect(await t.db.cashMovement.count({ where: { shiftId } })).toBe(0);
    expect((await get(t, `/shifts/${shiftId}/x-report`, "ADMIN")).body.figures.expected).toBe(20_000);
  });

  it("a repayment on the wrong customer, reversed and re-entered: the first customer's aging is as it was, and the drawer counts the money once", async () => {
    const wrong = await makeCustomer(t, "Սխալ");
    const right = await makeCustomer(t, "Ճիշտ");
    await backdatedCharge(t, wrong.id, 10_000, 70);
    await backdatedCharge(t, wrong.id, 5_000, 35);
    await backdatedCharge(t, right.id, 15_000, 10);
    const shiftId = (await t.db.shift.findFirstOrThrow({ where: { userId: t.users.WORKER.id, status: "OPEN" } })).id;
    const agingBefore = (await ledger(t, wrong.id)).aging;
    const expectedBefore = (await get(t, `/shifts/${shiftId}/x-report`)).body.figures.expected;

    const pay = repayment(wrong.id, 15_000, "CASH", shiftId);
    await post(t, "/debt-payments", pay);
    expect((await ledger(t, wrong.id)).outstanding).toBe(0);
    const expectedAfterPay = (await get(t, `/shifts/${shiftId}/x-report`)).body.figures.expected;
    expect(expectedAfterPay).toBe(expectedBefore + 15_000);

    expect((await post(t, `/debt-payments/${pay.id}/reverse`, { reauthGrant: "nope", reason: "սխալ" })).status).toBe(403);
    const grant = await reauth(t, "repaymentReversal");
    expect((await post(t, `/debt-payments/${pay.id}/reverse`, { reauthGrant: grant, reason: "սխալ հաճախորդ", reenterCustomerId: right.id })).status).toBe(200);

    const after = await ledger(t, wrong.id);
    expect(after.aging).toEqual(agingBefore);
    expect(after.outstanding).toBe(15_000);
    const today = new Date().toISOString().slice(0, 10);
    expect(after.entries.filter((e: { type: string; createdAt: string }) => e.type === "CHARGE" && e.createdAt.startsWith(today))).toEqual([]);
    expect((await ledger(t, right.id)).outstanding).toBe(0);
    expect((await get(t, `/shifts/${shiftId}/x-report`)).body.figures.expected).toBe(expectedAfterPay);
    // The money entered the drawer once: one movement for the original, none for the reversal or the re-entry.
    const reversal = await t.db.debtEntry.findFirstOrThrow({ where: { reversesId: pay.id } });
    expect(await t.db.cashMovement.count({ where: { sourceId: pay.id } })).toBe(1);
    expect(await t.db.cashMovement.count({ where: { sourceId: reversal.id } })).toBe(0);
    expect(await t.db.cashMovement.count({ where: { sourceType: "DebtEntry", shiftId, createdAt: { gt: reversal.createdAt } } })).toBe(0);
    expect(await t.db.auditLog.count({ where: { action: "debt.repaymentReversal", reason: "սխալ հաճախորդ" } })).toBe(1);
  });

  it("a repayment is idempotent on its id", async () => {
    const c = await makeCustomer(t, "Կրկնակի");
    await backdatedCharge(t, c.id, 8_000, 1);
    const body = repayment(c.id, 3_000, "CARD", null);
    await post(t, "/debt-payments", body);
    const again = await post(t, "/debt-payments", body);
    expect(again.body.outstanding).toBe(5_000);
    expect(await t.db.debtEntry.count({ where: { id: body.id } })).toBe(1);
  });

  it("§27.5 — aging buckets match a hand-kept book, oldest charge paid first", async () => {
    const c = await makeCustomer(t, "Գրքից");
    await backdatedCharge(t, c.id, 10_000, 120); // 90+
    await backdatedCharge(t, c.id, 8_000, 75);   // 61–90
    await backdatedCharge(t, c.id, 6_000, 45);   // 31–60
    await backdatedCharge(t, c.id, 4_000, 10);   // 0–30
    await post(t, "/debt-payments", repayment(c.id, 13_000, "CARD", null));
    // By hand: 13 000 clears the 120-day 10 000 and 3 000 of the 75-day charge.
    expect((await ledger(t, c.id)).aging).toMatchObject({ d90plus: 0, d61_90: 5_000, d31_60: 6_000, d0_30: 4_000, oldestChargeDays: 75 });
  });
});

describe("merge, erasure, returns onto debt, and the drawer's sources", () => {
  let t: TestApp;
  let item: FixtureProduct;
  beforeAll(async () => {
    t = await createTestApp();
    item = await makeProduct(t, { name: "Փական", priceDram: 1000, stock: 1_000_000, costMdram: 600_000 });
  });
  afterAll(async () => { await t.close(); });

  it("§27.20 — a merge keeps the sum of balances and aging, including an unallocated credit", async () => {
    const a = await makeCustomer(t, "Տիգրան Ա.", "091000001");
    const b = await makeCustomer(t, "Տիգրան Ավագյան", "091000002");
    await backdatedCharge(t, a.id, 10_000, 95);
    await backdatedCharge(t, b.id, 5_000, 20);
    await post(t, "/debt-payments", repayment(b.id, 8_000, "CARD", null)); // b carries a 3 000 credit
    const la = await ledger(t, a.id);
    const lb = await ledger(t, b.id);
    expect(lb.outstanding).toBe(-3_000);
    expect((await post(t, `/customers/${b.id}/merge`, { intoId: a.id }, "WORKER")).status).toBe(403);
    expect((await post(t, `/customers/${b.id}/merge`, { intoId: a.id }, "ADMIN")).status).toBe(200);
    const merged = await ledger(t, a.id);
    expect(merged.outstanding).toBe(la.outstanding + lb.outstanding);
    expect(merged.outstanding).toBe(7_000);
    expect(merged.aging.d90plus + merged.aging.d0_30).toBe(15_000 - 8_000);
    expect((await ledger(t, b.id)).customer.id).toBe(a.id); // the absorbed record forwards
    expect((await get(t, "/customers")).body.items.map((c: { id: string }) => c.id)).not.toContain(b.id);
  });

  it("§27.42 — erasure clears name and phone, keeps every amount and date, and the report totals", async () => {
    const c = await makeCustomer(t, "Մարիամ Գալստյան", "093555666");
    for (const [amount, days] of [[4_000, 50], [6_000, 30], [2_000, 5]] as const) await backdatedCharge(t, c.id, amount, days);
    await post(t, "/debt-payments", repayment(c.id, 3_000, "CARD", null));
    await post(t, "/debt-payments", repayment(c.id, 1_000, "CARD", null));
    const entriesBefore = await t.db.debtEntry.findMany({ where: { customerId: c.id }, orderBy: { id: "asc" }, select: { id: true, amount: true, createdAt: true } });
    const agingBefore = (await get(t, "/customers/aging", "ADMIN")).body.totals;
    const lines: string[] = [];
    const original = logger.info.bind(logger);
    (logger as { info: unknown }).info = (...args: unknown[]) => { lines.push(JSON.stringify(args)); return original(...(args as [string])); };
    try {
      expect((await post(t, `/customers/${c.id}/erase`, {}, "ADMIN")).status).toBe(200);
      await get(t, `/customers/${c.id}/ledger`, "ADMIN");
    } finally {
      (logger as { info: unknown }).info = original;
    }
    const row = await t.db.customer.findUniqueOrThrow({ where: { id: c.id } });
    expect(row).toMatchObject({ fullName: null, phone: null });
    expect(row.anonymisedAt).not.toBeNull();
    expect(await t.db.debtEntry.findMany({ where: { customerId: c.id }, orderBy: { id: "asc" }, select: { id: true, amount: true, createdAt: true } })).toEqual(entriesBefore);
    expect((await get(t, "/customers/aging", "ADMIN")).body.totals).toEqual(agingBefore);
    const audit = await t.db.auditLog.findMany({ where: { entityId: c.id } });
    for (const text of [...lines, ...audit.map((x) => JSON.stringify(x))]) {
      expect(text).not.toContain("Մարիամ");
      expect(text).not.toContain("093555666");
    }
  });

  it("§27.26 — a split cash + nisya sale, partly returned, pays cash from the drawer and reduces the debt", async () => {
    const c = await makeCustomer(t, "Վահե");
    const shiftId = await openShift(t, "WORKER", 0);
    const sale = saleBody({ shiftId, customerId: c.id, lines: [{ product: item, qty: 50_000 }], payments: [{ method: "CASH", amount: 30_000 }, { method: "DEBT" }] });
    const done = (await post(t, "/sales", sale)).body;
    expect((await ledger(t, c.id)).outstanding).toBe(20_000);
    const ret = await post(t, "/sale-returns", { id: uuidv7(), originalSaleId: done.id, shiftId, reason: "ավել", lines: [{ id: uuidv7(), saleLineId: done.lines[0].id, qty: 25_000, restock: true }], createdAt: new Date().toISOString(), sentAt: new Date().toISOString(), queued: false });
    expect(ret.body.tenders).toEqual([{ method: "CASH", amount: 15_000 }, { method: "DEBT_REDUCTION", amount: 10_000 }]);
    expect((await ledger(t, c.id)).outstanding).toBe(10_000);
    expect((await get(t, `/shifts/${shiftId}/x-report`)).body.figures).toMatchObject({ cashSales: 30_000, refunds: 15_000, expected: 15_000 });
  });

  it("§27.45 — REPAYMENT and REFUND rows name their sources; a mistyped pay-out is reversed by a linked row", async () => {
    const c = await makeCustomer(t, "Հայկ");
    await backdatedCharge(t, c.id, 9_000, 2);
    const shiftId = (await t.db.shift.findFirstOrThrow({ where: { userId: t.users.WORKER.id, status: "OPEN" } })).id;
    await post(t, "/debt-payments", repayment(c.id, 9_000, "CASH", shiftId));
    const cash = (type: string, amount: number, reasonCode: string | null) => post(t, "/cash-movements", { id: uuidv7(), shiftId, type, amount, reasonCode, reason: "լամպ", createdAt: new Date().toISOString(), queued: false });
    const expectedBefore = (await get(t, `/shifts/${shiftId}/x-report`)).body.figures.expected;
    const wrong = await cash("PAY_OUT", 12_000, "EXPENSE");
    const rev = await post(t, `/cash-movements/${wrong.body.id}/reverse`, { reason: "12 000 էր 1 200" });
    expect(rev.body.reversesId).toBe(wrong.body.id);
    await cash("PAY_OUT", 1_200, "EXPENSE");
    expect((await get(t, `/shifts/${shiftId}/x-report`)).body.figures.expected).toBe(expectedBefore - 1_200);

    const rows = (await get(t, `/shifts/${shiftId}/cash-movements`)).body.items;
    expect(rows.find((r: { type: string }) => r.type === "REPAYMENT").source).toMatchObject({ type: "DebtEntry", customerId: c.id, customerName: "Հայկ" });
    expect(rows.find((r: { type: string }) => r.type === "REFUND").source).toMatchObject({ type: "SaleReturn" });
    expect(rows.filter((r: { type: string }) => r.type === "PAY_OUT")).toHaveLength(3);
    expect(await t.db.cashMovement.count({ where: { id: wrong.body.id, amount: 12_000 } })).toBe(1); // the original is unchanged

    expect((await cash("REPAYMENT", 1_000, null)).status).toBe(400);
    expect((await cash("REFUND", 1_000, null)).status).toBe(400);
  });
});
