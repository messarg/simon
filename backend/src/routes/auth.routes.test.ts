import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../test/db.ts";
import { bearer, createTestApp, PINS, type TestApp } from "../test/app.ts";
import { createApp } from "../app.ts";
import { clock } from "../lib/time.ts";

describe("first-run setup (§7.1 Q1–Q2)", () => {
  it("creates the owner once, returns the recovery code once, then closes", async () => {
    const t = await createTestDb();
    const app = createApp({ live: t.db, practice: async () => t.db });
    expect((await request(app).get("/api/setup/status")).body).toEqual({ needsOwner: true });
    expect((await request(app).get("/api/auth/users")).body.type).toMatch(/setup-required$/);
    const res = await request(app).post("/api/setup/owner").send({ shopName: "Շինանյութ", ownerName: "Արամ", pin: "4321" });
    expect(res.status).toBe(201);
    expect(res.body.recoveryCode).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    expect((await request(app).post("/api/setup/owner").send({ shopName: "x", ownerName: "y", pin: "1234" })).status).toBe(403);
    await t.close();
  });
});

describe("PIN login — §27.39", () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.close(); });

  const attempt = (userId: string, pin: string, deviceId: string) => request(t.app).post("/api/auth/login").send({ userId, pin, deviceId });

  it("four wrong PINs leave the worker able to sign in; the fifth locks with 423; others still sign in", async () => {
    const worker = t.users.WORKER.id;
    for (let i = 4; i >= 1; i--) {
      const res = await attempt(worker, "0000", t.devices.WORKER);
      expect(res.status).toBe(401);
      expect(res.body.attemptsRemaining).toBe(i);
    }
    expect((await attempt(worker, PINS.WORKER, t.devices.WORKER)).status).toBe(200);
    for (let i = 0; i < 4; i++) await attempt(worker, "0000", t.devices.STOCK);
    const locked = await attempt(worker, "0000", t.devices.STOCK);
    expect(locked.status).toBe(423);
    expect(locked.body.minutesRemaining).toBe(15);
    expect((await attempt(worker, PINS.WORKER, t.devices.ADMIN)).status).toBe(423); // the right PIN is not a way out
    expect((await attempt(t.users.STOCK.id, PINS.STOCK, t.devices.ADMIN)).status).toBe(200); // the shop keeps selling
  });

  it("an admin clears the lock in one action", async () => {
    const worker = t.users.WORKER.id;
    expect((await request(t.app).post("/api/auth/unlock").set(bearer(t.tokens.WORKER)).send({ userId: worker })).status).toBe(403);
    expect((await request(t.app).post("/api/auth/unlock").set(bearer(t.tokens.ADMIN)).send({ userId: worker })).status).toBe(204);
    expect((await attempt(worker, PINS.WORKER, t.devices.WORKER)).status).toBe(200);
  });

  it("the lock expires by itself after fifteen minutes", async () => {
    const stock = t.users.STOCK.id;
    const device = (await t.loginAs("ADMIN")).deviceId;
    for (let i = 0; i < 5; i++) await attempt(stock, "0000", device);
    expect((await attempt(stock, PINS.STOCK, device)).status).toBe(423);
    clock.advance(15 * 60_000 + 1000);
    try {
      expect((await attempt(stock, PINS.STOCK, device)).status).toBe(200);
    } finally { clock.reset(); }
  });

  it("the owner's recovery code clears the only admin's lock, and is single-use", async () => {
    const t2 = await createTestDb();
    const app = createApp({ live: t2.db, practice: async () => t2.db });
    const owner = (await request(app).post("/api/setup/owner").send({ shopName: "Ա", ownerName: "Արամ", pin: "4321" })).body;
    for (let i = 0; i < 5; i++) await request(app).post("/api/auth/login").send({ userId: owner.user.id, pin: "0000", deviceId: "d" + i });
    expect((await request(app).post("/api/auth/login").send({ userId: owner.user.id, pin: "4321" })).status).toBe(423);
    const rec = await request(app).post("/api/auth/recover").send({ userId: owner.user.id, recoveryCode: owner.recoveryCode });
    expect(rec.status).toBe(200);
    expect(rec.body.recoveryCode).not.toBe(owner.recoveryCode);
    expect((await request(app).post("/api/auth/recover").send({ userId: owner.user.id, recoveryCode: owner.recoveryCode })).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ userId: owner.user.id, pin: "4321" })).status).toBe(200);
    await t2.close();
  });

  it("rate limits ten attempts a minute per device with 429", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await request(t.app).post("/api/auth/login").send({ userId: "nobody", pin: "1234", deviceId: "rate-device" })).status);
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe("sessions and devices — §27.40 (device half), FR-SEC-06", () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.close(); });

  it("assigns each new device a unique two-character prefix", async () => {
    const { body } = await request(t.app).get("/api/devices").set(bearer(t.tokens.ADMIN));
    const prefixes = body.items.map((d: { prefix: string }) => d.prefix);
    expect(prefixes).toEqual(["AA", "AB", "AC"]);
  });

  it("deactivating a device revokes its sessions in the same act", async () => {
    expect((await request(t.app).get("/api/auth/me").set(bearer(t.tokens.WORKER))).status).toBe(200);
    const res = await request(t.app).patch(`/api/devices/${t.devices.WORKER}`).set(bearer(t.tokens.ADMIN)).send({ isActive: false });
    expect(res.status).toBe(200);
    const after = await request(t.app).get("/api/auth/me").set(bearer(t.tokens.WORKER));
    expect(after.status).toBe(401);
    expect(after.body.type).toMatch(/session-expired$/);
  });

  it("an idle till session expires after fifteen minutes; the owner's does not", async () => {
    const worker = await t.loginAs("WORKER");
    clock.advance(16 * 60_000);
    try {
      expect((await request(t.app).get("/api/auth/me").set(bearer(worker.token))).status).toBe(401);
      expect((await request(t.app).get("/api/auth/me").set(bearer(t.tokens.ADMIN))).status).toBe(200);
    } finally { clock.reset(); }
  });

  it("an admin revokes another session in one call, and it is audited", async () => {
    const stock = await t.loginAs("STOCK");
    const me = (await request(t.app).get("/api/auth/me").set(bearer(stock.token))).body;
    expect((await request(t.app).post(`/api/sessions/${me.session.id}/revoke`).set(bearer(t.tokens.ADMIN))).status).toBe(204);
    expect((await request(t.app).get("/api/auth/me").set(bearer(stock.token))).status).toBe(401);
    expect(await t.db.auditLog.count({ where: { action: "session.revoke", entityId: me.session.id } })).toBe(1);
  });
});

describe("settings", () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.close(); });

  it("any session reads the client shape; only ADMIN reads or writes the whole", async () => {
    const client = await request(t.app).get("/api/settings/client").set(bearer(t.tokens.WORKER));
    expect(client.status).toBe(200);
    expect(client.body).toMatchObject({ taxRegime: "VAT", taxRateBp: 2000, maxDiscountBp: 500, offlineDebtCap: 20_000, debtBookEnabled: true });
    expect(client.body).not.toHaveProperty("retention.years");
    expect((await request(t.app).get("/api/settings").set(bearer(t.tokens.WORKER))).status).toBe(403);
    const patched = await request(t.app).patch("/api/settings").set(bearer(t.tokens.ADMIN)).send({ "discount.maxBp": 800 });
    expect(patched.body["discount.maxBp"]).toBe(800);
    expect((await request(t.app).patch("/api/settings").set(bearer(t.tokens.ADMIN)).send({ "discount.maxBp": 12.5 })).status).toBe(400);
    expect((await request(t.app).patch("/api/settings").set(bearer(t.tokens.STOCK)).send({ "discount.maxBp": 0 })).status).toBe(403);
  });
});
