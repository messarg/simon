/** Who is buying on credit (§6.3): type the first letters — Latin-typed works — or create them without leaving the sale. */
import { Search, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { t } from "@/i18n/t.ts";
import { searchCustomers, useCustomerVersion } from "@/lib/customers.ts";
import type { CachedCustomer } from "@/lib/local-db.ts";
import { CreateCustomerSheet } from "./CreateCustomerSheet.tsx";
import { CustomerRow } from "./CustomerRow.tsx";

export function CustomerPickerSheet({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (c: CachedCustomer) => void }) {
  const version = useCustomerVersion();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CachedCustomer[]>([]);
  const [creating, setCreating] = useState(false);
  useEffect(() => { const id = setTimeout(() => void searchCustomers(query).then(setResults), 60); return () => clearTimeout(id); }, [query, version]);
  const pick = (c: CachedCustomer) => { onPick(c); onOpenChange(false); setQuery(""); };
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange} title={t("debt.pickTitle")} className="md:max-w-xl">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("debt.searchPlaceholder")} className="pl-10 text-lg" />
        </div>
        <ul className="max-h-[50dvh] divide-y divide-border overflow-y-auto">
          {results.map((c) => <li key={c.id}><CustomerRow c={c} onClick={() => pick(c)} /></li>)}
        </ul>
        {query && results.length === 0 && <p className="py-4 text-center text-muted-foreground">{t("debt.noResults")}</p>}
        <Button className="mt-3 w-full" onClick={() => setCreating(true)}><UserPlus />{t("debt.create")}</Button>
      </Sheet>
      <CreateCustomerSheet key={creating ? `create-${query}` : "closed"} open={creating} onOpenChange={setCreating} initialName={query} onCreated={pick} />
    </>
  );
}
