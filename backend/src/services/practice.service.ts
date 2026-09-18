/**
 * Practice mode. PRD §7.2, §19.4, §27.19.
 *
 * A second database file, not a flag on every row: entering copies the shop's configuration and
 * catalogue into it, every write goes there, and leaving deletes it. The only row that knows
 * practice exists is `Session.mode` — so no report, export or reprojection has to remember a
 * `WHERE` clause, which is the failure this design exists to make unrepresentable.
 *
 * The settings are copied too, because a till that cannot read the tax regime cannot price a line
 * at all: without them every practice sale would fail, turning the one feature that removes a
 * worker's fear into the one place the system does not work.
 *
 * Entry and exit are audited **in the real database**, so "I was in practice mode" is checkable.
 */
import { rmSync } from "node:fs";
import { uuidv7 } from "@simon/shared";
import { databaseFile } from "../lib/config.ts";
import { closeClient, openDatabase, registerClient, type Db } from "../lib/db.ts";
import { applyMigrations } from "../lib/migrate.ts";
import { clock } from "../lib/time.ts";
import { writeAudit } from "./audit.service.ts";

/** Mutable so a test can give practice its own file rather than the host's. */
export const practicePaths = { file: databaseFile("PRACTICE") };

const removeFile = (file: string) => { for (const suffix of ["", "-wal", "-shm"]) rmSync(file + suffix, { force: true }); };

/** Opens the practice file as it stands, applying migrations — the factory every request goes through. */
export async function openPractice(): Promise<Db> {
  applyMigrations(practicePaths.file);
  const db = await openDatabase(practicePaths.file);
  registerClient("PRACTICE", db);
  return db;
}

/** A fresh file carrying the shop's configuration, catalogue, people and current stock (§19.4). */
async function seedPractice(live: Db): Promise<Db> {
  await closeClient("PRACTICE");
  removeFile(practicePaths.file);
  const practice = await openPractice();

  const [settings, users, categories, suppliers, products, customers] = await Promise.all([
    live.setting.findMany(),
    live.user.findMany(),
    live.category.findMany(),
    live.supplier.findMany(),
    live.product.findMany({ include: { barcodes: true, units: true } }),
    live.customer.findMany({ where: { mergedIntoId: null, anonymisedAt: null } }),
  ]);

  await practice.$transaction(async (tx) => {
    for (const row of settings) await tx.setting.create({ data: row });
    for (const row of users) await tx.user.create({ data: row });
    for (const row of categories) await tx.category.create({ data: { ...row, parentId: null } });
    for (const row of suppliers) await tx.supplier.create({ data: row });
    for (const row of customers) await tx.customer.create({ data: { ...row, mergedIntoId: null } });
    for (const p of products) {
      const { barcodes, units, ...product } = p;
      // Stock arrives as an opening balance below, so the cache starts where the ledger will land it.
      await tx.product.create({ data: { ...product, categoryId: p.categoryId, defaultSupplierId: p.defaultSupplierId, stockQty: 0, avgCostMdram: null } });
      for (const b of barcodes) await tx.productBarcode.create({ data: b });
      for (const u of units) await tx.productUnit.create({ data: u });
    }
  });

  // One movement per product with stock, so the practice ledger replays to the same figures.
  const owner = users.find((u) => u.role === "OWNER") ?? users[0];
  if (owner) {
    const { postMovement } = await import("./stock-ledger.service.ts");
    for (const p of products) {
      if (p.stockQty === 0) continue;
      await practice.$transaction((tx) => postMovement(tx, {
        productId: p.id, type: "OPENING_BALANCE", qtyDelta: p.stockQty, unitCostMdram: p.avgCostMdram,
        source: { type: "Practice", id: p.id }, userId: owner.id,
      }));
    }
  }
  return practice;
}

export interface PracticeActor { userId: string; sessionId: string }

export async function enterPractice(live: Db, actor: PracticeActor) {
  const session = await live.session.findUniqueOrThrow({ where: { id: actor.sessionId } });
  if (session.mode === "PRACTICE") return { mode: "PRACTICE" as const };
  await seedPractice(live);
  await live.$transaction(async (tx) => {
    await tx.session.update({ where: { id: actor.sessionId }, data: { mode: "PRACTICE" } });
    await writeAudit(tx, { userId: actor.userId, action: "session.practiceEnter", entityType: "Session", entityId: actor.sessionId });
  });
  return { mode: "PRACTICE" as const };
}

export async function exitPractice(live: Db, actor: PracticeActor) {
  const session = await live.session.findUniqueOrThrow({ where: { id: actor.sessionId } });
  if (session.mode !== "PRACTICE") return { mode: "LIVE" as const };
  const enteredAt = (await live.auditLog.findFirst({ where: { action: "session.practiceEnter", entityId: actor.sessionId }, orderBy: { createdAt: "desc" } }))?.createdAt;
  await live.$transaction(async (tx) => {
    await tx.session.update({ where: { id: actor.sessionId }, data: { mode: "LIVE" } });
    await writeAudit(tx, {
      userId: actor.userId, action: "session.practiceExit", entityType: "Session", entityId: actor.sessionId,
      after: enteredAt ? { minutes: Math.round((clock.now().getTime() - Date.parse(enteredAt)) / 60_000) } : undefined,
    });
  });
  // The file goes only when the last person practising leaves it — one worker's exit is not everyone's.
  const stillPractising = await live.session.count({ where: { mode: "PRACTICE", revokedAt: null } });
  if (stillPractising === 0) {
    await closeClient("PRACTICE");
    removeFile(practicePaths.file);
  }
  return { mode: "LIVE" as const };
}

/** A practice receipt is watermarked and never issues a fiscal document or opens the drawer (§19.4). */
export const PRACTICE_WATERMARK = "ՓՈՐՁՆԱԿԱՆ";

export const practiceId = () => uuidv7();
