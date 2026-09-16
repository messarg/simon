/**
 * Backup and restore. PRD §19.2, §27.10, FR-DAT-01/02/06.
 *
 * A backup is a consistent snapshot (`VACUUM INTO`, never a copy of a file being written),
 * encrypted under the owner's passphrase and written beside a `BackupRun` row that says whether
 * it worked. Local disk keeps §19.2's GFS generations; the USB drive gets the backup taken at
 * close. The passphrase lives in a file on the host — not a `Setting`, so no settings route can
 * reach it — and restore needs only the backup file and the paper.
 *
 * Restoring the live database cannot happen under a running server holding it open, so the
 * one-click path stages the decrypted file and the server swaps it in on its next start, keeping
 * the replaced file beside it.
 */
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { uuidv7 } from "@simon/shared";
import { LOCAL_GENERATIONS, retain, USB_GENERATIONS, type Generations } from "../domain/backup-rotation.ts";
import { decryptBackup, encryptBackup, generatePassphrase } from "../lib/backup-crypto.ts";
import { config } from "../lib/config.ts";
import type { Db } from "../lib/db.ts";
import { logger } from "../lib/logger.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { writeAudit } from "./audit.service.ts";
import { readSettings } from "./settings.service.ts";

/** Mutable so a test can point every path at a temporary directory. */
export const backupPaths = { keyDir: config.backup.keyDir, dir: config.backup.dir, usbDir: config.backup.usbDir };

export type BackupReason = "HOURLY" | "DAILY" | "CLOSE" | "MANUAL";

