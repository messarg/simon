/** Պահեստ — "do we have it, and how many?" (§6.16). The shelf, written down; last-known when offline. */
import { useQuery } from "@tanstack/react-query";
import { PackageSearch, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, MoneyText } from "@/components/shared";
import { Input } from "@/components/ui/input.tsx";
import { t, type StringKey } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { findByBarcode, getCachedProduct, searchCatalogue, useCatalogueVersion } from "@/lib/catalogue.ts";
import { useConnection } from "@/lib/connection.ts";
import { dateTime, qty } from "@/lib/format.ts";
import { http } from "@/lib/http.ts";
import type { CachedProduct } from "@/lib/local-db.ts";
import { useScanner } from "@/lib/scanner.ts";

interface Movement { id: string; type: string; qtyDelta: number; balanceAfter: number; createdAt: string; userName: string | null; reasonCode: string | null }

export function StockPage() {
  const connection = useConnection();
  const version = useCatalogueVersion();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CachedProduct[]>([]);
  const [selected, setSelected] = useState<CachedProduct | null>(null);

  useEffect(() => { const id = setTimeout(() => void searchCatalogue(query, 50).then(setResults), 60); return () => clearTimeout(id); }, [query, version]);
  useEffect(() => { if (selected) void getCachedProduct(selected.id).then((p) => p && setSelected(p)); }, [version]); // eslint-disable-line

  const onScan = useCallback(async (code: string) => { const p = await findByBarcode(code); if (p) setSelected(p); }, []);
  useScanner(onScan);

  const history = useQuery({
    queryKey: ["products", selected?.id, "movements"],
    enabled: Boolean(selected) && connection === "online",
    queryFn: () => http.get<{ items: Movement[] }>(`/products/${selected!.id}/movements`, { query: { limit: 50 } }),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <section className={cn("flex min-h-0 flex-col border-border md:w-96 md:border-r", selected && "hidden md:flex")}>
        <div className="p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("stock.searchPlaceholder")} className="pl-10" />
          </div>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          {results.map((p) => (
            <li key={p.id}>
              <button onClick={() => setSelected(p)} className={cn("flex min-h-touch-lg w-full items-center gap-3 px-4 py-2 text-left active:bg-muted", selected?.id === p.id && "bg-primary-soft")}>
                <div className="min-w-0 flex-1"><div className="truncate font-medium">{p.name}</div><div className="tabular text-sm text-muted-foreground">{p.barcodes[0] ?? p.stockUom}</div></div>
                {p.trackStock && <span className="tabular font-semibold">{qty(p.stockQty, p.decimalPlaces)} {p.stockUom}</span>}
              </button>
            </li>
          ))}
        </ul>
        {!query && <EmptyState icon={PackageSearch} title={t("stock.emptyTitle")} hint={t("stock.emptyHint")} />}
      </section>

      {selected && (
        <section className="min-h-0 flex-1 overflow-y-auto p-4">
          <button onClick={() => setSelected(null)} className="mb-2 h-10 text-muted-foreground md:hidden">← {t("common.back")}</button>
          <h1 className="text-2xl font-semibold">{selected.name}</h1>
          <p className="tabular text-muted-foreground">{selected.barcodes.join(" · ")}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-card p-4 ring-1 ring-border">
              <div className="text-sm text-muted-foreground">{t("stock.onHand")}</div>
              {selected.trackStock ? (
                <div className={cn("tabular text-4xl font-bold", selected.stockQty < 0 && "text-attention-foreground")}>{qty(selected.stockQty, selected.decimalPlaces)} <span className="text-xl font-medium text-muted-foreground">{selected.stockUom}</span></div>
              ) : <div className="text-muted-foreground">{t("stock.notTracked")}</div>}
              {connection === "offline" && <div className="mt-1 text-xs text-attention-foreground">{t("stock.lastKnown")}</div>}
            </div>
            <div className="rounded-xl bg-card p-4 ring-1 ring-border">
              <div className="text-sm text-muted-foreground">{t("stock.price")}</div>
              <MoneyText amount={selected.sellPriceMdram / 1000} className="text-3xl font-bold" />
            </div>
          </div>
          <h2 className="mt-6 mb-2 text-lg font-semibold">{t("stock.history")}</h2>
          {connection === "offline" ? <p className="text-muted-foreground">{t("stock.offlineHistory")}</p> : history.data?.items.length === 0 ? <p className="text-muted-foreground">{t("stock.historyEmpty")}</p> : (
            <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-border">
              {history.data?.items.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{t(`stock.types.${m.type}` as StringKey)}</div>
                    <div className="text-sm text-muted-foreground">{dateTime(m.createdAt)} · {m.userName}</div>
                  </div>
                  <div className="text-right">
                    <div className={cn("tabular font-semibold", m.qtyDelta < 0 ? "text-foreground" : "text-success")}>{m.qtyDelta > 0 ? "+" : ""}{qty(m.qtyDelta, selected.decimalPlaces)}</div>
                    <div className="tabular text-xs text-muted-foreground">= {qty(m.balanceAfter, selected.decimalPlaces)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
