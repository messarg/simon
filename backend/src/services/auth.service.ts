/**
 * PIN authentication, devices and sessions. PRD §16.2, §16.3, §11 `Device`/`Session`.
 *
 * - The PIN is compared only here, against an argon2id hash.
 * - Five consecutive failures lock the user for fifteen minutes (423); ten attempts a
 *   minute per device are refused (429). The lock is per user, so the shop keeps selling.
 * - The session token is 256 random bits; the row holds only its SHA-256. (§11 names
 *   argon2id for the token hash too, but a salted slow hash cannot be looked up by value;
 *   a 256-bit random token needs no stretching, only non-reversibility.)
 * - Re-authentication issues a short-lived, single-use grant for one named action.
 * - Nobody is listed before sign-in (§16.2, §26.2): a person types their name and their PIN, and a
 *   name that matches nobody fails exactly as a wrong PIN does — same problem, same time spent —
 *   so the sign-in screen cannot be used to find out who works here.
 */
import { createHash, randomBytes, randomInt } from "node:crypto";
import argon2 from "argon2";
import { isManager, isOwner, parsePermissions, uuidv7, type Role, type SessionMode } from "@simon/shared";
import { nameKey } from "../domain/person-name.ts";
import { afterAttempt, isLocked, minutesRemaining, PIN_PATTERN, type DeviceRateLimiter } from "../domain/pin-policy.ts";
import { config } from "../lib/config.ts";
import type { Db, Tx } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { writeAudit } from "./audit.service.ts";

export const hashSecret = (secret: string) => argon2.hash(secret, { type: argon2.argon2id, memoryCost: config.argon2.memoryCost, timeCost: config.argon2.timeCost });
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function assertPinShape(pin: string) {
  if (!PIN_PATTERN.test(pin)) throw problem("malformed-request", { field: "pin" });
}

/** The owner and managers work from the dashboard; an employee from the till (§16.3). */
export function idleMinutesFor(role: Role) {
  return isManager(role) ? config.ownerIdleMinutes : config.tillIdleMinutes;
}

const PREFIX_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** The lowest unused two-character prefix (§11 `Device.prefix`). */
export async function nextDevicePrefix(tx: Tx): Promise<string> {
  const used = new Set((await tx.device.findMany({ select: { prefix: true } })).map((d) => d.prefix));
  for (const a of PREFIX_ALPHABET) for (const b of PREFIX_ALPHABET) if (!used.has(a + b)) return a + b;
  throw new Error("device prefixes exhausted");
}

export function generateRecoveryCode(): string {
  // 16 characters, grouped for writing on paper; no 0/O/1/I ambiguity.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const raw = Array.from({ length: 16 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return raw.match(/.{4}/g)!.join("-");
}

type UserRow = NonNullable<Awaited<ReturnType<Db["user"]["findUnique"]>>>;

/** Every active person whose name matches. More than one only for names saved before §6.17's rule. */
export async function findActiveByName(db: Db | Tx, name: string): Promise<UserRow[]> {
  const key = nameKey(name);
  if (!key) return [];
  const active = await db.user.findMany({ where: { isActive: 1 } });
  return active.filter((u) => nameKey(u.name) === key);
}

// A name that matches nobody still costs one argon2 verification, so it answers in the same time
// as a wrong PIN and a stopwatch cannot tell the two apart.
let decoy: Promise<string> | null = null;
const decoyHash = () => (decoy ??= hashSecret(randomBytes(16).toString("hex")));

/**
 * Checks a PIN against the people a name matched, applying §16.2's lockout to each. Returns the one
 * it belongs to, or throws the same problem whether the name or the PIN was wrong.
 */
async function verifyByName(db: Db, name: string, pin: string, eligible: (u: UserRow) => boolean): Promise<UserRow> {
  const candidates = (await findActiveByName(db, name)).filter(eligible);
  if (!candidates.length) {
    await argon2.verify(await decoyHash(), pin);
    throw problem("pin-incorrect", { attemptsRemaining: null });
  }
  const now = clock.now();
  const open = candidates.filter((u) => !isLocked(u, now));
  if (!open.length) throw problem("account-locked", { minutesRemaining: Math.max(...candidates.map((u) => minutesRemaining(u, now))) });

  for (const u of open) {
    if (await argon2.verify(u.pinHash, pin)) {
      await db.user.update({ where: { id: u.id }, data: { failedAttempts: 0, lockedUntil: null } });
      return u;
    }
  }
  // A wrong PIN counts against everyone the name could have meant: with one match that is
  // exactly §16.2's rule, and a shared name is a legacy the owner is told to fix (§6.17).
  let last = afterAttempt(open[0]!, false, now);
  for (const u of open) {
    last = afterAttempt(u, false, now);
    await db.user.update({ where: { id: u.id }, data: { failedAttempts: last.failedAttempts, lockedUntil: last.lockedUntil } });
  }
  if (open.length === 1 && last.lockedUntil) throw problem("account-locked", { minutesRemaining: minutesRemaining(last, now) });
  throw problem("pin-incorrect", { attemptsRemaining: open.length === 1 ? last.attemptsRemaining : null });
}

