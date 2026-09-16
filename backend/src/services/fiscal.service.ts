/**
 * Issuing fiscal receipts. PRD §17, §19.4.
 *
 * After a sale commits, never inside its transaction (§13.1: no I/O in a transaction), and never
 * in practice mode — a practice sale is not a sale. A failure leaves the sale sold and the receipt
 * pending; pending sales are retried by a job and counted in diagnostics, so a device that stopped
 * answering is noticed rather than silently skipped.
 *
 * Whether a sale may complete at all while the device is down is a legal question (§17 item 1).
 * This implementation assumes it may — rule 1, a completed sale is never lost — and says so.
 */
import type { Db } from "../lib/db.ts";
import { fiscal, type FiscalDocument } from "../lib/hardware/fiscal.ts";
import { logger } from "../lib/logger.ts";
import { clock } from "../lib/time.ts";
import { readSettings, writeSettings } from "./settings.service.ts";

/**
 * The day fiscal receipts began. Turning a device on must not fiscalise years of history, so the
 * first start with a device records the moment (backend/src/index.ts calls this at startup), and
 * only sales after it are owed a receipt. Recording it lazily, at the first issue, would skip the
 * very sale that triggered it.
 */
export async function fiscalSince(db: Db): Promise<string | null> {
  if (!fiscal.get().enabled) return null;
  const since = (await readSettings(db))["fiscal.since"];
  if (since) return since;
  const now = clock.iso();
  await db.$transaction((tx) => writeSettings(tx, { "fiscal.since": now }, null));
  return now;
}

export async function issueFiscalReceipt(db: Db, saleId: string): Promise<string | null> {
  const device = fiscal.get();
  if (!device.enabled) return null;
  const sale = await db.sale.findUnique({ where: { id: saleId }, include: { lines: { orderBy: { id: "asc" } }, payments: true } });
  if (!sale || sale.status !== "COMPLETED") return null;
  if (sale.fiscalReceiptId) return sale.fiscalReceiptId;
  const since = await fiscalSince(db);
  if (!since || (sale.completedAt ?? sale.createdAt) < since) return null;
  const doc: FiscalDocument = {
    saleId: sale.id, number: sale.number, completedAt: sale.completedAt ?? sale.createdAt, priceBasis: sale.priceBasis,
    lines: sale.lines.map((l) => ({ name: l.productName, qty: l.qty, uom: l.uom, unitPriceMdram: l.unitPriceMdram, lineTotal: l.lineTotal, taxRateBp: l.taxRateBp, lineTax: l.lineTax })),
    discountTotal: sale.discountTotal, taxTotal: sale.taxTotal, total: sale.total,
    payments: sale.payments.map((p) => ({ method: p.method, amount: p.amount })),
  };
  try {
    const { receiptId } = await device.issue(doc);
    // Written only if still empty, so a retry racing the first call cannot issue a second number.
    const updated = await db.sale.updateMany({ where: { id: saleId, fiscalReceiptId: null }, data: { fiscalReceiptId: receiptId } });
    return updated.count ? receiptId : (await db.sale.findUniqueOrThrow({ where: { id: saleId } })).fiscalReceiptId;
  } catch (err) {
    logger.error({ err, saleId }, "fiscal receipt failed");
    return null;
  }
}

/** Completed sales still waiting for a fiscal receipt, oldest first. */
export async function pendingFiscal(db: Db, limit = 50) {
  const since = await fiscalSince(db);
  if (!since) return [];
  return db.sale.findMany({
    where: { status: "COMPLETED", fiscalReceiptId: null, completedAt: { gte: since } },
    orderBy: { completedAt: "asc" }, take: limit, select: { id: true, completedAt: true },
  });
}

export async function retryPendingFiscal(db: Db) {
  let issued = 0;
  for (const s of await pendingFiscal(db)) if (await issueFiscalReceipt(db, s.id)) issued++;
  return issued;
}
