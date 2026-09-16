/**
 * Margin, as booked and restated. PRD §10.5, §20.2, §27.4, §27.29, §27.33.
 *
 * As booked uses the cost snapshotted on each sale line and never changes. Restated replays the
 * product's ledger with every correction's right cost in place of the wrong one, and reads the
 * average each sale would have carried. Sale lines are never edited; a line whose cost was never
 * known reports no margin at all rather than 100%.
 */
import { apportionByValue, lineTotal, roundHalfUp, uuidv7 } from "@simon/shared";
import { applyMovement, widenBand, type CostBand, type StockState } from "../domain/costing.ts";
import type { Db } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { writeAudit } from "./audit.service.ts";

export async function correctCost(db: Db, adminId: string, body: { id: string; goodsReceiptLineId: string; correctUnitCostMdram: number; reason: string }) {
  return db.$transaction(async (tx) => {
    const existing = await tx.costCorrection.findUnique({ where: { id: body.id } });
    if (existing) return existing;
    const line = await tx.goodsReceiptLine.findUnique({ where: { id: body.goodsReceiptLineId }, include: { receipt: true } });
    if (!line) throw problem("not-found");
    if (line.invoiceUnitCostMdram === body.correctUnitCostMdram) throw problem("malformed-request", { field: "correctUnitCostMdram" });
    const now = clock.iso();
    const c = await tx.costCorrection.create({
      data: { id: body.id, goodsReceiptLineId: line.id, wrongUnitCostMdram: line.invoiceUnitCostMdram, correctUnitCostMdram: body.correctUnitCostMdram, affectedFrom: line.receipt.receivedAt, affectedTo: now, reason: body.reason.normalize("NFC"), userId: adminId, createdAt: now },
    });
    await writeAudit(tx, { userId: adminId, action: "cost.correction", entityType: "GoodsReceiptLine", entityId: line.id, before: { invoiceUnitCostMdram: line.invoiceUnitCostMdram }, after: { correctUnitCostMdram: body.correctUnitCostMdram, correctionId: c.id } });
    return c;
  });
}

interface ProductMargin {
  productId: string; productName: string; uom: string; decimalPlaces: number; qtySold: number;
  netRevenue: number; revenueWithoutCost: number;
  cogsBooked: number; cogsRestated: number; marginBooked: number | null; marginRestated: number | null;
  corrections: Array<{ id: string; reason: string; wrongUnitCostMdram: number; correctUnitCostMdram: number }>;
}

/** Restated cost per stock unit for each (sale, product) sold between the correction's bounds. */
async function restatedSaleCosts(db: Db, productId: string, corrections: Array<{ goodsReceiptLineId: string; correctUnitCostMdram: number; affectedFrom: string; affectedTo: string }>) {
  const lines = await db.goodsReceiptLine.findMany({ where: { id: { in: corrections.map((c) => c.goodsReceiptLineId) } } });
  const corrected = new Map<string, number>();
  for (const c of corrections) {
    const l = lines.find((x) => x.id === c.goodsReceiptLineId)!;
    const freightPerUnit = l.landedUnitCostMdram - l.invoiceUnitCostMdram;
    corrected.set(l.receiptId, roundHalfUp(c.correctUnitCostMdram + freightPerUnit, l.factorToStockUom));
  }
  const rows = await db.stockMovement.findMany({ where: { productId }, orderBy: { seq: "asc" } });
  let state: StockState = { stockQty: 0, avgCostMdram: null };
  let band: CostBand | null = null;
  const out = new Map<string, number | null>();
  for (const r of rows) {
    const cost = r.type === "PURCHASE_RECEIPT" && r.sourceType === "GoodsReceipt" && corrected.has(r.sourceId) ? corrected.get(r.sourceId)! : r.type === "SALE" || r.type === "WRITE_OFF" || r.type === "ADJUSTMENT" ? state.avgCostMdram : r.unitCostMdram;
    if (r.type === "SALE" && r.sourceType === "Sale") out.set(r.sourceId, state.avgCostMdram);
    const input = { type: r.type as "SALE", qtyDelta: r.qtyDelta, unitCostMdram: cost };
    state = applyMovement(state, input, band ?? undefined);
    band = widenBand(band, input);
  }
  return out;
}

export async function marginReport(db: Db, from: string, to: string) {
  const sales = await db.sale.findMany({ where: { status: "COMPLETED", businessDate: { gte: from, lte: to } }, include: { lines: { orderBy: { id: "asc" } } } });
  const products = new Map((await db.product.findMany({ select: { id: true, name: true, stockUom: true, decimalPlaces: true } })).map((p) => [p.id, p]));
  const allCorrections = await db.costCorrection.findMany({ include: { receiptLine: { select: { productId: true } } } });
  const correctionsByProduct = new Map<string, typeof allCorrections>();
  for (const c of allCorrections) correctionsByProduct.set(c.receiptLine.productId, [...(correctionsByProduct.get(c.receiptLine.productId) ?? []), c]);
  const restated = new Map<string, Map<string, number | null>>();
  for (const [productId, cs] of correctionsByProduct) restated.set(productId, await restatedSaleCosts(db, productId, cs));

  const rows = new Map<string, ProductMargin>();
  for (const sale of sales) {
    const shares = apportionByValue(sale.lines.map((l) => l.lineTotal), sale.discountTotal);
    for (const [i, l] of sale.lines.entries()) {
      const product = products.get(l.productId);
      const row = rows.get(l.productId) ?? {
        productId: l.productId, productName: product?.name ?? l.productName, uom: product?.stockUom ?? l.uom, decimalPlaces: product?.decimalPlaces ?? 0, qtySold: 0, netRevenue: 0, revenueWithoutCost: 0, cogsBooked: 0, cogsRestated: 0, marginBooked: null, marginRestated: null,
        corrections: (correctionsByProduct.get(l.productId) ?? []).map((c) => ({ id: c.id, reason: c.reason, wrongUnitCostMdram: c.wrongUnitCostMdram, correctUnitCostMdram: c.correctUnitCostMdram })),
      };
      const net = l.lineTotal - shares[i] - (sale.priceBasis === "INCLUSIVE" ? l.lineTax : 0);
      row.qtySold += l.qty * l.factorToStockUom;
      if (l.unitCostMdram === null) {
        row.revenueWithoutCost += net;
      } else {
        row.netRevenue += net;
        const booked = lineTotal(l.qty, l.unitCostMdram);
        row.cogsBooked += booked;
        const perStock = restated.get(l.productId)?.get(sale.id);
        row.cogsRestated += perStock === undefined || perStock === null ? booked : lineTotal(l.qty, perStock * l.factorToStockUom);
      }
      rows.set(l.productId, row);
    }
  }
  const items = [...rows.values()].map((r) => ({
    ...r,
    marginBooked: r.netRevenue > 0 || r.cogsBooked > 0 ? r.netRevenue - r.cogsBooked : null,
    marginRestated: r.netRevenue > 0 || r.cogsRestated > 0 ? r.netRevenue - r.cogsRestated : null,
  }));
  const sum = (k: "netRevenue" | "revenueWithoutCost" | "cogsBooked" | "cogsRestated") => items.reduce((a, r) => a + r[k], 0);
  return {
    from, to, items,
    totals: { netRevenue: sum("netRevenue"), revenueWithoutCost: sum("revenueWithoutCost"), cogsBooked: sum("cogsBooked"), cogsRestated: sum("cogsRestated"), marginBooked: sum("netRevenue") - sum("cogsBooked"), marginRestated: sum("netRevenue") - sum("cogsRestated") },
  };
}

export const newCorrectionId = () => uuidv7();
