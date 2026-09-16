/**
 * Հաշվետվություն (§6.10). The catalogue on the left, one report on the right; on a phone, the list
 * until one is chosen. The period and the grouping live in the URL, so a report can be linked to
 * from the figure it explains — which is what makes home's numbers drillable (§6.9, rule 3).
 */
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Search } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { businessDate, matchesSearch, normalizeForSearch, periodRange } from "@simon/shared";
import { EmptyState } from "@/components/shared";
import { Input } from "@/components/ui/input.tsx";
import { REPORTS, reportEntry } from "@/features/reports/catalogue.ts";
import { PeriodPicker } from "@/features/reports/PeriodPicker.tsx";
import { ReportTable } from "@/features/reports/ReportTable.tsx";
import type { ReportResult } from "@/features/reports/types.ts";
import { t, type StringKey } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { http } from "@/lib/http.ts";
import type { ApiProduct } from "@/lib/catalogue.ts";
import { useClientSettings } from "../settings.ts";

export function ReportsPage() {
  const settings = useClientSettings().data;
  const today = businessDate(new Date(), settings?.timezone ?? "Asia/Yerevan");
  const [params, setParams] = useSearchParams();
  const name = params.get("r");
  const entry = name ? reportEntry(name) : undefined;
  const period = { from: params.get("from") ?? today, to: params.get("to") ?? today };
  const groupBy = params.get("by") ?? entry?.groupings?.[0];
  const productId = params.get("productId") ?? "";

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v === undefined || v === "") next.delete(k); else next.set(k, v); }
    setParams(next);
  };

  const query = useQuery({
    queryKey: ["reports", name, period.from, period.to, groupBy, productId],
    queryFn: () => http.get<ReportResult>(`/reports/${name}`, { query: { from: period.from, to: period.to, groupBy, productId: productId || undefined } }),
    enabled: Boolean(name) && (!entry?.needsProduct || Boolean(productId)),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <nav className={cn("min-h-0 overflow-y-auto border-border p-3 md:w-80 md:border-r", name && "hidden md:block")} aria-label={t("reports.title")}>
        <h1 className="mb-2 px-1 text-2xl font-semibold">{t("nav.reports")}</h1>
        <ul className="space-y-1">
          {REPORTS.map((r) => {
            const Icon = r.icon;
            return (
              <li key={r.name}>
                <button
                  onClick={() => set({ r: r.name, by: undefined, productId: undefined, ...periodRange("today", today) })}
                  className={cn("flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left", name === r.name ? "bg-primary-soft" : "hover:bg-muted")}
                >
                  <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-medium">{t(`reports.names.${r.name}` as StringKey)}</span>
                    <span className="block text-sm text-muted-foreground">{t(`reports.hints.${r.name}` as StringKey)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <section className={cn("min-h-0 flex-1 overflow-y-auto p-4", !name && "hidden md:block")}>
        {!entry ? (
          <EmptyState icon={BarChart3} title={t("reports.pick")} className="h-full" />
        ) : (
          <div className="mx-auto w-full max-w-5xl space-y-4">
            <div className="flex items-baseline gap-3">
              <button onClick={() => set({ r: undefined })} className="h-touch text-muted-foreground md:hidden">← {t("common.back")}</button>
              <h2 className="text-xl font-semibold">{t(`reports.names.${entry.name}` as StringKey)}</h2>
            </div>

            {entry.period && <PeriodPicker today={today} value={period} onChange={(p) => set({ from: p.from, to: p.to })} />}
            {entry.groupings && (
              <div className="flex flex-wrap gap-2">
                {entry.groupings.map((g) => (
                  <button
                    key={g}
                    onClick={() => set({ by: g })}
                    className={cn("h-touch rounded-lg border px-4 text-sm font-medium", groupBy === g ? "border-primary bg-primary-soft text-accent-foreground" : "border-border bg-card text-muted-foreground")}
                  >
                    {t(`reports.groupings.${g}` as StringKey)}
                  </button>
                ))}
              </div>
            )}
            {entry.needsProduct && <ProductChooser value={productId} onChange={(id) => set({ productId: id })} />}

            {query.data && <ReportTable report={query.data} />}
            {query.isError && <p className="text-destructive">{t("problems.network")}</p>}
          </div>
        )}
      </section>
    </div>
  );
}

function ProductChooser({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [q, setQ] = useState("");
  const products = useQuery({ queryKey: ["products", "list", "all", ""], queryFn: () => http.get<{ items: ApiProduct[] }>("/products", { query: { filter: "all", limit: 200 } }) });
  const items = (products.data?.items ?? []).filter((p) => !q.trim() || matchesSearch(normalizeForSearch(p.name), q)).slice(0, 8);
  const chosen = products.data?.items.find((p) => p.id === value);
  return (
    <div className="space-y-2">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={chosen?.name ?? t("stock.searchPlaceholder")} className="pl-10" />
      </div>
      {q.trim() && (
        <ul className="flex flex-wrap gap-2">
          {items.map((p) => (
            <li key={p.id}>
              <button onClick={() => { onChange(p.id); setQ(""); }} className="h-touch rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted">{p.name}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
