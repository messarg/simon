/**
 * Audit trail. PRD §10.7, §11 `AuditLog`, §27.41.
 *
 * Written inside the transaction of the thing it records. `reason` is required for the
 * actions a person had to justify, and refused elsewhere.
 */
import { uuidv7 } from "@simon/shared";
import type { Tx } from "../lib/db.ts";
import { clock } from "../lib/time.ts";

export const AUDITED_ACTIONS = [
  "product.priceChange", "sale.linePriceOverride", "stock.adjustment", "sale.discountAboveCap",
  "debt.creditLimitOverride", "sale.void", "sale.return", "sale.blindReturn", "debt.repaymentReversal",
  "sale.heldTransfer", "cashDrawer.open", "user.permissionChange", "user.create", "session.revoke",
  "device.deactivate", "settings.update", "session.practiceEnter", "session.practiceExit", "auth.unlock", "auth.recover", "cashMovement.create", "cashMovement.reverse",
  "customer.update", "customer.merge", "customer.erase", "debt.payment",
  "supplier.update", "supplier.payment", "supplier.paymentReversal", "stock.writeOff", "cost.correction", "goodsReceipt.create", "purchaseReturn.create",
] as const;
export type AuditAction = (typeof AUDITED_ACTIONS)[number];

export const REASON_REQUIRED: ReadonlySet<AuditAction> = new Set([
  "sale.linePriceOverride", "debt.creditLimitOverride", "sale.discountAboveCap", "sale.blindReturn", "debt.repaymentReversal", "stock.adjustment",
]);

export interface AuditInput {
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

export async function writeAudit(tx: Tx, a: AuditInput) {
  const reason = a.reason?.normalize("NFC").trim() || null;
  if (REASON_REQUIRED.has(a.action) && !reason) throw new Error(`audit ${a.action} requires a reason`);
  return tx.auditLog.create({
    data: {
      id: uuidv7(), userId: a.userId, action: a.action, entityType: a.entityType, entityId: a.entityId,
      before: a.before === undefined ? null : JSON.stringify(a.before),
      after: a.after === undefined ? null : JSON.stringify(a.after),
      reason: REASON_REQUIRED.has(a.action) ? reason : null,
      createdAt: clock.iso(),
    },
  });
}
