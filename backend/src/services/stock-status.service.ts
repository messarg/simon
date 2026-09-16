/**
 * Low stock, dead stock and the reorder suggestion, per product. PRD §13.3, §6.9, §6.12.
 *
 * The supplier whose lead time counts is the product's default supplier, else the one that last
 * delivered it. With neither, the lead time is zero and the suggestion covers the safety days alone.
 */
import { businessDate, daysBetween } from "@simon/shared";
import { stockStatus, type StockStatus } from "../domain/reorder.ts";
import type { Db } from "../lib/db.ts";
import { clock } from "../lib/time.ts";
import { readSettings } from "./settings.service.ts";

export interface ProductStockStatus extends StockStatus {
  productId: string;
  avgDailyQty30d: number;
  daysSinceLastSale: number | null;
  lastSoldAt: string | null;
  leadTimeDays: number;
  safetyDays: number;
  supplierName: string | null;
}

export async function productStatuses(db: Db, productIds?: readonly string[]) {
  const settings = await readSettings(db);
  const tz = settings["shop.timezone"];
  const safetyDays = settings["reorder.safetyDays"];
  const today = businessDate(clock.now(), tz);
  const where = productIds ? { id: { in: [...productIds] } } : {};
  const [products, suppliers, lastReceipts] = await Promise.all([
    db.product.findMany({ where, select: { id: true, stockQty: true, reorderPoint: true, trackStock: true, isActive: true, createdAt: true, defaultSupplierId: true, stats: true } }),
    db.supplier.findMany({ select: { id: true, name: true, leadTimeDays: true } }),
    db.goodsReceiptLine.findMany({ where: productIds ? { productId: { in: [...productIds] } } : {}, select: { productId: true, receipt: { select: { supplierId: true, receivedAt: true } } }, orderBy: { receipt: { receivedAt: "desc" } } }),
  ]);
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const lastSupplier = new Map<string, string>();
  for (const l of lastReceipts) if (!lastSupplier.has(l.productId)) lastSupplier.set(l.productId, l.receipt.supplierId);

  const out = new Map<string, ProductStockStatus>();
  for (const p of products) {
    const supplier = supplierById.get(p.defaultSupplierId ?? lastSupplier.get(p.id) ?? "");
    const leadTimeDays = supplier?.leadTimeDays ?? 0;
    const avgDailyQty30d = p.stats?.avgDailyQty30d ?? 0;
    const daysSinceLastSale = p.stats?.daysSinceLastSale ?? null;
    const status = stockStatus({
      trackStock: p.trackStock === 1, isActive: p.isActive === 1, stockQty: p.stockQty, reorderPoint: p.reorderPoint,
      avgDailyQty30d, daysSinceLastSale, ageDays: daysBetween(businessDate(p.createdAt, tz), today),
    }, leadTimeDays, safetyDays);
    out.set(p.id, { productId: p.id, ...status, avgDailyQty30d, daysSinceLastSale, lastSoldAt: p.stats?.lastSoldAt ?? null, leadTimeDays, safetyDays, supplierName: supplier?.name ?? null });
  }
  return out;
}
