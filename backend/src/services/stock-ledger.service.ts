/**
 * Posting to the stock ledger. PRD §10.4, §11 `StockMovement`.
 *
 * Always called inside the caller's document transaction. Assigns the next `seq`, computes
 * `balanceAfter`, and reprojects `Product.stockQty` and `avgCostMdram` with the same
 * `applyMovement` the replay uses — so a replay reproduces what was written.
 */
import { uuidv7, type MilliDram, type MilliUnit, type MovementType, type WriteOffReason } from "@simon/shared";
import { AVERAGE_MOVING_TYPES, applyMovement, hitNegativeStockGuard, type CostBand } from "../domain/costing.ts";
import type { Tx } from "../lib/db.ts";
import { clock } from "../lib/time.ts";

export interface PostMovement {
  productId: string;
  type: MovementType;
  qtyDelta: MilliUnit;
  /** Required for PURCHASE_RECEIPT/PURCHASE_RETURN; SALE_RETURN/OPENING_BALANCE carry their own; ignored (average copied) otherwise. */
  unitCostMdram?: MilliDram | null;
  /** Omitted for ADJUSTMENT and WRITE_OFF, which are their own source (§11). */
  source?: { type: string; id: string };
  userId: string;
  reasonCode?: WriteOffReason | null;
  note?: string;
  band?: CostBand;
}

export async function postMovement(tx: Tx, m: PostMovement) {
  const product = await tx.product.findUniqueOrThrow({ where: { id: m.productId }, select: { stockQty: true, avgCostMdram: true } });
  const last = await tx.stockMovement.findFirst({ orderBy: { seq: "desc" }, select: { seq: true } });
  const seq = (last?.seq ?? 0) + 1;
  const state = { stockQty: product.stockQty, avgCostMdram: product.avgCostMdram };
  const ownCost = AVERAGE_MOVING_TYPES.has(m.type);
  const unitCostMdram = ownCost ? (m.unitCostMdram ?? null) : state.avgCostMdram;
  const next = applyMovement(state, { type: m.type, qtyDelta: m.qtyDelta, unitCostMdram }, m.band);
  const id = uuidv7();
  const selfSourced = m.type === "ADJUSTMENT" || m.type === "WRITE_OFF";
  if (!selfSourced && !m.source) throw new Error(`a ${m.type} movement must name its source document`);
  const now = clock.iso();

  const movement = await tx.stockMovement.create({
    data: {
      id, productId: m.productId, seq, type: m.type, qtyDelta: m.qtyDelta, unitCostMdram,
      balanceAfter: next.stockQty,
      sourceType: selfSourced ? "StockMovement" : m.source!.type,
      sourceId: selfSourced ? id : m.source!.id,
      userId: m.userId, locationId: null,
      reasonCode: m.type === "WRITE_OFF" ? (m.reasonCode ?? null) : null,
      note: m.note?.normalize("NFC") ?? "", createdAt: now,
    },
  });
  await tx.product.update({ where: { id: m.productId }, data: { stockQty: next.stockQty, avgCostMdram: next.avgCostMdram, updatedAt: now } });
  return { movement, before: state, after: next, negativeGuard: hitNegativeStockGuard(state, { type: m.type, qtyDelta: m.qtyDelta, unitCostMdram }) };
}