const FILE_RE = /^simon-(\d{8}T\d{6}Z)\.simonbak$/;
const keyFile = () => path.join(backupPaths.keyDir, "backup-passphrase.json");
const fileName = (iso: string) => `simon-${iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "")}.simonbak`;
const atOf = (name: string) => {
  const m = FILE_RE.exec(name);
  if (!m) return null;
  const s = m[1];
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`;
};

// ── The passphrase ───────────────────────────────────────────────────────────

export function readPassphrase(): string | null {
  try {
    return (JSON.parse(readFileSync(keyFile(), "utf8")) as { passphrase: string }).passphrase ?? null;
  } catch {
    return null;
  }
}

export function writePassphrase(passphrase: string) {
  mkdirSync(backupPaths.keyDir, { recursive: true, mode: 0o700 });
  const part = `${keyFile()}.part`;
  writeFileSync(part, JSON.stringify({ passphrase, createdAt: clock.iso() }), { mode: 0o600 });
  chmodSync(part, 0o600);
  renameSync(part, keyFile());
}

export const passphraseIsSet = () => readPassphrase() !== null;

/** Wizard's end (§7.1): a new shop gets a new passphrase, shown once beside the recovery code. */
export function createInstallPassphrase() {
  const passphrase = generatePassphrase();
  writePassphrase(passphrase);
  return passphrase;
}

export async function revealPassphrase(db: Db, adminId: string) {
  const passphrase = readPassphrase();
  if (!passphrase) throw problem("not-found", { reason: "passphrase-not-set" });
  await db.$transaction((tx) => writeAudit(tx, { userId: adminId, action: "backup.passphraseReveal", entityType: "Backup", entityId: "passphrase" }));
  return passphrase;
}

/** Rotation re-encrypts subsequent backups only — every backup already taken still needs the old paper. */
export async function rotatePassphrase(db: Db, adminId: string) {
  const hadOne = passphraseIsSet();
  const passphrase = generatePassphrase();
  writePassphrase(passphrase);
  await db.$transaction((tx) => writeAudit(tx, { userId: adminId, action: "backup.passphraseRotate", entityType: "Backup", entityId: "passphrase", before: { set: hadOne }, after: { set: true } }));
  return passphrase;
}

// ── Taking a backup ──────────────────────────────────────────────────────────

let running: Promise<unknown> | null = null;

function rotate(dir: string, gens: Generations, timeZone: string) {
  const files = readdirSync(dir).flatMap((name) => { const at = atOf(name); return at ? [{ id: name, at }] : []; });
  const keep = retain(files, timeZone, gens);
  for (const f of files) if (!keep.has(f.id)) rmSync(path.join(dir, f.id), { force: true });
}

async function record(db: Db, run: { id: string; startedAt: string; destination: "LOCAL" | "USB"; outcome: "OK" | "FAILED"; sizeBytes?: number; error?: string }) {
  await db.backupRun.create({ data: { id: run.id, startedAt: run.startedAt, completedAt: clock.iso(), destination: run.destination, sizeBytes: run.sizeBytes ?? null, outcome: run.outcome, error: run.error ?? null } });
}

export async function takeBackup(db: Db, reason: BackupReason) {
  if (running) await running.catch(() => undefined);
  const job = doBackup(db, reason);
  running = job;
  try { return await job; } finally { if (running === job) running = null; }
}

async function doBackup(db: Db, reason: BackupReason) {
  const startedAt = clock.iso();
  const id = uuidv7();
  const passphrase = readPassphrase();
  if (!passphrase) {
    await record(db, { id, startedAt, destination: "LOCAL", outcome: "FAILED", error: "passphrase-not-set" });
    return { ok: false as const, error: "passphrase-not-set" };
  }
  const settings = await readSettings(db);
  const snapshot = path.join(backupPaths.dir, `.snapshot-${id}.db`);
  try {
    mkdirSync(backupPaths.dir, { recursive: true });
    await db.$executeRawUnsafe(`VACUUM INTO '${snapshot.replaceAll("'", "''")}'`);
    const encrypted = encryptBackup(readFileSync(snapshot), passphrase);
    const name = fileName(startedAt);
    const target = path.join(backupPaths.dir, name);
    writeFileSync(`${target}.part`, encrypted, { mode: 0o600 });
    renameSync(`${target}.part`, target);
    await record(db, { id, startedAt, destination: "LOCAL", outcome: "OK", sizeBytes: encrypted.length });
    rotate(backupPaths.dir, LOCAL_GENERATIONS, settings["shop.timezone"]);

    // The drive carries dailies and monthlies: the backup at close, or the daily of a day with no close.
    if ((reason === "CLOSE" || reason === "DAILY") && settings["backup.destination"].includes("USB")) {
      const usbId = uuidv7();
      if (!backupPaths.usbDir || !existsSync(backupPaths.usbDir)) {
        await record(db, { id: usbId, startedAt, destination: "USB", outcome: "FAILED", error: "usb-not-present" });
      } else {
        copyFileSync(target, path.join(backupPaths.usbDir, name));
        await record(db, { id: usbId, startedAt, destination: "USB", outcome: "OK", sizeBytes: encrypted.length });
        rotate(backupPaths.usbDir, USB_GENERATIONS, settings["shop.timezone"]);
      }
    }
    return { ok: true as const, file: name, sizeBytes: encrypted.length };
  } catch (err) {
    logger.error({ err }, "backup failed");
    const error = err instanceof Error ? err.message.slice(0, 200) : "unknown";
    await record(db, { id, startedAt, destination: "LOCAL", outcome: "FAILED", error }).catch(() => undefined);
    return { ok: false as const, error };
  } finally {
    rmSync(snapshot, { force: true });
  }
}

/** Hourly while trading — a shift is open or something sold since the last backup — and daily regardless. */
export async function backupTick(db: Db) {
  const last = await db.backupRun.findFirst({ where: { outcome: "OK", destination: "LOCAL" }, orderBy: { startedAt: "desc" } });
  const age = last ? clock.now().getTime() - Date.parse(last.startedAt) : Infinity;
  if (age >= 24 * 3_600_000) return takeBackup(db, "DAILY");
  if (age < 55 * 60_000) return null;
  const trading = (await db.shift.count({ where: { status: { in: ["OPEN", "CLOSING"] } } })) > 0
    || (await db.sale.count({ where: { completedAt: { gt: last!.startedAt } } })) > 0;
  return trading ? takeBackup(db, "HOURLY") : null;
}

