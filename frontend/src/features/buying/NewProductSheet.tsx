/** A product arriving that the catalogue does not know yet — created here, where its cost is actually known (J5). */
import { useState } from "react";
import { toast } from "sonner";
import { uuidv7 } from "@simon/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { putProducts, toCached, type ApiProduct } from "@/lib/catalogue.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import type { CachedProduct } from "@/lib/local-db.ts";
import { UNITS } from "@/lib/units.ts";

export function NewProductSheet({ open, onOpenChange, initialName, barcode, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; initialName?: string; barcode?: string | null; onCreated: (p: CachedProduct) => void }) {
  // Remounted per opening by the parent's key.
  const [name, setName] = useState(initialName ?? "");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState(0);
  const save = async () => {
    try {
      const p = await http.post<ApiProduct>("/products", { id: uuidv7(), name: name.trim(), sellPriceMdram: Number(price || "0") * 1000, stockUom: t(UNITS[unit].key), decimalPlaces: UNITS[unit].decimals, barcode: barcode || null });
      await putProducts([p]);
      onCreated(toCached(p));
      onOpenChange(false);
    } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("buy.newProduct")}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (name.trim()) void save(); }}>
        {barcode && <div className="tabular rounded-lg bg-muted px-3 py-2 text-sm">{barcode}</div>}
        <div><Label htmlFor="np-name">{t("quickAdd.name")}</Label><Input id="np-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
        <div><Label htmlFor="np-price">{t("buy.salePrice")}</Label><Input id="np-price" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, "").slice(0, 9))} inputMode="numeric" className="tabular" /></div>
        <div className="grid grid-cols-3 gap-2">
          {UNITS.map((u, i) => (
            <button type="button" key={u.key} onClick={() => setUnit(i)} className={cn("h-touch rounded-lg border font-medium", unit === i ? "border-primary bg-primary-soft" : "border-border")}>{t(u.key)}</button>
          ))}
        </div>
        <Button type="submit" size="xl" className="w-full" disabled={!name.trim()}>{t("common.save")}</Button>
      </form>
    </Sheet>
  );
}
