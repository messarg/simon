/**
 * Sales velocity. PRD §11 `ProductStats`, §13.3, §6.1.
 *
 * A rebuildable cache over the stock ledger: net units sold per day over thirty days, and when
 * each product last sold. Four screens read it and none can afford to derive it live. A product
 * whose velocity changed is touched, so tills pick up the new tile order on their next `?since=` sync.
 */
import { businessDate, daysBetween } from "@simon/shared";
import { dailyVelocity, VELOCITY_WINDOW_DAYS } from "../domain/reorder.ts";
import type { Db } from "../lib/db.ts";
import { clock } from "../lib/time.ts";
import { readSettings } from "../services/settings.service.ts";

export async function runProductStats(db: Db) {
  const settings = await readSettings(db);
  const tz = settings["shop.timezone"];
  const now = clock.now();
  const iso = now.toISOString();
  const today = businessDate(now, tz);
  const since = new Date(now.getTime() - VELOCITY_WINDOW_DAYS * 86_400_000).toISOString();

  const [window, lastSale, products] = await Promise.all([
    db.stockMovement.groupBy({ by: ["productId", "type"], where: { type: { in: ["SALE", "SALE_RETURN"] }, createdAt: { gte: since } }, _sum: { qtyDelta: true } }),
    db.stockMovement.groupBy({ by: ["productId"], where: { type: "SALE" }, _max: { createdAt: true } }),
    db.product.findMany({ select: { id: true, stats: true } }),
  ]);
  const sold = new Map<string, number>();
  // A sale's movement is negative and a customer return's positive: units sold is the negation of their sum.
  for (const row of window) sold.set(row.productId, (sold.get(row.productId) ?? 0) - (row._sum.qtyDelta ?? 0));
  const last = new Map(lastSale.map((r) => [r.productId, r._max.createdAt]));

  let changed = 0;
  for (const p of products) {
    const avgDailyQty30d = dailyVelocity(sold.get(p.id) ?? 0);
    const lastSoldAt = last.get(p.id) ?? null;
    const daysSinceLastSale = lastSoldAt ? daysBetween(businessDate(lastSoldAt, tz), today) : null;
    const data = { avgDailyQty30d, lastSoldAt, daysSinceLastSale, computedAt: iso };
    await db.productStats.upsert({ where: { productId: p.id }, create: { productId: p.id, ...data }, update: data });
    if ((p.stats?.avgDailyQty30d ?? 0) !== avgDailyQty30d) {
      await db.product.update({ where: { id: p.id }, data: { updatedAt: iso } });
      changed++;
    }
  }
  return { computed: products.length, changed };
}
