/**
 * Checkout. PRD §12.1, §13.1, §14.3, §14.6, §15.3.
 *
 * One transaction per post. The idempotency key is the id **and** the target status: the same
 * pair is a replay and returns the stored document; a different status is the next transition,
 * checked against §11's lifecycle. The server recomputes every total with @simon/shared, takes
 * price and tax rate as quoted, snapshots cost itself, and enforces the discount cap — a 422 at
 * the counter, a flag up to the offline ceiling from the queue.
 */
import { computeSale, effectiveLineDiscount, lineTotal as grossLineTotal, businessDate, uuidv7, type SaleBody, type ReviewFlagType } from "@simon/shared";
import { evaluateDiscount } from "../domain/discount-cap.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import type { Db, Tx } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import type { Role } from "@simon/shared";
import { writeAudit } from "./audit.service.ts";
import { consumeGrant } from "./auth.service.ts";
import { customerProjection, touchCustomer } from "./debt.service.ts";
import { raiseFlag, warningsFor } from "./review-flag.service.ts";
import { readSettings } from "./settings.service.ts";
import { postMovement } from "./stock-ledger.service.ts";

export const saleInclude = { lines: { orderBy: { id: "asc" } }, payments: { orderBy: { id: "asc" } }, user: { select: { name: true } } } satisfies Prisma.SaleInclude;

export interface Actor {
  userId: string;
  role: Role;
  deviceId: string;
}

type PendingFlag = { type: ReviewFlagType; productId?: string | null; customerId?: string | null; note?: unknown };

