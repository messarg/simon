/**
 * Պատվերներ (§13.3, §11): what the shop has asked suppliers for. Optional by design — most goods
 * arrive unordered — so the empty state says so rather than implying something is missing.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, MoneyText } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { problemMessage, t, type StringKey } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { dateLabel, dateTime } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import { statusTone, type Order, type OrderRow } from "./orders.ts";

export function OrdersPanel({ selectedId, onSelect, onNew }: { selectedId: string | null; onSelect: (id: string) => void; onNew: () => void }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"active" | "all">("active");
  const list = useQuery({
    queryKey: ["purchase-orders", filter],
    queryFn: () => http.get<{ items: OrderRow[] }>("/purchase-orders", { query: { status: filter === "active" ? "DRAFT,OPEN,PARTIAL" : undefined } }),
  });
  const [busy, setBusy] = useState(false);

  const suggest = async () => {
    setBusy(true);
    try {
      const res = await http.post<{ created: Order[]; withoutSupplier: unknown[] }>("/purchase-orders/from-suggestions", {});
      if (res.created.length === 0) toast(t("orders.nothingToOrder"));
      else toast.success(t("orders.suggested", { n: res.created.length }));
      if (res.withoutSupplier.length) toast.warning(t("orders.withoutSupplier", { n: res.withoutSupplier.length }));
      await qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      if (res.created[0]) onSelect(res.created[0].id);
    } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
    finally { setBusy(false); }
  };

  const items = list.data?.items ?? [];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 p-3">
        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={() => void suggest()}><Sparkles />{t("orders.suggest")}</Button>
          <Button size="icon" onClick={onNew} aria-label={t("orders.new")}><Plus /></Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("orders.suggestHint")}</p>
        <div className="flex rounded-lg bg-muted p-1">
          {(["active", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("h-touch flex-1 rounded-md text-sm font-medium", filter === f ? "bg-card shadow-xs" : "text-muted-foreground")}>{t(`orders.filters.${f}`)}</button>
          ))}
        </div>
      </div>
      {list.data && items.length === 0 ? <EmptyState icon={ClipboardList} title={t("orders.empty")} hint={t("orders.emptyHint")} /> : (
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          {items.map((o) => (
            <li key={o.id}>
              <button onClick={() => onSelect(o.id)} className={cn("flex min-h-touch-lg w-full items-center gap-3 px-4 py-2.5 text-left active:bg-muted", o.id === selectedId && "bg-primary-soft")}>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{o.supplierName}</div>
                  <div className="tabular text-sm text-muted-foreground">{o.number} · {o.expectedAt ? dateLabel(o.expectedAt) : dateTime(o.createdAt)}</div>
                </div>
                <div className="text-right">
                  <span className={cn("rounded-xs px-2 py-0.5 text-xs font-medium", statusTone(o.status))}>{t(`orders.statuses.${o.status}` as StringKey)}</span>
                  {o.total !== undefined && <div><MoneyText amount={o.total} className="text-sm font-semibold" /></div>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
