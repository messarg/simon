/**
 * Payables aged against agreed terms. PRD §20.2, §13.8.
 *
 * Bands count from the day the terms ran out, not from the receipt date: not yet due, 1–30,
 * 31–60, 61–90, 90+ days past term. Day 60 sits in exactly one band.
 */
import type { Dram } from "@simon/shared";

export interface PayablesBuckets {
  notYetDue: Dram;
  d1_30: Dram;
  d31_60: Dram;
  d61_90: Dram;
  d90plus: Dram;
}

export function payablesBand(daysPastDue: number): keyof PayablesBuckets {
  if (daysPastDue <= 0) return "notYetDue";
  if (daysPastDue <= 30) return "d1_30";
  if (daysPastDue <= 60) return "d31_60";
  if (daysPastDue <= 90) return "d61_90";
  return "d90plus";
}

export function agePayables(receipts: ReadonlyArray<{ unpaid: Dram; daysPastDue: number }>): PayablesBuckets {
  const out: PayablesBuckets = { notYetDue: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
  for (const r of receipts) if (r.unpaid > 0) out[payablesBand(r.daysPastDue)] += r.unpaid;
  return out;
}
