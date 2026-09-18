/** What the shop owes, by supplier (§6.14): sorted by outstanding payable, overdue marked with a word as well as a colour. */
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Plus, Search, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { matchesSearch, normalizeForSearch, uuidv7 } from "@simon/shared";
import { EmptyState, MoneyText } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { money } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";

/** `paymentTerms` is the owner's; a manager's rows come without it (§16.5). */
export interface SupplierRow { id: string; name: string; phone: string | null; paymentTerms?: number; leadTimeDays: number; outstanding: number; overdue: number; isActive: boolean }

export function SupplierList({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const list = useQuery({ queryKey: ["suppliers", "list"], queryFn: () => http.get<{ items: SupplierRow[] }>("/suppliers") });
  const items = (list.data?.items ?? []).filter((s) => !query.trim() || matchesSearch(normalizeForSearch(s.name), query));
  const create = async () => {
    try {
      const s = await http.post<{ id: string }>("/suppliers", { id: uuidv7(), name: query.trim() });
      await list.refetch();
      setQuery("");
      onSelect(s.id);
    } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-2 p-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("buy.supplierName")} className="pl-10" />
        </div>
        <Button size="icon" disabled={!query.trim()} onClick={() => void create()} aria-label={t("buy.newSupplier")}><Plus /></Button>
      </div>
      {list.data && items.length === 0 && !query ? <EmptyState icon={Truck} title={t("suppliers.empty")} hint={t("suppliers.emptyHint")} /> : (
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          {items.map((s) => (
            <li key={s.id}>
              <button onClick={() => onSelect(s.id)} className={cn("flex min-h-touch-lg w-full items-center gap-3 px-4 py-2.5 text-left active:bg-muted", s.id === selectedId && "bg-primary-soft", !s.isActive && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.name}</div>
                  {s.paymentTerms !== undefined && <div className="text-sm text-muted-foreground">{t("suppliers.terms")}: {s.paymentTerms}</div>}
                </div>
                <div className="text-right">
                  {s.outstanding >= 0 ? <MoneyText amount={s.outstanding} className="font-semibold" /> : <span className="text-sm text-success">{t("suppliers.credit", { amount: money(-s.outstanding) })}</span>}
                  {s.overdue > 0 && <div className="flex items-center justify-end gap-1 text-xs text-attention-foreground"><AlertTriangle className="size-3" aria-hidden />{t("suppliers.overdue", { amount: money(s.overdue) })}</div>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
