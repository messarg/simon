/**
 * Suppliers and what the shop owes them. PRD §6.14, §13.8, §11 `SupplierAllocation`.
 *
 * The mirror of the debt book with one deliberate difference: allocations are stored rows, not a
 * projection, because paying a supplier is online-only against a single writer (§11). Every
 * settlement — a payment, a purchase-return credit, a credit adjustment — lands in one table
 * against the receipt it settles. A credit that finds nothing left to settle becomes a credit
 * adjustment the next receipt draws on; a payable is never negative. Payables age against the
 * terms both sides agreed, not from the receipt date (§13.8).
 */
import { businessDate, daysBetween, normalizeForSearch, uuidv7 } from "@simon/shared";
import type { z } from "zod";
import type { SupplierBody, UpdateSupplierBody } from "@simon/shared";
import type { Db, Tx } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { writeAudit } from "./audit.service.ts";
import { readSettings } from "./settings.service.ts";

export type CreditType = "SUPPLIER_PAYMENT" | "PURCHASE_RETURN" | "SUPPLIER_ADJUSTMENT";

export async function createSupplier(db: Db, body: z.infer<typeof SupplierBody>, isAdmin: boolean) {
  return db.$transaction(async (tx) => {
    const existing = await tx.supplier.findUnique({ where: { id: body.id } });
    if (existing) return existing;
    const now = clock.iso();
    const name = body.name.normalize("NFC").trim();
    return tx.supplier.create({
      data: {
        id: body.id, name, nameSearch: normalizeForSearch(name), phone: body.phone || null,
        taxId: isAdmin ? (body.taxId || null) : null, paymentTerms: isAdmin ? (body.paymentTerms ?? 0) : 0, leadTimeDays: isAdmin ? (body.leadTimeDays ?? 0) : 0,
        createdAt: now, updatedAt: now,
      },
    });
  });
}

export async function updateSupplier(db: Db, adminId: string, id: string, patch: z.infer<typeof UpdateSupplierBody>) {
  return db.$transaction(async (tx) => {
    const s = await tx.supplier.findUnique({ where: { id } });
    if (!s) throw problem("not-found");
    const name = patch.name?.normalize("NFC").trim();
    const updated = await tx.supplier.update({
      where: { id },
      data: {
        name, nameSearch: name ? normalizeForSearch(name) : undefined, phone: patch.phone === undefined ? undefined : patch.phone || null,
        taxId: patch.taxId === undefined ? undefined : patch.taxId || null, paymentTerms: patch.paymentTerms, leadTimeDays: patch.leadTimeDays,
        isActive: patch.isActive === undefined ? undefined : patch.isActive ? 1 : 0, updatedAt: clock.iso(),
      },
    });
    await writeAudit(tx, { userId: adminId, action: "supplier.update", entityType: "Supplier", entityId: id, before: { paymentTerms: s.paymentTerms, leadTimeDays: s.leadTimeDays, isActive: s.isActive }, after: { paymentTerms: updated.paymentTerms, leadTimeDays: updated.leadTimeDays, isActive: updated.isActive } });
    return updated;
  });
}

/** Everything that settles or voids a supplier's receipts, computed from stored rows. */
export async function supplierBooks(db: Db | Tx, supplierId: string) {
  const [supplier, receipts, payments, adjustments, returns, settings] = await Promise.all([
    db.supplier.findUnique({ where: { id: supplierId } }),
    db.goodsReceipt.findMany({ where: { supplierId, reversesId: null }, orderBy: [{ receivedAt: "asc" }, { id: "asc" }] }),
    db.supplierPayment.findMany({ where: { supplierId }, orderBy: { paidAt: "asc" } }),
    db.supplierAdjustment.findMany({ where: { supplierId }, orderBy: { createdAt: "asc" } }),
    db.purchaseReturn.findMany({ where: { supplierId }, orderBy: { createdAt: "asc" } }),
    readSettings(db),
  ]);
  if (!supplier) throw problem("not-found");
  const allocations = await db.supplierAllocation.findMany({ where: { goodsReceiptId: { in: receipts.map((r) => r.id) } }, orderBy: { createdAt: "asc" } });
  const reversedPayments = new Set(payments.flatMap((p) => (p.reversesId ? [p.reversesId, p.id] : [])));
  const reversedAdjustments = new Set(adjustments.flatMap((a) => (a.reversesId ? [a.reversesId, a.id] : [])));
  const voided = (a: { creditType: string; creditId: string }) =>
    (a.creditType === "SUPPLIER_PAYMENT" && reversedPayments.has(a.creditId)) || (a.creditType === "SUPPLIER_ADJUSTMENT" && reversedAdjustments.has(a.creditId));
  const standing = allocations.filter((a) => !voided(a));
  const paidOn = (receiptId: string) => standing.filter((a) => a.goodsReceiptId === receiptId).reduce((s, a) => s + a.amount, 0);
  const usedOf = (type: CreditType, creditId: string) => standing.filter((a) => a.creditType === type && a.creditId === creditId).reduce((s, a) => s + a.amount, 0);

  const today = businessDate(clock.now(), settings["shop.timezone"]);
  const receiptRows = receipts.map((r) => {
    const unpaid = r.total - paidOn(r.id);
    const dueDate = new Date(Date.parse(r.receivedAt) + supplier.paymentTerms * 86_400_000).toISOString();
    const daysPastDue = daysBetween(businessDate(dueDate, settings["shop.timezone"]), today);
    return { receipt: r, unpaid, dueDate, overdue: unpaid > 0 && daysPastDue > 0, daysPastDue };
  });
  const credits = adjustments.filter((a) => !reversedAdjustments.has(a.id)).map((a) => ({ adjustment: a, remaining: a.amount - usedOf("SUPPLIER_ADJUSTMENT", a.id) }));
  const unallocatedCredit = credits.reduce((s, c) => s + Math.max(0, c.remaining), 0);
  const owed = receiptRows.reduce((s, r) => s + r.unpaid, 0);
  return {
    supplier, receipts: receiptRows, payments, adjustments, returns, allocations, standing, reversedPayments, reversedAdjustments, credits,
    outstanding: owed - unallocatedCredit,
    overdue: receiptRows.filter((r) => r.overdue).reduce((s, r) => s + r.unpaid, 0),
  };
}

