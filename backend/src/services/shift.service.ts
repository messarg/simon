/**
 * Shifts and the drawer. PRD §6.6, §11 `Shift`/`CashMovement`/`ShiftLateArrival`, §12.5.
 *
 * Expected cash is a query over rows while a shift is OPEN or CLOSING, and a stored record once
 * it is CLOSED. A document that arrives after close is posted against the shift and stated
 * beside the Z-report, never folded into its frozen figures.
 */
import { businessDate, uuidv7, type CashMovementBody, type CashMovementType } from "@simon/shared";
import { countedTotal, DENOMINATIONS, expectedCash, needsVarianceNote } from "../domain/shift-cash.ts";
import type { Db, Tx } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { writeAudit } from "./audit.service.ts";
import { revokeSessionsForShift } from "./auth.service.ts";
import type { Actor } from "./sale.service.ts";
import { readSettings } from "./settings.service.ts";

export async function openShift(db: Db, live: Db, actor: Actor & { sessionId: string }, body: { id: string; openingFloat: number }) {
  const shift = await db.$transaction(async (tx) => {
    const existing = await tx.shift.findUnique({ where: { id: body.id } });
    if (existing) return existing;
    const open = await tx.shift.findFirst({ where: { userId: actor.userId, status: { in: ["OPEN", "CLOSING"] } } });
    if (open) throw problem("illegal-transition", { shiftId: open.id, status: open.status });
    return tx.shift.create({ data: { id: body.id, userId: actor.userId, openedAt: clock.iso(), openingFloat: body.openingFloat, status: "OPEN" } });
  });
  await live.session.update({ where: { id: actor.sessionId }, data: { shiftId: shift.id } });
  return shift;
}

export async function currentShift(db: Db, userId: string) {
  return db.shift.findFirst({ where: { userId, status: { in: ["OPEN", "CLOSING"] } }, orderBy: { openedAt: "desc" } });
}

async function assertOwnShift(tx: Tx | Db, actor: Actor, shiftId: string) {
  const shift = await tx.shift.findUnique({ where: { id: shiftId } });
  if (!shift) throw problem("not-found");
  if (shift.userId !== actor.userId && actor.role !== "ADMIN") throw problem("not-permitted");
  return shift;
}

export interface ShiftFigures {
  openingFloat: number;
  cashSales: number;
  cardSales: number;
  salesCount: number;
  repayments: number;
  payIns: number;
  refunds: number;
  payOuts: number;
  drops: number;
  noSales: number;
  expected: number;
}

/** §12.5's terms, excluding anything that arrived after close (it is stated separately). */
export async function shiftFigures(db: Db | Tx, shiftId: string): Promise<ShiftFigures & { lateSourceIds: Set<string> }> {
  const shift = await db.shift.findUniqueOrThrow({ where: { id: shiftId } });
  const late = await db.shiftLateArrival.findMany({ where: { shiftId }, select: { sourceId: true } });
  const lateSourceIds = new Set(late.map((l) => l.sourceId));
  const sales = await db.sale.findMany({ where: { shiftId, status: "COMPLETED" }, select: { id: true, payments: { select: { method: true, amount: true } } } });
  const counted = sales.filter((s) => !lateSourceIds.has(s.id));
  const sum = (method: string) => counted.reduce((a, s) => a + s.payments.filter((p) => p.method === method).reduce((b, p) => b + p.amount, 0), 0);
  const movements = (await db.cashMovement.findMany({ where: { shiftId }, select: { id: true, type: true, amount: true, sourceId: true } }))
    .filter((m) => !lateSourceIds.has(m.id) && !lateSourceIds.has(m.sourceId));
  const byType = (t: CashMovementType) => movements.filter((m) => m.type === t).reduce((a, m) => a + m.amount, 0);
  const cashSales = sum("CASH");
  return {
    openingFloat: shift.openingFloat, cashSales, cardSales: sum("CARD"), salesCount: counted.length,
    repayments: byType("REPAYMENT"), payIns: byType("PAY_IN"), refunds: byType("REFUND"), payOuts: byType("PAY_OUT"), drops: byType("DROP"),
    noSales: movements.filter((m) => m.type === "NO_SALE").length,
    expected: expectedCash({ openingFloat: shift.openingFloat, cashSales, movements: movements.map((m) => ({ type: m.type as CashMovementType, amount: m.amount })) }),
    lateSourceIds,
  };
}

