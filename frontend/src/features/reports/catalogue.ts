/**
 * The report catalogue, in §20.2's order. The PRD lists it once and so does this file: adding a
 * report here is what puts it on the screen, with its own one-line explanation of what it answers.
 */
import { BookUser, Coins, FileClock, HandCoins, LineChart, PackageSearch, Percent, ReceiptText, Scale, ShieldCheck, Trash2, Truck, Undo2, type LucideIcon } from "lucide-react";
import type { ReportName } from "./types.ts";

export interface ReportEntry {
  name: ReportName;
  icon: LucideIcon;
  /** Groupings the report accepts, first one default. */
  groupings?: readonly string[];
  /** Needs a product chosen before it can run. */
  needsProduct?: boolean;
  /** Reads a period; the rest are "as things stand now". */
  period: boolean;
}

export const REPORTS: readonly ReportEntry[] = [
  { name: "sales", icon: ReceiptText, groupings: ["day", "product", "category", "worker", "sale"], period: true },
  { name: "margin", icon: LineChart, period: true },
  { name: "valuation", icon: Scale, period: true },
  { name: "debtor-aging", icon: BookUser, period: false },
  { name: "payables-aging", icon: Truck, period: false },
  { name: "stock-turnover", icon: PackageSearch, period: false },
  { name: "write-offs", icon: Trash2, period: true },
  { name: "cash-out", icon: HandCoins, period: true },
  { name: "discounts", icon: Percent, period: true },
  { name: "voids-returns", icon: Undo2, period: true },
  { name: "z-reports", icon: Coins, period: true },
  { name: "item-history", icon: FileClock, needsProduct: true, period: false },
  { name: "audit", icon: ShieldCheck, period: true },
];

export const reportEntry = (name: string) => REPORTS.find((r) => r.name === name);
