/**
 * Write-offs and stock adjustments. PRD §13.5, §16.3, §10.7.
 *
 * A write-off carries a coded reason, never free text alone. An adjustment needs an admin's PIN
 * and a reason, and is audited. Both are self-sourced movements, idempotent on their client id.
 */
import type { Db } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { writeAudit } from "./audit.service.ts";
import { consumeGrant } from "./auth.service.ts";
import type { Actor } from "./sale.service.ts";
import { postMovement } from "./stock-ledger.service.ts";

export async function writeOff(db: Db, actor: Actor, body: { id: string; productId: string; qty: number; reasonCode: "DAMAGE" | "EXPIRY" | "THEFT" | "INTERNAL_USE" | "SAMPLE"; note?: string }) {
  return db.$transaction(async (tx) => {
    const existing = await tx.stockMovement.findUnique({ where: { id: body.id } });
    if (existing) return existing;
    const p = await tx.product.findUnique({ where: { id: body.productId } });
    if (!p) throw problem("not-found");
    if (body.qty % 10 ** (3 - p.decimalPlaces) !== 0) throw problem("malformed-request", { field: "qty" });
    const posted = await postMovement(tx, { id: body.id, productId: p.id, type: "WRITE_OFF", qtyDelta: -body.qty, reasonCode: body.reasonCode, note: body.note, userId: actor.userId });
    await writeAudit(tx, { userId: actor.userId, action: "stock.writeOff", entityType: "StockMovement", entityId: body.id, after: { productId: p.id, qty: body.qty, reasonCode: body.reasonCode } });
    return posted.movement;
  });
}

export async function adjustStock(db: Db, actor: Actor, body: { id: string; productId: string; qtyDelta: number; note?: string; reauthGrant: string; reason: string }) {
  const adminId = consumeGrant(body.reauthGrant, "stockAdjustment");
  if (!adminId) throw problem("reauth-required", { action: "stockAdjustment" });
  return db.$transaction(async (tx) => {
    const existing = await tx.stockMovement.findUnique({ where: { id: body.id } });
    if (existing) return existing;
    const p = await tx.product.findUnique({ where: { id: body.productId } });
    if (!p) throw problem("not-found");
    if (Math.abs(body.qtyDelta) % 10 ** (3 - p.decimalPlaces) !== 0) throw problem("malformed-request", { field: "qtyDelta" });
    const posted = await postMovement(tx, { id: body.id, productId: p.id, type: "ADJUSTMENT", qtyDelta: body.qtyDelta, note: body.note, userId: actor.userId });
    await writeAudit(tx, { userId: actor.userId, action: "stock.adjustment", entityType: "StockMovement", entityId: body.id, before: { stockQty: posted.before.stockQty }, after: { stockQty: posted.after.stockQty, authorisedBy: adminId }, reason: body.reason });
    return posted.movement;
  });
}
