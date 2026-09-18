/** Users and first-run setup. PRD §6.17, §7.1 (Q1–Q2), §16.4. */
import { assignableRoles, canManage, listsPerson, normalisePermissions, uuidv7, type Permission, type Role, type StaffAction } from "@simon/shared";
import { nameKey } from "../domain/person-name.ts";
import type { Db, Tx } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { writeAudit } from "./audit.service.ts";
import { assertPinShape, generateRecoveryCode, hashSecret } from "./auth.service.ts";
import { writeSettings } from "./settings.service.ts";

export async function needsSetup(db: Db) {
  return (await db.user.count()) === 0;
}

/** Wizard Q1–Q2: the shop's name and its owner. Only reachable while no user exists. */
export async function createOwner(db: Db, input: { shopName: string; ownerName: string; pin: string }) {
  assertPinShape(input.pin);
  const recoveryCode = generateRecoveryCode();
  const [pinHash, recoveryCodeHash] = await Promise.all([hashSecret(input.pin), hashSecret(recoveryCode)]);
  const user = await db.$transaction(async (tx) => {
    if ((await tx.user.count()) > 0) throw problem("not-permitted");
    const u = await tx.user.create({
      data: { id: uuidv7(), name: input.ownerName.normalize("NFC").trim(), pinHash, recoveryCodeHash, role: "OWNER", createdAt: clock.iso() },
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
  id: true, name: true, role: true, permissions: true, isActive: true, failedAttempts: true, lockedUntil: true, createdAt: true,
  avatarUpdatedAt: true, phone: true, startedOn: true, note: true,
} as const;

/** The person acting on the staff list, as the routes know them. */
export interface StaffActor { id: string; role: Role }

/** Everyone the viewer may see, oldest first. A manager is not shown the owner (§6.17). */
export async function listUsers(db: Db, viewer: Role) {
  const rows = await db.user.findMany({ orderBy: { createdAt: "asc" }, select: STAFF_FIELDS });
  return rows.filter((u) => listsPerson(viewer, u.role as Role));
}

/** One person, for §6.17's page — only someone the viewer may manage, or themselves. */
export async function getUser(db: Db, actor: StaffActor, userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: STAFF_FIELDS });
  if (!u || !canManage(actor, { id: u.id, role: u.role as Role }, "view")) throw problem("not-found");
  return u;
}

/**
 * Refuses unless `actor` may do `action` to `target`. Someone the actor may not even see answers
 * `not-found`, as a row that is not there does — a manager learns nothing about the owner by
 * probing ids.
 */
export async function assertCanManage(db: Db | Tx, actor: StaffActor, userId: string, action: StaffAction) {
  const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  const t = target && { id: target.id, role: target.role as Role };
  if (!t || !canManage(actor, t, "view")) throw problem("not-found");
  if (!canManage(actor, t, action)) throw problem("not-permitted", { reason: t.role === "OWNER" ? "owner" : "not-yours" });
  return t;
}

/**
 * A name has to say who is signing in (§16.2), so two active people may not share one. A person
 * being deactivated frees theirs; `except` is the row being renamed, which may keep its own.
 */
async function assertNameFree(tx: Tx, name: string, except?: string) {
  const key = nameKey(name);
  const clash = (await tx.user.findMany({ where: { isActive: 1 }, select: { id: true, name: true } }))
    .some((u) => u.id !== except && nameKey(u.name) === key);
  if (clash) throw problem("duplicate-name", { field: "name" });
}

/** An employee's grants, in stable order; nobody else carries any (§16.4). */
const storedPermissions = (role: Role, permissions: readonly Permission[] | undefined) =>
  JSON.stringify(role === "EMPLOYEE" ? normalisePermissions(permissions ?? []) : []);

export async function createUser(db: Db, actor: StaffActor, input: { name: string; pin: string; role: Role; permissions?: Permission[] } & Pick<StaffPatch, "phone" | "startedOn" | "note">) {
  if (!assignableRoles(actor.role).includes(input.role)) throw problem("not-permitted", { reason: "role" });
  assertPinShape(input.pin);
  const pinHash = await hashSecret(input.pin);
  return db.$transaction(async (tx) => {
    const name = input.name.normalize("NFC").trim();
    await assertNameFree(tx, name);
    const u = await tx.user.create({
      // Details are optional on create: adding someone mid-shift should cost a name, a PIN and a
      // role, and nothing else (§6.17). They are the same columns `updateUser` writes.
      data: {
        id: uuidv7(), name, pinHash, role: input.role, permissions: storedPermissions(input.role, input.permissions), createdAt: clock.iso(),
        phone: blankToNull(input.phone) ?? null, startedOn: blankToNull(input.startedOn) ?? null, note: blankToNull(input.note) ?? null,
      },
      select: STAFF_FIELDS,
    });
    await writeAudit(tx, { userId: actor.id, action: "user.create", entityType: "User", entityId: u.id, after: { name: u.name, role: u.role, permissions: u.permissions } });
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

export type StaffPatch = { name?: string; pin?: string; role?: Role; permissions?: Permission[]; isActive?: boolean; phone?: string | null; startedOn?: string | null; note?: string | null };

export async function updateUser(db: Db, actor: StaffActor, userId: string, patch: StaffPatch) {
  if (patch.pin !== undefined) assertPinShape(patch.pin);
  const pinHash = patch.pin !== undefined ? await hashSecret(patch.pin) : undefined;
  return db.$transaction(async (tx) => {
    const target = await assertCanManage(tx, actor, userId, "edit");
    const before = (await tx.user.findUnique({ where: { id: userId }, select: STAFF_FIELDS }))!;
    const role = (patch.role ?? target.role) as Role;
    const roleChanges = role !== before.role;
    // A form sends back the grants it was shown; only a real difference is a permission change.
    const grantsChange = patch.permissions !== undefined && storedPermissions(role, patch.permissions) !== before.permissions;
    if (roleChanges || grantsChange) await assertCanManage(tx, actor, userId, "setRole");
    if (roleChanges && !assignableRoles(actor.role).includes(role)) throw problem("not-permitted", { reason: "role" });
    if (patch.isActive !== undefined && (patch.isActive ? 1 : 0) !== before.isActive) await assertCanManage(tx, actor, userId, "deactivate");

    const name = patch.name?.normalize("NFC").trim();
    const staysActive = patch.isActive ?? before.isActive === 1;
    if (staysActive && (name !== undefined || patch.isActive === true)) await assertNameFree(tx, name ?? before.name, userId);
    // Becoming a manager clears an employee's grants, which a manager has no use for; a new
    // employee starts from the grants sent, or from none — never from grants they held before.
    const permissions = roleChanges || grantsChange ? storedPermissions(role, patch.permissions) : undefined;

    const details = { phone: blankToNull(patch.phone), startedOn: blankToNull(patch.startedOn), note: blankToNull(patch.note) };
    const u = await tx.user.update({
      where: { id: userId },
      data: {
        name, role: roleChanges ? role : undefined, permissions, pinHash, ...details,
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
      userId: actor.id, action: "user.permissionChange", entityType: "User", entityId: userId,
      before: { name: before.name, role: before.role, permissions: before.permissions, isActive: before.isActive },
      after: { name: u.name, role: u.role, permissions: u.permissions, isActive: u.isActive, pinChanged: patch.pin !== undefined, detailsChanged: changed },
    });
    return u;
  });
}
