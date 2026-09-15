/**
 * Ledger-vs-cache drift. PRD §10.4, §27.43. Reports drift as a LEDGER_CACHE_DRIFT flag and
 * never repairs it — a mismatch means a bug worth finding. Runs outside any document
 * transaction, one product at a time, so it never holds the single writer for long.
 */
import { uuidv7 } from "@simon/shared";
import { detectDrift } from "../domain/stock-replay.ts";
import type { Db } from "../lib/db.ts";
import { clock } from "../lib/time.ts";

export async function runStockDriftCheck(db: Db) {
  const products = await db.product.findMany({ select: { id: true, stockQty: true, avgCostMdram: true } });
  let flagged = 0;
  for (const p of products) {
    const rows = await db.stockMovement.findMany({ where: { productId: p.id }, orderBy: { seq: "asc" }, select: { seq: true, type: true, qtyDelta: true, unitCostMdram: true } });
    const drift = detectDrift({ stockQty: p.stockQty, avgCostMdram: p.avgCostMdram }, rows.map((r) => ({ ...r, type: r.type as never })));
    if (drift.length === 0) continue;
    const open = await db.reviewFlag.findFirst({ where: { type: "LEDGER_CACHE_DRIFT", productId: p.id, resolvedAt: null } });
    if (open) continue;
    await db.reviewFlag.create({
      data: { id: uuidv7(), type: "LEDGER_CACHE_DRIFT", sourceType: "Product", sourceId: p.id, productId: p.id, note: JSON.stringify(drift), createdAt: clock.iso() },
    });
    flagged++;
  }
  return { checked: products.length, flagged };
}
