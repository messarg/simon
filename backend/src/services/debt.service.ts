/**
 * The debt ledger. PRD §10.6, §12.3, §8.2, §11 `DebtEntry`/`DebtAllocation`/`AllocationOverride`.
 *
 * Charges, payments and credit adjustments are stored and never edited. Which payment settled
 * which charge is a projection over them and the overrides people made, so two offline tills
 * that paid the same charge simply both arrive. An overpayment is the part of a credit the
 * projection could not allocate — it reduces what the customer owes, in both directions.
 *
 * Only a cash repayment writes the REPAYMENT cash movement §12.5 counts. A reversal and a
 * re-entry move an attribution, not money, so neither writes one.
 */
import { businessDate, uuidv7, type DebtPaymentBody } from "@simon/shared";
import { age } from "../domain/aging.ts";
import { allocate, type DebtEntryInput } from "../domain/debt-allocation.ts";
import type { Db, Tx } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { writeAudit } from "./audit.service.ts";
import { consumeGrant } from "./auth.service.ts";
import type { Actor } from "./sale.service.ts";
import { readSettings } from "./settings.service.ts";

type EntryRow = { id: string; type: string; amount: number; createdAt: string; reversesId: string | null; customerId: string; dueDate: string | null };

const toInput = (e: EntryRow): DebtEntryInput => ({ id: e.id, type: e.type as DebtEntryInput["type"], amount: e.amount, createdAt: e.createdAt, reversesId: e.reversesId });

export async function touchCustomer(tx: Tx, customerId: string) {
  await tx.customer.update({ where: { id: customerId }, data: { updatedAt: clock.iso() } });
}

async function overridesFor(db: Db | Tx, entryIds: string[]) {
  if (!entryIds.length) return [];
  return db.allocationOverride.findMany({ where: { creditEntryId: { in: entryIds } }, orderBy: { createdAt: "asc" } });
}

