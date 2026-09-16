/**
 * Purchase orders. PRD §11 `PurchaseOrder`/Lifecycles, §13.2, §13.3; v2 per §9.
 *
 * Optional by design: most deliveries arrive unordered (A1, §24.2), so receiving never requires an
 * order. When a delivery answers one, receiving fills the order's lines and derives its status.
 * Turning reorder suggestions into draft orders is the "automatic reordering" of §23's Phase 6 —
 * automatic up to the draft; the owner still reads it and decides to send it.
 */
import { lineTotal, roundHalfUp, uuidv7, type PurchaseOrderBody } from "@simon/shared";
import { applyReceipt, canTransition, expectedUnitCost, receivable, statusFromReceipts, suggestedOrderQty, type PurchaseOrderStatus } from "../domain/purchase-order.ts";
import type { Db, Tx } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { writeAudit } from "./audit.service.ts";
import { readSettings } from "./settings.service.ts";
import { productStatuses } from "./stock-status.service.ts";

type Actor = { userId: string };

async function validateLines(tx: Tx, body: PurchaseOrderBody) {
  const supplier = await tx.supplier.findUnique({ where: { id: body.supplierId } });
  if (!supplier || supplier.isActive !== 1) throw problem("not-found", { entity: "Supplier" });
  const products = new Map((await tx.product.findMany({ where: { id: { in: body.lines.map((l) => l.productId) } }, include: { units: true } })).map((p) => [p.id, p]));
  for (const [i, l] of body.lines.entries()) {
    const p = products.get(l.productId);
    if (!p) throw problem("not-found", { entity: "Product", productId: l.productId });
    if (!p.units.some((u) => u.uom === l.uom && u.factorToStockUom === l.factorToStockUom)) throw problem("malformed-request", { field: `lines.${i}.uom` });
  }
}

async function writeLines(tx: Tx, poId: string, body: PurchaseOrderBody) {
  await tx.purchaseOrderLine.deleteMany({ where: { poId } });
  let total = 0;
  for (const l of body.lines) {
    total += lineTotal(l.qty, l.unitCostMdram);
    await tx.purchaseOrderLine.create({
      data: { id: l.id, poId, productId: l.productId, qtyOrdered: l.qty * l.factorToStockUom, unitCostMdram: l.unitCostMdram, uom: l.uom, factorToStockUom: l.factorToStockUom },
    });
  }
  return total;
}

export async function createPurchaseOrder(db: Db, actor: Actor, body: PurchaseOrderBody) {
  const id = await db.$transaction(async (tx) => {
    if (await tx.purchaseOrder.findUnique({ where: { id: body.id } })) return body.id;
    await validateLines(tx, body);
    const number = `P-${String((await tx.purchaseOrder.count()) + 1).padStart(6, "0")}`;
    const now = clock.iso();
    await tx.purchaseOrder.create({
      data: { id: body.id, number, supplierId: body.supplierId, status: "DRAFT", expectedAt: body.expectedAt ?? null, total: 0, createdAt: now, createdBy: actor.userId, note: body.note?.normalize("NFC") ?? "" },
    });
    const total = await writeLines(tx, body.id, body);
    await tx.purchaseOrder.update({ where: { id: body.id }, data: { total } });
    await writeAudit(tx, { userId: actor.userId, action: "purchaseOrder.create", entityType: "PurchaseOrder", entityId: body.id, after: { number, supplierId: body.supplierId, total, lines: body.lines.length } });
    return body.id;
  });
  return loadPurchaseOrder(db, id);
}

/** A draft is edited by replacing its lines; a sent order is a document the supplier holds and is not edited (§10.7). */
export async function updateDraft(db: Db, actor: Actor, id: string, body: PurchaseOrderBody) {
  await db.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw problem("not-found");
    if (po.status !== "DRAFT") throw problem("illegal-transition", { status: po.status });
    await validateLines(tx, { ...body, id });
    const total = await writeLines(tx, id, body);
    await tx.purchaseOrder.update({ where: { id }, data: { supplierId: body.supplierId, expectedAt: body.expectedAt ?? null, note: body.note?.normalize("NFC") ?? po.note, total } });
    await writeAudit(tx, { userId: actor.userId, action: "purchaseOrder.update", entityType: "PurchaseOrder", entityId: id, before: { total: po.total }, after: { total } });
  });
  return loadPurchaseOrder(db, id);
}

