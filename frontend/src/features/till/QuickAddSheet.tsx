/**
 * Quick-add (§7.4): an unknown barcode is never a dead end. Name and price are the only
 * required fields; the unit defaults to pieces. Saves and puts the item straight in the basket.
 */
import { useState } from "react";
import { uuidv7 } from "@simon/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { UNITS } from "@/lib/units.ts";
import { cn } from "@/lib/cn.ts";
import { putProducts, toCached, type ApiProduct } from "@/lib/catalogue.ts";
import { useConnection } from "@/lib/connection.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import type { CachedProduct } from "@/lib/local-db.ts";


export function QuickAddSheet({ open, onOpenChange, barcode, initialName, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; barcode: string | null; initialName?: string; onCreated: (p: CachedProduct) => void }) {
  const connection = useConnection();
  // The parent remounts this sheet with a new key each time it opens, so state starts fresh.
  const [name, setName] = useState(initialName ?? "");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const p = await http.post<ApiProduct>("/products", {
        id: uuidv7(), name: name.trim(), sellPriceMdram: Number(price) * 1000, stockUom: t(UNITS[unit].key), decimalPlaces: UNITS[unit].decimals, barcode: barcode || null,
      }, { timeoutMs: 5000 });
      await putProducts([p]);
      onCreated(toCached(p));
      onOpenChange(false);
    } catch (err) {
      setError(problemMessage(err instanceof ApiProblem ? err.type : "network"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("quickAdd.title")}>
      {connection === "offline" ? (
        <p className="rounded-lg bg-attention-soft p-4 text-attention-foreground">{t("quickAdd.offline")}</p>
      ) : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (name.trim() && price) void save(); }}>
          {barcode && (
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">{t("quickAdd.barcode")}</span>
              <span className="tabular font-medium">{barcode}</span>
            </div>
          )}
          <div>
            <Label htmlFor="qa-name">{t("quickAdd.name")}</Label>
            <Input id="qa-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
          <div>
            <Label htmlFor="qa-price">{t("quickAdd.price")}</Label>
            <Input id="qa-price" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, "").slice(0, 9))} inputMode="numeric" className="tabular text-xl" />
          </div>
          <div>
            <Label>{t("quickAdd.unit")}</Label>
            <div className="grid grid-cols-3 gap-2">
              {UNITS.map((u, i) => (
                <button type="button" key={u.key} onClick={() => setUnit(i)} className={cn("h-touch rounded-lg border font-medium", unit === i ? "border-primary bg-primary-soft text-accent-foreground" : "border-border bg-card")}>
                  {t(u.key)}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" size="xl" className="w-full" disabled={busy || !name.trim() || !price}>{t("quickAdd.saveAndSell")}</Button>
        </form>
      )}
    </Sheet>
  );
}
