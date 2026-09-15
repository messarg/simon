/**
 * Opening the cash drawer. PRD §15.4, §16.3, §18, FR-DAT-08, §27.37.
 *
 * Free once per document that accounts for cash, and freely while a float is being counted or a
 * shift is closing. Anything else is a no-sale open: admin re-auth, a reason, and a NO_SALE
 * movement. Every open writes an audit row — which is also how the server knows a document has
 * already been spent.
 */
import { businessDate, uuidv7 } from "@simon/shared";
import { decideDrawerOpen, type DrawerDocument } from "../domain/drawer.ts";
import type { Db } from "../lib/db.ts";
import { printer } from "../lib/hardware/printer.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { writeAudit } from "./audit.service.ts";
import { consumeGrant } from "./auth.service.ts";
import type { Actor } from "./sale.service.ts";
import { readSettings } from "./settings.service.ts";

export interface DrawerRequest {
  document?: { type: "Sale" | "SaleReturn" | "CashMovement" | "DebtEntry"; id: string } | null;
  purpose?: "document" | "float" | "close" | "no-sale";
  reauthGrant?: string | null;
  reason?: string | null;
}

export async function openDrawer(db: Db, actor: Actor, req: DrawerRequest) {
  const settings = await readSettings(db);
  const outcome = await db.$transaction(async (tx) => {
    const shift = await tx.shift.findFirst({ where: { userId: actor.userId, status: { in: ["OPEN", "CLOSING"] } } });
    const shiftCounting = (req.purpose === "float" && !shift) || (req.purpose === "close" && shift?.status === "CLOSING");

    let document: DrawerDocument = { kind: "none" };
    let entity = { type: "Shift", id: shift?.id ?? actor.userId };
    if (req.document) {
      const { type, id } = req.document;
      if (type === "Sale") {
        const sale = await tx.sale.findUnique({ where: { id }, include: { payments: true } });
        if (!sale) throw problem("not-found");
        document = { kind: "sale", hasCash: sale.status === "COMPLETED" && sale.payments.some((p) => p.method === "CASH") };
      } else if (type === "SaleReturn") {
        const ret = await tx.saleReturn.findUnique({ where: { id }, include: { tenders: true } });
        if (!ret) throw problem("not-found");
        document = { kind: "return", hasCash: ret.tenders.some((t) => t.method === "CASH") };
      } else if (type === "DebtEntry") {
        const entry = await tx.debtEntry.findUnique({ where: { id } });
        if (!entry) throw problem("not-found");
        const cash = await tx.cashMovement.findFirst({ where: { sourceType: "DebtEntry", sourceId: id, type: "REPAYMENT" } });
        document = { kind: "repayment", hasCash: Boolean(cash) };
      } else {
        const m = await tx.cashMovement.findUnique({ where: { id } });
        if (!m) throw problem("not-found");
        document = ["PAY_IN", "PAY_OUT", "DROP"].includes(m.type) ? { kind: "cash-movement" } : { kind: "none" };
      }
      entity = { type, id };
    }
    const alreadySpent = req.document ? (await tx.auditLog.count({ where: { action: "cashDrawer.open", entityType: entity.type, entityId: entity.id } })) > 0 : false;
    const decision = decideDrawerOpen({ document, alreadySpent, shiftCounting });

    if (decision === "no-sale") {
      const adminId = consumeGrant(req.reauthGrant, "noSaleDrawer");
      if (!adminId) throw problem("reauth-required", { action: "noSaleDrawer" });
      const reason = req.reason?.normalize("NFC").trim();
      if (!reason) throw problem("malformed-request", { field: "reason" });
      if (!shift) throw problem("shift-not-open");
      const id = uuidv7();
      const now = clock.now();
      await tx.cashMovement.create({ data: { id, shiftId: shift.id, businessDate: businessDate(now, settings["shop.timezone"]), type: "NO_SALE", amount: 0, reason, sourceType: "CashMovement", sourceId: id, userId: actor.userId, createdAt: now.toISOString() } });
      await writeAudit(tx, { userId: actor.userId, action: "cashDrawer.open", entityType: "CashMovement", entityId: id, after: { noSale: true, authorisedBy: adminId, reason, document: req.document ?? null } });
      return { decision, noSaleMovementId: id };
    }
    await writeAudit(tx, { userId: actor.userId, action: "cashDrawer.open", entityType: entity.type, entityId: entity.id, after: { purpose: req.purpose ?? "document" } });
    return { decision, noSaleMovementId: null };
  });

  try {
    await printer.get().kick();
  } catch {
    throw problem("internal-error", { component: "drawer" });
  }
  return outcome;
}
