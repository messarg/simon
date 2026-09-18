/** The shape every report returns (§20.2). One shape, so one screen renders every one of them. */
export type ReportName =
  | "sales" | "margin" | "valuation" | "debtor-aging" | "payables-aging" | "item-history"
  | "z-reports" | "discounts" | "write-offs" | "stock-turnover" | "voids-returns" | "cash-out" | "audit"
  // The two §20.2 added for §6.11.1: the same rows grouped by whose hand, not by what or why.
  | "movements-by-person" | "cash-out-by-person";

export interface ReportColumn {
  key: string;
  kind: "text" | "code" | "money" | "qty" | "int" | "date" | "datetime" | "days" | "percent";
  codeSet?: string;
}

export interface ReportResult {
  name: ReportName;
  from: string;
  to: string;
  groupBy?: string;
  columns: ReportColumn[];
  rows: Array<Record<string, unknown>>;
  totals?: Record<string, number | null>;
  notes?: Array<{ key: string; vars?: Record<string, string | number> }>;
}
