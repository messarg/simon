/**
 * The three tiers of §16.4, end to end: what a manager is refused because it is the owner's, who
 * may make and change whom, and what an employee's grants do and do not open.
 *
 * `packages/shared/src/staff-policy.test.ts` holds the who-manages-whom table without HTTP; this suite is the
 * proof that every route actually asks it.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearer, createTestApp, type TestApp } from "../test/app.ts";
import { get, makeCustomer, makeProduct, openShift, post, saleBody } from "../test/fixtures.ts";

const as = (t: TestApp, token: string) => ({
  get: (path: string) => request(t.server).get(`/api${path}`).set(bearer(token)),
  post: (path: string, body: object = {}) => request(t.server).post(`/api${path}`).set(bearer(token)).send(body),
  patch: (path: string, body: object) => request(t.server).patch(`/api${path}`).set(bearer(token)).send(body),
});

async function signIn(t: TestApp, name: string, pin: string) {
  const res = await request(t.server).post("/api/auth/login").send({ name, pin, deviceLabel: name });
  expect(res.status).toBe(200);
  return res.body as { token: string; user: { role: string; permissions: string[] } };
}

describe("a manager runs the shop without what is the owner's — §16.4", () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.close(); });

  it("is refused every route that is the owner's alone", async () => {
    const m = as(t, t.tokens.MANAGER);
    const refused: Array<[string, () => request.Test]> = [
      ["GET /audit-log", () => m.get("/audit-log")], ["GET /diagnostics", () => m.get("/diagnostics")],
      ["GET /backups", () => m.get("/backups")], ["GET /imports", () => m.get("/imports")], ["POST /imports", () => m.post("/imports")],
      ["GET /settings", () => m.get("/settings")], ["PATCH /settings", () => m.patch("/settings", {})],
      ["GET /sessions", () => m.get("/sessions")], ["GET /devices", () => m.get("/devices")],
      ["POST /cost-corrections", () => m.post("/cost-corrections")], ["POST /purchase-orders", () => m.post("/purchase-orders")],
      ["GET /purchase-orders/suggestions", () => m.get("/purchase-orders/suggestions")],
      ["GET /products?filter=needs-detail", () => m.get("/products?filter=needs-detail")],
      ["GET /reports/margin", () => m.get("/reports/margin")], ["GET /reports/valuation", () => m.get("/reports/valuation")],
      ["GET /reports/audit", () => m.get("/reports/audit")],
    ];
    for (const [name, call] of refused) expect([name, (await call()).status]).toEqual([name, 403]);
  });

  it("reaches everything else a shop is run from", async () => {
    const m = as(t, t.tokens.MANAGER);
    for (const path of ["/home", "/users", "/suppliers", "/reports/sales", "/customers", "/stocktakes", "/review-flags"]) {
      const res = await m.get(path);
      expect([path, res.status]).toEqual([path, 200]);
    }
  });

  it("cannot read the owner's own figures by asking for them by person", async () => {
    const res = await get(t, `/reports/movements-by-person?userId=${t.users.OWNER.id}`, "MANAGER");
    expect(res.status).toBe(404);
    expect((await get(t, `/reports/movements-by-person?userId=${t.users.WORKER.id}`, "MANAGER")).status).toBe(200);
  });
});

describe("who makes and changes whom — §6.17", () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.close(); });

  it("the owner makes managers and employees; a manager makes employees only; nobody makes an owner", async () => {
    expect((await post(t, "/users", { name: "Նոր մենեջեր", pin: "5555", role: "MANAGER" }, "OWNER")).status).toBe(201);
    expect((await post(t, "/users", { name: "Մեկ այլ", pin: "5556", role: "MANAGER" }, "MANAGER")).status).toBe(403);
    const hired = await post(t, "/users", { name: "Սարո", pin: "5557", role: "EMPLOYEE", permissions: ["sell"] }, "MANAGER");
    expect(hired.status).toBe(201);
    expect(hired.body).toMatchObject({ role: "EMPLOYEE", permissions: ["sell"] });
    // OWNER is not a value the body accepts at all.
    expect((await post(t, "/users", { name: "Երկրորդ տեր", pin: "5558", role: "OWNER" }, "OWNER")).status).toBe(400);
  });

  it("nobody demotes or deactivates the owner — the owner included", async () => {
    for (const body of [{ role: "MANAGER" }, { isActive: false }]) {
      expect((await request(t.server).patch(`/api/users/${t.users.OWNER.id}`).set(bearer(t.tokens.OWNER)).send(body)).status).toBe(403);
    }
    // The owner still keeps their own record.
    expect((await request(t.server).patch(`/api/users/${t.users.OWNER.id}`).set(bearer(t.tokens.OWNER)).send({ note: "տեր" })).status).toBe(200);
  });

  it("a manager keeps their own record, cannot raise or switch themselves off, and cannot touch another manager", async () => {
    const m = as(t, t.tokens.MANAGER);
    const own = await m.patch(`/users/${t.users.MANAGER.id}`, { phone: "091 000000" });
    expect(own.status).toBe(200);
    // What they wrote, they read back — on the reply and on their own page.
    expect(own.body.phone).toBe("091 000000");
    expect((await m.get(`/users/${t.users.MANAGER.id}`)).body.phone).toBe("091 000000");
    expect((await m.patch(`/users/${t.users.MANAGER.id}`, { isActive: false })).status).toBe(403);
    const other = (await post(t, "/users", { name: "Երկրորդ մենեջեր", pin: "6666", role: "MANAGER" }, "OWNER")).body;
    expect((await m.patch(`/users/${other.id}`, { phone: "1" })).status).toBe(404);
    await request(t.server).patch(`/api/users/${other.id}`).set(bearer(t.tokens.OWNER)).send({ phone: "093 222222" });
    const listed = (await m.get("/users")).body.items.find((u: { id: string }) => u.id === other.id);
    expect(listed).toMatchObject({ name: "Երկրորդ մենեջեր", role: "MANAGER", phone: null });
    expect((await m.get(`/users/${other.id}`)).status).toBe(404);
  });

  it("refuses a second active person with the same name, however it is written (§16.2)", async () => {
    const dup = await post(t, "/users", { name: "  ԳՈՌ ", pin: "7777", role: "EMPLOYEE" }, "OWNER");
    expect(dup.status).toBe(422);
    expect(dup.body.type).toMatch(/duplicate-name$/);
    expect((await request(t.server).patch(`/api/users/${t.users.STOCK.id}`).set(bearer(t.tokens.OWNER)).send({ name: "գոռ" })).body.type).toMatch(/duplicate-name$/);
  });

  it("a change of grants is a permission change, audited with what it was and what it became", async () => {
    const res = await request(t.server).patch(`/api/users/${t.users.WORKER.id}`).set(bearer(t.tokens.MANAGER)).send({ permissions: ["sell", "labels"] });
    expect(res.body.permissions).toEqual(["sell", "labels"]);
    const row = await t.db.auditLog.findFirstOrThrow({ where: { action: "user.permissionChange", entityId: t.users.WORKER.id }, orderBy: { createdAt: "desc" } });
    expect(JSON.parse(row.before!)).toMatchObject({ permissions: '["sell","returns","debt"]' });
    expect(JSON.parse(row.after!)).toMatchObject({ permissions: '["sell","labels"]' });
    expect(row.userId).toBe(t.users.MANAGER.id);
  });
});

describe("an employee does exactly what they were granted — §16.4", () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.close(); });

  it("a receiver who does not sell cannot open a till, see the debt book, or sell", async () => {
    await post(t, "/users", { name: "Արմեն", pin: "8181", role: "EMPLOYEE", permissions: ["receive"] }, "OWNER");
    const s = await signIn(t, "Արմեն", "8181");
    expect(s.user).toMatchObject({ role: "EMPLOYEE", permissions: ["receive"] });
    const e = as(t, s.token);
    expect((await e.get("/suppliers")).status).toBe(200);
    expect((await e.get("/goods-receipts")).status).toBe(200);
    expect((await e.post("/shifts", { id: "x", openingFloat: 0 })).status).toBe(403);
    expect((await e.get("/customers")).status).toBe(403);
    expect((await e.post("/sales", {})).status).toBe(403);
    expect((await e.get("/stocktakes")).status).toBe(403);
    expect((await e.get("/users")).status).toBe(403);
  });

  it("selling on credit needs the debt book, not just the till", async () => {
    const p = await makeProduct(t, { name: "Պտուտակ", priceDram: 50, stock: 10_000 });
    const customer = await makeCustomer(t, "Սամվել", null, "OWNER");
    await post(t, "/users", { name: "Կարեն", pin: "8282", role: "EMPLOYEE", permissions: ["sell"] }, "OWNER");
    const s = await signIn(t, "Կարեն", "8282");
    const shiftId = await openShift(t, "WORKER", 0, s.token);
    const onCredit = saleBody({ shiftId, lines: [{ product: p, qty: 1000 }], payments: [{ method: "DEBT" }], customerId: customer.id, prefix: "KR" });
    const refused = await request(t.server).post("/api/sales").set(bearer(s.token)).send(onCredit);
    expect(refused.status).toBe(403);
    expect(refused.body.required).toBe("debt");
    const cash = saleBody({ shiftId, lines: [{ product: p, qty: 1000 }], prefix: "KR" });
    expect((await request(t.server).post("/api/sales").set(bearer(s.token)).send(cash)).status).toBe(200);
  });

  it("a grant takes effect on the next request, without signing in again", async () => {
    const s = await signIn(t, "Արմեն", "8181");
    expect((await as(t, s.token).get("/stocktakes")).status).toBe(403);
    const person = (await get(t, "/users", "OWNER")).body.items.find((u: { name: string }) => u.name === "Արմեն");
    await request(t.server).patch(`/api/users/${person.id}`).set(bearer(t.tokens.OWNER)).send({ permissions: ["receive", "stocktake"] });
    expect((await as(t, s.token).get("/stocktakes")).status).toBe(200);
  });
});
