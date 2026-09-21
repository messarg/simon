/**
 * Աշխատակիցներ — the staff photograph and the two ledgers read by person.
 * PRD §6.11.1, §11 `User.avatar`, §15.4, §16.5, §19.6, §20.2, §26.2.
 *
 * The photograph is the one personal field served without a session, so the tests here are mostly
 * about what the host refuses: a worker writing one, a file larger than the bound, and a PNG
 * wearing a JPEG's label. The reports are asserted against a hand-worked day, as §20.2's others are.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { businessDate, uuidv7 } from "@simon/shared";
import { AVATAR_MAX_BYTES } from "../domain/avatar.ts";
import { REPORT_NAMES } from "../services/report.service.ts";
import { bearer, createTestApp, PINS, type Persona, type TestApp } from "../test/app.ts";
import { dataUrl, jpegBytes, pngBytes } from "../test/images.ts";
import { get, makeProduct, openShift, post, saleBody, type FixtureProduct } from "../test/fixtures.ts";

const today = () => businessDate(new Date(), "Asia/Yerevan");
const report = async (t: TestApp, name: string, query = "") => (await get(t, `/reports/${name}?from=${today()}&to=${today()}${query}`, "OWNER")).body;
const rowFor = (body: { rows: Array<Record<string, unknown>> }, key: string) => body.rows.find((r) => r.key === key) as Record<string, number>;

const putAvatar = (t: TestApp, userId: string, image: string, role: Persona = "OWNER") =>
  request(t.server).put(`/api/users/${userId}/avatar`).set(bearer(t.tokens[role])).send({ image });

describe("the staff photograph — §6.11.1, §19.6, §26.2", () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.close(); });

  it("is written by whoever manages the person, and served to an <img> without a token", async () => {
    const png = pngBytes(256, 256);
    const written = await putAvatar(t, t.users.WORKER.id, dataUrl("image/png", png));
    expect(written.status).toBe(200);
    expect(written.body.avatarUpdatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // No session, no token, no header at all: an <img> cannot send one (§16.5, §26.2).
    const res = await request(t.server).get(`/api/users/${t.users.WORKER.id}/avatar`).responseType("blob");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["cache-control"]).toBe("no-cache");
    expect(res.headers.etag).toBe(`"${written.body.avatarUpdatedAt}"`);
    expect(Buffer.from(res.body).equals(png)).toBe(true);

    // Asked again with the tag it was given, the face is not sent twice.
    const again = await request(t.server).get(`/api/users/${t.users.WORKER.id}/avatar`).set("If-None-Match", res.headers.etag);
    expect(again.status).toBe(304);
    expect(again.body).toHaveLength(0);
    const stale = await request(t.server).get(`/api/users/${t.users.WORKER.id}/avatar`).set("If-None-Match", '"1999-01-01T00:00:00.000Z"');
    expect(stale.status).toBe(200);
  });

  it("the staff list says whether there is a face and what to cache-bust on, never the bytes", async () => {
    const users = (await get(t, "/users", "OWNER")).body.items as Array<Record<string, unknown>>;
    expect(users.find((u) => u.id === t.users.WORKER.id)!.avatarUpdatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(users.find((u) => u.id === t.users.STOCK.id)!.avatarUpdatedAt).toBeNull();
    expect(JSON.stringify(users)).not.toMatch(/iVBOR|"avatar"|pinHash/);
  });

  it("an owner or a manager may write one for someone they manage — never an employee", async () => {
    const image = dataUrl("image/png", pngBytes());
    expect((await putAvatar(t, t.users.WORKER.id, image, "MANAGER")).status).toBe(200);
    // The owner's record is not a manager's to see, let alone change (§16.4).
    expect((await putAvatar(t, t.users.OWNER.id, image, "MANAGER")).status).toBe(404);
    expect((await putAvatar(t, t.users.WORKER.id, image, "WORKER")).status).toBe(403);
    expect((await putAvatar(t, t.users.WORKER.id, image, "STOCK")).status).toBe(403);
    expect((await request(t.server).put(`/api/users/${t.users.WORKER.id}/avatar`).send({ image })).status).toBe(401);
    expect((await request(t.server).delete(`/api/users/${t.users.WORKER.id}/avatar`).set(bearer(t.tokens.WORKER))).status).toBe(403);
  });

  it("refuses what the device should never have sent: too large, mislabelled, or not a picture", async () => {
    const oversized = await putAvatar(t, t.users.STOCK.id, dataUrl("image/png", pngBytes(128, 128, AVATAR_MAX_BYTES + 1)));
    expect(oversized.status).toBe(400);
    expect(oversized.body.errors).toEqual({ image: ["too-large"] });

    // A PNG under a JPEG's label. The declaration is not evidence; the first bytes are.
    const mislabelled = await putAvatar(t, t.users.STOCK.id, dataUrl("image/jpeg", pngBytes()));
    expect(mislabelled.status).toBe(400);
    expect(mislabelled.body.errors).toEqual({ image: ["magic-mismatch"] });

    expect((await putAvatar(t, t.users.STOCK.id, dataUrl("image/svg+xml", pngBytes()))).body.errors).toEqual({ image: ["unsupported-media-type"] });
    expect((await putAvatar(t, t.users.STOCK.id, dataUrl("image/png", pngBytes(512, 512)))).body.errors).toEqual({ image: ["too-many-pixels"] });
    expect((await putAvatar(t, t.users.STOCK.id, "https://example.invalid/face.png")).body.errors).toEqual({ image: ["not-a-data-url"] });
    expect((await putAvatar(t, uuidv7(), dataUrl("image/png", pngBytes()))).status).toBe(404);
    // Nothing above reached the column.
    expect((await request(t.server).get(`/api/users/${t.users.STOCK.id}/avatar`)).status).toBe(404);
  });

  it("is replaced in place, removed on request, and gone when the person is deactivated (§19.6)", async () => {
    const first = (await putAvatar(t, t.users.STOCK.id, dataUrl("image/png", pngBytes()))).body.avatarUpdatedAt;
    const second = (await putAvatar(t, t.users.STOCK.id, dataUrl("image/jpeg", jpegBytes()))).body.avatarUpdatedAt;
    expect(Date.parse(second)).toBeGreaterThanOrEqual(Date.parse(first));
    expect((await request(t.server).get(`/api/users/${t.users.STOCK.id}/avatar`)).headers["content-type"]).toBe("image/jpeg");

    const removed = await request(t.server).delete(`/api/users/${t.users.STOCK.id}/avatar`).set(bearer(t.tokens.OWNER));
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual({ avatarUpdatedAt: null });
    expect((await request(t.server).get(`/api/users/${t.users.STOCK.id}/avatar`)).status).toBe(404);

    // The name is financial record and stays; the photograph is operational and does not.
    const leaver = (await post(t, "/users", { name: "Հրաժեշտ", pin: "567800", role: "EMPLOYEE", permissions: ["sell"] }, "OWNER")).body;
    await putAvatar(t, leaver.id, dataUrl("image/png", pngBytes()));
    expect((await request(t.server).get(`/api/users/${leaver.id}/avatar`)).status).toBe(200);
    await request(t.server).patch(`/api/users/${leaver.id}`).set(bearer(t.tokens.OWNER)).send({ isActive: false });
    expect((await request(t.server).get(`/api/users/${leaver.id}/avatar`)).status).toBe(404);
    expect((await get(t, "/users", "OWNER")).body.items.find((u: { id: string }) => u.id === leaver.id).avatarUpdatedAt).toBeNull();
  });

  it("writing a photograph is not an audited action — §10.7 enumerates what is", async () => {
    const log = (await get(t, "/audit-log", "OWNER")).body.items as Array<{ action: string }>;
    expect(log.some((x) => /avatar|photo/i.test(x.action))).toBe(false);
  });
});

describe("the two ledgers read by person — §20.2, §6.11.1", () => {
  let t: TestApp;
  let cable: FixtureProduct;
  let shiftId: string;

  beforeAll(async () => {
    t = await createTestApp();
    // The owner brings ten in at 800 ֏; the stock keeper writes one off and adjusts one back.
    cable = await makeProduct(t, { name: "Մալուխ", priceDram: 1_200, stock: 10_000, costMdram: 800_000, barcode: "111" });
    shiftId = await openShift(t, "WORKER", 20_000);
    await post(t, "/sales", saleBody({ shiftId, lines: [{ product: cable, qty: 2_000, taxRateBp: 0 }] }));
    await post(t, "/write-offs", { id: uuidv7(), productId: cable.id, qty: 1_000, reasonCode: "DAMAGE" }, "STOCK");
    const grant = (await post(t, "/auth/reauth", { name: t.users.OWNER.name, pin: PINS.OWNER, action: "stockAdjustment" })).body.grant;
    await post(t, "/adjustments", { id: uuidv7(), productId: cable.id, qtyDelta: 1_000, reauthGrant: grant, reason: "դարակում գտնվեց" }, "STOCK");
    // Two hands on the drawer, for two stated reasons.
    await post(t, "/cash-movements", { id: uuidv7(), shiftId, type: "PAY_OUT", amount: 12_000, reasonCode: "EXPENSE", reason: "ջրի վարձ", createdAt: new Date().toISOString(), queued: false });
    await post(t, "/cash-movements", { id: uuidv7(), shiftId, type: "PAY_OUT", amount: 5_000, reasonCode: "WAGE", reason: "կանխավճար", createdAt: new Date().toISOString(), queued: false });
  });
  afterAll(async () => { await t.close(); });

  it("stock movements by person: what each of them moved, valued at cost because quantities do not add up", async () => {
    const byPerson = await report(t, "movements-by-person");
    expect(byPerson.name).toBe("movements-by-person");
    // The owner received ten at 800 ֏.
    expect(rowFor(byPerson, t.users.OWNER.id)).toMatchObject({ worker: "Արամ", receipts: 1, receiptsValue: 8_000, movements: 1 });
    // The stock keeper wrote one off (−800 ֏) and put one back (+800 ֏).
    expect(rowFor(byPerson, t.users.STOCK.id)).toMatchObject({ worker: "Լուսինե", writeOffs: 1, writeOffsValue: -800, adjustments: 1, adjustmentsValue: 800, movements: 2 });
    // Selling is counted beside them, never mixed into them.
    expect(rowFor(byPerson, t.users.WORKER.id)).toMatchObject({ worker: "Գոռ", saleLines: 1, receipts: 0, writeOffs: 0 });
    expect(byPerson.totals).toMatchObject({ movements: 4, receipts: 1, writeOffs: 1, adjustments: 1, saleLines: 1 });
    expect(byPerson.columns.map((x: { key: string }) => x.key)).toEqual([
      "worker", "movements", "products", "receipts", "receiptsValue", "writeOffs", "writeOffsValue",
      "adjustments", "adjustmentsValue", "stocktake", "stocktakeValue", "saleLines",
    ]);

    // Asked about one person, it answers about that person only (§6.11.1).
    const stockOnly = await report(t, "movements-by-person", `&userId=${t.users.STOCK.id}`);
    expect(stockOnly.rows.map((r: { key: string }) => r.key)).toEqual([t.users.STOCK.id]);
  });

  it("cash out by person: whose hand, beside which reason", async () => {
    const byPerson = await report(t, "cash-out-by-person");
    expect(rowFor(byPerson, t.users.WORKER.id)).toMatchObject({ worker: "Գոռ", count: 2, amount: 17_000, EXPENSE: 12_000, WAGE: 5_000, OWNER_DRAW: 0 });
    expect(byPerson.totals).toMatchObject({ count: 2, amount: 17_000, EXPENSE: 12_000 });
    expect(byPerson.columns.map((x: { key: string }) => x.key)).toEqual(["worker", "count", "amount", "SUPPLIER_PAYMENT", "WAGE", "EXPENSE", "OWNER_DRAW", "CORRECTION", "OTHER"]);
    // The same rows the reason report totals, read the other way round.
    const byReason = await report(t, "cash-out");
    expect(byReason.totals.amount).toBe(byPerson.totals.amount);

    expect((await report(t, "cash-out-by-person", `&userId=${t.users.OWNER.id}`)).rows).toEqual([]);
  });

  it("both are the owner's alone, and a worker cannot reach either", async () => {
    for (const name of ["movements-by-person", "cash-out-by-person"]) {
      expect((await get(t, `/reports/${name}?from=${today()}&to=${today()}`, "WORKER")).status).toBe(403);
      expect((await get(t, `/reports/${name}?from=${today()}&to=${today()}`, "STOCK")).status).toBe(403);
    }
  });

  it("the reports that were already per-worker now narrow to one person", async () => {
    const mine = await report(t, "sales", `&groupBy=worker&userId=${t.users.WORKER.id}`);
    expect(mine.rows.map((r: { key: string }) => r.key)).toEqual([t.users.WORKER.id]);
    expect((await report(t, "sales", `&groupBy=worker&userId=${t.users.OWNER.id}`)).rows).toEqual([]);
    expect((await report(t, "sales", "&groupBy=day")).totals.gross).toBe(2_400);
    expect((await report(t, "sales", `&groupBy=day&userId=${t.users.OWNER.id}`)).totals.gross).toBe(0);

    expect((await report(t, "discounts", `&userId=${t.users.OWNER.id}`)).rows).toEqual([]);
    expect((await report(t, "voids-returns", `&userId=${t.users.OWNER.id}`)).rows).toEqual([]);
    expect((await report(t, "write-offs", `&userId=${t.users.STOCK.id}`)).rows).toEqual([expect.objectContaining({ reasonCode: "DAMAGE", lines: 1 })]);
    expect((await report(t, "write-offs", `&userId=${t.users.WORKER.id}`)).rows).toEqual([]);

    await post(t, `/shifts/${shiftId}/begin-close`, { unsyncedAtClose: 0 });
    // 20 000 opened, 2 400 taken, 17 000 paid out: the drawer should hold 5 400, and the difference is explained.
    expect((await post(t, `/shifts/${shiftId}/close`, { breakdown: [{ value: 5_000, count: 1 }], note: "մանրը պակասեց", unsyncedAtClose: 0 })).status).toBe(200);
    expect((await report(t, "z-reports", `&userId=${t.users.WORKER.id}`)).rows).toHaveLength(1);
    expect((await report(t, "z-reports", `&userId=${t.users.OWNER.id}`)).rows).toEqual([]);
  });
});

/**
 * The personal details §6.11 puts at the top of a person's page — phone, start date, note.
 *
 * §19.6 draws the boundary these tests exist to hold: they reach two routes, the owner reads
 * everyone's and a manager an employee's, and *"a staff phone book on the sign-in screen is the
 * failure that boundary exists to prevent."* There is no sign-in list any more, so most of what
 * follows is about what every other surface does **not** carry.
 */