async function openBaskets(tx: Tx, shiftId: string) {
  const baskets = await tx.sale.findMany({ where: { shiftId, status: { in: ["DRAFT", "HELD"] } }, orderBy: { createdAt: "asc" }, select: { id: true, createdAt: true, total: true, lines: { take: 1, orderBy: { id: "asc" }, select: { productName: true } } } });
  return baskets.map((b) => ({ id: b.id, createdAt: b.createdAt, total: b.total, firstItem: b.lines[0]?.productName ?? null }));
}

export async function beginClose(db: Db, actor: Actor, shiftId: string, unsyncedAtClose: number) {
  return db.$transaction(async (tx) => {
    const shift = await assertOwnShift(tx, actor, shiftId);
    if (shift.status === "CLOSED") throw problem("illegal-transition", { status: shift.status });
    const baskets = await openBaskets(tx, shiftId);
    if (baskets.length) throw problem("shift-has-open-baskets", { baskets });
    if (shift.status === "OPEN") await tx.shift.update({ where: { id: shiftId }, data: { status: "CLOSING", unsyncedAtClose } });
    const { lateSourceIds: _late, ...figures } = await shiftFigures(tx, shiftId);
    return figures;
  });
}

export async function cancelClose(db: Db, actor: Actor, shiftId: string) {
  await db.$transaction(async (tx) => {
    const shift = await assertOwnShift(tx, actor, shiftId);
    if (shift.status !== "CLOSING") throw problem("illegal-transition", { status: shift.status });
    await tx.shift.update({ where: { id: shiftId }, data: { status: "OPEN" } });
  });
}

export async function closeShift(db: Db, live: Db, actor: Actor, shiftId: string, body: { breakdown: { value: number; count: number }[]; note?: string; unsyncedAtClose: number }) {
  const settings = await readSettings(db);
  for (const d of body.breakdown) if (!DENOMINATIONS.includes(d.value)) throw problem("malformed-request", { field: "breakdown.value", value: d.value });
  await db.$transaction(async (tx) => {
    const shift = await assertOwnShift(tx, actor, shiftId);
    if (shift.status !== "CLOSING") throw problem("illegal-transition", { status: shift.status });
    const baskets = await openBaskets(tx, shiftId);
    if (baskets.length) throw problem("shift-has-open-baskets", { baskets });
    const figures = await shiftFigures(tx, shiftId);
    const counted = countedTotal(body.breakdown);
    const variance = counted - figures.expected;
    const note = body.note?.normalize("NFC").trim() ?? "";
    if (needsVarianceNote(variance, settings["shift.varianceNoteThreshold"]) && !note) {
      throw problem("malformed-request", { field: "note", variance, threshold: settings["shift.varianceNoteThreshold"] });
    }
    await tx.shift.update({
      where: { id: shiftId },
      data: { status: "CLOSED", closedAt: clock.iso(), expectedCash: figures.expected, countedCash: counted, countedBreakdown: JSON.stringify(body.breakdown), variance, notes: note, unsyncedAtClose: body.unsyncedAtClose },
    });
  });
  // Sessions die with their shift (§16.3). Sessions live in the live database.
  await live.$transaction((tx) => revokeSessionsForShift(tx, shiftId));
  return shiftReport(db, shiftId);
}

