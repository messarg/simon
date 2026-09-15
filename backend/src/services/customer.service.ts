/**
 * Customers — the Nisya book, one page per person. PRD §6.13, §6.15, §19.6.
 *
 * A worker creates a customer (name and phone) and nothing more; limits, blocks, merges and
 * erasure are the owner's. Nothing is deleted: a duplicate is merged, leaving a forwarding
 * address, and an erasure request anonymises the row while every ledger amount and date stays.
 */
import { normalizeForSearch, uuidv7, type CreateCustomerBody } from "@simon/shared";
import type { z } from "zod";
import type { UpdateCustomerBody } from "@simon/shared";
import { age } from "../domain/aging.ts";
import type { Db } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { businessDate } from "@simon/shared";
import { writeAudit } from "./audit.service.ts";
import { allProjections, customerProjection, overdueAmount } from "./debt.service.ts";
import { readSettings } from "./settings.service.ts";

/** Phones compare by digits: "+374 91 12-34-56" and "37491123456" are one person. */
export const normalizePhone = (phone: string | null | undefined) => {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length ? digits : null;
};

export async function createCustomer(db: Db, body: CreateCustomerBody) {
  const settings = await readSettings(db);
  return db.$transaction(async (tx) => {
    const existing = await tx.customer.findUnique({ where: { id: body.id } });
    if (existing) return existing;
    const phone = normalizePhone(body.phone);
    if (phone) {
      const dup = await tx.customer.findUnique({ where: { phone } });
      if (dup) {
        const target = dup.mergedIntoId ? await tx.customer.findUnique({ where: { id: dup.mergedIntoId } }) : dup;
        throw problem("duplicate-phone", { customerId: target?.id ?? dup.id, fullName: target?.fullName ?? null });
      }
    }
    const now = clock.iso();
    const fullName = body.fullName.normalize("NFC").trim();
    return tx.customer.create({
      data: { id: body.id, fullName, nameSearch: normalizeForSearch(fullName), phone, creditLimit: settings["debt.defaultLimit"], createdAt: now, updatedAt: now },
    });
  });
}

export async function updateCustomer(db: Db, adminId: string, customerId: string, patch: z.infer<typeof UpdateCustomerBody>) {
  return db.$transaction(async (tx) => {
    const c = await tx.customer.findUnique({ where: { id: customerId } });
    if (!c) throw problem("not-found");
    if (c.mergedIntoId || c.anonymisedAt) throw problem("illegal-transition", { reason: c.mergedIntoId ? "merged" : "anonymised" });
    const phone = patch.phone === undefined ? undefined : normalizePhone(patch.phone);
    if (phone && phone !== c.phone && (await tx.customer.findUnique({ where: { phone } }))) throw problem("duplicate-phone");
    const fullName = patch.fullName?.normalize("NFC").trim();
    const updated = await tx.customer.update({
      where: { id: customerId },
      data: {
        fullName, nameSearch: fullName ? normalizeForSearch(fullName) : undefined, phone,
        creditLimit: patch.creditLimit, discountBp: patch.discountBp, notes: patch.notes?.normalize("NFC"),
        isBlocked: patch.isBlocked === undefined ? undefined : patch.isBlocked ? 1 : 0,
        isActive: patch.isActive === undefined ? undefined : patch.isActive ? 1 : 0,
        updatedAt: clock.iso(),
      },
    });
    // Limits and blocks are the controls on debt; the trail records who moved them. No name or phone in the row (§19.5).
    await writeAudit(tx, {
      userId: adminId, action: "customer.update", entityType: "Customer", entityId: customerId,
      before: { creditLimit: c.creditLimit, isBlocked: c.isBlocked, discountBp: c.discountBp, isActive: c.isActive },
      after: { creditLimit: updated.creditLimit, isBlocked: updated.isBlocked, discountBp: updated.discountBp, isActive: updated.isActive },
    });
    return updated;
  });
}

export async function listCustomers(db: Db, opts: { q?: string; includeInactive?: boolean; limit: number }) {
  const q = opts.q?.trim() ? normalizeForSearch(opts.q) : "";
  const digits = normalizePhone(opts.q);
  const rows = await db.customer.findMany({
    where: {
      mergedIntoId: null,
      ...(opts.includeInactive ? {} : { isActive: 1 }),
      ...(q ? { OR: [{ nameSearch: { contains: q } }, ...(digits && digits.length >= 3 ? [{ phone: { contains: digits } }] : [])] } : {}),
    },
  });
  const projections = await allProjections(db);
  const recent = await db.sale.findMany({ where: { customerId: { not: null }, status: "COMPLETED" }, orderBy: { completedAt: "desc" }, take: 200, select: { customerId: true, completedAt: true } });
  const lastSold = new Map<string, string>();
  for (const s of recent) if (s.customerId && !lastSold.has(s.customerId)) lastSold.set(s.customerId, s.completedAt!);
  return rows
    .map((c) => {
      const p = projections.get(c.id);
      return { customer: c, outstanding: p?.outstanding ?? 0, oldestChargeDays: p?.oldestChargeDays ?? null, overdue: p?.overdue ?? 0, lastSaleAt: lastSold.get(c.id) ?? null };
    })
    // By what is owed, then the oldest charge — the owner opens this list to decide who to call (§6.13).
    .sort((a, b) => b.outstanding - a.outstanding || (b.oldestChargeDays ?? -1) - (a.oldestChargeDays ?? -1) || (a.customer.fullName ?? "").localeCompare(b.customer.fullName ?? ""))
    .slice(0, opts.limit);
}

