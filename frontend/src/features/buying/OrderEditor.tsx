/**
 * One purchase order (§11). A draft is edited freely; once sent it is a document the supplier holds
 * — printable, cancellable while nothing has arrived, and filled by receiving, never by hand.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer, Search, Send, Tags, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { lineTotal, parseQty, uuidv7 } from "@simon/shared";
import { ConfirmSheet, MoneyText } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { problemMessage, t, type StringKey } from "@/i18n/t.ts";
import { searchCatalogue } from "@/lib/catalogue.ts";
import { cn } from "@/lib/cn.ts";
import { dateLabel, dateTime, money, qty as formatQty } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import type { CachedProduct } from "@/lib/local-db.ts";
import { printPage } from "@/lib/print.ts";
import { SupplierPickerSheet } from "./SupplierPickerSheet.tsx";
import { inOrderedUnit, statusTone, type Order } from "./orders.ts";

interface DraftLine { id: string; productId: string; productName: string; units: Array<{ uom: string; factor: number }>; uom: string; factor: number; qtyText: string; costText: string }

const toText = (milli: number) => String(milli / 1000);

export function OrderEditor({ orderId, onBack, onSaved }: { orderId: string | null; onBack: () => void; onSaved: (id: string) => void }) {
  const qc = useQueryClient();
  const order = useQuery({ queryKey: ["purchase-orders", "one", orderId], queryFn: () => http.get<Order>(`/purchase-orders/${orderId}`), enabled: Boolean(orderId) });
  const o = order.data;
  if (orderId && !o) return null;
  if (!o || o.status === "DRAFT") {
    return <DraftEditor key={o?.id ?? "new"} order={o ?? null} onBack={onBack} onSaved={async (id) => { await qc.invalidateQueries({ queryKey: ["purchase-orders"] }); onSaved(id); }} />;
  }
  return <SentOrder order={o} onBack={onBack} onChanged={() => qc.invalidateQueries({ queryKey: ["purchase-orders"] })} />;
}

function DraftEditor({ order, onBack, onSaved }: { order: Order | null; onBack: () => void; onSaved: (id: string) => Promise<void> }) {
  const [supplier, setSupplier] = useState<{ id: string; name: string } | null>(order ? { id: order.supplierId, name: order.supplierName } : null);
  const [expectedAt, setExpectedAt] = useState(order?.expectedAt ?? "");
  const [note, setNote] = useState(order?.note ?? "");
  const [lines, setLines] = useState<DraftLine[]>(() => (order?.lines ?? []).map((l) => ({
    id: l.id, productId: l.productId, productName: l.productName, units: [{ uom: l.uom, factor: l.factorToStockUom }],
    uom: l.uom, factor: l.factorToStockUom, qtyText: toText(inOrderedUnit(l.qtyOrdered, l.factorToStockUom)), costText: toText(l.unitCostMdram ?? 0),
  })));
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CachedProduct[]>([]);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!query.trim()) return;
    const id = setTimeout(() => void searchCatalogue(query, 15).then(setResults), 60);
    return () => clearTimeout(id);
  }, [query]);
  const shownResults = query.trim() ? results : [];

  const add = (p: CachedProduct) => {
    const units = p.units.filter((u) => u.role !== "SALE").map((u) => ({ uom: u.uom, factor: u.factorToStockUom }));
    const pack = units.filter((u) => u.factor > 1).sort((a, b) => b.factor - a.factor)[0] ?? units[0] ?? { uom: p.stockUom, factor: 1 };
    setLines((ls) => [...ls, { id: uuidv7(), productId: p.id, productName: p.name, units: units.length ? units : [pack], uom: pack.uom, factor: pack.factor, qtyText: "", costText: "" }]);
    setQuery("");
  };
  const update = (id: string, patch: Partial<DraftLine>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const qtyOf = (l: DraftLine) => parseQty(l.qtyText, 3) ?? 0;
  const costOf = (l: DraftLine) => parseQty(l.costText, 3) ?? 0;
  const total = lines.reduce((a, l) => a + lineTotal(qtyOf(l), costOf(l)), 0);
  const valid = (l: DraftLine) => qtyOf(l) > 0 && parseQty(l.costText, 3) !== null;
  const missing = [!supplier && t("orders.missingSupplier"), lines.length === 0 && t("orders.missingLines")].filter(Boolean) as string[];
  const ready = missing.length === 0 && lines.every(valid);

  const body = (id: string) => ({
    id, supplierId: supplier!.id, expectedAt: expectedAt || null, note,
    lines: lines.map((l) => ({ id: l.id, productId: l.productId, uom: l.uom, factorToStockUom: l.factor, qty: qtyOf(l), unitCostMdram: costOf(l) })),
  });

  const save = async (send: boolean) => {
    setBusy(true);
    try {
      const saved = order
        ? await http.put<Order>(`/purchase-orders/${order.id}`, body(order.id))
        : await http.post<Order>("/purchase-orders", body(uuidv7()));
      if (send) { await http.post(`/purchase-orders/${saved.id}/open`); toast.success(t("orders.sent")); }
      else toast.success(t("settings.saved"));
      await onSaved(saved.id);
    } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <button onClick={onBack} className="h-touch text-muted-foreground md:hidden">← {t("common.back")}</button>
      <h1 className="text-2xl font-semibold">{order ? t("orders.number", { number: order.number }) : t("orders.new")}</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>{t("orders.supplier")}</Label>
          <Button variant="secondary" size="lg" className="w-full justify-start" onClick={() => setPicking(true)}>{supplier?.name ?? t("buy.pickSupplier")}</Button>
        </div>
        <div>
          <Label htmlFor="po-expected">{t("orders.expectedAt")}</Label>
          <Input id="po-expected" type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="po-note">{t("orders.note")}</Label>
        <Input id="po-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">{t("orders.lines")}</h2>
        {lines.map((l) => (
          <div key={l.id} className={cn("rounded-xl bg-card p-3 ring-1", valid(l) ? "ring-border" : "ring-attention")}>
            <div className="mb-2 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-medium">{l.productName}</span>
              <Button size="icon" variant="ghost" aria-label={t("buy.remove")} onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))}><Trash2 /></Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
              <div>
                <Label>{t("orders.qty")}</Label>
                <div className="flex gap-1">
                  <Input inputMode="decimal" className="tabular" value={l.qtyText} onChange={(e) => update(l.id, { qtyText: e.target.value.replace(",", ".") })} />
                  {l.units.length > 1 ? (
                    <select className="h-touch rounded-lg border border-border bg-card px-2" value={`${l.uom}|${l.factor}`} onChange={(e) => { const [uom, f] = e.target.value.split("|"); update(l.id, { uom, factor: Number(f) }); }}>
                      {l.units.map((u) => <option key={`${u.uom}|${u.factor}`} value={`${u.uom}|${u.factor}`}>{u.uom}</option>)}
                    </select>
                  ) : <span className="self-center px-1 text-muted-foreground">{l.uom}</span>}
                </div>
              </div>
              <div>
                <Label>{t("orders.unitCost", { uom: l.uom })}</Label>
                <Input inputMode="decimal" className="tabular" value={l.costText} onChange={(e) => update(l.id, { costText: e.target.value.replace(",", ".") })} />
              </div>
              <div>
                <Label>{t("orders.lineTotal")}</Label>
                <MoneyText amount={lineTotal(qtyOf(l), costOf(l))} className="block pt-2 text-lg font-semibold" />
              </div>
            </div>
          </div>
        ))}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("orders.addProduct")} className="pl-10" />
        </div>
        {shownResults.length > 0 && (
          <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-border shadow-sm">
            {shownResults.map((p) => <li key={p.id}><button className="flex min-h-touch w-full items-center px-4 text-left" onClick={() => add(p)}>{p.name}</button></li>)}
          </ul>
        )}
      </section>

      <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
        <span className="font-medium">{t("orders.total")}</span>
        <MoneyText amount={total} className="text-2xl font-bold" />
      </div>
      {missing.length > 0 && <p className="text-sm text-attention-foreground">{t("orders.missing", { items: missing.join(", ") })}</p>}
      <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
        <Button size="lg" variant="secondary" disabled={!ready || busy} onClick={() => void save(false)}>{t("orders.save")}</Button>
        <Button size="lg" disabled={!ready || busy} onClick={() => setSending(true)}><Send />{t("orders.send")}</Button>
      </div>

      <SupplierPickerSheet open={picking} onOpenChange={setPicking} onPick={(s) => { setSupplier({ id: s.id, name: s.name }); setPicking(false); }} />
      <ConfirmSheet open={sending} onOpenChange={setSending} destructive={false} title={t("orders.send")} description={t("orders.sendHint")} confirmLabel={t("orders.send")} onConfirm={() => void save(true)} />
    </div>
  );
}

function SentOrder({ order: o, onBack, onChanged }: { order: Order; onBack: () => void; onChanged: () => void }) {
  const [cancelling, setCancelling] = useState(false);
  // A column of blanks tells the supplier nothing; show codes only when some line has one.
  const hasCodes = o.lines.some((l) => l.sku || l.barcode);
  const cancel = async () => {
    try { await http.post(`/purchase-orders/${o.id}/cancel`); onChanged(); }
    catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
  };
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <div className="print-hidden space-y-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="h-touch text-muted-foreground md:hidden">← {t("common.back")}</button>
          <span className={cn("rounded-xs px-3 py-1 text-sm font-medium", statusTone(o.status))}>{t(`orders.statuses.${o.status}` as StringKey)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={printPage}><Printer />{t("orders.print")}</Button>
          <Button asChild variant="secondary"><Link to={`/labels?ids=${o.lines.map((l) => l.productId).join(",")}`}><Tags />{t("labels.title")}</Link></Button>
          {o.status === "OPEN" && <Button variant="ghost" onClick={() => setCancelling(true)}><X />{t("orders.cancel")}</Button>}
        </div>
      </div>

      {/* The document the supplier gets: no status, no buttons. */}
      <article className="print-area space-y-4 rounded-xl bg-card p-5 ring-1 ring-border shadow-sm print:ring-0">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold">{t("orders.printTitle")} {o.number}</h1>
          <span className="text-muted-foreground">{t("orders.printedAt")}: {dateTime(o.openedAt ?? o.createdAt)}</span>
        </header>
        <p><span className="text-muted-foreground">{t("orders.supplier")}:</span> <strong>{o.supplierName}</strong>{o.supplierPhone ? ` · ${o.supplierPhone}` : ""}</p>
        {o.expectedAt && <p><span className="text-muted-foreground">{t("orders.expectedAt")}:</span> {dateLabel(o.expectedAt)}</p>}
        {o.note && <p>{o.note}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-[0.95rem]">
            <thead>
              <tr className="border-b border-border text-sm text-muted-foreground">
                <th className="py-2 pr-3 text-left font-medium">{t("reports.cols.productName")}</th>
                {hasCodes && <th className="py-2 pr-3 text-left font-medium">{t("products.sku")}</th>}
                <th className="py-2 pr-3 text-right font-medium">{t("orders.qty")}</th>
                {o.lines[0]?.unitCostMdram !== undefined && <th className="py-2 pr-3 text-right font-medium">{t("reports.cols.price")}</th>}
                {o.lines[0]?.unitCostMdram !== undefined && <th className="py-2 text-right font-medium">{t("orders.lineTotal")}</th>}
                <th className="print-hidden py-2 pl-3 text-right font-medium">{t("orders.remaining")}</th>
              </tr>
            </thead>
            <tbody>
              {o.lines.map((l) => {
                const ordered = inOrderedUnit(l.qtyOrdered, l.factorToStockUom);
                return (
                  <tr key={l.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">{l.productName}</td>
                    {hasCodes && <td className="tabular py-2 pr-3 text-muted-foreground">{l.sku ?? l.barcode ?? ""}</td>}
                    <td className="tabular py-2 pr-3 text-right">{formatQty(ordered, 3)} {l.uom}</td>
                    {l.unitCostMdram !== undefined && <td className="tabular py-2 pr-3 text-right">{money(l.unitCostMdram / 1000)}</td>}
                    {l.unitCostMdram !== undefined && <td className="tabular py-2 text-right">{money(lineTotal(ordered, l.unitCostMdram))}</td>}
                    <td className="print-hidden tabular py-2 pl-3 text-right text-muted-foreground">
                      {formatQty(Math.max(0, l.qtyOrdered - l.qtyReceived), l.decimalPlaces)} {l.stockUom}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {o.total !== undefined && <p className="text-right text-lg font-semibold">{t("orders.total")}: {money(o.total)}</p>}
      </article>

      {o.receipts.length > 0 && (
        <section className="print-hidden rounded-xl bg-card p-4 ring-1 ring-border shadow-sm">
          <h2 className="mb-1 font-semibold">{t("stockOps.receipts")}</h2>
          <ul className="text-sm">{o.receipts.map((r) => <li key={r.id} className="tabular">{r.number} · {dateTime(r.receivedAt)}</li>)}</ul>
        </section>
      )}
      <ConfirmSheet open={cancelling} onOpenChange={setCancelling} title={t("orders.cancelTitle")} description={t("orders.cancelHint")} confirmLabel={t("orders.cancelConfirm")} onConfirm={() => void cancel()} />
    </div>
  );
}
