/**
 * One table for every report (§6.10): money right-aligned and tabular, a totals row, footnotes that
 * say what the figures leave out, and an export that writes exactly what is on the screen.
 */
import { Download, FileSpreadsheet } from "lucide-react";
import { EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { toast } from "sonner";
import { t, type StringKey } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { downloadCsv, toCsv } from "@/lib/csv.ts";
import { cellText, columnLabel, isNumeric } from "./cellFormat.ts";
import { Cell } from "./cells.tsx";
import type { ReportResult } from "./types.ts";

export function ReportTable({ report }: { report: ReportResult }) {
  const exportCsv = () => {
    // A quantity column is exported as a plain number with its unit beside it: a spreadsheet has to
    // be able to add the column, and "8 մ" is text (§6.10, FR-DAT-03).
    const withUnits = report.columns.some((c) => c.kind === "qty") && report.rows.some((r) => r.uom);
    const columns = report.columns.flatMap((c) => [
      { key: c.key, label: columnLabel(c.key), kind: c.kind },
      ...(withUnits && c.kind === "qty" ? [{ key: "uom", label: t("products.unit") }] : []),
    ]);
    const rows = report.rows.map((row) => ({
      ...Object.fromEntries(report.columns.map((c) => [c.key, cellText(c, row)])),
      uom: String(row.uom ?? ""),
    }));
    const totals = report.totals ? Object.fromEntries(report.columns.map((c) => [c.key, report.totals?.[c.key] ?? ""])) : null;
    downloadCsv(`${report.name}-${report.from}_${report.to}`, toCsv(columns, rows, totals, t("reports.totals")));
    toast.success(t("reports.exported"));
  };

  if (report.rows.length === 0) {
    return (
      <div>
        <EmptyState icon={FileSpreadsheet} title={t("reports.empty")} hint={t("reports.emptyHint")} />
        <Notes report={report} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground">{t("reports.rows", { n: report.rows.length })}</p>
        <span className="flex-1" />
        <Button variant="soft" onClick={exportCsv}><Download />{t("reports.export")}</Button>
      </div>

      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-border shadow-sm">
        <table className="w-full min-w-max border-collapse text-[0.95rem]">
          <thead>
            <tr className="border-b border-border text-sm text-muted-foreground">
              {report.columns.map((c) => (
                <th key={c.key} scope="col" className={cn("px-3 py-2 font-medium", isNumeric(c.kind) ? "text-right" : "text-left")}>{columnLabel(c.key)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row, i) => (
              <tr key={String(row.key ?? i)} className="border-b border-border/60 last:border-0">
                {report.columns.map((c) => (
                  <td key={c.key} className={cn("px-3 py-2 align-top", isNumeric(c.kind) ? "text-right" : "text-left")}><Cell column={c} row={row} /></td>
                ))}
              </tr>
            ))}
          </tbody>
          {report.totals && Object.values(report.totals).some((v) => v !== null && v !== 0) && (
            <tfoot>
              <tr className="border-t-2 border-border font-semibold">
                {report.columns.map((c, i) => (
                  <td key={c.key} className={cn("px-3 py-2", isNumeric(c.kind) ? "text-right" : "text-left")}>
                    {i === 0 ? t("reports.totals") : report.totals?.[c.key] === undefined || report.totals?.[c.key] === null ? "" : <Cell column={c} row={report.totals as Record<string, unknown>} />}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <Notes report={report} />
    </div>
  );
}

function Notes({ report }: { report: ReportResult }) {
  if (!report.notes?.length) return null;
  return (
    <ul className="space-y-1 text-sm text-muted-foreground">
      {report.notes.map((n, i) => <li key={i}>{t(`reports.notes.${n.key}` as StringKey, n.vars)}</li>)}
    </ul>
  );
}