export async function customerLedger(db: Db, customerId: string) {
  let customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw problem("not-found");
  const mergedInto = customer.mergedIntoId ? await db.customer.findUnique({ where: { id: customer.mergedIntoId } }) : null;
  if (mergedInto) customer = mergedInto;
  const settings = await readSettings(db);
  const today = businessDate(clock.now(), settings["shop.timezone"]);
  const projection = await customerProjection(db, customer.id);
  const buckets = age(projection.entries.map((e) => ({ id: e.id, type: e.type as "CHARGE", amount: e.amount, createdAt: e.createdAt, reversesId: e.reversesId })), projection, today, settings["shop.timezone"]);
  const saleIds = projection.entries.map((e) => e.saleId).filter((x): x is string => Boolean(x));
  const sales = new Map((await db.sale.findMany({ where: { id: { in: saleIds } }, select: { id: true, number: true } })).map((s) => [s.id, s.number]));
  const users = new Map((await db.user.findMany({ select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const reversed = new Set(projection.entries.filter((e) => e.reversesId).map((e) => e.reversesId as string));
  return {
    customer,
    forwardedFrom: mergedInto ? customerId : null,
    outstanding: projection.outstanding,
    overdue: overdueAmount(projection.entries, projection.chargeBalance, today),
    aging: buckets,
    entries: projection.entries.map((e) => ({
      id: e.id, type: e.type, amount: e.amount, method: e.method, saleId: e.saleId, saleNumber: e.saleId ? (sales.get(e.saleId) ?? null) : null,
      dueDate: e.dueDate, reversesId: e.reversesId, reversed: reversed.has(e.id), createdAt: e.createdAt, userName: users.get(e.userId) ?? null,
      balance: e.type === "CHARGE" ? (projection.chargeBalance.get(e.id) ?? 0) : null,
      unallocated: e.type !== "CHARGE" ? (projection.creditRemaining.get(e.id) ?? 0) : null,
      settles: e.type !== "CHARGE" ? projection.allocations.filter((a) => a.creditEntryId === e.id).map((a) => ({ chargeEntryId: a.chargeEntryId, amount: a.amount })) : [],
    })),
  };
}

/** Merge a duplicate into the record that stays: every entry re-pointed, a forwarding address left, audited (§6.13). */
export async function mergeCustomer(db: Db, adminId: string, sourceId: string, targetId: string) {
  if (sourceId === targetId) throw problem("malformed-request", { field: "intoId" });
  return db.$transaction(async (tx) => {
    const [source, target] = await Promise.all([tx.customer.findUnique({ where: { id: sourceId } }), tx.customer.findUnique({ where: { id: targetId } })]);
    if (!source || !target) throw problem("not-found");
    if (source.mergedIntoId || target.mergedIntoId || target.anonymisedAt) throw problem("illegal-transition", { reason: "merged-or-anonymised" });
    const moved = await tx.debtEntry.updateMany({ where: { customerId: sourceId }, data: { customerId: targetId } });
    const now = clock.iso();
    await tx.customer.update({ where: { id: sourceId }, data: { mergedIntoId: targetId, isActive: 0, updatedAt: now } });
    await tx.customer.update({ where: { id: targetId }, data: { updatedAt: now, phone: target.phone ?? undefined } });
    await writeAudit(tx, { userId: adminId, action: "customer.merge", entityType: "Customer", entityId: sourceId, after: { intoId: targetId, entriesMoved: moved.count } });
    return { entriesMoved: moved.count };
  });
}

/** Erasure is anonymisation, never deletion: name and phone go, every amount and date stays (§19.6, §27.42). */
export async function eraseCustomer(db: Db, adminId: string, customerId: string) {
  return db.$transaction(async (tx) => {
    const c = await tx.customer.findUnique({ where: { id: customerId } });
    if (!c) throw problem("not-found");
    if (c.anonymisedAt) return c;
    const now = clock.iso();
    const erased = await tx.customer.update({ where: { id: customerId }, data: { fullName: null, phone: null, nameSearch: "", notes: "", anonymisedAt: now, isActive: 0, updatedAt: now } });
    // The audit row names the record, never the person it held.
    await writeAudit(tx, { userId: adminId, action: "customer.erase", entityType: "Customer", entityId: customerId, before: { anonymised: false }, after: { anonymisedAt: now } });
    return erased;
  });
}

export async function agingReport(db: Db) {
  const projections = await allProjections(db);
  const totals = { outstanding: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, credit: 0, debtors: 0 };
  for (const p of projections.values()) {
    if (p.outstanding > 0) { totals.outstanding += p.outstanding; totals.debtors++; } else totals.credit += -p.outstanding;
    totals.d0_30 += p.buckets.d0_30; totals.d31_60 += p.buckets.d31_60; totals.d61_90 += p.buckets.d61_90; totals.d90plus += p.buckets.d90plus;
  }
  return { totals, customers: [...projections.entries()].map(([customerId, p]) => ({ customerId, outstanding: p.outstanding, ...p.buckets })) };
}

export const newCustomerId = () => uuidv7();
