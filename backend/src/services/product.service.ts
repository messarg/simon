/**
 * Catalogue. PRD §6.12, §7.4, §11 `Product`/`ProductBarcode`/`ProductUnit`, §18.
 *
 * - Products are deactivated, never deleted.
 * - `decimalPlaces`, `stockUom` and a unit's factor are immutable once movements exist.
 * - A price change writes PriceHistory and an audit row, and needs admin re-auth.
 * - A barcode belongs to one product forever; retiring stops new labels, never a scan.
 */
import { normalizeForSearch, searchTokens, uuidv7, type CreateProductBody, type Role } from "@simon/shared";
import type { z } from "zod";
import type { UpdateProductBody } from "@simon/shared";
import type { Prisma } from "../generated/prisma/client.ts";
import type { Db, Tx } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { productStatuses } from "./stock-status.service.ts";
import { writeAudit } from "./audit.service.ts";
import { consumeGrant } from "./auth.service.ts";

export const productInclude = {
  barcodes: { orderBy: [{ isPrimary: "desc" }, { updatedAt: "asc" }] },
  units: { orderBy: { uom: "asc" } },
  stats: true,
} satisfies Prisma.ProductInclude;

/** Internal codes for unbarcoded goods use a reserved prefix, so they never collide with an EAN (§18). */
export const INTERNAL_PREFIX = "S";

async function assertBarcodeFree(tx: Tx, barcode: string) {
  const existing = await tx.productBarcode.findUnique({ where: { barcode }, include: { product: { select: { id: true, name: true } } } });
  if (existing) throw problem("duplicate-barcode", { barcode, productId: existing.product.id, productName: existing.product.name });
}

export async function nextInternalBarcode(tx: Tx) {
  const last = await tx.productBarcode.findFirst({ where: { barcode: { startsWith: INTERNAL_PREFIX } }, orderBy: { barcode: "desc" } });
  const n = last ? Number(last.barcode.slice(INTERNAL_PREFIX.length)) + 1 : 1;
  return `${INTERNAL_PREFIX}${String(Number.isFinite(n) ? n : 1).padStart(7, "0")}`;
}

export async function hasMovements(tx: Db | Tx, productId: string) {
  return (await tx.stockMovement.count({ where: { productId } })) > 0;
}

export async function createProduct(db: Db, userId: string, body: CreateProductBody) {
  return db.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({ where: { id: body.id }, include: productInclude });
    if (existing) return existing; // idempotent: quick-add may be retried
    if (body.barcode) await assertBarcodeFree(tx, body.barcode);
    const now = clock.iso();
    const name = body.name.normalize("NFC");
    await tx.product.create({
      data: {
        id: body.id, name, nameSearch: normalizeForSearch(name), sku: body.sku || null, categoryId: body.categoryId ?? null,
        stockUom: body.stockUom, decimalPlaces: body.decimalPlaces, sellPriceMdram: body.sellPriceMdram,
        reorderPoint: body.reorderPoint ?? 0, reorderQty: body.reorderQty ?? 0, trackStock: body.trackStock === false ? 0 : 1,
        createdAt: now, updatedAt: now,
      },
    });
    await tx.productUnit.create({ data: { id: uuidv7(), productId: body.id, uom: body.stockUom, factorToStockUom: 1, role: "STOCK", updatedAt: now } });
    if (body.barcode) await tx.productBarcode.create({ data: { id: uuidv7(), productId: body.id, barcode: body.barcode, isPrimary: 1, updatedAt: now } });
    await tx.priceHistory.create({ data: { id: uuidv7(), productId: body.id, sellPriceMdram: body.sellPriceMdram, effectiveFrom: now, changedBy: userId } });
    return tx.product.findUniqueOrThrow({ where: { id: body.id }, include: productInclude });
  });
}

export async function updateProduct(db: Db, userId: string, productId: string, patch: z.infer<typeof UpdateProductBody>) {
  return db.$transaction(async (tx) => {
    const p = await tx.product.findUnique({ where: { id: productId } });
    if (!p) throw problem("not-found");
    const moved = await hasMovements(tx, productId);
    if (moved && ((patch.decimalPlaces !== undefined && patch.decimalPlaces !== p.decimalPlaces) || (patch.stockUom !== undefined && patch.stockUom !== p.stockUom))) {
      throw problem("immutable-after-movements", { field: patch.decimalPlaces !== undefined && patch.decimalPlaces !== p.decimalPlaces ? "decimalPlaces" : "stockUom" });
    }
    const now = clock.iso();
    const priceChanged = patch.sellPriceMdram !== undefined && patch.sellPriceMdram !== p.sellPriceMdram;
    if (priceChanged) {
      if (!consumeGrant(patch.reauthGrant, "priceChange")) throw problem("reauth-required", { action: "priceChange" });
      await tx.priceHistory.create({ data: { id: uuidv7(), productId, sellPriceMdram: patch.sellPriceMdram!, effectiveFrom: now, changedBy: userId } });
      await writeAudit(tx, { userId, action: "product.priceChange", entityType: "Product", entityId: productId, before: { sellPriceMdram: p.sellPriceMdram }, after: { sellPriceMdram: patch.sellPriceMdram } });
    }
    const name = patch.name?.normalize("NFC");
    if (patch.stockUom !== undefined && patch.stockUom !== p.stockUom) {
      await tx.productUnit.updateMany({ where: { productId, role: "STOCK" }, data: { uom: patch.stockUom, updatedAt: now } });
    }
    await tx.product.update({
      where: { id: productId },
      data: {
        name, nameSearch: name ? normalizeForSearch(name) : undefined, sellPriceMdram: patch.sellPriceMdram,
        stockUom: patch.stockUom, decimalPlaces: patch.decimalPlaces, sku: patch.sku === undefined ? undefined : patch.sku || null,
        categoryId: patch.categoryId === undefined ? undefined : patch.categoryId, reorderPoint: patch.reorderPoint, reorderQty: patch.reorderQty,
        trackStock: patch.trackStock === undefined ? undefined : patch.trackStock ? 1 : 0,
        isActive: patch.isActive === undefined ? undefined : patch.isActive ? 1 : 0,
        tilePinnedAt: patch.pinnedTile === undefined ? undefined : patch.pinnedTile ? (p.tilePinnedAt ?? now) : null,
        updatedAt: now,
      },
    });
    return tx.product.findUniqueOrThrow({ where: { id: productId }, include: productInclude });
  });
}