/**
 * Settle receipts with a credit: the person's choice first, then oldest receipt first. Whatever
 * finds nothing left to settle becomes a credit adjustment (§13.8's invariant: allocations + credit = payment).
 */
export async function allocateCredit(tx: Tx, args: { supplierId: string; creditType: CreditType; creditId: string; amount: number; userId: string; preferred?: Array<{ goodsReceiptId: string; amount: number }>; leftoverReason: string }) {
  const books = await supplierBooks(tx, args.supplierId);
  const unpaid = new Map(books.receipts.map((r) => [r.receipt.id, r.unpaid]));
  let left = args.amount;
  const now = clock.iso();
  const write = async (goodsReceiptId: string, amount: number) => {
    if (amount <= 0) return;
    await tx.supplierAllocation.create({ data: { id: uuidv7(), creditType: args.creditType, creditId: args.creditId, goodsReceiptId, amount, userId: args.userId, createdAt: now } });
    unpaid.set(goodsReceiptId, (unpaid.get(goodsReceiptId) ?? 0) - amount);
    left -= amount;
  };
  for (const p of args.preferred ?? []) {
    if (!unpaid.has(p.goodsReceiptId)) throw problem("malformed-request", { field: "allocations.goodsReceiptId" });
    await write(p.goodsReceiptId, Math.min(p.amount, left, unpaid.get(p.goodsReceiptId)!));
  }
  for (const r of books.receipts) await write(r.receipt.id, Math.min(left, unpaid.get(r.receipt.id)!));
  let creditAdjustmentId: string | null = null;
  if (left > 0) {
    creditAdjustmentId = uuidv7();
    await tx.supplierAdjustment.create({ data: { id: creditAdjustmentId, supplierId: args.supplierId, type: "CREDIT", amount: left, reason: args.leftoverReason, userId: args.userId, createdAt: now } });
  }
  return { leftover: left, creditAdjustmentId };
}

/** Standing credits draw on receipts that still owe money, oldest credit and oldest receipt first. */
export async function applyStandingCredits(tx: Tx, supplierId: string, userId: string) {
  const books = await supplierBooks(tx, supplierId);
  const unpaid = new Map(books.receipts.map((r) => [r.receipt.id, r.unpaid]));
  const now = clock.iso();
  for (const c of books.credits) {
    let left = c.remaining;
    for (const r of books.receipts) {
      const owe = unpaid.get(r.receipt.id)!;
      const amount = Math.min(left, owe);
      if (amount <= 0) continue;
      await tx.supplierAllocation.create({ data: { id: uuidv7(), creditType: "SUPPLIER_ADJUSTMENT", creditId: c.adjustment.id, goodsReceiptId: r.receipt.id, amount, userId, createdAt: now } });
      unpaid.set(r.receipt.id, owe - amount);
      left -= amount;
    }
  }
}

export async function listSuppliers(db: Db, q?: string) {
  const query = q?.trim() ? normalizeForSearch(q) : "";
  const rows = await db.supplier.findMany({ where: query ? { nameSearch: { contains: query } } : {}, orderBy: { name: "asc" } });
  const withBooks = await Promise.all(rows.map(async (s) => ({ supplier: s, books: await supplierBooks(db, s.id) })));
  return withBooks.sort((a, b) => b.books.outstanding - a.books.outstanding || a.supplier.name.localeCompare(b.supplier.name));
}
