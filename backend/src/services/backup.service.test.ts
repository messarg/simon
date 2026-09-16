/**
 * §27.10 — the database is restored onto a different machine, by the owner, using only the backup
 * file and the passphrase he wrote down. Nothing is carried over from the host that took it.
 */
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDatabase } from "../lib/db.ts";
import { PINS, bearer, createTestApp, type TestApp } from "../test/app.ts";
import { makeProduct, openShift, post, saleBody } from "../test/fixtures.ts";
import request from "supertest";
import { applyPendingRestore, backupPaths, createInstallPassphrase, listBackups, readPassphrase, restoreFromFile, takeBackup } from "./backup.service.ts";
import { diagnostics } from "./diagnostics.service.ts";

const reauth = async (t: TestApp, action: string) =>
  (await post(t, "/auth/reauth", { adminUserId: t.users.ADMIN.id, pin: PINS.ADMIN, action })).body.grant as string;

describe("backup and restore — §19.2, §27.10", () => {
  let t: TestApp;
  let home = "";
  let usb = "";
  let passphrase = "";
  const original = { ...backupPaths };

  beforeAll(async () => {
    t = await createTestApp();
    home = mkdtempSync(path.join(tmpdir(), "simon-backup-"));
    usb = path.join(home, "usb");
    backupPaths.keyDir = path.join(home, "keys");
    backupPaths.dir = path.join(home, "backups");
    backupPaths.usbDir = "";
    passphrase = createInstallPassphrase();
    const product = await makeProduct(t, { name: "Մալուխ", priceDram: 1_200, stock: 10_000, costMdram: 800_000 });
    const shiftId = await openShift(t, "WORKER");
    await post(t, "/sales", saleBody({ shiftId, lines: [{ product, qty: 2_000, taxRateBp: 0 }] }));
  });

  afterAll(async () => {
    Object.assign(backupPaths, original);
    rmSync(home, { recursive: true, force: true });
    await t.close();
  });

  it("without a passphrase there is no backup, and the failure is recorded rather than swallowed", async () => {
    const keys = backupPaths.keyDir;
    backupPaths.keyDir = path.join(home, "absent");
    const result = await takeBackup(t.db, "MANUAL");
    backupPaths.keyDir = keys;
    expect(result).toMatchObject({ ok: false, error: "passphrase-not-set" });
    expect(await t.db.backupRun.count({ where: { outcome: "FAILED", error: "passphrase-not-set" } })).toBe(1);
  });

  it("takes an encrypted snapshot and records what it wrote", async () => {
    const result = await takeBackup(t.db, "MANUAL");
    expect(result.ok).toBe(true);
    const listed = await listBackups(t.db);
    expect(listed.files).toHaveLength(1);
    expect(listed.passphraseSet).toBe(true);
    expect(listed.runs[0]).toMatchObject({ destination: "LOCAL", outcome: "OK" });
    expect(listed.files[0].sizeBytes).toBeGreaterThan(1_000);
    // No half-written snapshot left behind.
    expect(readdirSync(backupPaths.dir).filter((f) => f.startsWith(".snapshot") || f.endsWith(".part"))).toEqual([]);
  });

  it("copies the backup taken at close to the USB drive, and says so when the drive is not there", async () => {
    backupPaths.usbDir = path.join(home, "no-such-drive");
    await takeBackup(t.db, "CLOSE");
    expect(await t.db.backupRun.findFirst({ where: { destination: "USB", outcome: "FAILED" } })).toMatchObject({ error: "usb-not-present" });
    backupPaths.usbDir = usb;
    const { mkdirSync } = await import("node:fs");
    mkdirSync(usb, { recursive: true });
    await takeBackup(t.db, "CLOSE");
    expect(readdirSync(usb)).toHaveLength(1);
    expect(await t.db.backupRun.findFirst({ where: { destination: "USB", outcome: "OK" } })).not.toBeNull();
  });

  it("§27.10 — restores onto a machine holding neither the key nor the database, from the file and the paper alone", async () => {
    const file = path.join(usb, readdirSync(usb)[0]);
    const replacement = mkdtempSync(path.join(tmpdir(), "simon-replacement-"));
    const target = path.join(replacement, "data", "simon.db");
    try {
      // The replacement host has no keystore at all.
      backupPaths.keyDir = path.join(replacement, "keys");
      expect(readPassphrase()).toBeNull();
      expect(() => restoreFromFile(file, "WRON-GPAS-SPHR-ASEX-XXXX-XXXX", target)).toThrow();
      expect(existsSync(target)).toBe(false);

      restoreFromFile(file, passphrase, target);
      const restored = await openDatabase(target);
      try {
        expect(await restored.sale.count({ where: { status: "COMPLETED" } })).toBe(1);
        expect((await restored.product.findFirstOrThrow()).name).toBe("Մալուխ");
        expect(await restored.user.count()).toBe(3);
      } finally {
        await restored.$disconnect();
      }
    } finally {
      backupPaths.keyDir = path.join(home, "keys");
      rmSync(replacement, { recursive: true, force: true });
    }
  });

  it("a one-click restore is staged and swapped in on the next start, keeping the database it replaced", async () => {
    const name = (await listBackups(t.db)).files[0].name;
    expect((await post(t, "/backup/restore", { file: name, reauthGrant: "nope" }, "ADMIN")).status).toBe(403);
    const grant = await reauth(t, "backupRestore");
    const staged = await post(t, "/backup/restore", { file: name, reauthGrant: grant }, "ADMIN");
    expect(staged.status).toBe(200);
    expect(staged.body).toMatchObject({ staged: true, file: name });
    expect(await t.db.auditLog.count({ where: { action: "backup.restore" } })).toBe(1);

    // The swap itself, against a copy of the live file rather than the one this test is using.
    const live = path.join(home, "swap", "simon.db");
    const { mkdirSync, writeFileSync, renameSync } = await import("node:fs");
    mkdirSync(path.dirname(live), { recursive: true });
    writeFileSync(live, "old database");
    renameSync(`${(await import("../lib/config.ts")).databaseFile("LIVE")}.restore`, `${live}.restore`);
    expect(applyPendingRestore(live)).toBe(true);
    expect(readdirSync(path.dirname(live)).some((f) => f.includes("before-restore"))).toBe(true);
    expect(applyPendingRestore(live)).toBe(false);
  });

  it("the passphrase is revealed and rotated only with an admin PIN, and every use is audited", async () => {
    expect((await post(t, "/backup/passphrase/reveal", { reauthGrant: "nope" }, "ADMIN")).status).toBe(403);
    const reveal = await post(t, "/backup/passphrase/reveal", { reauthGrant: await reauth(t, "backupPassphrase") }, "ADMIN");
    expect(reveal.body.passphrase).toBe(passphrase);
    expect((await request(t.server).post("/api/backup/passphrase/reveal").set(bearer(t.tokens.STOCK)).send({ reauthGrant: "x" })).status).toBe(403);

    const rotated = await post(t, "/backup/passphrase/rotate", { reauthGrant: await reauth(t, "backupPassphrase") }, "ADMIN");
    expect(rotated.body.passphrase).not.toBe(passphrase);
    expect(readPassphrase()).toBe(rotated.body.passphrase);
    passphrase = rotated.body.passphrase;
    expect(await t.db.auditLog.count({ where: { action: { in: ["backup.passphraseReveal", "backup.passphraseRotate"] } } })).toBe(2);
    // Rotation re-encrypts later backups only: the audit row records that one exists, never which.
    const row = await t.db.auditLog.findFirstOrThrow({ where: { action: "backup.passphraseRotate" } });
    expect(JSON.stringify(row)).not.toContain(passphrase);
  });

  it("diagnostics report whether a passphrase is set, never the passphrase", async () => {
    const payload = await diagnostics(t.db);
    expect(payload.backup.passphraseSet).toBe(true);
    expect(payload.backup.lastOkAt).not.toBeNull();
    expect(JSON.stringify(payload)).not.toContain(passphrase);
    expect(payload.installation).toMatchObject({ taxRegime: "VAT", priceBasis: "INCLUSIVE", timezone: "Asia/Yerevan" });
    expect(payload.database.bytes).toBeGreaterThan(0);
  });
});