/** The projection for one customer: allocations, per-charge balances, outstanding. */
export async function customerProjection(db: Db | Tx, customerId: string) {
  const entries = await db.debtEntry.findMany({ where: { customerId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const overrides = await overridesFor(db, entries.map((e) => e.id));
  return { entries, ...allocate(entries.map(toInput), overrides) };
}

export function overdueAmount(entries: readonly EntryRow[], chargeBalance: Map<string, number>, today: string) {
  return entries.filter((e) => e.type === "CHARGE" && e.dueDate && e.dueDate < today).reduce((a, e) => a + Math.max(0, chargeBalance.get(e.id) ?? 0), 0);
}

/** Every customer's projection in two queries — the debtor list, the aging report and the snapshot. */
export async function allProjections(db: Db) {
  const [entries, overrides] = await Promise.all([
    db.debtEntry.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    db.allocationOverride.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  const byCustomer = new Map<string, EntryRow[]>();
  for (const e of entries) byCustomer.set(e.customerId, [...(byCustomer.get(e.customerId) ?? []), e]);
  const settings = await readSettings(db);
  const today = businessDate(clock.now(), settings["shop.timezone"]);
  const result = new Map<string, { outstanding: number; oldestChargeDays: number | null; overdue: number; buckets: ReturnType<typeof age> }>();
  for (const [customerId, rows] of byCustomer) {
    const ids = new Set(rows.map((r) => r.id));
    const projection = allocate(rows.map(toInput), overrides.filter((o) => ids.has(o.creditEntryId)));
    const buckets = age(rows.map(toInput), projection, today, settings["shop.timezone"]);
    result.set(customerId, { outstanding: projection.outstanding, oldestChargeDays: buckets.oldestChargeDays, overdue: overdueAmount(rows, projection.chargeBalance, today), buckets });
  }
  return result;
}

export async function submitDebtPayment(db: Db, actor: Actor, body: DebtPaymentBody) {
  const settings = await readSettings(db);
  if (!settings["debt.enabled"]) throw problem("not-permitted", { reason: "debt-book-disabled" });
  if (body.method === "CASH" && !body.shiftId) throw problem("malformed-request", { field: "shiftId" });
  const id = await db.$transaction(async (tx) => {
    if (await tx.debtEntry.findUnique({ where: { id: body.id } })) return body.id; // replay: id alone (§14.3)
    let customer = await tx.customer.findUnique({ where: { id: body.customerId } });
    if (customer?.mergedIntoId) customer = await tx.customer.findUnique({ where: { id: customer.mergedIntoId } });
    if (!customer) throw problem("not-found", { entity: "Customer" });

    const now = clock.now();
    const nowIso = now.toISOString();
    let late = false;
    if (body.method === "CASH") {
      const shift = await tx.shift.findUnique({ where: { id: body.shiftId! } });
      if (!shift) throw problem("not-found", { entity: "Shift" });
      late = shift.status === "CLOSED";
      if (late && !body.queued) throw problem("shift-not-open");
    }
    await tx.debtEntry.create({ data: { id: body.id, customerId: customer.id, type: "PAYMENT", amount: body.amount, method: body.method, createdAt: nowIso, userId: actor.userId } });

    if (body.allocations?.length) {
      const charges = new Set((await tx.debtEntry.findMany({ where: { customerId: customer.id, type: "CHARGE" }, select: { id: true } })).map((c) => c.id));
      if (body.allocations.reduce((a, x) => a + x.amount, 0) > body.amount) throw problem("malformed-request", { field: "allocations" });
      for (const a of body.allocations) {
        if (!charges.has(a.chargeEntryId)) throw problem("malformed-request", { field: "allocations.chargeEntryId" });
        await tx.allocationOverride.create({ data: { id: uuidv7(), creditEntryId: body.id, chargeEntryId: a.chargeEntryId, amount: a.amount, userId: actor.userId, createdAt: nowIso } });
      }
    }
    if (body.method === "CASH") {
      await tx.cashMovement.create({
        data: { id: uuidv7(), shiftId: body.shiftId!, businessDate: businessDate(now, settings["shop.timezone"]), type: "REPAYMENT", amount: body.amount, sourceType: "DebtEntry", sourceId: body.id, userId: actor.userId, createdAt: body.createdAt },
      });
      if (late) await tx.shiftLateArrival.create({ data: { id: uuidv7(), shiftId: body.shiftId!, sourceType: "DebtEntry", sourceId: body.id, amount: body.amount, arrivedAt: nowIso } });
    }
    await touchCustomer(tx, customer.id);
    await writeAudit(tx, { userId: actor.userId, action: "debt.payment", entityType: "DebtEntry", entityId: body.id, after: { customerId: customer.id, amount: body.amount, method: body.method } });
    return body.id;
  });
  return paymentResult(db, id);
}

async function paymentResult(db: Db, paymentId: string) {
  const entry = await db.debtEntry.findUniqueOrThrow({ where: { id: paymentId } });
  const projection = await customerProjection(db, entry.customerId);
  return {
    entry: { id: entry.id, customerId: entry.customerId, type: entry.type, amount: entry.amount, method: entry.method, createdAt: entry.createdAt },
    settled: projection.allocations.filter((a) => a.creditEntryId === paymentId).map((a) => ({ chargeEntryId: a.chargeEntryId, amount: a.amount })),
    outstanding: projection.outstanding,
    warnings: [],
  };
}

/**
 * Reverse a repayment taken against the wrong customer and, in the same act, re-enter it
 * against the right one (§8.2). Admin re-auth and a reason; no cash movement on either side.
 */
export async function reverseDebtPayment(db: Db, actor: Actor, paymentId: string, input: { reauthGrant: string; reason: string; reenterCustomerId?: string | null }) {
  const adminId = consumeGrant(input.reauthGrant, "repaymentReversal");
  if (!adminId) throw problem("reauth-required", { action: "repaymentReversal" });
  return db.$transaction(async (tx) => {
    const original = await tx.debtEntry.findUnique({ where: { id: paymentId } });
    if (!original || original.type !== "PAYMENT" || original.reversesId) throw problem("illegal-transition", { reason: "not-a-payment" });
    if (await tx.debtEntry.findFirst({ where: { reversesId: paymentId } })) throw problem("illegal-transition", { reason: "already-reversed" });
    const nowIso = clock.iso();
    const reversalId = uuidv7();
    await tx.debtEntry.create({ data: { id: reversalId, customerId: original.customerId, type: "PAYMENT", amount: original.amount, method: original.method, reversesId: original.id, createdAt: nowIso, userId: actor.userId } });
    await touchCustomer(tx, original.customerId);
    let reentryId: string | null = null;
    if (input.reenterCustomerId) {
      const target = await tx.customer.findUnique({ where: { id: input.reenterCustomerId } });
      if (!target || target.mergedIntoId || target.anonymisedAt) throw problem("not-found", { entity: "Customer" });
      reentryId = uuidv7();
      await tx.debtEntry.create({ data: { id: reentryId, customerId: target.id, type: "PAYMENT", amount: original.amount, method: original.method, createdAt: nowIso, userId: actor.userId } });
      await touchCustomer(tx, target.id);
    }
    await writeAudit(tx, {
      userId: actor.userId, action: "debt.repaymentReversal", entityType: "DebtEntry", entityId: original.id, reason: input.reason,
      before: { customerId: original.customerId, amount: original.amount }, after: { reversalId, reentryId, toCustomerId: input.reenterCustomerId ?? null, authorisedBy: adminId },
    });
    return { reversalId, reentryId };
  });
}