export interface LoginInput {
  name: string;
  pin: string;
  deviceId?: string | null;
  deviceLabel?: string;
  rateKey: string;
}

/** The limiter belongs to the running app, not the module, so two apps never share a window. */
export async function login(db: Db, limiter: DeviceRateLimiter, input: LoginInput) {
  const wait = limiter.take(input.deviceId ?? input.rateKey, clock.now().getTime());
  if (wait > 0) throw problem("too-many-attempts", { retryAfterSeconds: wait });
  assertPinShape(input.pin);

  const user = await verifyByName(db, input.name, input.pin, () => true);
  const now = clock.now();

  const token = randomBytes(32).toString("base64url");
  return db.$transaction(async (tx) => {
    let device = input.deviceId ? await tx.device.findUnique({ where: { id: input.deviceId } }) : null;
    if (device && device.isActive !== 1) device = null;
    if (!device) {
      device = await tx.device.create({
        data: { id: uuidv7(), prefix: await nextDevicePrefix(tx), label: input.deviceLabel?.trim() || "Till", registeredAt: now.toISOString(), lastSeenAt: now.toISOString() },
      });
    }
    // A worker's open shift carries across logins on the same day.
    const shift = await tx.shift.findFirst({ where: { userId: user.id, status: { in: ["OPEN", "CLOSING"] } }, select: { id: true } });
    const expiresAt = new Date(now.getTime() + idleMinutesFor(user.role as Role) * 60_000).toISOString();
    const session = await tx.session.create({
      data: { id: uuidv7(), userId: user.id, deviceId: device.id, tokenHash: hashToken(token), mode: "LIVE", shiftId: shift?.id ?? null, createdAt: now.toISOString(), lastSeenAt: now.toISOString(), expiresAt },
    });
    return {
      token,
      session: { id: session.id, mode: session.mode as SessionMode, expiresAt, shiftId: session.shiftId },
      user: sessionUser(user),
      device: { id: device.id, prefix: device.prefix, label: device.label, lastSequence: device.lastSequence },
    };
  });
}

/** What a signed-in client is told about its person — enough to decide what to show. */
export function sessionUser(u: { id: string; name: string; role: string; permissions: string }) {
  return { id: u.id, name: u.name, role: u.role as Role, permissions: parsePermissions(u.permissions) };
}

export async function resolveSession(db: Db, token: string) {
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true, device: true } });
  if (!session || session.revokedAt || session.user.isActive !== 1 || session.device.isActive !== 1) return null;
  const now = clock.now();
  if (Date.parse(session.expiresAt) <= now.getTime()) return null;
  // Throttled: at most once a minute, never inside a document transaction (§16.3).
  if (now.getTime() - Date.parse(session.lastSeenAt) > 60_000) {
    const expiresAt = new Date(now.getTime() + idleMinutesFor(session.user.role as Role) * 60_000).toISOString();
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: now.toISOString(), expiresAt } });
  }
  return session;
}

export async function logout(db: Db, sessionId: string) {
  await db.session.update({ where: { id: sessionId }, data: { revokedAt: clock.iso() } });
}

/** Sessions end when their shift closes (§16.3, §27.40). Called inside the close transaction. */
export async function revokeSessionsForShift(tx: Tx, shiftId: string) {
  await tx.session.updateMany({ where: { shiftId, revokedAt: null }, data: { revokedAt: clock.iso() } });
}

// ── Re-authentication grants ─────────────────────────────────────────────────

export type ReauthAction = "discount" | "priceOverride" | "priceChange" | "stockAdjustment" | "blindReturn" | "repaymentReversal" | "noSaleDrawer" | "creditLimitOverride" | "unlock" | "backupPassphrase" | "backupRestore";

/** Grants only the owner can give: they unlock what is the owner's alone (§16.4). */
const OWNER_ACTIONS: readonly ReauthAction[] = ["backupPassphrase", "backupRestore"];

