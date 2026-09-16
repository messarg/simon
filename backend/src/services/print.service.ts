/**
 * Receipt and report rendering, always from the stored document, so a reprint is the same call
 * made again (§15.4, §27.37). Printing happens after commit and never pulses the drawer.
 */
import { formatQty, groupDigits, QTY_SCALE } from "@simon/shared";
import type { Db } from "../lib/db.ts";
import { printer } from "../lib/hardware/printer.ts";
import { problem } from "../lib/problem.ts";
import { receiptHy as R } from "../lib/receipt-strings.ts";
import { loadSaleReturn } from "./sale-return.service.ts";
import { loadSale } from "./sale.service.ts";
import { readSettings } from "./settings.service.ts";
import { shiftReport } from "./shift.service.ts";
import { customerProjection } from "./debt.service.ts";

const WIDTH = 32;
const money = (n: number) => groupDigits(n).replace(/\u00a0/g, " ");
const row = (left: string, right: string) => {
  const space = WIDTH - left.length - right.length;
  return space >= 1 ? left + " ".repeat(space) + right : `${left}\n${" ".repeat(Math.max(0, WIDTH - right.length))}${right}`;
};
const rule = "-".repeat(WIDTH);
const when = (iso: string, tz: string) => new Intl.DateTimeFormat("hy-AM", { timeZone: tz, dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

/** ՓՈՐՁՆԱԿԱՆ on both ends, so a practice receipt cannot be mistaken for a real one (§19.4). */
function watermark(lines: string[], practice: boolean) {
  if (!practice) return lines;
  const banner = R.practice.padStart(Math.floor((WIDTH + R.practice.length) / 2)).padEnd(WIDTH);
  return [banner, rule, ...lines, rule, banner];
}

async function send(title: string, lines: string[]) {
  try {
    await printer.get().print(title, lines);
  } catch {
    throw problem("internal-error", { component: "printer" });
  }
  return { printed: true, lines };
}

export async function renderSaleReceipt(db: Db, saleId: string) {
  const settings = await readSettings(db);
  const { sale } = await loadSale(db, saleId);
  if (sale.status !== "COMPLETED") throw problem("illegal-transition", { status: sale.status });
  const lines = [settings["shop.name"], settings["shop.address"], rule, row(`${R.sale} ${sale.number}`, when(sale.completedAt!, settings["shop.timezone"])), `${R.cashier}: ${sale.user.name}`, rule];
  for (const l of sale.lines) {
    lines.push(l.productName);
    lines.push(row(`  ${formatQty(l.qty, l.qty % QTY_SCALE === 0 ? 0 : 3)} ${l.uom} × ${money(l.unitPriceMdram / 1000)}`, money(l.lineTotal)));
    if (l.discountAmount > 0) lines.push(row(`  ${R.discount}${l.discountReason ? ` (${l.discountReason})` : ""}`, `-${money(l.discountAmount)}`));
  }
  lines.push(rule);
  const exclusive = sale.priceBasis === "EXCLUSIVE";
  if (exclusive || sale.discountTotal > 0 || sale.roundingAdjustment !== 0) lines.push(row(R.subtotal, money(sale.subtotal)));
  if (sale.discountTotal > 0) lines.push(row(R.discount, `-${money(sale.discountTotal)}`));
  if (exclusive && sale.taxTotal > 0) lines.push(row(R.tax, money(sale.taxTotal)));
  if (sale.roundingAdjustment !== 0) lines.push(row(R.rounding, money(sale.roundingAdjustment)));
  lines.push(row(R.total, money(sale.total)));
  if (!exclusive && sale.taxTotal > 0) lines.push(row(R.taxIncluded, money(sale.taxTotal)));
  lines.push(rule);
  for (const p of sale.payments) {
    lines.push(row(p.method === "CASH" ? R.cash : p.method === "CARD" ? R.card : R.debt, money(p.amount)));
    if (p.method === "CASH" && p.tenderedAmount !== null && p.changeGiven) {
      lines.push(row(`  ${R.tendered}`, money(p.tenderedAmount)));
      lines.push(row(`  ${R.change}`, money(p.changeGiven)));
    }
  }
  return lines;
}

export async function printSaleReceipt(db: Db, saleId: string, opts: { practice?: boolean } = {}) {
  return send(`sale-${saleId}`, watermark(await renderSaleReceipt(db, saleId), Boolean(opts.practice)));
}

export async function printReturnReceipt(db: Db, returnId: string, opts: { practice?: boolean } = {}) {
  const settings = await readSettings(db);
  const { saleReturn } = await loadSaleReturn(db, returnId);
  const lines = [settings["shop.name"], rule, row(`${R.return}${saleReturn.originalSale?.number ? ` ← ${saleReturn.originalSale.number}` : ""}`, when(saleReturn.createdAt, settings["shop.timezone"])), rule];
  for (const t of saleReturn.tenders) lines.push(row(t.method === "CASH" ? R.cash : t.method === "CARD" ? R.card : R.debt, `-${money(t.amount)}`));
  lines.push(row(R.total, `-${money(saleReturn.total)}`));
  return send(`return-${returnId}`, watermark(lines, Boolean(opts.practice)));
}

export async function printRepaymentReceipt(db: Db, paymentId: string) {
  const settings = await readSettings(db);
  const entry = await db.debtEntry.findUnique({ where: { id: paymentId }, include: { customer: true, user: { select: { name: true } } } });
  if (!entry || entry.type !== "PAYMENT") throw problem("not-found");
  const { outstanding } = await customerProjection(db, entry.customerId);
  const lines = [settings["shop.name"], rule, row(R.repayment, when(entry.createdAt, settings["shop.timezone"])), `${R.customer}: ${entry.customer.fullName ?? "—"}`, `${R.cashier}: ${entry.user.name}`, rule,
    row(entry.method === "CARD" ? R.card : R.cash, money(entry.amount)), rule,
    outstanding >= 0 ? row(R.remaining, money(outstanding)) : row(R.credit, money(-outstanding))];
  return send(`repayment-${paymentId}`, lines);
}

export async function printShiftReport(db: Db, shiftId: string, opts: { practice?: boolean } = {}) {
  const settings = await readSettings(db);
  const r = await shiftReport(db, shiftId);
  const f = r.figures;
  const lines = [settings["shop.name"], r.kind === "Z" ? R.zReport : R.xReport, `${R.cashier}: ${r.shift.userName}`, when(r.shift.openedAt, settings["shop.timezone"]), rule,
    row(R.openingFloat, money(f.openingFloat)), row(`+ ${R.cashSales}`, money(f.cashSales)), row(`+ ${R.repayments}`, money(f.repayments)),
    row(`+ ${R.payIns}`, money(f.payIns)), row(`- ${R.refunds}`, money(f.refunds)), row(`- ${R.payOuts}`, money(f.payOuts)), row(`- ${R.drops}`, money(f.drops)),
    rule, row(R.expected, money(f.expected)), row(R.cardSales, money(f.cardSales))];
  if (r.counted !== null) lines.push(row(R.counted, money(r.counted)), row(R.variance, money(r.variance ?? 0)));
  for (const l of r.lateArrivals) lines.push(row(`${l.amount >= 0 ? "+" : ""}${money(l.amount)}`, R.lateArrival));
  for (const t of r.transfers) lines.push(row(t.direction === "in" ? R.transferIn : R.transferOut, t.saleId.slice(-6)));
  return send(`${r.kind}-${shiftId}`, watermark(lines, Boolean(opts.practice)));
}