export async function transition(db: Db, actor: Actor, id: string, to: "OPEN" | "CANCELLED") {
  await db.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw problem("not-found");
    if (po.status === to) return;
    if (!canTransition(po.status as PurchaseOrderStatus, to)) throw problem("illegal-transition", { status: po.status });
    const now = clock.iso();
    await tx.purchaseOrder.update({ where: { id }, data: { status: to, ...(to === "OPEN" ? { openedAt: now } : { cancelledAt: now }) } });
    await writeAudit(tx, { userId: actor.userId, action: to === "OPEN" ? "purchaseOrder.open" : "purchaseOrder.cancel", entityType: "PurchaseOrder", entityId: id, before: { status: po.status } });
  });
  return loadPurchaseOrder(db, id);
}

/**
 * Called inside the receiving transaction: the delivery fills the order and the order's status
 * follows. Quantities are compared in stock units, so an order for two spools is filled by 100 m
 * received as metres.
 */
export async function receiveAgainstOrder(tx: Tx, poId: string, supplierId: string, received: ReadonlyArray<{ productId: string; qty: number }>) {
  const po = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: { lines: { orderBy: { id: "asc" } } } });
  if (!po) throw problem("not-found", { entity: "PurchaseOrder" });
  if (po.supplierId !== supplierId) throw problem("malformed-request", { field: "poId", reason: "other-supplier" });
  if (!receivable(po.status as PurchaseOrderStatus)) throw problem("illegal-transition", { status: po.status });
  const next = applyReceipt(po.lines, received);
  for (const line of po.lines) {
    const qtyReceived = next.get(line.id)!;
    if (qtyReceived !== line.qtyReceived) await tx.purchaseOrderLine.update({ where: { id: line.id }, data: { qtyReceived } });
  }
  const status = statusFromReceipts(po.status as PurchaseOrderStatus, po.lines.map((l) => ({ qtyOrdered: l.qtyOrdered, qtyReceived: next.get(l.id)! })));
  if (status !== po.status) await tx.purchaseOrder.update({ where: { id: poId }, data: { status } });
}

export async function loadPurchaseOrder(db: Db, id: string) {
  const po = await db.purchaseOrder.findUnique({ where: { id }, include: { lines: { orderBy: { id: "asc" } }, supplier: { select: { id: true, name: true, phone: true } }, receipts: { select: { id: true, number: true, receivedAt: true } } } });
  if (!po) throw problem("not-found");
  const products = new Map((await db.product.findMany({ where: { id: { in: po.lines.map((l) => l.productId) } }, select: { id: true, name: true, stockUom: true, decimalPlaces: true, sku: true, barcodes: { where: { isPrimary: 1 }, select: { barcode: true } } } })).map((p) => [p.id, p]));
  return {
    ...po,
    lines: po.lines.map((l) => {
      const p = products.get(l.productId);
      return { ...l, productName: p?.name ?? "", stockUom: p?.stockUom ?? "", decimalPlaces: p?.decimalPlaces ?? 0, sku: p?.sku ?? null, barcode: p?.barcodes[0]?.barcode ?? null };
    }),
  };
}