export async function addBarcode(db: Db, productId: string, barcode: string | null | undefined, isPrimary: boolean) {
  return db.$transaction(async (tx) => {
    if (!(await tx.product.findUnique({ where: { id: productId } }))) throw problem("not-found");
    const code = barcode || (await nextInternalBarcode(tx));
    await assertBarcodeFree(tx, code);
    const now = clock.iso();
    if (isPrimary) await tx.productBarcode.updateMany({ where: { productId }, data: { isPrimary: 0, updatedAt: now } });
    const hasAny = (await tx.productBarcode.count({ where: { productId } })) > 0;
    await tx.productBarcode.create({ data: { id: uuidv7(), productId, barcode: code, isPrimary: isPrimary || !hasAny ? 1 : 0, updatedAt: now } });
    await tx.product.update({ where: { id: productId }, data: { updatedAt: now } });
    return tx.product.findUniqueOrThrow({ where: { id: productId }, include: productInclude });
  });
}

export async function retireBarcode(db: Db, productId: string, barcode: string) {
  return db.$transaction(async (tx) => {
    const b = await tx.productBarcode.findUnique({ where: { barcode } });
    if (!b || b.productId !== productId) throw problem("not-found");
    const now = clock.iso();
    if (!b.retiredAt) await tx.productBarcode.update({ where: { id: b.id }, data: { retiredAt: now, isPrimary: 0, updatedAt: now } });
    await tx.product.update({ where: { id: productId }, data: { updatedAt: now } });
    return tx.product.findUniqueOrThrow({ where: { id: productId }, include: productInclude });
  });
}

export async function addUnit(db: Db, productId: string, unit: { uom: string; factorToStockUom: number; role: "PURCHASE" | "SALE" }) {
  return db.$transaction(async (tx) => {
    if (!(await tx.product.findUnique({ where: { id: productId } }))) throw problem("not-found");
    const now = clock.iso();
    // A factor is never edited: a new packaging is a new unit (§11, §27.31).
    await tx.productUnit.create({ data: { id: uuidv7(), productId, uom: unit.uom, factorToStockUom: unit.factorToStockUom, role: unit.role, updatedAt: now } });
    await tx.product.update({ where: { id: productId }, data: { updatedAt: now } });
    return tx.product.findUniqueOrThrow({ where: { id: productId }, include: productInclude });
  });
}

export type ProductFilter = "all" | "needs-detail" | "inactive" | "low-stock" | "dead-stock";

export async function listProducts(db: Db, opts: { q?: string; filter?: ProductFilter; categoryId?: string; cursor?: string; limit: number; role: Role }) {
  const tokens = opts.q ? searchTokens(opts.q) : [];
  const where = {
    ...(tokens.length ? { OR: [{ AND: tokens.map((t) => ({ nameSearch: { contains: t } })) }, { barcodes: { some: { barcode: opts.q!.trim() } } }, { sku: opts.q!.trim() }] } : {}),
    ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    ...(opts.filter === "inactive" ? { isActive: 0 } : opts.filter === "all" || !opts.filter ? {} : { isActive: 1 }),
    ...(opts.filter === "needs-detail" ? { OR: [{ avgCostMdram: null }, { categoryId: null }, { barcodes: { none: {} } }] } : {}),
  };
  const attention = opts.filter === "low-stock" || opts.filter === "dead-stock" ? await productStatuses(db) : null;
  const wanted = attention ? [...attention.values()].filter((s) => (opts.filter === "low-stock" ? s.low : s.dead)).map((s) => s.productId) : null;
  const rows = await db.product.findMany({
    where: { ...where, ...(wanted ? { id: { in: wanted } } : {}) }, include: productInclude,
    orderBy: { id: "asc" }, take: opts.limit + 1, ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const next = rows.length > opts.limit ? rows[opts.limit - 1].id : null;
  return { items: rows.slice(0, opts.limit), nextCursor: next };
}

export async function productByBarcode(db: Db, code: string) {
  const b = await db.productBarcode.findUnique({ where: { barcode: code.trim() }, include: { product: { include: productInclude } } });
  return b?.product ?? null;
}
