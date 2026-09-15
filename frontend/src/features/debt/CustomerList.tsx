/** The debtor list (§6.13, §6.15): sorted by what is owed, never alphabetical; Latin-typed search; create inline. */
import { useQuery } from "@tanstack/react-query";
import { BookUser, Search, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { t } from "@/i18n/t.ts";
import { useConnection } from "@/lib/connection.ts";
import { putCustomers, searchCustomers, useCustomerVersion } from "@/lib/customers.ts";
import { http } from "@/lib/http.ts";
import type { CachedCustomer } from "@/lib/local-db.ts";
import { CreateCustomerSheet } from "./CreateCustomerSheet.tsx";
import { CustomerRow } from "./CustomerRow.tsx";

export function CustomerList({ admin, selectedId, onSelect }: { admin: boolean; selectedId: string | null; onSelect: (id: string) => void }) {
  const connection = useConnection();
  const version = useCustomerVersion();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [local, setLocal] = useState<CachedCustomer[]>([]);
  const remote = useQuery({
    queryKey: ["customers", "list", query],
    enabled: connection === "online",
    queryFn: async () => {
      const res = await http.get<{ items: CachedCustomer[] }>("/customers", { query: { q: query.trim() || undefined, limit: 300 } });
      await putCustomers(res.items);
      return res.items;
    },
  });
  useEffect(() => { const id = setTimeout(() => void searchCustomers(query, 300).then(setLocal), 60); return () => clearTimeout(id); }, [query, version]);
  const items = connection === "online" && remote.data ? remote.data : local;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-2 p-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("debt.searchPlaceholder")} className="pl-10" />
        </div>
        <Button variant="soft" size="icon" onClick={() => setCreating(true)} aria-label={t("debt.create")}><UserPlus /></Button>
      </div>
      {items.length === 0 && !query ? (
        <EmptyState icon={BookUser} title={t("debt.emptyTitle")} hint={t("debt.emptyHint")} />
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          {items.map((c) => <li key={c.id}><CustomerRow c={c} selected={c.id === selectedId} onClick={() => onSelect(c.id)} showLimit={admin} /></li>)}
        </ul>
      )}
      <CreateCustomerSheet key={creating ? `create-${query}` : "closed"} open={creating} onOpenChange={setCreating} initialName={query} onCreated={(c) => onSelect(c.id)} />
    </div>
  );
}