export async function submitSale(db: Db, actor: Actor, body: SaleBody) {
  if (body.status === "COMPLETED" && !body.number) throw problem("malformed-request", { field: "number" });
  if (new Set(body.lines.map((l) => l.id)).size !== body.lines.length) throw problem("malformed-request", { field: "lines.id" });

  const settings = await readSettings(db);
  const now = clock.now();

  const saleId = await db.$transaction(async (tx) => {
    const existing = await tx.sale.findUnique({ where: { id: body.id } });
    if (existing) {
      if (existing.status === body.status) return existing.id; // replay (§14.3)
      const open = existing.status === "DRAFT" || existing.status === "HELD";
      const legal = open && (body.status === "COMPLETED" || existing.status === "DRAFT");
      if (!legal) throw problem("illegal-transition", { status: existing.status });
    }

    const shift = await tx.shift.findUnique({ where: { id: body.shiftId } });
    if (!shift) throw problem("not-found", { entity: "Shift" });
    const late = shift.status === "CLOSED";
    if (!late && shift.status !== "OPEN" && !body.queued) throw problem("shift-not-open");
    if (late && !body.queued) throw problem("shift-not-open");
    if (body.status === "COMPLETED" && settings["tax.regime"] === null) throw problem("tax-regime-not-set");

    const completing = body.status === "COMPLETED";
    const flags: PendingFlag[] = [];
    const products = new Map((await tx.product.findMany({ where: { id: { in: [...new Set(body.lines.map((l) => l.productId))] } }, include: { units: true } })).map((p) => [p.id, p]));

    // ── Lines: shape checks against the catalogue ─────────────────────────────
    for (const [i, l] of body.lines.entries()) {
      const p = products.get(l.productId);
      if (!p) throw problem("not-found", { entity: "Product", productId: l.productId });
      const unit = p.units.find((u) => u.uom === l.uom && u.factorToStockUom === l.factorToStockUom);
      if (!unit) throw problem("malformed-request", { field: `lines.${i}.uom` });
      const step = unit.role === "STOCK" ? 10 ** (3 - p.decimalPlaces) : 1000;
      if (l.qty % step !== 0) throw problem("malformed-request", { field: `lines.${i}.qty`, decimalPlaces: p.decimalPlaces });
    }

    // ── Arithmetic: recomputed, compared, never trusted (§15.3) ───────────────
    const totals = computeSale(body.lines, body.saleDiscount, body.priceBasis, body.cashRoundingStep);
    for (const [i, l] of totals.lines.entries()) {
      if (l.lineTotal !== body.lines[i].lineTotal) throw problem("malformed-request", { field: `lines.${i}.lineTotal`, expected: l.lineTotal });
    }
    if (totals.total !== body.total) throw problem("malformed-request", { field: "total", expected: totals.total });

    // ── The discount cap, one control for discounts and overrides (§12.1) ─────
    let base = 0;
    let discount = body.saleDiscount;
    const overridden: number[] = [];
    for (const [i, l] of body.lines.entries()) {
      const p = products.get(l.productId)!;
      const catalogueMdram = p.sellPriceMdram * l.factorToStockUom;
      const priceDiffers = l.unitPriceMdram !== catalogueMdram;
      if (priceDiffers && l.priceOverridden) overridden.push(i);
      // A queued sale quoted from a stale cache keeps its price and is flagged, not capped.
      const reference = body.queued && priceDiffers && !l.priceOverridden ? l.unitPriceMdram : catalogueMdram;
      base += grossLineTotal(l.qty, reference);
      discount += effectiveLineDiscount(l.qty, reference, l);
      if (completing && priceDiffers && !l.priceOverridden) flags.push({ type: "PRICE_CHANGED_ON_SYNC", productId: p.id, note: { quotedMdram: l.unitPriceMdram, currentMdram: catalogueMdram } });
    }
    const adminId = consumeGrant(body.reauthGrant, ["discount", "priceOverride"]);
    const decision = evaluateDiscount({
      discount, base, maxBp: settings["discount.maxBp"], offlineCeilingBp: settings["offline.discountCeilingBp"],
      drained: body.queued, reauthorised: adminId !== null,
    });
    if (decision === "reject-cap" || decision === "reject-ceiling") {
      throw problem("discount-above-cap", { maxBp: settings["discount.maxBp"], ceilingBp: settings["offline.discountCeilingBp"], discount, base, beyondCeiling: decision === "reject-ceiling" });
    }
    const aboveCap = discount > 0 && discount * 10_000 > base * settings["discount.maxBp"];
    if (completing && aboveCap && decision === "flag") flags.push({ type: "DISCOUNT_ABOVE_CAP_ON_SYNC", note: { discount, base } });
    const reason = body.overrideReason?.trim() || null;
    if (completing && ((aboveCap && adminId) || overridden.length > 0) && !reason && !body.queued) {
      throw problem("malformed-request", { field: "overrideReason" });
    }

    // ── Other accept-and-flag divergences (§14.6) ─────────────────────────────
    if (completing) {
      const currentRate = settings["tax.regime"] === "VAT" ? settings["tax.rateBp"] : 0;
      if (body.lines.some((l) => l.taxRateBp !== currentRate)) flags.push({ type: "TAX_RATE_CHANGED_ON_SYNC", note: { currentRateBp: currentRate } });
      for (const p of products.values()) if (p.isActive !== 1) flags.push({ type: "PRODUCT_DEACTIVATED_ON_SYNC", productId: p.id });
      const skewMs = Math.abs(Date.parse(body.sentAt) - now.getTime());
      if (skewMs > settings["device.clockSkewMinutes"] * 60_000) flags.push({ type: "DEVICE_CLOCK_SKEW", note: { skewSeconds: Math.round(skewMs / 1000), deviceId: actor.deviceId } });
    }
    if (late && body.status === "HELD") flags.push({ type: "HELD_BASKET_AFTER_CLOSE" });

    // ── Payments ──────────────────────────────────────────────────────────────
    const payments = body.payments.map((p) => {
      if (p.method === "CASH") {
        const tendered = p.tenderedAmount ?? p.amount;
        if (tendered < p.amount) throw problem("malformed-request", { field: "payments.tenderedAmount" });
        return { ...p, tenderedAmount: tendered, changeGiven: tendered - p.amount };
      }
      return { ...p, tenderedAmount: null, changeGiven: null };
    });
    if (completing && payments.reduce((a, p) => a + p.amount, 0) !== totals.total) {
      throw problem("malformed-request", { field: "payments", expected: totals.total });
    }

    // ── Debt: block and limit, refused at the counter and flagged from the queue (§12.2, §14.6) ──
    const debtAmount = completing ? payments.filter((p) => p.method === "DEBT").reduce((a, p) => a + p.amount, 0) : 0;
    let chargeCustomerId: string | null = null;
    let limitAdminId: string | null = null;
    let limitFigures: { limit: number; current: number; wouldBe: number } | null = null;
    if (debtAmount > 0) {
      if (!settings["debt.enabled"]) throw problem("not-permitted", { reason: "debt-book-disabled" });
      if (!body.customerId) throw problem("malformed-request", { field: "customerId" });
      let customer = await tx.customer.findUnique({ where: { id: body.customerId } });
      // A merged record leaves a forwarding address; a queued sale naming it follows it (§11).
      if (customer?.mergedIntoId) customer = await tx.customer.findUnique({ where: { id: customer.mergedIntoId } });
      if (!customer || customer.anonymisedAt) throw problem("not-found", { entity: "Customer" });
      chargeCustomerId = customer.id;
      if (customer.isBlocked === 1) {
        if (!body.queued) throw problem("customer-blocked", { customerId: customer.id });
        flags.push({ type: "CUSTOMER_BLOCKED_ON_SYNC", customerId: customer.id });
      }
      const current = (await customerProjection(tx, customer.id)).outstanding;
      limitFigures = { limit: customer.creditLimit, current, wouldBe: current + debtAmount };
      if (limitFigures.wouldBe > customer.creditLimit) {
        if (body.queued) {
          flags.push({ type: "CREDIT_LIMIT_EXCEEDED_ON_SYNC", customerId: customer.id, note: limitFigures });
        } else {
          const strict = settings["debt.strictLimit"];
          limitAdminId = strict ? null : consumeGrant(body.limitGrant, "creditLimitOverride");
          if (!limitAdminId) throw problem("credit-limit-exceeded", { customerId: customer.id, ...limitFigures, strict });
          if (!body.limitReason?.trim()) throw problem("malformed-request", { field: "limitReason" });
        }
      }
    }

    // ── Write the document ────────────────────────────────────────────────────
    const nowIso = now.toISOString();
    const header = {
      number: completing ? body.number! : null, shiftId: body.shiftId, userId: actor.userId, customerId: chargeCustomerId ?? body.customerId ?? null,
      status: body.status, subtotal: totals.subtotal, discountTotal: totals.discountTotal, discountReason: body.discountReason ?? null,
      taxTotal: totals.taxTotal, priceBasis: body.priceBasis, roundingAdjustment: totals.roundingAdjustment, total: totals.total,
      businessDate: businessDate(now, settings["shop.timezone"]), completedAt: completing ? nowIso : null,
    };
    if (existing) {
      await tx.payment.deleteMany({ where: { saleId: body.id } });
      await tx.saleLine.deleteMany({ where: { saleId: body.id } });
      await tx.sale.update({ where: { id: body.id }, data: header });
      if (existing.shiftId !== body.shiftId) {
        await writeAudit(tx, { userId: actor.userId, action: "sale.heldTransfer", entityType: "Sale", entityId: body.id, before: { shiftId: existing.shiftId, userId: existing.userId }, after: { shiftId: body.shiftId, userId: actor.userId } });
      }
    } else {
      await tx.sale.create({ data: { id: body.id, ...header, createdAt: body.createdAt } });
    }

    for (const [i, l] of body.lines.entries()) {
      const p = products.get(l.productId)!;
      let unitCostMdram: number | null = null;
      if (completing) {
        const stockDelta = -(l.qty * l.factorToStockUom);
        if (p.trackStock === 1) {
          const current = await tx.product.findUniqueOrThrow({ where: { id: p.id }, select: { stockQty: true } });
          if (current.stockQty + stockDelta < 0) {
            if (settings["stock.strictNegative"] && !body.queued) throw problem("insufficient-stock-strict", { productId: p.id, available: current.stockQty });
            if (!flags.some((f) => f.type === "INSUFFICIENT_STOCK" && f.productId === p.id)) flags.push({ type: "INSUFFICIENT_STOCK", productId: p.id, note: { stockQtyBefore: current.stockQty } });
          }
          const posted = await postMovement(tx, { productId: p.id, type: "SALE", qtyDelta: stockDelta, source: { type: "Sale", id: body.id }, userId: actor.userId });
          unitCostMdram = posted.movement.unitCostMdram === null ? null : posted.movement.unitCostMdram * l.factorToStockUom;
        } else {
          unitCostMdram = p.avgCostMdram === null ? null : p.avgCostMdram * l.factorToStockUom;
        }
      }
      await tx.saleLine.create({
        data: {
          id: l.id, saleId: body.id, productId: p.id, productName: p.name, qty: l.qty, uom: l.uom, factorToStockUom: l.factorToStockUom,
          unitPriceMdram: l.unitPriceMdram, unitCostMdram, taxRateBp: l.taxRateBp, lineTax: totals.lines[i].lineTax,
          discountAmount: l.discountAmount, discountReason: l.discountReason ?? null, priceOverridden: l.priceOverridden ? 1 : 0, lineTotal: totals.lines[i].lineTotal,
        },
      });
    }
    for (const p of payments) {
      await tx.payment.create({ data: { id: p.id, saleId: body.id, method: p.method, amount: p.amount, tenderedAmount: p.tenderedAmount, changeGiven: p.changeGiven } });
    }

    if (completing) {
      for (const i of overridden) {
        await writeAudit(tx, { userId: actor.userId, action: "sale.linePriceOverride", entityType: "SaleLine", entityId: body.lines[i].id, before: { productId: body.lines[i].productId }, after: { unitPriceMdram: body.lines[i].unitPriceMdram }, reason: reason ?? "offline" });
      }
      if (aboveCap && adminId) {
        await writeAudit(tx, { userId: actor.userId, action: "sale.discountAboveCap", entityType: "Sale", entityId: body.id, after: { discount, base, authorisedBy: adminId }, reason: reason! });
      }
      if (late) await tx.shiftLateArrival.create({ data: { id: uuidv7(), shiftId: body.shiftId, sourceType: "Sale", sourceId: body.id, amount: totals.total, arrivedAt: nowIso } });
      if (chargeCustomerId) {
        const chargeId = uuidv7();
        await tx.debtEntry.create({ data: { id: chargeId, customerId: chargeCustomerId, type: "CHARGE", amount: debtAmount, method: null, saleId: body.id, dueDate: body.dueDate ?? null, createdAt: nowIso, userId: actor.userId } });
        await touchCustomer(tx, chargeCustomerId);
        if (limitAdminId) {
          await writeAudit(tx, { userId: actor.userId, action: "debt.creditLimitOverride", entityType: "DebtEntry", entityId: chargeId, before: limitFigures, after: { authorisedBy: limitAdminId, customerId: chargeCustomerId }, reason: body.limitReason! });
        }
      }
    }
    for (const f of flags) await raiseFlag(tx, { ...f, sourceType: "Sale", sourceId: body.id });
    return body.id;
  });

  // The device's counter is authoritative; the server records the highest it has seen (§11), outside the sale's transaction.
  if (body.number) {
    const [prefix, seq] = body.number.split("-");
    await db.device.updateMany({ where: { prefix, lastSequence: { lt: Number(seq) } }, data: { lastSequence: Number(seq) } });
  }
  return loadSale(db, saleId);
}

