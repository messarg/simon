/**
 * Sale returns. PRD §6.5, §12.4, §14.3, §15.3.
 *
 * Starts from the original sale; blind returns need admin re-auth. The per-line quantity check
 * binds the counter (422) and is flagged from the queue. Goods back on the shelf post
 * SALE_RETURN at the original unit cost; damaged goods post SALE_RETURN then WRITE_OFF, so the
 * shelf count stays true. The refund splits across the sale's tenders pro-rata, and a cash
 * refund is a REFUND cash movement in the same transaction.
 */
import { businessDate, uuidv7, type SaleReturnBody } from "@simon/shared";
import { computeReturn } from "../domain/returns.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import type { Db } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { writeAudit } from "./audit.service.ts";
import { consumeGrant } from "./auth.service.ts";
import { raiseFlag, warningsFor } from "./review-flag.service.ts";
import type { Actor } from "./sale.service.ts";
import { readSettings } from "./settings.service.ts";
import { postMovement } from "./stock-ledger.service.ts";

export const returnInclude = { lines: true, tenders: true, originalSale: { select: { number: true } } } satisfies Prisma.SaleReturnInclude;

export async function submitSaleReturn(db: Db, actor: Actor, body: SaleReturnBody) {
  const settings = await readSettings(db);
  const now = clock.now();

  const id = await db.$transaction(async (tx) => {
    if (await tx.saleReturn.findUnique({ where: { id: body.id } })) return body.id; // replay: id alone (§14.3)

    const shift = await tx.shift.findUnique({ where: { id: body.shiftId } });
    if (!shift) throw problem("not-found", { entity: "Shift" });
    const late = shift.status === "CLOSED";
    if (late && !body.queued) throw problem("shift-not-open");

    const nowIso = now.toISOString();
    const bizDate = businessDate(now, settings["shop.timezone"]);
    let total = 0;
    let tenders: Array<{ method: "CASH" | "CARD" | "DEBT_REDUCTION"; amount: number }> = [];
    const lineRows: Array<{ id: string; saleLineId: string | null; productId: string; qty: number; stockQty: number; unitCostPerStockMdram: number | null; unitCostMdram: number | null; taxRateBp: number; lineTax: number; discountShare: number; refundAmount: number; restock: boolean; writeOffReason: string | null }> = [];
    let priceBasis: string = settings["tax.priceBasis"];
    const exceeded: string[] = [];

    if (body.originalSaleId === null) {
      const adminId = consumeGrant(body.reauthGrant, "blindReturn");
      if (!adminId) throw problem("reauth-required", { action: "blindReturn" });
      for (const l of body.lines) {
        if (!l.productId || l.refundAmount == null) throw problem("malformed-request", { field: "lines.productId" });
        const p = await tx.product.findUnique({ where: { id: l.productId } });
        if (!p) throw problem("not-found", { entity: "Product" });
        const step = 10 ** (3 - p.decimalPlaces);
        if (l.qty % step !== 0) throw problem("malformed-request", { field: "lines.qty" });
        lineRows.push({ id: l.id, saleLineId: null, productId: p.id, qty: l.qty, stockQty: l.qty, unitCostPerStockMdram: p.avgCostMdram, unitCostMdram: p.avgCostMdram, taxRateBp: 0, lineTax: 0, discountShare: 0, refundAmount: l.refundAmount, restock: l.restock, writeOffReason: l.writeOffReason ?? null });
        total += l.refundAmount;
      }
      tenders = total > 0 ? [{ method: "CASH", amount: total }] : [];
      await writeAudit(tx, { userId: actor.userId, action: "sale.blindReturn", entityType: "SaleReturn", entityId: body.id, after: { total, authorisedBy: adminId }, reason: body.reason });
    } else {
      const sale = await tx.sale.findUnique({ where: { id: body.originalSaleId }, include: { lines: { orderBy: { id: "asc" } }, payments: { orderBy: { id: "asc" } } } });
      if (!sale) throw problem("not-found", { entity: "Sale" });
      if (sale.status !== "COMPLETED") throw problem("illegal-transition", { status: sale.status });
      priceBasis = sale.priceBasis;
      const returned = await tx.saleReturnLine.groupBy({ by: ["saleLineId"], where: { saleLineId: { in: sale.lines.map((l) => l.id) }, ret: { reversesId: null } }, _sum: { qty: true } });
      const already = new Map(returned.map((r) => [r.saleLineId, r._sum.qty ?? 0]));
      if (body.lines.some((l) => !l.saleLineId)) throw problem("malformed-request", { field: "lines.saleLineId" });
      const result = computeReturn(
        { priceBasis: sale.priceBasis as "INCLUSIVE" | "EXCLUSIVE", discountTotal: sale.discountTotal, roundingAdjustment: sale.roundingAdjustment, total: sale.total, lines: sale.lines, payments: sale.payments.map((p) => ({ method: p.method as "CASH", amount: p.amount })) },
        body.lines.map((l) => ({ saleLineId: l.saleLineId!, qty: l.qty, alreadyReturned: already.get(l.saleLineId!) ?? 0 })),
      );
      for (const [i, r] of result.lines.entries()) {
        const original = sale.lines.find((l) => l.id === r.saleLineId)!;
        if (r.exceedsSold) {
          const remaining = original.qty - (already.get(original.id) ?? 0);
          if (!body.queued) throw problem("return-exceeds-sold", { saleLineId: original.id, remaining });
          exceeded.push(original.id);
        }
        const perStock = original.unitCostMdram === null ? null : original.unitCostMdram / original.factorToStockUom;
        lineRows.push({
          id: body.lines[i].id, saleLineId: original.id, productId: original.productId, qty: r.qty, stockQty: r.qty * original.factorToStockUom,
          unitCostPerStockMdram: perStock === null ? null : Math.round(perStock), unitCostMdram: original.unitCostMdram, taxRateBp: original.taxRateBp,
          lineTax: r.lineTax, discountShare: r.discountShare, refundAmount: r.refundAmount, restock: body.lines[i].restock, writeOffReason: body.lines[i].writeOffReason ?? null,
        });
      }
      total = result.total;
      tenders = result.tenders;
      if (tenders.some((t) => t.method === "DEBT_REDUCTION")) throw problem("not-permitted", { reason: "debt-book-not-available" });
    }

    await tx.saleReturn.create({
      data: { id: body.id, originalSaleId: body.originalSaleId, shiftId: body.shiftId, businessDate: bizDate, userId: actor.userId, reason: body.reason.normalize("NFC"), priceBasis, total, createdAt: body.createdAt },
    });
    for (const l of lineRows) {
      await tx.saleReturnLine.create({
        data: { id: l.id, returnId: body.id, saleLineId: l.saleLineId, productId: l.productId, qty: l.qty, unitCostMdram: l.unitCostMdram, taxRateBp: l.taxRateBp, lineTax: l.lineTax, discountShare: l.discountShare, refundAmount: l.refundAmount, restock: l.restock ? 1 : 0 },
      });
      const product = await tx.product.findUniqueOrThrow({ where: { id: l.productId }, select: { trackStock: true } });
      if (product.trackStock !== 1) continue;
      await postMovement(tx, { productId: l.productId, type: "SALE_RETURN", qtyDelta: l.stockQty, unitCostMdram: l.unitCostPerStockMdram, source: { type: "SaleReturn", id: body.id }, userId: actor.userId });
      if (!l.restock) {
        await postMovement(tx, { productId: l.productId, type: "WRITE_OFF", qtyDelta: -l.stockQty, reasonCode: (l.writeOffReason as "DAMAGE") ?? "DAMAGE", note: `SaleReturn ${body.id}`, userId: actor.userId });
      }
    }
    let cashOut = 0;
    for (const t of tenders) {
      await tx.saleReturnTender.create({ data: { id: uuidv7(), returnId: body.id, method: t.method, amount: t.amount } });
      if (t.method === "CASH") cashOut += t.amount;
    }
    if (cashOut > 0) {
      await tx.cashMovement.create({
        data: { id: uuidv7(), shiftId: body.shiftId, businessDate: bizDate, type: "REFUND", amount: cashOut, sourceType: "SaleReturn", sourceId: body.id, userId: actor.userId, createdAt: nowIso },
      });
    }
    if (late) await tx.shiftLateArrival.create({ data: { id: uuidv7(), shiftId: body.shiftId, sourceType: "SaleReturn", sourceId: body.id, amount: -cashOut, arrivedAt: nowIso } });
    for (const saleLineId of exceeded) await raiseFlag(tx, { type: "RETURN_EXCEEDS_SOLD_ON_SYNC", sourceType: "SaleReturn", sourceId: body.id, note: { saleLineId } });
    await writeAudit(tx, { userId: actor.userId, action: "sale.return", entityType: "SaleReturn", entityId: body.id, after: { originalSaleId: body.originalSaleId, total }, reason: null });
    return body.id;
  });

  return loadSaleReturn(db, id);
}

export async function loadSaleReturn(db: Db, id: string) {
  const ret = await db.saleReturn.findUnique({ where: { id }, include: returnInclude });
  if (!ret) throw problem("not-found");
  return { saleReturn: ret, warnings: await warningsFor(db, "SaleReturn", id) };
}

/** What is left to return on each line of a sale — the counter-side check the screen shows (§6.5). */
export async function returnableLines(db: Db, saleId: string) {
  const sale = await db.sale.findUnique({ where: { id: saleId }, include: { lines: { orderBy: { id: "asc" } } } });
  if (!sale) throw problem("not-found");
  const returned = await db.saleReturnLine.groupBy({ by: ["saleLineId"], where: { saleLineId: { in: sale.lines.map((l) => l.id) }, ret: { reversesId: null } }, _sum: { qty: true } });
  const already = new Map(returned.map((r) => [r.saleLineId, r._sum.qty ?? 0]));
  return sale.lines.map((l) => ({ saleLineId: l.id, returned: already.get(l.id) ?? 0, remaining: l.qty - (already.get(l.id) ?? 0) }));
}
