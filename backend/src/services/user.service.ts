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

export async function listUsers(db: Db) {
  return db.user.findMany({ orderBy: { createdAt: "asc" } });
}

/** The PIN pad's name tiles: active users, names only. */
export async function listSignInUsers(db: Db) {
  return db.user.findMany({ where: { isActive: 1 }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

export async function createUser(db: Db, adminId: string, input: { name: string; pin: string; role: Role }) {
  assertPinShape(input.pin);
  const pinHash = await hashSecret(input.pin);
  return db.$transaction(async (tx) => {
    const u = await tx.user.create({ data: { id: uuidv7(), name: input.name.normalize("NFC").trim(), pinHash, role: input.role, createdAt: clock.iso() } });
    await writeAudit(tx, { userId: adminId, action: "user.create", entityType: "User", entityId: u.id, after: { name: u.name, role: u.role } });
    return u;
  });
}

export async function updateUser(db: Db, adminId: string, userId: string, patch: { name?: string; pin?: string; role?: Role; isActive?: boolean }) {
  if (patch.pin !== undefined) assertPinShape(patch.pin);
  const pinHash = patch.pin !== undefined ? await hashSecret(patch.pin) : undefined;
  return db.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id: userId } });
    if (!before) throw problem("not-found");
    if (before.role === "ADMIN" && (patch.role && patch.role !== "ADMIN" || patch.isActive === false)) {
      const admins = await tx.user.count({ where: { role: "ADMIN", isActive: 1 } });
      if (admins <= 1) throw problem("not-permitted", { reason: "last-admin" });
    }
    const u = await tx.user.update({
      where: { id: userId },
      data: {
        name: patch.name?.normalize("NFC").trim(), role: patch.role, pinHash,
        isActive: patch.isActive === undefined ? undefined : patch.isActive ? 1 : 0,
      },
    });
    if (patch.isActive === false) await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: clock.iso() } });
    await writeAudit(tx, {
      userId: adminId, action: "user.permissionChange", entityType: "User", entityId: userId,
      before: { name: before.name, role: before.role, isActive: before.isActive },
      after: { name: u.name, role: u.role, isActive: u.isActive, pinChanged: patch.pin !== undefined },
    });
    return u;
  });
}
