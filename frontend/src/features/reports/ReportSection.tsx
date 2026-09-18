/**
 * One report from §20.2's catalogue, fetched and rendered with its own heading — the same table
 * every report uses, asked for with one filter already fixed.
 *
 * It is what makes a person's page a *view onto the catalogue* rather than a second one (§6.10,
 * §6.11.1): the figures, the columns, the drill-through and the export all come from the report
 * itself, and nothing here knows what any of them mean.
 */
import { useQuery } from "@tanstack/react-query";
import { t, type StringKey } from "@/i18n/t.ts";
import { http } from "@/lib/http.ts";
import { ReportTable } from "./ReportTable.tsx";
import type { ReportName, ReportResult } from "./types.ts";

export interface ReportSectionProps {
  name: ReportName;
  from: string;
  to: string;
  /** Scope every row to one person (§6.11.1). */
  userId?: string;
  groupBy?: string;
}

export function ReportSection({ name, from, to, userId, groupBy }: ReportSectionProps) {
  const query = useQuery({
    queryKey: ["reports", name, from, to, groupBy, userId],
    queryFn: () => http.get<ReportResult>(`/reports/${name}`, { query: { from, to, groupBy, userId } }),
  });

  return (
    <section className="space-y-2">
      <h3 className="text-lg font-semibold">{t(`reports.names.${name}` as StringKey)}</h3>
      {query.isPending && <p className="text-muted-foreground">{t("common.loading")}</p>}
      {/* A report that cannot be reached says so quietly; the other three facets still work. */}
      {query.isError && <p className="text-muted-foreground">{t("problems.network")}</p>}
      {query.data && <ReportTable report={query.data} />}
    </section>
  );
}
