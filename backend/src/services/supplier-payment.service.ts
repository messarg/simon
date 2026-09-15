/**
 * Paying a supplier. PRD §13.8, §6.14, §27.46. Online and owner-only.
 *
 * Allocated oldest receipt first or as chosen; an overpayment becomes a credit. Cash leaves the
 * drawer as a PAY_OUT with reason SUPPLIER_PAYMENT naming this payment; card and transfer write
 * nothing. A payment to the wrong supplier is reversed by a linked payment — its allocations and
 * the credit it created go with it — and re-entered against the right one without moving cash.
 */
import { businessDate, uuidv7, type SupplierPaymentBody } from "@simon/shared";
import type { Db } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { writeAudit } from "./audit.service.ts";
import type { Actor } from "./sale.service.ts";
import { readSettings } from "./settings.service.ts";
import { allocateCredit, supplierBooks } from "./supplier.service.ts";

export async function paySupplier(db: Db, actor: Actor, body: SupplierPaymentBody) {
  const settings = await readSettings(db);
  await db.$transaction(async (tx) => {
    if (await tx.supplierPayment.findUnique({ where: { id: body.id } })) return;
    const supplier = await tx.supplier.findUnique({ where: { id: body.supplierId } });
    if (!supplier) throw problem("not-found", { entity: "Supplier" });
    const now = clock.now();
    if (body.method === "CASH") {
      if (!body.shiftId) throw problem("malformed-request", { field: "shiftId" });
      const shift = await tx.shift.findUnique({ where: { id: body.shiftId } });
      if (!shift || shift.status !== "OPEN") throw problem("shift-not-open");
    }
    await tx.supplierPayment.create({ data: { id: body.id, supplierId: supplier.id, amount: body.amount, method: body.method, paidAt: now.toISOString(), userId: actor.userId } });
    await allocateCredit(tx, { supplierId: supplier.id, creditType: "SUPPLIER_PAYMENT", creditId: body.id, amount: body.amount, userId: actor.userId, preferred: body.allocations, leftoverReason: `overpayment:${body.id}` });
    if (body.method === "CASH") {
      await tx.cashMovement.create({
        data: { id: uuidv7(), shiftId: body.shiftId!, businessDate: businessDate(now, settings["shop.timezone"]), type: "PAY_OUT", amount: body.amount, reasonCode: "SUPPLIER_PAYMENT", sourceType: "SupplierPayment", sourceId: body.id, userId: actor.userId, createdAt: now.toISOString() },
      });
    }
    await writeAudit(tx, { userId: actor.userId, action: "supplier.payment", entityType: "SupplierPayment", entityId: body.id, after: { supplierId: supplier.id, amount: body.amount, method: body.method } });
  });
  const payment = await db.supplierPayment.findUniqueOrThrow({ where: { id: body.id } });
  const books = await supplierBooks(db, payment.supplierId);
  return {
    payment,
    settled: books.standing.filter((a) => a.creditType === "SUPPLIER_PAYMENT" && a.creditId === body.id).map((a) => ({ goodsReceiptId: a.goodsReceiptId, amount: a.amount })),
    outstanding: books.outstanding,
  };
}

export async function reverseSupplierPayment(db: Db, actor: Actor, paymentId: string, input: { reason: string; reenterSupplierId?: string | null }) {
  return db.$transaction(async (tx) => {
    const original = await tx.supplierPayment.findUnique({ where: { id: paymentId } });
    if (!original || original.reversesId) throw problem("illegal-transition", { reason: "not-a-payment" });
    if (await tx.supplierPayment.findFirst({ where: { reversesId: paymentId } })) throw problem("illegal-transition", { reason: "already-reversed" });
    const now = clock.iso();
    const reversalId = uuidv7();
    await tx.supplierPayment.create({ data: { id: reversalId, supplierId: original.supplierId, amount: original.amount, method: original.method, paidAt: now, userId: actor.userId, reversesId: original.id } });
    // A credit left standing behind a reversed payment would be spent twice (§11 `SupplierAdjustment.reversesId`).
    for (const credit of await tx.supplierAdjustment.findMany({ where: { reason: `overpayment:${original.id}`, reversesId: null } })) {
      await tx.supplierAdjustment.create({ data: { id: uuidv7(), supplierId: credit.supplierId, type: "CREDIT", amount: credit.amount, reason: `reversal:${original.id}`, userId: actor.userId, createdAt: now, reversesId: credit.id } });
    }
    let reentryId: string | null = null;
    if (input.reenterSupplierId) {
      const target = await tx.supplier.findUnique({ where: { id: input.reenterSupplierId } });
      if (!target) throw problem("not-found", { entity: "Supplier" });
      reentryId = uuidv7();
      await tx.supplierPayment.create({ data: { id: reentryId, supplierId: target.id, amount: original.amount, method: original.method, paidAt: now, userId: actor.userId } });
      await allocateCredit(tx, { supplierId: target.id, creditType: "SUPPLIER_PAYMENT", creditId: reentryId, amount: original.amount, userId: actor.userId, leftoverReason: `overpayment:${reentryId}` });
    }
    await writeAudit(tx, { userId: actor.userId, action: "supplier.paymentReversal", entityType: "SupplierPayment", entityId: original.id, before: { supplierId: original.supplierId, amount: original.amount }, after: { reversalId, reentryId, toSupplierId: input.reenterSupplierId ?? null } });
    return { reversalId, reentryId };
  });
}
