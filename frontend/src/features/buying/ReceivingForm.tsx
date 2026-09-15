/**
 * Receiving a delivery (§6.7, J5): a paper invoice in one hand. Pick the supplier, type the invoice
 * number, then per line scan or search, choose the packaging, and type quantity and the invoice
 * cost. Packaging converts itself — 3 spools of 50 m posts 150 m. One delivery charge field is
 * spread across lines by value and each line shows where its cost landed. A cost far from last time
 * is questioned before it commits. Needs the server; STOCK never sees the resulting average.
 */
import { CheckCircle2, PackagePlus, Search, Trash2, Truck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apportionByValue, lineTotal, parseQty, roundHalfUp, uuidv7 } from "@simon/shared";
import { EmptyState, Keypad, MoneyText } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t, warningMessage } from "@/i18n/t.ts";
import { beep } from "@/lib/beep.ts";
import { cn } from "@/lib/cn.ts";
import { findByBarcode, searchCatalogue, syncCatalogue } from "@/lib/catalogue.ts";
import { useConnection } from "@/lib/connection.ts";
import { money, moneyPlain, qty as formatQty } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import type { CachedProduct } from "@/lib/local-db.ts";
import { useScanner } from "@/lib/scanner.ts";
import { NewProductSheet } from "./NewProductSheet.tsx";
import { SupplierPickerSheet, type SupplierRef } from "./SupplierPickerSheet.tsx";

interface ReceivingInfo { productId: string; name: string; stockUom: string; decimalPlaces: number; units: { uom: string; factorToStockUom: number; role: string }[]; lastInvoiceCostPerStockUnitMdram: number | null }
interface Line { id: string; info: ReceivingInfo; uom: string; factor: number; qtyText: string; costText: string; varianceConfirmed: boolean }

const VARIANCE_RATIO = 3;
const lineQty = (l: Line) => parseQty(l.qtyText, l.factor === 1 ? l.info.decimalPlaces : 0) ?? 0;
const lineCost = (l: Line) => parseQty(l.costText, 3) ?? 0;

function varianceOf(l: Line) {
  const last = l.info.lastInvoiceCostPerStockUnitMdram;
  const now = roundHalfUp(lineCost(l), l.factor);
  if (!last || !lineCost(l)) return null;
  return now >= last * VARIANCE_RATIO || now * VARIANCE_RATIO <= last ? { last, now } : null;
}

