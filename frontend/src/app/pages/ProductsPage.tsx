/** Ապրանքներ — opens on what is unfinished, not the whole catalogue (§6.12). Cost appears for ADMIN only. */
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, PackagePlus, Plus, Search } from "lucide-react";
import { useState } from "react";
import { EmptyState, MoneyText } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { ProductEditor } from "@/features/products/ProductEditor.tsx";
import { t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import type { ApiProduct } from "@/lib/catalogue.ts";
import { qty } from "@/lib/format.ts";
import { http } from "@/lib/http.ts";

type Filter = "needs-detail" | "all" | "inactive";

export function ProductsPage() {
  const [filter, setFilter] = useState<Filter>("needs-detail");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const list = useQuery({
    queryKey: ["products", "list", filter, q],
    queryFn: () => http.get<{ items: ApiProduct[] }>("/products", { query: { filter, q: q.trim() || undefined, limit: 200 } }),
  });

  const tabs: Array<[Filter, string]> = [["needs-detail", t("products.incomplete")], ["all", t("products.all")], ["inactive", t("products.inactive")]];

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{t("nav.products")}</h1>
        <span className="flex-1" />
        <Button onClick={() => setEditing({ id: null })}><Plus />{t("products.add")}</Button>
      </div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="flex rounded-lg bg-muted p-1">
          {tabs.map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={cn("h-10 flex-1 rounded-md px-4 text-sm font-medium", filter === key ? "bg-card shadow-xs" : "text-muted-foreground")}>{label}</button>
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
                  </div>
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
            </li>
          ))}
        </ul>
      )}
      <ProductEditor productId={editing?.id ?? null} open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }} />
    </div>
  );
}
