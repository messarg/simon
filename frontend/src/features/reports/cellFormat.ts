/** How a report cell reads as text: the screen and the CSV must say the same thing (§6.10). */
import { hy } from "@/i18n/hy.ts";
import { t, type StringKey } from "@/i18n/t.ts";
import { dateTime, qty as formatQty } from "@/lib/format.ts";
import type { ReportColumn } from "./types.ts";

const CODE_TABLES: Record<string, Record<string, string>> = {
  writeOff: hy.stockOps.reasons as Record<string, string>,
  cashReason: hy.reports.cashReasons as Record<string, string>,
  history: { ...(hy.stock.types as Record<string, string>), ...(hy.reports.actions as Record<string, string>) },
  audit: hy.reports.actions as Record<string, string>,
};

export function codeLabel(codeSet: string | undefined, code: unknown): string {
  const value = String(code ?? "");
  return (codeSet && CODE_TABLES[codeSet]?.[value]) || value;
}

export function cellText(column: ReportColumn, row: Record<string, unknown>): string {
  const value = row[column.key];
  if (value === null || value === undefined || value === "") return "";
  switch (column.kind) {
    case "money": return String(value);
    case "qty": return formatQty(Number(value), Number(row.decimalPlaces ?? 3));
    case "code": return codeLabel(column.codeSet, value);
    case "date": return String(value);
    case "datetime": return dateTime(String(value));
    case "percent": return `${(Number(value) / 100).toFixed(1)}%`;
    default: return String(value);
  }
}

export const isNumeric = (kind: ReportColumn["kind"]) => kind === "money" || kind === "qty" || kind === "int" || kind === "days" || kind === "percent";

/**
 * A column the resource file does not name falls back to the key the server sent, rather than to
 * the lookup path — a report gaining a column must never print «reports.cols.…» at a shop.
 */
export const columnLabel = (key: string) =>
  key in (hy.reports.cols as Record<string, string>) ? t(`reports.cols.${key}` as StringKey) : key;
