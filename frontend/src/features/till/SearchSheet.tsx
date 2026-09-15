/** Search — Armenian or Latin-typed (§20.3). The scanner stays quiet while this field has focus. */
import { PackagePlus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { t } from "@/i18n/t.ts";
import { searchCatalogue } from "@/lib/catalogue.ts";
import { moneyPlain, qty } from "@/lib/format.ts";
import type { CachedProduct } from "@/lib/local-db.ts";

export function SearchResults({ query, onPick }: { query: string; onPick: (p: CachedProduct) => void }) {
  const [results, setResults] = useState<CachedProduct[]>([]);
  useEffect(() => {
    const id = setTimeout(() => void searchCatalogue(query).then(setResults), 60);
    return () => clearTimeout(id);
  }, [query]);
  if (!query.trim()) return null;
  if (!results.length) return <p className="py-6 text-center text-muted-foreground">{t("till.searchEmpty")}</p>;
  return (
    <ul className="divide-y divide-border">
      {results.map((p) => (
        <li key={p.id}>
          <button onClick={() => onPick(p)} className="flex min-h-touch-lg w-full items-center gap-3 px-1 py-2 text-left active:bg-muted">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{p.name}</div>
              <div className="tabular text-sm text-muted-foreground">{p.barcodes[0] ?? ""}{p.trackStock ? ` · ${qty(p.stockQty, p.decimalPlaces)} ${p.stockUom}` : ""}</div>
            </div>
            <div className="tabular font-semibold">{moneyPlain(p.sellPriceMdram / 1000)} ֏</div>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function SearchSheet({ open, onOpenChange, onPick, onAddNew }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (p: CachedProduct) => void; onAddNew: (name: string) => void }) {
  const [query, setQuery] = useState("");
  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setQuery(""); }} title={t("till.search")} className="md:max-w-xl">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("till.searchPlaceholder")} className="pl-10 text-lg" enterKeyHint="search" />
      </div>
      <div className="max-h-[50dvh] overflow-y-auto">
        <SearchResults query={query} onPick={(p) => { onPick(p); onOpenChange(false); setQuery(""); }} />
      </div>
      <Button variant="soft" className="mt-3 w-full" onClick={() => { onAddNew(query); onOpenChange(false); setQuery(""); }}>
        <PackagePlus /> {t("till.addNew")}
      </Button>
    </Sheet>
  );
}
