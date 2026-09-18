/** Users and first-run setup. PRD §7.1 (Q1–Q2), §16.4. */
import { uuidv7, type Role } from "@simon/shared";
import type { Db } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { writeAudit } from "./audit.service.ts";
import { assertPinShape, generateRecoveryCode, hashSecret } from "./auth.service.ts";
import { writeSettings } from "./settings.service.ts";

export async function needsSetup(db: Db) {
  return (await db.user.count()) === 0;
}

/** Wizard Q1–Q2: the shop's name and its first ADMIN. Only reachable while no user exists. */
export async function createOwner(db: Db, input: { shopName: string; ownerName: string; pin: string }) {
  assertPinShape(input.pin);
  const recoveryCode = generateRecoveryCode();
  const [pinHash, recoveryCodeHash] = await Promise.all([hashSecret(input.pin), hashSecret(recoveryCode)]);
  const user = await db.$transaction(async (tx) => {
    if ((await tx.user.count()) > 0) throw problem("not-permitted");
    const u = await tx.user.create({
      data: { id: uuidv7(), name: input.ownerName.normalize("NFC").trim(), pinHash, recoveryCodeHash, role: "ADMIN", createdAt: clock.iso() },
    });
    // Q1 and Q2 are answered; the wizard resumes at Q3 if this is where it was abandoned (§7.1, §27.35).
    await writeSettings(tx, { "shop.name": input.shopName.normalize("NFC").trim(), "setup.step": 2 }, null);
    return u;
  });
  return { user: { id: user.id, name: user.name, role: user.role }, recoveryCode };
}

/**
 * Explicitly projected: the only BLOB in the schema is on this row, and a list has no use for it
 * (§11). The two hashes are never selected anywhere, which is why this is a `select` and not an
 * omission — a field added to `User` joins nothing by accident.
 */
const STAFF_FIELDS = {
  id: true, name: true, role: true, isActive: true, failedAttempts: true, lockedUntil: true, createdAt: true,
  avatarUpdatedAt: true, phone: true, startedOn: true, note: true,
} as const;

export async function listUsers(db: Db) {
  return db.user.findMany({ orderBy: { createdAt: "asc" }, select: STAFF_FIELDS });
}

/** One person, for §6.11's page. `ADMIN` only, like the list it is a row of. */
export async function getUser(db: Db, userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: STAFF_FIELDS });
  if (!u) throw problem("not-found");
  return u;
}

/**
 * The PIN pad's tiles: active users, and for each the stamp that says whether a photograph exists
 * and what to cache-bust on (§6.11.1, §15.4). The bytes are one request per face — carrying them
 * base64-encoded here would put a third of a megabyte on the screen that must appear first (§26.2).
 */
export async function listSignInUsers(db: Db) {
  return db.user.findMany({ where: { isActive: 1 }, orderBy: { name: "asc" }, select: { id: true, name: true, avatarUpdatedAt: true } });
}

/**
 * Who can approve an override (§16.3). The re-auth sheet listed everybody, so a worker was offered
 * their colleague's name and a PIN that could never work. Names only, as the sign-in list is.
 */
export async function listAdmins(db: Db) {
  return db.user.findMany({ where: { isActive: 1, role: "ADMIN" }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

export async function createUser(db: Db, adminId: string, input: { name: string; pin: string; role: Role } & Pick<StaffPatch, "phone" | "startedOn" | "note">) {
  assertPinShape(input.pin);
  const pinHash = await hashSecret(input.pin);
  return db.$transaction(async (tx) => {
    const u = await tx.user.create({
      // Details are optional on create: adding someone mid-shift should cost a name, a PIN and a
      // role, and nothing else (§6.17). They are the same columns `updateUser` writes.
      data: {
        id: uuidv7(), name: input.name.normalize("NFC").trim(), pinHash, role: input.role, createdAt: clock.iso(),
        phone: blankToNull(input.phone) ?? null, startedOn: blankToNull(input.startedOn) ?? null, note: blankToNull(input.note) ?? null,
      },
      select: STAFF_FIELDS,
    });
    await writeAudit(tx, { userId: adminId, action: "user.create", entityType: "User", entityId: u.id, after: { name: u.name, role: u.role } });
    return u;
  });
}

/**
 * A cleared field arrives from a form as `""`, and means null — the column is nullable precisely so
 * that "not recorded" has a representation (§19.6). `undefined` still means "leave it alone", which
 * is what keeps a PATCH of the role from wiping a phone number.
 */
const blankToNull = (v: string | null | undefined) => {
  if (v === undefined) return undefined;
  const s = (v ?? "").normalize("NFC").trim();
  return s === "" ? null : s;
};

export type StaffPatch = { name?: string; pin?: string; role?: Role; isActive?: boolean; phone?: string | null; startedOn?: string | null; note?: string | null };

export async function updateUser(db: Db, adminId: string, userId: string, patch: StaffPatch) {
  if (patch.pin !== undefined) assertPinShape(patch.pin);
  const pinHash = patch.pin !== undefined ? await hashSecret(patch.pin) : undefined;
  return db.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id: userId }, select: STAFF_FIELDS });
    if (!before) throw problem("not-found");
    if (before.role === "ADMIN" && (patch.role && patch.role !== "ADMIN" || patch.isActive === false)) {
      const admins = await tx.user.count({ where: { role: "ADMIN", isActive: 1 } });
      if (admins <= 1) throw problem("not-permitted", { reason: "last-admin" });
    }
    const details = { phone: blankToNull(patch.phone), startedOn: blankToNull(patch.startedOn), note: blankToNull(patch.note) };
    const u = await tx.user.update({
      where: { id: userId },
      data: {
        name: patch.name?.normalize("NFC").trim(), role: patch.role, pinHash, ...details,
        isActive: patch.isActive === undefined ? undefined : patch.isActive ? 1 : 0,
        // The name follows the financial retention period and so does the start date; the
        // photograph, the phone and the note do not — they are operational, nothing in the books
        // needs them, and they go when the person does, in this transaction (§19.6).
        ...(patch.isActive === false ? { avatar: null, avatarType: null, avatarUpdatedAt: null, phone: null, note: null } : {}),
      },
      select: STAFF_FIELDS,
    });
    if (patch.isActive === false) await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: clock.iso() } });
    // §10.7 enumerates what is audited and this stays one of its members: changing a person's
    // details is part of managing the person, not a new kind of event. The row names *which*
    // details moved and never their values — `pinChanged` is the same shape, and for the same
    // reason. A phone number copied into an append-only table would outlive the erasure §19.6
    // promises, which is the whole point of the column going null on deactivation.
    const changed = (["phone", "startedOn", "note"] as const).filter((k) => details[k] !== undefined && details[k] !== before[k]);
    await writeAudit(tx, {
      userId: adminId, action: "user.permissionChange", entityType: "User", entityId: userId,
      before: { name: before.name, role: before.role, isActive: before.isActive },
      after: { name: u.name, role: u.role, isActive: u.isActive, pinChanged: patch.pin !== undefined, detailsChanged: changed },
    });
    return u;
  });
}