export async function listBackups(db: Db) {
  const files = existsSync(backupPaths.dir)
    ? readdirSync(backupPaths.dir).flatMap((name) => { const at = atOf(name); return at ? [{ name, at, sizeBytes: statSync(path.join(backupPaths.dir, name)).size }] : []; })
    : [];
  files.sort((a, b) => (a.at < b.at ? 1 : -1));
  const runs = await db.backupRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 });
  return { files, runs, passphraseSet: passphraseIsSet(), usbConfigured: Boolean(backupPaths.usbDir), usbPresent: Boolean(backupPaths.usbDir) && existsSync(backupPaths.usbDir) };
}

// ── Restoring ────────────────────────────────────────────────────────────────

/** A decrypted database is only written where the live one will be if SQLite agrees it is whole. */
function verifyDatabase(bytes: Buffer) {
  const probe = path.join(tmpdir(), `simon-restore-check-${uuidv7()}.db`);
  writeFileSync(probe, bytes, { mode: 0o600 });
  try {
    const sqlite = new Database(probe, { readonly: true });
    try {
      const check = sqlite.pragma("integrity_check", { simple: true });
      const hasSales = sqlite.prepare(`SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'Sale'`).get() as { n: number };
      if (check !== "ok" || hasSales.n !== 1) throw new Error("not a Simon database");
    } finally {
      sqlite.close();
    }
  } finally {
    rmSync(probe, { force: true });
  }
}

const moveAside = (file: string, stamp: string) => {
  for (const suffix of ["", "-wal", "-shm"]) if (existsSync(file + suffix)) renameSync(file + suffix, `${file}.before-restore-${stamp}${suffix}`);
};
const stampOf = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** The §27.10 path: a backup file and the paper, on a machine that has neither the old host's key nor its database. */
export function restoreFromFile(backupFile: string, passphrase: string, targetDbFile: string) {
  const bytes = decryptBackup(readFileSync(backupFile), passphrase);
  verifyDatabase(bytes);
  mkdirSync(path.dirname(targetDbFile), { recursive: true });
  moveAside(targetDbFile, stampOf(clock.iso()));
  writeFileSync(`${targetDbFile}.part`, bytes, { mode: 0o600 });
  renameSync(`${targetDbFile}.part`, targetDbFile);
}

/** One-click restore from a backup on this host's disk: staged now, swapped in at the next start. */
export async function stageRestore(db: Db, adminId: string, name: string, targetDbFile: string) {
  if (!FILE_RE.test(name)) throw problem("malformed-request", { field: "file" });
  const source = path.join(backupPaths.dir, name);
  if (!existsSync(source)) throw problem("not-found");
  const passphrase = readPassphrase();
  if (!passphrase) throw problem("not-found", { reason: "passphrase-not-set" });
  let bytes: Buffer;
  try {
    bytes = decryptBackup(readFileSync(source), passphrase);
    verifyDatabase(bytes);
  } catch {
    // Taken under an earlier passphrase, or damaged: the file needs the paper it was taken under.
    throw problem("not-permitted", { reason: "backup-unreadable" });
  }
  mkdirSync(path.dirname(targetDbFile), { recursive: true });
  writeFileSync(`${targetDbFile}.restore`, bytes, { mode: 0o600 });
  await db.$transaction((tx) => writeAudit(tx, { userId: adminId, action: "backup.restore", entityType: "Backup", entityId: name }));
  return { staged: true, file: name, backupAt: atOf(name) };
}

/** Called before migrations on startup. The replaced database is kept, never deleted. */
export function applyPendingRestore(dbFile: string): boolean {
  const staged = `${dbFile}.restore`;
  if (!existsSync(staged)) return false;
  moveAside(dbFile, stampOf(new Date().toISOString()));
  renameSync(staged, dbFile);
  return true;
}