export async function loadSale(db: Db | Tx, id: string) {
  const sale = await db.sale.findUnique({ where: { id }, include: saleInclude });
  if (!sale) throw problem("not-found");
  return { sale, warnings: await warningsFor(db, "Sale", id) };
}

/** HELD → DRAFT on any open shift; the sale moves to the shift that will complete it (§12.1). */
export async function resumeSale(db: Db, actor: Actor, saleId: string, shiftId: string) {
  await db.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id: saleId } });
    if (!sale) throw problem("not-found");
    if (sale.status !== "HELD" && sale.status !== "DRAFT") throw problem("illegal-transition", { status: sale.status });
    const shift = await tx.shift.findUnique({ where: { id: shiftId } });
    if (!shift || shift.status !== "OPEN") throw problem("shift-not-open");
    await tx.sale.update({ where: { id: saleId }, data: { status: "DRAFT", shiftId } });
    if (sale.shiftId !== shiftId) {
      await writeAudit(tx, { userId: actor.userId, action: "sale.heldTransfer", entityType: "Sale", entityId: saleId, before: { shiftId: sale.shiftId, userId: sale.userId }, after: { shiftId, userId: actor.userId } });
    }
  });
  return loadSale(db, saleId);
}

/** Only a basket that never completed is voided; a completed sale is reversed by a return (§10.7). */
export async function voidSale(db: Db, actor: Actor, saleId: string) {
  await db.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id: saleId } });
    if (!sale) throw problem("not-found");
    if (sale.status === "VOIDED") return;
    if (sale.status !== "HELD" && sale.status !== "DRAFT") throw problem("illegal-transition", { status: sale.status });
    await tx.sale.update({ where: { id: saleId }, data: { status: "VOIDED" } });
    await writeAudit(tx, { userId: actor.userId, action: "sale.void", entityType: "Sale", entityId: saleId, before: { status: sale.status, total: sale.total } });
  });
  return loadSale(db, saleId);
}
