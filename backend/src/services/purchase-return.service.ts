/**
 * Returning goods to a supplier. PRD §13.7, §27.22.
 *
 * Names receipt lines, never bare products. Stock leaves at the landed cost it came in at; the
 * average moves only when the result stays inside the band of costs the product has actually
 * entered at, and is flagged otherwise — as it is whenever stock sold between receipt and return.
 * The supplier credits the invoice, never the freight: the difference is recorded as lost. The
 * credit settles the original receipt first.
 */
import { lineTotal, roundHalfUp, type PurchaseReturnBody } from "@simon/shared";
import type { Db } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { writeAudit } from "./audit.service.ts";
import { raiseFlag, warningsFor } from "./review-flag.service.ts";
import type { Actor } from "./sale.service.ts";
import { postMovement } from "./stock-ledger.service.ts";
import { allocateCredit, applyStandingCredits, supplierBooks } from "./supplier.service.ts";

export async function returnToSupplier(db: Db, actor: Actor, body: PurchaseReturnBody) {
  const id = await db.$transaction(async (tx) => {
    if (await tx.purchaseReturn.findUnique({ where: { id: body.id } })) return body.id;
    const receipt = await tx.goodsReceipt.findUnique({ where: { id: body.receiptId }, include: { lines: true } });
    if (!receipt || receipt.reversesId) throw problem("not-found", { entity: "GoodsReceipt" });
    const already = await tx.purchaseReturnLine.groupBy({ by: ["receiptLineId"], where: { receiptLineId: { in: receipt.lines.map((l) => l.id) } }, _sum: { qty: true } });
    const back = new Map(already.map((r) => [r.receiptLineId, r._sum.qty ?? 0]));
    const now = clock.iso();

    let credit = 0;
    let lost = 0;
    const prepared = body.lines.map((l, i) => {
      const line = receipt.lines.find((x) => x.id === l.receiptLineId);
      if (!line) throw problem("malformed-request", { field: `lines.${i}.receiptLineId` });
      const remaining = line.qty - (back.get(line.id) ?? 0);
      if (l.qty > remaining) throw problem("return-exceeds-sold", { receiptLineId: line.id, remaining });
      const creditAmount = lineTotal(l.qty, line.invoiceUnitCostMdram);
      credit += creditAmount;
      lost += lineTotal(l.qty, line.landedUnitCostMdram) - creditAmount;
      return { body: l, line, creditAmount };
    });
    await tx.purchaseReturn.create({ data: { id: body.id, supplierId: receipt.supplierId, receiptId: receipt.id, reason: body.reason.normalize("NFC"), total: credit, landedCostLost: lost, userId: actor.userId, createdAt: now } });

    for (const { body: l, line, creditAmount } of prepared) {
      await tx.purchaseReturnLine.create({ data: { id: l.id, returnId: body.id, receiptLineId: line.id, productId: line.productId, qty: l.qty, landedUnitCostMdram: line.landedUnitCostMdram, creditAmount } });
      const receiptMovement = await tx.stockMovement.findFirst({ where: { sourceType: "GoodsReceipt", sourceId: receipt.id, productId: line.productId }, orderBy: { seq: "asc" } });
      const soldSince = receiptMovement ? await tx.stockMovement.count({ where: { productId: line.productId, type: "SALE", seq: { gt: receiptMovement.seq } } }) : 0;
      const posted = await postMovement(tx, {
        productId: line.productId, type: "PURCHASE_RETURN", qtyDelta: -(l.qty * line.factorToStockUom),
        unitCostMdram: roundHalfUp(line.landedUnitCostMdram, line.factorToStockUom), source: { type: "PurchaseReturn", id: body.id }, userId: actor.userId,
      });
      if (posted.returnRefused || soldSince > 0) {
        await raiseFlag(tx, {
          type: "COST_VARIANCE", sourceType: "PurchaseReturn", sourceId: body.id, productId: line.productId,
          note: { reason: posted.returnRefused ? "purchase-return-average-refused" : "stock-turned-over", averageKeptMdram: posted.after.avgCostMdram, soldSince },
        });
      }
    }

    const books = await supplierBooks(tx, receipt.supplierId);
    const unpaidOnReceipt = books.receipts.find((r) => r.receipt.id === receipt.id)?.unpaid ?? 0;
    await allocateCredit(tx, {
      supplierId: receipt.supplierId, creditType: "PURCHASE_RETURN", creditId: body.id, amount: credit, userId: actor.userId,
      preferred: unpaidOnReceipt > 0 ? [{ goodsReceiptId: receipt.id, amount: Math.min(credit, unpaidOnReceipt) }] : [], leftoverReason: `purchase-return:${body.id}`,
    });
    await applyStandingCredits(tx, receipt.supplierId, actor.userId);
    await writeAudit(tx, { userId: actor.userId, action: "purchaseReturn.create", entityType: "PurchaseReturn", entityId: body.id, after: { receiptId: receipt.id, credit, landedCostLost: lost } });
    return body.id;
  });
  const ret = await db.purchaseReturn.findUniqueOrThrow({ where: { id }, include: { lines: true } });
  return { purchaseReturn: ret, warnings: await warningsFor(db, "PurchaseReturn", id) };
}