interface Grant { adminId: string; action: ReauthAction; expires: number; }
const grants = new Map<string, Grant>();
const GRANT_TTL_MS = 2 * 60_000;

/**
 * The approver types their name and PIN on the device asking, as at sign-in — an owner or a
 * manager, or the owner alone for the owner's actions. Someone who could not approve fails exactly
 * as a wrong PIN does, so the sheet does not reveal who holds which role.
 */
export async function reauth(db: Db, limiter: DeviceRateLimiter, input: { name: string; pin: string; action: ReauthAction; rateKey: string }) {
  const wait = limiter.take(`reauth:${input.rateKey}`, clock.now().getTime());
  if (wait > 0) throw problem("too-many-attempts", { retryAfterSeconds: wait });
  assertPinShape(input.pin);
  const ownerOnly = OWNER_ACTIONS.includes(input.action);
  const admin = await verifyByName(db, input.name, input.pin, (u) => ownerOnly ? isOwner(u.role as Role) : isManager(u.role as Role));
  const now = clock.now();
  const grant = randomBytes(24).toString("base64url");
  grants.set(grant, { adminId: admin.id, action: input.action, expires: now.getTime() + GRANT_TTL_MS });
  return { grant, adminId: admin.id, adminName: admin.name, expiresAt: new Date(now.getTime() + GRANT_TTL_MS).toISOString() };
}

/** Consumes a grant for an action, returning the admin who gave it, or null. */
export function consumeGrant(grant: string | null | undefined, action: ReauthAction | readonly ReauthAction[]): string | null {
  if (!grant) return null;
  const g = grants.get(grant);
  if (!g) return null;
  grants.delete(grant);
  const allowed = typeof action === "string" ? [action] : action;
  if (!allowed.includes(g.action) || g.expires < clock.now().getTime()) return null;
  return g.adminId;
}

// ── Lockout exits (§16.2) ────────────────────────────────────────────────────

export async function unlockUser(db: Db, adminId: string, userId: string) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw problem("not-found");
    await tx.user.update({ where: { id: userId }, data: { failedAttempts: 0, lockedUntil: null } });
    await writeAudit(tx, { userId: adminId, action: "auth.unlock", entityType: "User", entityId: userId, before: { lockedUntil: user.lockedUntil } });
  });
}

/**
 * Redeems the single-use recovery code and reissues it (§16.2's third way out). Only the owner holds
 * one, so the code alone says whose it is — nobody has to be picked from a list first.
 */
export async function recover(db: Db, input: { recoveryCode: string }) {
  const user = await db.user.findFirst({ where: { role: "OWNER", isActive: 1 } });
  if (!user?.recoveryCodeHash) {
    await argon2.verify(await decoyHash(), input.recoveryCode);
    throw problem("pin-incorrect", { attemptsRemaining: null });
  }
  const ok = await argon2.verify(user.recoveryCodeHash, input.recoveryCode.trim().toUpperCase());
  if (!ok) throw problem("pin-incorrect", { attemptsRemaining: null });
  const recoveryCode = generateRecoveryCode();
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null, recoveryCodeHash: await hashSecret(recoveryCode) } });
    await writeAudit(tx, { userId: user.id, action: "auth.recover", entityType: "User", entityId: user.id });
  });
  return { recoveryCode };
}

export async function revokeSession(db: Db, adminId: string, sessionId: string) {
  await db.$transaction(async (tx) => {
    const s = await tx.session.findUnique({ where: { id: sessionId } });
    if (!s) throw problem("not-found");
    if (!s.revokedAt) await tx.session.update({ where: { id: sessionId }, data: { revokedAt: clock.iso() } });
    await writeAudit(tx, { userId: adminId, action: "session.revoke", entityType: "Session", entityId: sessionId });
  });
}

/** Deactivating a device revokes its sessions in the same transaction (§16.3, FR-SEC-06). */
export async function deactivateDevice(db: Db, adminId: string, deviceId: string) {
  await db.$transaction(async (tx) => {
    const d = await tx.device.findUnique({ where: { id: deviceId } });
    if (!d) throw problem("not-found");
    await tx.device.update({ where: { id: deviceId }, data: { isActive: 0 } });
    await tx.session.updateMany({ where: { deviceId, revokedAt: null }, data: { revokedAt: clock.iso() } });
    await writeAudit(tx, { userId: adminId, action: "device.deactivate", entityType: "Device", entityId: deviceId });
  });
}
