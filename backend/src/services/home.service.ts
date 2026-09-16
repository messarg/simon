/**
 * Owner home. PRD §6.9: "how did today go?", answered in five seconds from the doorway, and every
 * figure tappable to the events behind it — the drill-downs are the reports and the ledgers that
 * already exist, so nothing here is a second source of truth.
 */
import { businessDate } from "@simon/shared";
import type { Db } from "../lib/db.ts";
import { clock } from "../lib/time.ts";
import { allProjections } from "./debt.service.ts";
import { systemAlerts } from "./diagnostics.service.ts";
import { marginReport } from "./margin.service.ts";
import { readSettings } from "./settings.service.ts";
import { productStatuses } from "./stock-status.service.ts";
import { supplierBooks } from "./supplier.service.ts";

export async function ownerHome(db: Db) {
  const settings = await readSettings(db);
  const today = businessDate(clock.now(), settings["shop.timezone"]);

  const [sales, returns, margin, projections, suppliers, statuses, openFlags] = await Promise.all([
    db.sale.aggregate({ where: { status: "COMPLETED", businessDate: today }, _sum: { total: true }, _count: true }),
    db.saleReturn.aggregate({ where: { businessDate: today }, _sum: { total: true } }),
    marginReport(db, today, today),
    allProjections(db),
    db.supplier.findMany({ where: { isActive: 1 }, select: { id: true } }),
    productStatuses(db),
    db.reviewFlag.count({ where: { resolvedAt: null } }),
  ]);

  const takings = sales._sum.total ?? 0;
  const debtors = [...projections.values()].filter((p) => p.outstanding > 0);
  let payable = 0;
  let overdue = 0;
  for (const s of suppliers) {
    const books = await supplierBooks(db, s.id);
    payable += Math.max(0, books.outstanding);
    overdue += books.overdue;
  }
  const stock = [...statuses.values()];

  return {
    businessDate: today,
    today: {
      takings,
      salesCount: sales._count,
      averageSale: sales._count ? Math.round(takings / sales._count) : 0,
      returns: returns._sum.total ?? 0,
      profit: margin.totals.marginBooked,
      revenueWithoutCost: margin.totals.revenueWithoutCost,
    },
    receivables: {
      outstanding: debtors.reduce((a, p) => a + p.outstanding, 0),
      customers: debtors.length,
      over90: debtors.reduce((a, p) => a + p.buckets.d90plus, 0),
      overdue: debtors.reduce((a, p) => a + p.overdue, 0),
    },
    payables: { outstanding: payable, overdue },
    stock: { low: stock.filter((s) => s.low).length, dead: stock.filter((s) => s.dead).length },
    attention: { openFlags },
    alerts: await systemAlerts(db),
  };
}