/** X-report while open, Z-report once closed: the same shape, frozen figures once CLOSED. */
export async function shiftReport(db: Db, shiftId: string) {
  const shift = await db.shift.findUnique({ where: { id: shiftId }, include: { user: { select: { name: true } } } });
  if (!shift) throw problem("not-found");
  const { lateSourceIds: _l, ...figures } = await shiftFigures(db, shiftId);
  const lateArrivals = await db.shiftLateArrival.findMany({ where: { shiftId }, orderBy: { arrivedAt: "asc" } });
  const transferAudits = await db.auditLog.findMany({ where: { action: "sale.heldTransfer" }, orderBy: { createdAt: "asc" } });
  const transfers = transferAudits
    .map((a) => ({ saleId: a.entityId, before: JSON.parse(a.before ?? "{}") as { shiftId?: string }, after: JSON.parse(a.after ?? "{}") as { shiftId?: string }, at: a.createdAt }))
    .filter((t) => t.after.shiftId === shiftId || t.before.shiftId === shiftId)
    .map((t) => ({ saleId: t.saleId, direction: t.after.shiftId === shiftId ? "in" : "out", fromShiftId: t.before.shiftId ?? null, toShiftId: t.after.shiftId ?? null, at: t.at }));
  const closed = shift.status === "CLOSED";
  return {
    shift: {
      id: shift.id, userId: shift.userId, userName: shift.user.name, status: shift.status, openedAt: shift.openedAt, closedAt: shift.closedAt,
      openingFloat: shift.openingFloat, unsyncedAtClose: shift.unsyncedAtClose, notes: shift.notes,
      countedBreakdown: shift.countedBreakdown ? JSON.parse(shift.countedBreakdown) : null,
    },
    kind: closed ? "Z" : "X",
    figures: { ...figures, expected: closed ? shift.expectedCash! : figures.expected },
    counted: shift.countedCash,
    variance: closed ? shift.variance : null,
    lateArrivals: lateArrivals.map((l) => ({ sourceType: l.sourceType, sourceId: l.sourceId, amount: l.amount, arrivedAt: l.arrivedAt })),
    transfers,
  };
}

export async function submitCashMovement(db: Db, actor: Actor, body: CashMovementBody) {
  const settings = await readSettings(db);
  if (body.type === "PAY_OUT" && !["WAGE", "EXPENSE", "OWNER_DRAW"].includes(body.reasonCode ?? "")) {
    throw problem("malformed-request", { field: "reasonCode" });
  }
  const id = await db.$transaction(async (tx) => {
    if (await tx.cashMovement.findUnique({ where: { id: body.id } })) return body.id;
    const shift = await tx.shift.findUnique({ where: { id: body.shiftId } });
    if (!shift) throw problem("not-found", { entity: "Shift" });
    const late = shift.status === "CLOSED";
    if (late && !body.queued) throw problem("shift-not-open");
    const now = clock.now();
    await tx.cashMovement.create({
      data: {
        id: body.id, shiftId: body.shiftId, businessDate: businessDate(now, settings["shop.timezone"]), type: body.type, amount: body.amount,
        reasonCode: body.type === "PAY_OUT" ? body.reasonCode! : null, reason: body.reason.normalize("NFC"),
        sourceType: "CashMovement", sourceId: body.id, userId: actor.userId, createdAt: body.createdAt,
      },
    });
    if (late) await tx.shiftLateArrival.create({ data: { id: uuidv7(), shiftId: body.shiftId, sourceType: "CashMovement", sourceId: body.id, amount: body.type === "PAY_IN" ? body.amount : -body.amount, arrivedAt: now.toISOString() } });
    await writeAudit(tx, { userId: actor.userId, action: "cashMovement.create", entityType: "CashMovement", entityId: body.id, after: { type: body.type, amount: body.amount, reasonCode: body.reasonCode ?? null } });
    return body.id;
  });
  return db.cashMovement.findUniqueOrThrow({ where: { id } });
}