export async function listPurchaseOrders(db: Db, opts: { status?: string[]; supplierId?: string }) {
  return db.purchaseOrder.findMany({
    where: { ...(opts.status?.length ? { status: { in: opts.status } } : {}), ...(opts.supplierId ? { supplierId: opts.supplierId } : {}) },
    include: { supplier: { select: { name: true } }, _count: { select: { lines: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

/** Stock already on its way: ordered on a sent order and not yet delivered. */
async function onOrder(db: Db) {
  const lines = await db.purchaseOrderLine.findMany({ where: { po: { status: { in: ["OPEN", "PARTIAL"] } } }, select: { productId: true, qtyOrdered: true, qtyReceived: true } });
  const out = new Map<string, number>();
  for (const l of lines) out.set(l.productId, (out.get(l.productId) ?? 0) + Math.max(0, l.qtyOrdered - l.qtyReceived));
  return out;
}

export interface Suggestion {
  productId: string; productName: string; supplierId: string | null; supplierName: string | null;
  stockQty: number; threshold: number; onOrder: number; orderQty: number;
  uom: string; factorToStockUom: number; decimalPlaces: number; stockUom: string; unitCostMdram: number;
}

/** §13.3's suggestion, turned into quantities: every low product, what to order, and from whom. */
export async function reorderSuggestions(db: Db): Promise<Suggestion[]> {
  const [statuses, ordered, settings] = await Promise.all([productStatuses(db), onOrder(db), readSettings(db)]);
  const low = [...statuses.values()].filter((s) => s.low);
  if (!low.length) return [];
  const products = await db.product.findMany({
    where: { id: { in: low.map((s) => s.productId) } },
    select: { id: true, name: true, stockQty: true, reorderQty: true, avgCostMdram: true, defaultSupplierId: true, decimalPlaces: true, stockUom: true, units: { where: { role: "PURCHASE" }, orderBy: { factorToStockUom: "desc" } } },
  });
  const lastLines = await db.goodsReceiptLine.findMany({
    where: { productId: { in: products.map((p) => p.id) }, receipt: { reversesId: null } },
    include: { receipt: { select: { supplierId: true, receivedAt: true } } },
    orderBy: { receipt: { receivedAt: "desc" } },
  });
  const suppliers = new Map((await db.supplier.findMany({ where: { isActive: 1 }, select: { id: true, name: true, leadTimeDays: true } })).map((s) => [s.id, s]));

  const out: Suggestion[] = [];
  for (const p of products) {
    const status = statuses.get(p.id)!;
    const lastFromAnyone = lastLines.find((l) => l.productId === p.id);
    const supplierId = p.defaultSupplierId ?? lastFromAnyone?.receipt.supplierId ?? null;
    const supplier = supplierId ? suppliers.get(supplierId) ?? null : null;
    const lastFromSupplier = lastLines.find((l) => l.productId === p.id && l.receipt.supplierId === supplierId);
    // Order in the pack this supplier last delivered, else the largest purchase pack, else the stock unit.
    const pack = lastFromSupplier
      ? { uom: lastFromSupplier.uom, factor: lastFromSupplier.factorToStockUom }
      : p.units[0] ? { uom: p.units[0].uom, factor: p.units[0].factorToStockUom } : { uom: p.stockUom, factor: 1 };
    const orderQty = suggestedOrderQty({
      stockQty: p.stockQty, threshold: status.threshold, reorderQty: p.reorderQty, avgDailyQty30d: status.avgDailyQty30d,
      leadTimeDays: supplier?.leadTimeDays ?? 0, safetyDays: settings["reorder.safetyDays"], onOrder: ordered.get(p.id) ?? 0, packFactor: pack.factor,
    });
    if (orderQty <= 0) continue;
    const perStockLast = lastFromSupplier ? roundHalfUp(lastFromSupplier.invoiceUnitCostMdram, lastFromSupplier.factorToStockUom) : null;
    out.push({
      productId: p.id, productName: p.name, supplierId: supplier?.id ?? null, supplierName: supplier?.name ?? null,
      stockQty: p.stockQty, threshold: status.threshold, onOrder: ordered.get(p.id) ?? 0, orderQty,
      uom: pack.uom, factorToStockUom: pack.factor, decimalPlaces: p.decimalPlaces, stockUom: p.stockUom,
      unitCostMdram: expectedUnitCost(perStockLast, p.avgCostMdram) * pack.factor,
    });
  }
  return out.sort((a, b) => (a.supplierName ?? "￿").localeCompare(b.supplierName ?? "￿") || a.productName.localeCompare(b.productName));
}

/** One draft per supplier from the current suggestions. Products with no supplier on record are left out and listed. */
export async function draftsFromSuggestions(db: Db, actor: Actor, opts: { supplierId?: string }) {
  const suggestions = (await reorderSuggestions(db)).filter((s) => !opts.supplierId || s.supplierId === opts.supplierId);
  const bySupplier = new Map<string, Suggestion[]>();
  const withoutSupplier: Suggestion[] = [];
  for (const s of suggestions) {
    if (!s.supplierId) { withoutSupplier.push(s); continue; }
    bySupplier.set(s.supplierId, [...(bySupplier.get(s.supplierId) ?? []), s]);
  }
  const created = [];
  for (const [supplierId, lines] of bySupplier) {
    created.push(await createPurchaseOrder(db, actor, {
      id: uuidv7(), supplierId, note: "",
      lines: lines.map((l) => ({ id: uuidv7(), productId: l.productId, uom: l.uom, factorToStockUom: l.factorToStockUom, qty: l.orderQty / l.factorToStockUom, unitCostMdram: l.unitCostMdram })),
    }));
  }
  return { created, withoutSupplier };
}
