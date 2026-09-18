/** Pick the supplier on the paper invoice, or add them by name without leaving receiving (§6.7). */
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { matchesSearch, normalizeForSearch, uuidv7 } from "@simon/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import { toast } from "sonner";

export interface SupplierRef { id: string; name: string }

export function SupplierPickerSheet({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (s: SupplierRef) => void }) {
  const [query, setQuery] = useState("");
  const list = useQuery({ queryKey: ["suppliers", "picker"], enabled: open, queryFn: () => http.get<{ items: SupplierRef[] }>("/suppliers") });
  const items = (list.data?.items ?? []).filter((s) => !query.trim() || matchesSearch(normalizeForSearch(s.name), query));
  const pick = (s: SupplierRef) => { onPick(s); onOpenChange(false); setQuery(""); };
  const create = async () => {
    try {
      const s = await http.post<SupplierRef>("/suppliers", { id: uuidv7(), name: query.trim() });
      await list.refetch();
      pick(s);
    } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("buy.pickSupplier")}>
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("buy.supplierName")} className="pl-10" />
      </div>
      <ul className="max-h-[45dvh] divide-y divide-border overflow-y-auto">
        {items.map((s) => (
          <li key={s.id}><button onClick={() => pick(s)} className="flex min-h-touch w-full items-center px-2 text-left font-medium active:bg-muted">{s.name}</button></li>
        ))}
      </ul>
      {query.trim() && !items.some((s) => s.name.toLowerCase() === query.trim().toLowerCase()) && (
        <Button className="mt-3 w-full" onClick={() => void create()}><Plus />{t("buy.newSupplier")}: {query.trim()}</Button>
      )}
    </Sheet>
  );
}
