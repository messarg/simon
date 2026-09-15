/**
 * Debtor aging. PRD §10.6, FR-DEBT-05. Measured from the charge date in shop-local time;
 * a due date never moves a charge between buckets.
 */
import { businessDate, daysBetween, type Dram } from "@simon/shared";
import type { DebtEntryInput, Projection } from "./debt-allocation.ts";

export interface AgingBuckets {
  d0_30: Dram;
  d31_60: Dram;
  d61_90: Dram;
  d90plus: Dram;
  oldestChargeDays: number | null;
}

export function age(entries: readonly DebtEntryInput[], projection: Projection, asOf: string, timeZone: string): AgingBuckets {
  const out: AgingBuckets = { d0_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, oldestChargeDays: null };
  const byId = new Map(entries.map((e) => [e.id, e]));
  for (const [id, balance] of projection.chargeBalance) {
    if (balance <= 0) continue;
    const days = daysBetween(businessDate(byId.get(id)!.createdAt, timeZone), asOf);
    if (days <= 30) out.d0_30 += balance;
    else if (days <= 60) out.d31_60 += balance;
    else if (days <= 90) out.d61_90 += balance;
    else out.d90plus += balance;
    out.oldestChargeDays = Math.max(out.oldestChargeDays ?? 0, days);
  }
  return out;
}