export function ReceivingForm() {
  const connection = useConnection();
  const [supplier, setSupplier] = useState<SupplierRef | null>(null);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [freight, setFreight] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "supplier" | "search">(null);
  const [creating, setCreating] = useState<{ name?: string; barcode?: string } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CachedProduct[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ number: string; warnings: string[] } | null>(null);

  useEffect(() => { const id = setTimeout(() => void searchCatalogue(query).then(setResults), 60); return () => clearTimeout(id); }, [query]);

  const addProduct = useCallback(async (p: CachedProduct) => {
    try {
      const info = await http.get<ReceivingInfo>(`/products/${p.id}/receiving`, { timeoutMs: 5000 });
      const purchase = info.units.find((u) => u.role === "PURCHASE") ?? info.units.find((u) => u.role === "STOCK") ?? { uom: info.stockUom, factorToStockUom: 1 };
      const line: Line = { id: uuidv7(), info, uom: purchase.uom, factor: purchase.factorToStockUom, qtyText: "", costText: "", varianceConfirmed: false };
      setLines((ls) => [...ls, line]);
      setEditing(line.id);
      beep("ok");
    } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
  }, []);

  const onScan = useCallback(async (code: string) => {
    const p = await findByBarcode(code);
    if (p) void addProduct(p);
    else { beep("error"); setCreating({ barcode: code }); }
  }, [addProduct]);
  useScanner(onScan, !editing && sheet === null && !creating && !done);

  const values = lines.map((l) => lineTotal(lineQty(l), lineCost(l)));
  const freightTotal = Number(freight || "0");
  // A handful of lines: cheaper to recompute than to memoise.
  const shares = apportionByValue(values, freightTotal);
  const invoiceTotal = values.reduce((a, v) => a + v, 0);
  // Say what is missing rather than leave a silent disabled button (rule 7).
  const missing = [
    !supplier && t("buy.missingSupplier"),
    !invoiceNo.trim() && t("buy.missingInvoice"),
    lines.length === 0 && t("buy.missingLines"),
    lines.some((l) => lineQty(l) <= 0 || l.costText === "") && t("buy.missingLineDetail"),
    lines.some((l) => varianceOf(l) && !l.varianceConfirmed) && t("buy.missingVariance"),
  ].filter(Boolean) as string[];
  const complete = missing.length === 0;
  const current = lines.find((l) => l.id === editing) ?? null;
  const update = (id: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const submit = async () => {
    if (!complete || !supplier) return;
    setBusy(true);
    try {
      const res = await http.post<{ number: string; warnings: { type: string }[] }>("/goods-receipts", {
        id: uuidv7(), supplierId: supplier.id, supplierInvoiceNo: invoiceNo.trim(), landedCostTotal: freightTotal,
        lines: lines.map((l) => ({ id: l.id, productId: l.info.productId, uom: l.uom, factorToStockUom: l.factor, qty: lineQty(l), invoiceUnitCostMdram: lineCost(l) })),
      }, { timeoutMs: 15_000 });
      void syncCatalogue().catch(() => {});
      setDone({ number: res.number, warnings: res.warnings.map((w) => w.type) });
    } catch (err) {
      toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network"));
    } finally {
      setBusy(false);
    }
  };

  if (connection === "offline") return <EmptyState icon={Truck} title={t("buy.receiveTitle")} hint={t("buy.offline")} className="flex-1" />;

  if (done) {
    return (
      <div className="mx-auto w-full max-w-md p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 size-16 text-success" aria-hidden />
        <h1 className="text-2xl font-semibold">{t("buy.done", { number: done.number })}</h1>
        {done.warnings.map((w) => <p key={w} className="mt-3 rounded-lg bg-attention-soft p-3 text-attention-foreground">{warningMessage(w)} — {t("buy.flagged")}</p>)}
        <Button size="xl" className="mt-6 w-full" onClick={() => { setDone(null); setLines([]); setInvoiceNo(""); setFreight(""); setSupplier(null); }}>{t("buy.another")}</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 pb-32">
      <h1 className="text-2xl font-semibold">{t("buy.receiveTitle")}</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>{t("buy.supplier")}</Label>
          <Button variant="secondary" size="lg" className="w-full justify-start" onClick={() => setSheet("supplier")}><Truck />{supplier?.name ?? t("buy.pickSupplier")}</Button>
        </div>
        <div>
          <Label htmlFor="inv-no">{t("buy.invoiceNo")}</Label>
          <Input id="inv-no" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="h-touch-lg tabular" maxLength={60} />
        </div>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-border">
        {lines.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground">{t("buy.empty")}. {t("buy.scanHint")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {lines.map((l, i) => {
              const q = lineQty(l);
              const landedPerUnit = q > 0 ? lineCost(l) + roundHalfUp((shares[i] ?? 0) * 1_000_000, q) : 0;
              const v = varianceOf(l);
              return (
                <li key={l.id}>
                  <button onClick={() => setEditing(l.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-muted">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{l.info.name}</div>
                      <div className="tabular text-sm text-muted-foreground">
                        {l.qtyText || "0"} {l.uom} × {l.costText || "0"} ֏{l.factor > 1 && q > 0 ? ` · ${t("buy.becomes", { qty: formatQty(q * l.factor, l.info.decimalPlaces), uom: l.info.stockUom })}` : ""}
                      </div>
                      {freightTotal > 0 && q > 0 && <div className="tabular text-xs text-muted-foreground">{t("buy.landedEach", { amount: moneyPlain(landedPerUnit / 1000), uom: l.uom })}</div>}
                      {v && !l.varianceConfirmed && <div className="text-sm text-attention-foreground">{t("buy.varianceTitle")}</div>}
                    </div>
                    <MoneyText amount={values[i]} className="font-semibold" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
          <Button variant="soft" size="lg" onClick={() => setSheet("search")}><Search />{t("buy.addItem")}</Button>
          <Button variant="ghost" size="lg" onClick={() => setCreating({})}><PackagePlus />{t("buy.newProduct")}</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="freight">{t("buy.delivery")}</Label>
          <Input id="freight" value={freight} onChange={(e) => setFreight(e.target.value.replace(/\D/g, "").slice(0, 9))} inputMode="numeric" className="h-touch-lg tabular text-lg" />
          <p className="mt-1 text-xs text-muted-foreground">{t("buy.deliveryHint")}</p>
        </div>
        <div className="rounded-xl bg-muted p-4">
          <div className="flex justify-between"><span className="text-muted-foreground">{t("buy.invoiceTotal")}</span><MoneyText amount={invoiceTotal} className="font-semibold" /></div>
          {freightTotal > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t("buy.delivery")}</span><MoneyText amount={freightTotal} /></div>}
        </div>
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-16 z-20 border-t border-border bg-background/95 p-3 backdrop-blur md:bottom-0 md:left-60">
        <div className="mx-auto max-w-3xl">
          {!complete && <p className="mb-2 text-center text-sm text-muted-foreground" role="status">{t("buy.missing", { items: missing.join(", ") })}</p>}
          <Button size="xl" className="w-full" disabled={!complete || busy} onClick={() => void submit()}>{t("buy.submit")} · {money(invoiceTotal)}</Button>
        </div>
      </div>

      <SupplierPickerSheet open={sheet === "supplier"} onOpenChange={(o) => setSheet(o ? "supplier" : null)} onPick={setSupplier} />
      <Sheet open={sheet === "search"} onOpenChange={(o) => { setSheet(o ? "search" : null); if (!o) setQuery(""); }} title={t("buy.addItem")}>
        <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("till.searchPlaceholder")} className="mb-2" />
        <ul className="max-h-[50dvh] divide-y divide-border overflow-y-auto">
          {results.map((p) => (
            <li key={p.id}><button onClick={() => { setSheet(null); setQuery(""); void addProduct(p); }} className="flex min-h-touch w-full items-center px-2 text-left active:bg-muted">{p.name}</button></li>
          ))}
        </ul>
        {query && <Button variant="ghost" className="mt-2 w-full" onClick={() => { setSheet(null); setCreating({ name: query }); }}><PackagePlus />{t("buy.newProduct")}</Button>}
      </Sheet>
      <NewProductSheet key={creating ? `${creating.name ?? ""}-${creating.barcode ?? ""}` : "closed"} open={creating !== null} onOpenChange={(o) => { if (!o) setCreating(null); }} initialName={creating?.name} barcode={creating?.barcode} onCreated={(p) => void addProduct(p)} />
      {current && <LineSheet key={current.id} line={current} onChange={(patch) => update(current.id, patch)} onRemove={() => { setLines((ls) => ls.filter((l) => l.id !== current.id)); setEditing(null); }} onClose={() => setEditing(null)} />}
    </div>
  );
}

function LineSheet({ line, onChange, onRemove, onClose }: { line: Line; onChange: (p: Partial<Line>) => void; onRemove: () => void; onClose: () => void }) {
  const [field, setField] = useState<"qty" | "cost">(line.qtyText ? "cost" : "qty");
  const units = line.info.units.length ? line.info.units : [{ uom: line.info.stockUom, factorToStockUom: 1, role: "STOCK" }];
  const q = lineQty(line);
  const v = varianceOf(line);
  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }} title={line.info.name} className="md:max-w-xl">
      <div className="mb-3 flex flex-wrap gap-2">
        {units.map((u) => (
          <button key={`${u.uom}-${u.factorToStockUom}`} onClick={() => onChange({ uom: u.uom, factor: u.factorToStockUom, qtyText: "", varianceConfirmed: false })} className={cn("h-touch rounded-lg border px-4 font-medium", line.uom === u.uom && line.factor === u.factorToStockUom ? "border-primary bg-primary-soft" : "border-border")}>
            {u.uom}{u.factorToStockUom > 1 ? ` (${u.factorToStockUom} ${line.info.stockUom})` : ""}
          </button>
        ))}
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button onClick={() => setField("qty")} className={cn("rounded-lg border p-3 text-left", field === "qty" ? "border-primary ring-2 ring-primary/30" : "border-border")}>
          <div className="text-sm text-muted-foreground">{t("buy.qty")}, {line.uom}</div>
          <div className="tabular text-2xl font-semibold">{line.qtyText || "0"}</div>
          {line.factor > 1 && q > 0 && <div className="tabular text-xs text-muted-foreground">{t("buy.becomes", { qty: formatQty(q * line.factor, line.info.decimalPlaces), uom: line.info.stockUom })}</div>}
        </button>
        <button onClick={() => setField("cost")} className={cn("rounded-lg border p-3 text-left", field === "cost" ? "border-primary ring-2 ring-primary/30" : "border-border")}>
          <div className="text-sm text-muted-foreground">{t("buy.unitCost", { uom: line.uom })}</div>
          <div className="tabular text-2xl font-semibold">{line.costText || "0"} ֏</div>
        </button>
      </div>
      {field === "qty"
        ? <Keypad value={line.qtyText} onChange={(qtyText) => onChange({ qtyText })} allowDecimal={line.factor === 1 && line.info.decimalPlaces > 0} maxDecimals={line.info.decimalPlaces} maxLength={7} />
        : <Keypad value={line.costText} onChange={(costText) => onChange({ costText, varianceConfirmed: false })} allowDecimal maxDecimals={3} maxLength={10} />}
      {v && (
        <div className="mt-3 rounded-lg bg-attention-soft p-3 text-attention-foreground">
          <div className="font-semibold">{t("buy.varianceTitle")}</div>
          <p className="text-sm">{t("buy.varianceBody", { last: money(v.last / 1000), now: money(v.now / 1000), uom: line.info.stockUom })}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => { setField("cost"); onChange({ costText: "", varianceConfirmed: false }); }}>{t("buy.varianceFix")}</Button>
            <Button variant="attention" disabled={line.varianceConfirmed} onClick={() => onChange({ varianceConfirmed: true })}>{t("buy.varianceConfirm")}</Button>
          </div>
        </div>
      )}
      <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
        <Button variant="ghost" size="lg" onClick={onRemove} aria-label={t("buy.remove")}><Trash2 /></Button>
        <Button size="lg" disabled={q <= 0 || !line.costText || (Boolean(v) && !line.varianceConfirmed)} onClick={onClose}>{t("common.done")}</Button>
      </div>
      {q > 0 && <p className="mt-2 text-center text-sm text-muted-foreground">{t("buy.lineValue")}: {money(lineTotal(q, lineCost(line)))}</p>}
    </Sheet>
  );
}

