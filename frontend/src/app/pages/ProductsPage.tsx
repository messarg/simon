/** Ապրանքներ — opens on what is unfinished, not the whole catalogue (§6.12). Cost appears for ADMIN only. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, PackageSearch, PackagePlus, Plus, Search } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { EmptyState, MoneyText } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { ProductEditor } from "@/features/products/ProductEditor.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import type { ApiProduct } from "@/lib/catalogue.ts";
import { qty } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";

type Filter = "needs-detail" | "low-stock" | "dead-stock" | "all" | "inactive";

/** What the server worked out about this product's stock (§13.3). */
interface StockStatus {
  suggested: number; threshold: number; manual: boolean; low: boolean; dead: boolean;
  daysOfCover: number | null; avgDailyQty30d: number; daysSinceLastSale: number | null;
  leadTimeDays: number; safetyDays: number; supplierName: string | null;
}
type ProductRow = ApiProduct & { stockStatus?: StockStatus | null };

export function ProductsPage() {
  const qc = useQueryClient();
  // The filter lives in the URL so home's "7 low" tile can open this list already filtered (§6.9).
  const [params, setParams] = useSearchParams();
  const filter = (params.get("filter") as Filter | null) ?? "needs-detail";
  const setFilter = (f: Filter) => setParams(f === "needs-detail" ? {} : { filter: f });
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const list = useQuery({
    queryKey: ["products", "list", filter, q],
    queryFn: () => http.get<{ items: ProductRow[] }>("/products", { query: { filter, q: q.trim() || undefined, limit: 200 } }),
  });

  const acceptSuggestion = async (p: ProductRow) => {
    try {
      await http.patch(`/products/${p.id}`, { reorderPoint: p.stockStatus?.suggested });
      await qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(t("products.suggestionSet"));
    } catch (err) {
      toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network"));
    }
  };

  const tabs: Array<[Filter, string]> = [
    ["needs-detail", t("products.incomplete")], ["low-stock", t("products.lowStock")], ["dead-stock", t("products.deadStock")],
    ["all", t("products.all")], ["inactive", t("products.inactive")],
  ];

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{t("nav.products")}</h1>
        <span className="flex-1" />
        <Button onClick={() => setEditing({ id: null })}><Plus />{t("products.add")}</Button>
      </div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="flex overflow-x-auto rounded-lg bg-muted p-1">
          {tabs.map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={cn("h-10 flex-1 whitespace-nowrap rounded-md px-3 text-sm font-medium", filter === key ? "bg-card shadow-xs" : "text-muted-foreground")}>{label}</button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("stock.searchPlaceholder")} className="h-12 pl-10" />
        </div>
      </div>

      {list.data?.items.length === 0 ? (
        filter === "needs-detail"
          ? <EmptyState icon={CheckCircle2} title={t("products.emptyIncomplete")} hint={t("products.emptyIncompleteHint")} />
          : filter === "low-stock"
            ? <EmptyState icon={CheckCircle2} title={t("products.emptyLow")} hint={t("products.emptyLowHint")} />
            : filter === "dead-stock"
              ? <EmptyState icon={PackageSearch} title={t("products.emptyDead")} hint={t("products.emptyDeadHint")} />
              : <EmptyState icon={PackagePlus} title={t("products.emptyAll")} hint={t("products.emptyAllHint")} action={<Button onClick={() => setEditing({ id: null })}>{t("products.add")}</Button>} />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border">
          {list.data?.items.map((p) => (
            <li key={p.id}>
              <button onClick={() => setEditing({ id: p.id })} className="flex min-h-touch-lg w-full items-center gap-4 px-4 py-3 text-left hover:bg-muted/60">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                    {p.needsDetail?.cost && <span className="inline-flex items-center gap-1 text-attention-foreground"><AlertTriangle className="size-3.5" aria-hidden />{t("products.noCost")}</span>}
                    {p.needsDetail?.category && <span>{t("products.noCategory")}</span>}
                    {p.needsDetail?.barcode && <span>{t("products.noBarcode")}</span>}
                    {filter === "dead-stock" && <span>{p.stockStatus?.daysSinceLastSale === null || p.stockStatus?.daysSinceLastSale === undefined ? t("products.neverSold") : t("products.idleFor", { n: p.stockStatus.daysSinceLastSale })}</span>}
                    {filter === "low-stock" && p.stockStatus && <span>{t("products.reorderAt", { qty: qty(p.stockStatus.threshold, p.decimalPlaces) })}</span>}
                  </div>
                  {filter === "low-stock" && p.stockStatus && p.stockStatus.avgDailyQty30d > 0 && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {p.stockStatus.supplierName && p.stockStatus.leadTimeDays > 0
                        ? t("products.suggestion", { daily: qty(p.stockStatus.avgDailyQty30d, p.decimalPlaces), lead: p.stockStatus.leadTimeDays })
                        : t("products.suggestionNoSupplier", { daily: qty(p.stockStatus.avgDailyQty30d, p.decimalPlaces) })}
                    </p>
                  )}
                </div>
                <div className="hidden text-right sm:block">
                  <div className="text-xs text-muted-foreground">{t("products.stock")}</div>
                  <div className="tabular">{p.trackStock ? `${qty(p.stockQty, p.decimalPlaces)} ${p.stockUom}` : "—"}</div>
                </div>
                <div className="hidden w-28 text-right md:block">
                  <div className="text-xs text-muted-foreground">{t("products.cost")}</div>
                  {p.avgCostMdram == null ? <span className="text-muted-foreground">—</span> : <MoneyText amount={Math.round(p.avgCostMdram / 1000)} />}
                </div>
                <div className="w-28 text-right">
                  <MoneyText amount={p.sellPriceMdram / 1000} className="font-semibold" />
                </div>
              </button>
              {filter === "low-stock" && p.stockStatus && !p.stockStatus.manual && p.stockStatus.suggested > 0 && (
                <div className="flex justify-end px-4 pb-3">
                  <Button size="sm" variant="soft" onClick={() => void acceptSuggestion(p)}>{t("products.suggestionAccept", { qty: qty(p.stockStatus.suggested, p.decimalPlaces) })}</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ProductEditor productId={editing?.id ?? null} open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }} />
    </div>
  );
}