describe("staff personal details — §6.11, §19.6", () => {
  let t: TestApp;
  const PHONE = "+374 77 123456";
  const NOTE = "Երկուշաբթի օրերին չի աշխատում";
  const patch = (userId: string, body: unknown, role: Persona = "OWNER") =>
    request(t.server).patch(`/api/users/${userId}`).set(bearer(t.tokens[role])).send(body as object);

  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.close(); });

  it("the owner records all three, and reads them back from the list and the person's page", async () => {
    const written = await patch(t.users.WORKER.id, { phone: PHONE, startedOn: "2024-03-01", note: NOTE });
    expect(written.status).toBe(200);
    expect(written.body).toMatchObject({ id: t.users.WORKER.id, phone: PHONE, startedOn: "2024-03-01", note: NOTE });

    const one = await get(t, `/users/${t.users.WORKER.id}`, "OWNER");
    expect(one.status).toBe(200);
    expect(Object.keys(one.body).sort()).toEqual(
      ["avatarUpdatedAt", "createdAt", "id", "isActive", "lockedUntil", "name", "note", "permissions", "phone", "role", "startedOn"],
    );
    expect(one.body).toMatchObject({ name: "Գոռ", role: "EMPLOYEE", permissions: ["sell", "returns", "debt"], isActive: true, phone: PHONE, startedOn: "2024-03-01", note: NOTE });
    // The two hashes and the photograph's bytes are selected by nothing, here least of all.
    expect(JSON.stringify(one.body)).not.toMatch(/pinHash|recoveryCodeHash|"avatar"/);

    const list = (await get(t, "/users", "OWNER")).body.items as Array<Record<string, unknown>>;
    expect(list.find((u) => u.id === t.users.WORKER.id)).toEqual(one.body);
    // Somebody who has none of them reads as null, not absent — a form binds to a key that exists.
    expect(list.find((u) => u.id === t.users.STOCK.id)).toMatchObject({ phone: null, startedOn: null, note: null });

    expect((await get(t, `/users/${uuidv7()}`, "OWNER")).status).toBe(404);
  });

  it("a cleared field is null, and a patch of something else leaves them where they were", async () => {
    await patch(t.users.STOCK.id, { phone: "  077 000000  ", note: "  պահոց  ", startedOn: "2023-01-15" });
    // Trimmed on the way in, as every other free text on this API is.
    expect((await get(t, `/users/${t.users.STOCK.id}`, "OWNER")).body).toMatchObject({ phone: "077 000000", note: "պահոց" });

    // A change of grants is not an instruction about a phone number.
    await patch(t.users.STOCK.id, { role: "EMPLOYEE", permissions: ["sell", "receive"] });
    expect((await get(t, `/users/${t.users.STOCK.id}`, "OWNER")).body).toMatchObject({ phone: "077 000000", startedOn: "2023-01-15" });

    // An emptied form field means "not recorded", which is what the nullable column is for.
    const cleared = await patch(t.users.STOCK.id, { phone: "", note: "", startedOn: "" });
    expect(cleared.body).toMatchObject({ phone: null, note: null, startedOn: null });
    expect((await patch(t.users.STOCK.id, { phone: null, note: null })).body).toMatchObject({ phone: null, note: null });
  });

  it("is lenient about how a phone is written and strict about what a date is", async () => {
    for (const phone of ["+374 77 12 34 56", "077123456", "(093) 12-34-56", "+37477123456 / 010 555555"]) {
      expect((await patch(t.users.WORKER.id, { phone })).body.phone).toBe(phone);
    }

    const tooLong = await patch(t.users.WORKER.id, { note: "ա".repeat(501) });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.errors).toEqual([{ path: "note", code: "too_big" }]);
    expect((await patch(t.users.WORKER.id, { phone: "0".repeat(41) })).status).toBe(400);
    // 500 exactly is the bound, not one below it.
    expect((await patch(t.users.WORKER.id, { note: "ա".repeat(500) })).status).toBe(200);

    // A day, written the one way a TEXT column can be ordered by (§11).
    for (const startedOn of ["01/03/2024", "2024-3-1", "2024-13-01", "2024-02-31", "yesterday", "2024-03-01T00:00:00Z"]) {
      const res = await patch(t.users.WORKER.id, { startedOn });
      expect([startedOn, res.status]).toEqual([startedOn, 400]);
    }
    expect((await patch(t.users.WORKER.id, { startedOn: "2024-02-29" })).body.startedOn).toBe("2024-02-29");
  });

  it("a manager reads an employee's, and nobody else's; an employee reads none", async () => {
    await patch(t.users.OWNER.id, { phone: "010 111111" });
    const seen = (await get(t, "/users", "MANAGER")).body.items as Array<Record<string, unknown>>;
    expect(seen.find((u) => u.id === t.users.WORKER.id)).toMatchObject({ phone: expect.any(String) });
    // The owner is not in a manager's list at all, and not at their own id either (§16.4).
    expect(seen.find((u) => u.id === t.users.OWNER.id)).toBeUndefined();
    expect((await get(t, `/users/${t.users.OWNER.id}`, "MANAGER")).status).toBe(404);
    expect(JSON.stringify(seen)).not.toContain("010 111111");
    expect((await patch(t.users.OWNER.id, { phone: "000" }, "MANAGER")).status).toBe(404);

    for (const role of ["WORKER", "STOCK"] as const) {
      expect((await patch(t.users.WORKER.id, { phone: "099999999" }, role)).status).toBe(403);
      // Not even their own: a worker has no route to anyone's record, including their own.
      expect((await get(t, `/users/${t.users[role].id}`, role)).status).toBe(403);
      expect((await get(t, "/users", role)).status).toBe(403);
      const me = await get(t, "/auth/me", role);
      expect(JSON.stringify(me.body)).not.toContain("123456");
    }
    expect((await request(t.server).patch(`/api/users/${t.users.WORKER.id}`).send({ phone: "099999999" })).status).toBe(401);
  });

  it("nothing before sign-in carries any of it — there is no list to carry it (§16.5, §26.2)", async () => {
    await patch(t.users.OWNER.id, { phone: PHONE, startedOn: "2020-01-01", note: NOTE });
    for (const path of ["/api/auth/users", "/api/auth/admins", "/api/setup/status", "/api/health"]) {
      const body = JSON.stringify((await request(t.server).get(path)).body);
      expect(body).not.toMatch(/phone|startedOn|"note"|123456|2020-01-01|Արամ|Գոռ/);
    }
    // Signing in says who you are, and nothing about anyone's details — your own included.
    const login = await request(t.server).post("/api/auth/login").send({ name: t.users.OWNER.name, pin: PINS.OWNER, deviceId: "details" });
    expect(JSON.stringify(login.body)).not.toMatch(/phone|startedOn|"note"|2020-01-01/);
  });

  it("and no report does either — §20.2's rows are about the shop, not about the person", async () => {
    const day = today();
    const product = await makeProduct(t, { name: "Մեխ", priceDram: 50, stock: 1_000, costMdram: 20_000 });
    for (const name of REPORT_NAMES) {
      // Every one of §20.2's thirteen, asked about this person, on the one screen that renders them all.
      const res = await get(t, `/reports/${name}?from=${day}&to=${day}&userId=${t.users.WORKER.id}&productId=${product.id}`, "OWNER");
      expect([name, res.status]).toEqual([name, 200]);
      const body = JSON.stringify(res.body);
      // A customer's phone is a legitimate column on the aging report, so the assertion is about
      // the value this staff record holds, not about a key spelled the same way.
      expect([name, /"startedOn"|123456|555555/.test(body)]).toEqual([name, false]);
      expect([name, body.includes(NOTE)]).toEqual([name, false]);
    }
    const audit = JSON.stringify((await get(t, "/audit-log", "OWNER")).body);
    expect(audit).not.toContain(NOTE);
    expect(audit).not.toContain("123456");
  });

  it("a change rides the audited action §10.7 already lists, naming the field and never its value", async () => {
    await patch(t.users.WORKER.id, { phone: "077 555555", note: "նոր" });
    const rows = (await get(t, "/audit-log", "OWNER")).body.items as Array<{ action: string; entityId: string; after: string | null }>;
    // The row is created and then patched, so `user.create` is on this entity too — and those two
    // are the whole of what a `User` may write. Newest first: the patch just made is `mine[0]`.
    const mine = rows.filter((x) => x.entityId === t.users.WORKER.id);
    expect([...new Set(mine.map((x) => x.action))].sort()).toEqual(["user.create", "user.permissionChange"]);
    expect(mine[0]!.action).toBe("user.permissionChange");
    const after = JSON.parse(mine[0]!.after ?? "{}");
    expect(after.detailsChanged).toEqual(["phone", "note"]);
    expect(JSON.stringify(after)).not.toContain("555555");
    // No new member of §10.7's list was invented for this.
    expect(rows.some((x) => /detail|phone|note|personal/i.test(x.action))).toBe(false);
  });

  it("the phone and the note go when the person does; the start date is employment record (§19.6)", async () => {
    const leaver = (await post(t, "/users", { name: "Հեռացող", pin: "432100", role: "EMPLOYEE" }, "OWNER")).body;
    await patch(leaver.id, { phone: PHONE, startedOn: "2021-06-01", note: NOTE });
    await patch(leaver.id, { isActive: false });

    const row = (await get(t, `/users/${leaver.id}`, "OWNER")).body;
    expect(row).toMatchObject({ isActive: false, phone: null, note: null, startedOn: "2021-06-01", avatarUpdatedAt: null });
  });
});
