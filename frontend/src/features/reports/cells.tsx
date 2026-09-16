/** One place decides how a report cell looks, so every report reads the same (§6.10). */
import { MoneyText } from "@/components/shared";
import { t } from "@/i18n/t.ts";
import { dateLabel, dateTime, qty as formatQty } from "@/lib/format.ts";
import { codeLabel } from "./cellFormat.ts";
import type { ReportColumn } from "./types.ts";

export function Cell({ column, row }: { column: ReportColumn; row: Record<string, unknown> }) {
  const value = row[column.key];
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  switch (column.kind) {
    case "money": return <MoneyText amount={Number(value)} symbol={false} />;
    case "qty": return <span className="tabular">{formatQty(Number(value), Number(row.decimalPlaces ?? 3))}{row.uom ? ` ${row.uom}` : ""}</span>;
    case "int": return <span className="tabular">{Number(value)}</span>;
    case "days": return <span className="tabular">{t("debt.days", { n: Number(value) })}</span>;
    case "percent": return <span className="tabular">{(Number(value) / 100).toFixed(1)}%</span>;
    case "date": return <span>{dateLabel(String(value))}</span>;
    case "datetime": return <span className="tabular">{dateTime(String(value))}</span>;
    case "code": return <span>{codeLabel(column.codeSet, value)}</span>;
    default: return <span>{String(value)}</span>;
  }
}
