/**
 * Product editor (§6.12): the quick-add sheet with the optional fields filled in. A price change
 * asks for admin re-auth; `decimalPlaces` and the unit lock once the product has movements;
 * barcodes are a list that is added to and retired from, never edited.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { uuidv7 } from "@simon/shared";
import { ReauthSheet } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { putProducts, type ApiProduct } from "@/lib/catalogue.ts";
import { dateTime, money } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";

type Detail = ApiProduct & { hasMovements: boolean; priceHistory: { sellPriceMdram: number; effectiveFrom: string }[] };

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  price: z.string().regex(/^\d{1,9}$/),
  stockUom: z.string().trim().min(1).max(16),
  decimalPlaces: z.number().int().min(0).max(3),
  sku: z.string().trim().max(40),
  categoryId: z.string(),
  reorderPoint: z.string().regex(/^\d{0,7}$/),
  trackStock: z.boolean(),
  pinned: z.boolean(),
  isActive: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex h-touch w-full items-center justify-between rounded-lg px-1">
      <span>{label}</span>
      <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-border")}>
        <span className={cn("absolute top-0.5 left-0.5 size-6 rounded-full bg-card shadow transition-transform", checked && "translate-x-5")} />
      </span>
    </button>
  );
}

export { Toggle };

export function ProductEditor({ productId, open, onOpenChange }: { productId: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const isNew = productId === null;
  const detail = useQuery({ queryKey: ["products", productId], enabled: open && !isNew, queryFn: () => http.get<Detail>(`/products/${productId}`) });
  const categories = useQuery({ queryKey: ["categories"], enabled: open, queryFn: () => http.get<{ items: { id: string; name: string }[] }>("/categories") });
  const [reauth, setReauth] = useState<FormValues | null>(null);
  const [newBarcode, setNewBarcode] = useState("");
  const [unit, setUnit] = useState({ uom: "", factor: "" });
  const [newCategory, setNewCategory] = useState("");

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", price: "", stockUom: t("units.piece"), decimalPlaces: 0, sku: "", categoryId: "", reorderPoint: "", trackStock: true, pinned: false, isActive: true } });
  const d = detail.data;
  useEffect(() => {
    if (!open) return;
    if (isNew) form.reset({ name: "", price: "", stockUom: t("units.piece"), decimalPlaces: 0, sku: "", categoryId: "", reorderPoint: "", trackStock: true, pinned: false, isActive: true });
    else if (d) form.reset({ name: d.name, price: String(d.sellPriceMdram / 1000), stockUom: d.stockUom, decimalPlaces: d.decimalPlaces, sku: d.sku ?? "", categoryId: d.categoryId ?? "", reorderPoint: d.reorderPoint ? String(d.reorderPoint / 1000) : "", trackStock: d.trackStock, pinned: Boolean(d.tilePinnedAt), isActive: d.isActive });
  }, [open, isNew, d, form]);

  const refresh = async (p: ApiProduct) => {
    await putProducts([p]);
    await qc.invalidateQueries({ queryKey: ["products"] });
  };

  const save = async (v: FormValues, grant?: string) => {
    const priceMdram = Number(v.price) * 1000;
    try {
      if (isNew) {
        const p = await http.post<ApiProduct>("/products", { id: uuidv7(), name: v.name, sellPriceMdram: priceMdram, stockUom: v.stockUom, decimalPlaces: v.decimalPlaces, sku: v.sku || null, categoryId: v.categoryId || null, reorderPoint: Number(v.reorderPoint || "0") * 1000 });
        await refresh(p);
        if (v.pinned) await refresh(await http.patch<ApiProduct>(`/products/${p.id}`, { pinnedTile: true }));
        toast.success(t("products.saved"));
        onOpenChange(false);
        return;
      }
      if (!d) return;
      if (priceMdram !== d.sellPriceMdram && !grant) { setReauth(v); return; }
      const p = await http.patch<ApiProduct>(`/products/${d.id}`, {
        name: v.name, sellPriceMdram: priceMdram, ...(d.hasMovements ? {} : { stockUom: v.stockUom, decimalPlaces: v.decimalPlaces }),
        sku: v.sku || null, categoryId: v.categoryId || null, reorderPoint: Number(v.reorderPoint || "0") * 1000, trackStock: v.trackStock, pinnedTile: v.pinned, isActive: v.isActive, reauthGrant: grant ?? null,
      });
      await refresh(p);
      toast.success(t("products.saved"));
      onOpenChange(false);
    } catch (err) {
      toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network"), { description: err instanceof ApiProblem ? (err.field<string>("productName") ?? undefined) : undefined });
    }
  };

  const mutate = async (fn: () => Promise<ApiProduct>) => {
    try { await refresh(await fn()); await detail.refetch(); } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network"), { description: err instanceof ApiProblem ? (err.field<string>("productName") ?? undefined) : undefined }); }
  };

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    const c = await http.post<{ id: string }>("/categories", { id: uuidv7(), name: newCategory.trim() });
    await categories.refetch();
    form.setValue("categoryId", c.id);
    setNewCategory("");
  };

  const locked = Boolean(d?.hasMovements);
  const values = useWatch({ control: form.control });
  const lastPrice = d?.priceHistory[1];

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={isNew ? t("products.add") : (d?.name ?? t("products.edit"))} className="md:max-w-2xl">
      <form className="space-y-4" onSubmit={form.handleSubmit((v) => void save(v))}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="p-name">{t("products.name")}</Label>
            <Input id="p-name" {...form.register("name")} aria-invalid={Boolean(form.formState.errors.name)} />
          </div>
          <div>
            <Label htmlFor="p-price">{t("products.price")}</Label>
            <Input id="p-price" inputMode="numeric" className="tabular text-lg" {...form.register("price")} />
            {lastPrice && <p className="mt-1 text-xs text-muted-foreground">{t("products.wasPrice", { price: money(lastPrice.sellPriceMdram / 1000), date: dateTime(d!.priceHistory[0].effectiveFrom) })}</p>}
          </div>
          <div>
            <Label htmlFor="p-sku">{t("products.sku")}</Label>
            <Input id="p-sku" {...form.register("sku")} />
          </div>
          <div>
            <Label htmlFor="p-uom">{t("products.unit")}</Label>
            <Input id="p-uom" disabled={locked} {...form.register("stockUom")} />
          </div>
          <div>
            <Label htmlFor="p-dp">{t("products.decimals")}</Label>
            <div className="grid grid-cols-4 gap-1">
              {[0, 1, 2, 3].map((n) => (
                <button key={n} type="button" disabled={locked} onClick={() => form.setValue("decimalPlaces", n)} className={cn("tabular h-touch rounded-lg border font-medium disabled:opacity-50", values.decimalPlaces === n ? "border-primary bg-primary-soft" : "border-border")}>{n}</button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{locked ? t("products.lockedAfterMovements") : t("products.decimalsHint")}</p>
          </div>
          <div>
            <Label htmlFor="p-cat">{t("products.category")}</Label>
            <select id="p-cat" {...form.register("categoryId")} className="h-touch w-full rounded-lg border border-input bg-card px-3">
              <option value="">{t("products.noneCategory")}</option>
              {categories.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="mt-1 flex gap-1">
              <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="h-10" placeholder="+" />
              <Button type="button" variant="secondary" size="sm" onClick={() => void addCategory()} aria-label={t("common.add")}><Plus /></Button>
            </div>
          </div>
          <div>
            <Label htmlFor="p-reorder">{t("products.reorderPoint")}</Label>
            <Input id="p-reorder" inputMode="numeric" className="tabular" {...form.register("reorderPoint")} />
          </div>
        </div>
        <div className="divide-y divide-border rounded-lg border border-border px-3">
          <Toggle checked={values.trackStock ?? true} onChange={(v) => form.setValue("trackStock", v)} label={t("products.trackStock")} />
          <Toggle checked={values.pinned ?? false} onChange={(v) => form.setValue("pinned", v)} label={t("products.pinned")} />
          {!isNew && <Toggle checked={values.isActive ?? true} onChange={(v) => form.setValue("isActive", v)} label={t("products.active")} />}
        </div>

        {d && (
          <>
            <section>
              <h3 className="mb-2 font-semibold">{t("products.barcodes")}</h3>
              <ul className="mb-2 space-y-1">
                {d.barcodes.map((b) => (
                  <li key={b.barcode} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                    <span className={cn("tabular flex-1", b.retiredAt && "text-muted-foreground line-through")}>{b.barcode}</span>
                    {b.isPrimary && <span className="text-xs text-primary">{t("products.primary")}</span>}
                    {b.retiredAt ? <span className="text-xs text-muted-foreground">{t("products.retired")}</span> : (
                      <Button type="button" variant="ghost" size="sm" onClick={() => void mutate(() => http.post(`/products/${d.id}/barcodes/${encodeURIComponent(b.barcode)}/retire`))}>{t("products.retire")}</Button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input value={newBarcode} onChange={(e) => setNewBarcode(e.target.value.replace(/[^0-9A-Za-z-]/g, ""))} className="tabular" placeholder={t("quickAdd.barcode")} />
                <Button type="button" variant="secondary" disabled={!newBarcode} onClick={() => void mutate(async () => { const p = await http.post<ApiProduct>(`/products/${d.id}/barcodes`, { barcode: newBarcode }); setNewBarcode(""); return p; })}>{t("products.addBarcode")}</Button>
                <Button type="button" variant="ghost" onClick={() => void mutate(() => http.post(`/products/${d.id}/barcodes`, {}))} aria-label={t("products.generate")}><Wand2 /></Button>
              </div>
            </section>
            <section>
              <h3 className="mb-2 font-semibold">{t("products.units")}</h3>
              <ul className="mb-2 space-y-1">
                {d.units.map((u) => (
                  <li key={u.id} className="flex justify-between rounded-lg bg-muted px-3 py-2">
                    <span>{u.uom} · {t(`products.unitRole.${u.role as "STOCK"}`)}</span>
                    <span className="tabular text-muted-foreground">= {u.factorToStockUom} {d.stockUom}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input value={unit.uom} onChange={(e) => setUnit((s) => ({ ...s, uom: e.target.value }))} placeholder={t("products.unitName")} />
                <Input value={unit.factor} onChange={(e) => setUnit((s) => ({ ...s, factor: e.target.value.replace(/\D/g, "") }))} inputMode="numeric" className="tabular w-24" placeholder={t("products.factor", { uom: d.stockUom })} />
                <Button type="button" variant="secondary" disabled={!unit.uom || !Number(unit.factor)} onClick={() => void mutate(async () => { const p = await http.post<ApiProduct>(`/products/${d.id}/units`, { uom: unit.uom, factorToStockUom: Number(unit.factor), role: "PURCHASE" }); setUnit({ uom: "", factor: "" }); return p; })}>{t("products.addUnit")}</Button>
              </div>
            </section>
          </>
        )}

        <Button type="submit" size="xl" className="w-full" disabled={form.formState.isSubmitting}>{isNew ? t("products.create") : t("common.save")}</Button>
      </form>
      <ReauthSheet open={reauth !== null} onOpenChange={(o) => { if (!o) setReauth(null); }} action="priceChange" requireReason={false} onGranted={(grant) => { const v = reauth!; setReauth(null); void save(v, grant); }} />
    </Sheet>
  );
}
