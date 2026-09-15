/**
 * Receiving goods. PRD §6.7, §13.2, §10.3, §10.5, J5.
 *
 * One transaction: the receipt and its lines (unit and factor snapshotted), the delivery charge
 * spread across lines by value, PURCHASE_RECEIPT movements at the landed cost per stock unit
 * (moving the weighted average, or seeding it), the payable, and any standing supplier credit
 * drawn against it. A cost far from the last one is flagged for the owner (§13.2).
 */
import { apportionByValue, lineTotal, roundHalfUp, uuidv7, type GoodsReceiptBody } from "@simon/shared";
import type { Db } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { writeAudit } from "./audit.service.ts";
import { raiseFlag, warningsFor } from "./review-flag.service.ts";
import type { Actor } from "./sale.service.ts";
import { readSettings } from "./settings.service.ts";
import { postMovement } from "./stock-ledger.service.ts";
import { applyStandingCredits } from "./supplier.service.ts";

/** Last invoice cost for a product per stock unit — the figure the variance check compares against. STOCK may see it: it is an invoice cost (§16.5). */
export async function lastInvoiceCostPerStockUnit(db: Db, productId: string) {
  const line = await db.goodsReceiptLine.findFirst({ where: { productId, receipt: { reversesId: null } }, orderBy: { receipt: { receivedAt: "desc" } } });
  return line ? roundHalfUp(line.invoiceUnitCostMdram, line.factorToStockUom) : null;
}

export async function receiveGoods(db: Db, actor: Actor, body: GoodsReceiptBody) {
  const settings = await readSettings(db);
  const receivedAt = body.receivedAt && Date.parse(body.receivedAt) <= clock.now().getTime() ? new Date(body.receivedAt).toISOString() : clock.iso();
  const id = await db.$transaction(async (tx) => {
    if (await tx.goodsReceipt.findUnique({ where: { id: body.id } })) return body.id;
    const supplier = await tx.supplier.findUnique({ where: { id: body.supplierId } });
    if (!supplier || supplier.isActive !== 1) throw problem("not-found", { entity: "Supplier" });

    const products = new Map((await tx.product.findMany({ where: { id: { in: body.lines.map((l) => l.productId) } }, include: { units: true } })).map((p) => [p.id, p]));
    for (const [i, l] of body.lines.entries()) {
      const p = products.get(l.productId);
      if (!p) throw problem("not-found", { entity: "Product", productId: l.productId });
      if (!p.units.some((u) => u.uom === l.uom && u.factorToStockUom === l.factorToStockUom)) throw problem("malformed-request", { field: `lines.${i}.uom` });
      if (l.factorToStockUom === 1 && l.qty % 10 ** (3 - p.decimalPlaces) !== 0) throw problem("malformed-request", { field: `lines.${i}.qty` });
    }

    const values = body.lines.map((l) => lineTotal(l.qty, l.invoiceUnitCostMdram));
    const freight = apportionByValue(values, body.landedCostTotal);
    const count = await tx.goodsReceipt.count();
    const number = `R-${String(count + 1).padStart(6, "0")}`;
    const total = values.reduce((a, v) => a + v, 0);
    await tx.goodsReceipt.create({ data: { id: body.id, number, supplierId: supplier.id, poId: null, receivedAt, userId: actor.userId, supplierInvoiceNo: body.supplierInvoiceNo.normalize("NFC"), landedCostTotal: body.landedCostTotal, total } });

    for (const [i, l] of body.lines.entries()) {
      // The line's share of the delivery charge per unit received, rounded once where it is stored (§10.1).
      const landedUnitCostMdram = l.invoiceUnitCostMdram + roundHalfUp(freight[i] * 1_000_000, l.qty);
      await tx.goodsReceiptLine.create({ data: { id: l.id, receiptId: body.id, productId: l.productId, qty: l.qty, uom: l.uom, factorToStockUom: l.factorToStockUom, invoiceUnitCostMdram: l.invoiceUnitCostMdram, landedUnitCostMdram } });

      const perStockInvoice = roundHalfUp(l.invoiceUnitCostMdram, l.factorToStockUom);
      const last = await tx.goodsReceiptLine.findFirst({ where: { productId: l.productId, receiptId: { not: body.id }, receipt: { reversesId: null } }, orderBy: { receipt: { receivedAt: "desc" } } });
      if (last) {
        const lastPer = roundHalfUp(last.invoiceUnitCostMdram, last.factorToStockUom);
        const ratio = settings["receiving.costVarianceRatio"];
        if (lastPer > 0 && (perStockInvoice >= lastPer * ratio || perStockInvoice * ratio <= lastPer)) {
          await raiseFlag(tx, { type: "COST_VARIANCE", sourceType: "GoodsReceipt", sourceId: body.id, productId: l.productId, note: { lastMdram: lastPer, newMdram: perStockInvoice, receiptLineId: l.id } });
        }
      }
      await postMovement(tx, {
        productId: l.productId, type: "PURCHASE_RECEIPT", qtyDelta: l.qty * l.factorToStockUom,
        unitCostMdram: roundHalfUp(landedUnitCostMdram, l.factorToStockUom), source: { type: "GoodsReceipt", id: body.id }, userId: actor.userId,
      });
    }
    await applyStandingCredits(tx, supplier.id, actor.userId);
    await writeAudit(tx, { userId: actor.userId, action: "goodsReceipt.create", entityType: "GoodsReceipt", entityId: body.id, after: { number, supplierId: supplier.id, total } });
    return body.id;
  });
  return loadReceipt(db, id);
}

export async function loadReceipt(db: Db, id: string) {
  const receipt = await db.goodsReceipt.findUnique({ where: { id }, include: { lines: { orderBy: { id: "asc" } }, supplier: { select: { id: true, name: true } } } });
  if (!receipt) throw problem("not-found");
  const products = new Map((await db.product.findMany({ where: { id: { in: receipt.lines.map((l) => l.productId) } }, select: { id: true, name: true, stockUom: true } })).map((p) => [p.id, p]));
  const returned = await db.purchaseReturnLine.groupBy({ by: ["receiptLineId"], where: { receiptLineId: { in: receipt.lines.map((l) => l.id) } }, _sum: { qty: true } });
  const back = new Map(returned.map((r) => [r.receiptLineId, r._sum.qty ?? 0]));
  return {
    receipt,
    lines: receipt.lines.map((l) => ({ ...l, productName: products.get(l.productId)?.name ?? "", stockUom: products.get(l.productId)?.stockUom ?? "", returnedQty: back.get(l.id) ?? 0 })),
    warnings: await warningsFor(db, "GoodsReceipt", id),
  };
}

export const newReceiptId = () => uuidv7();
