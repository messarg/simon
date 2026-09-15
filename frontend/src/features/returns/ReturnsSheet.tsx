/**
 * Returns (§6.5): always from the original sale. Per-line quantities never beyond what is
 * left; one plain question per line — did the goods come back to stock? — and a refund split
 * the way the sale was paid, shown before it is confirmed.
 */
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, Search, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { computeReturn, QTY_SCALE, uuidv7, type OriginalSale } from "@simon/shared";
import { MoneyText } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t, type StringKey } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { useConnection } from "@/lib/connection.ts";
import { dateTime, money, qty as formatQty } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import { outbox } from "@/lib/outbox.ts";

interface SaleDetail {
  id: string; number: string; total: number; discountTotal: number; roundingAdjustment: number; priceBasis: "INCLUSIVE" | "EXCLUSIVE"; completedAt: string; status: string;
  lines: { id: string; productName: string; qty: number; uom: string; unitPriceMdram: number; lineTotal: number; lineTax: number; taxRateBp: number }[];
  payments: { method: "CASH" | "CARD" | "DEBT"; amount: number }[];
  returnable: { saleLineId: string; returned: number; remaining: number }[];
}

const REASONS: StringKey[] = ["returns.reasonChips.wrong", "returns.reasonChips.extra", "returns.reasonChips.damaged", "returns.reasonChips.changedMind"];

export function ReturnsSheet({ open, onOpenChange, shiftId, initialNumber }: { open: boolean; onOpenChange: (o: boolean) => void; shiftId: string | null; initialNumber?: string | null }) {
  const connection = useConnection();
  // Remounted by the parent on each opening, so a scanned receipt number arrives as initial state.
  const [number, setNumber] = useState(initialNumber ?? "");
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [selected, setSelected] = useState<Record<string, { qty: number; restock: boolean }>>({});
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<{ cash: number; card: number; debt: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recent = useQuery({
    queryKey: ["sales", "recent"],
    enabled: open && !sale && connection === "online",
    queryFn: () => http.get<{ items: SaleDetail[] }>("/sales", { query: { status: "COMPLETED", limit: 15 } }),
  });

  const reset = () => { setNumber(""); setSale(null); setSelected({}); setReason(""); setDone(null); setError(null); };
  const close = (o: boolean) => { onOpenChange(o); if (!o) reset(); };

  const load = async (path: string) => {
    try {
      const s = await http.get<SaleDetail>(path, { timeoutMs: 5000 });
      if (s.status !== "COMPLETED") throw new ApiProblem({ type: "illegal-transition", title: "", status: 422 });
      setError(null);
      setSale(s);
      setSelected({});
    } catch (err) {
      setError(err instanceof ApiProblem && err.status === 404 ? t("returns.notFound") : problemMessage(err instanceof ApiProblem ? err.type : "network"));
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && initialNumber) void load(`/sales/by-number/${encodeURIComponent(initialNumber)}`); }, [open, initialNumber]);

  const preview = useMemo(() => {
    if (!sale) return null;
    const request = Object.entries(selected).filter(([, v]) => v.qty > 0).map(([saleLineId, v]) => ({
      saleLineId, qty: v.qty, alreadyReturned: sale.returnable.find((r) => r.saleLineId === saleLineId)?.returned ?? 0,
    }));
    if (!request.length) return null;
    const original: OriginalSale = { priceBasis: sale.priceBasis, discountTotal: sale.discountTotal, roundingAdjustment: sale.roundingAdjustment, total: sale.total, lines: sale.lines, payments: sale.payments.map((p) => ({ method: p.method, amount: p.amount })) };
    return computeReturn(original, request);
  }, [sale, selected]);

  const submit = async () => {
    if (!sale || !preview || !shiftId) return;
    const id = uuidv7();
    const now = new Date().toISOString();
    const lines = Object.entries(selected).filter(([, v]) => v.qty > 0).map(([saleLineId, v]) => ({ id: uuidv7(), saleLineId, qty: v.qty, restock: v.restock, writeOffReason: v.restock ? null : "DAMAGE" as const, productId: null, refundAmount: null }));
    const cash = preview.tenders.filter((x) => x.method === "CASH").reduce((a, x) => a + x.amount, 0);
    await outbox.enqueue("sale-return", id, { id, originalSaleId: sale.id, shiftId, reason: reason.trim(), lines, createdAt: now, sentAt: now, queued: false }, {
      dependsOn: outbox.has(sale.id) ? [sale.id] : [], afterSync: { print: true, drawer: cash > 0 }, label: `${t("returns.title")} ← ${sale.number} · ${money(preview.total)}`,
    });
    const sum = (m: string) => preview.tenders.filter((x) => x.method === m).reduce((a, x) => a + x.amount, 0);
    setDone({ cash, card: sum("CARD"), debt: sum("DEBT_REDUCTION") });
    toast.success(t("returns.done"));
  };

  const step = (lineId: string, remaining: number, delta: number) => setSelected((s) => {
    const cur = s[lineId] ?? { qty: 0, restock: true };
    return { ...s, [lineId]: { ...cur, qty: Math.min(remaining, Math.max(0, cur.qty + delta)) } };
  });

  return (
    <Sheet open={open} onOpenChange={close} title={t("returns.title")} description={sale ? `№ ${sale.number} · ${dateTime(sale.completedAt)}` : t("returns.findHint")} className="md:max-w-xl">
      {done ? (
        <div className="text-center">
          <Undo2 className="mx-auto mb-3 size-14 text-primary" aria-hidden />
          {done.cash > 0 && <><div className="text-muted-foreground">{t("returns.refundCash")}</div><MoneyText amount={done.cash} className="text-6xl font-bold" /></>}
          {done.card > 0 && <div className="mt-3 text-lg">{t("returns.refundCard")}: <MoneyText amount={done.card} className="font-semibold" /></div>}
          {done.debt > 0 && <div className="mt-3 text-lg">{t("returns.refundDebt")}: <MoneyText amount={done.debt} className="font-semibold" /></div>}
          <Button size="xl" className="mt-6 w-full" onClick={() => close(false)}>{t("common.done")}</Button>
        </div>
      ) : connection === "offline" ? (
        <p className="rounded-lg bg-attention-soft p-4 text-attention-foreground">{t("returns.offline")}</p>
      ) : !sale ? (
        <div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (number.trim()) void load(`/sales/by-number/${encodeURIComponent(number.trim().toUpperCase())}`); }}>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder={t("returns.numberPlaceholder")} className="tabular uppercase" autoCapitalize="characters" />
            <Button type="submit" size="md" aria-label={t("returns.find")}><Search /></Button>
          </form>
          {error && <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>}
          <h3 className="mt-5 mb-1 text-sm font-medium text-muted-foreground">{t("returns.recent")}</h3>
          <ul className="divide-y divide-border">
            {recent.data?.items.map((s) => (
              <li key={s.id}>
                <button onClick={() => void load(`/sales/${s.id}`)} className="flex min-h-touch-lg w-full items-center gap-3 py-2 text-left active:bg-muted">
                  <div className="min-w-0 flex-1">
                    <div className="tabular font-medium">№ {s.number}</div>
                    <div className="truncate text-sm text-muted-foreground">{dateTime(s.completedAt)} · {s.lines[0]?.productName}{s.lines.length > 1 ? ` +${s.lines.length - 1}` : ""}</div>
                  </div>
                  <MoneyText amount={s.total} className="font-semibold" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          {sale.returnable.every((r) => r.remaining <= 0) && <p className="rounded-lg bg-muted p-3 text-muted-foreground">{t("returns.nothingLeft")}</p>}
          <ul className="space-y-2">
            {sale.lines.map((l) => {
              const r = sale.returnable.find((x) => x.saleLineId === l.id);
              const remaining = r?.remaining ?? 0;
              const sel = selected[l.id] ?? { qty: 0, restock: true };
              const unitStep = l.qty % QTY_SCALE === 0 ? QTY_SCALE : 100;
              return (
                <li key={l.id} className={cn("rounded-lg border p-3", sel.qty > 0 ? "border-primary bg-primary-soft/40" : "border-border", remaining <= 0 && "opacity-50")}>
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{l.productName}</div>
                      <div className="tabular text-sm text-muted-foreground">{t("returns.remaining", { qty: `${formatQty(remaining, 3)} ${l.uom}` })}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="secondary" size="icon" disabled={sel.qty <= 0} onClick={() => step(l.id, remaining, -unitStep)} aria-label="−"><Minus /></Button>
                      <span className="tabular w-14 text-center text-xl font-semibold">{formatQty(sel.qty, 3)}</span>
                      <Button variant="secondary" size="icon" disabled={sel.qty >= remaining} onClick={() => step(l.id, remaining, unitStep)} aria-label="+"><Plus /></Button>
                    </div>
                  </div>
                  {sel.qty > 0 && (
                    <div className="mt-3">
                      <div className="mb-1 text-sm">{t("returns.restockQuestion")}</div>
                      <div className="grid grid-cols-2 gap-2">
                        {[true, false].map((v) => (
                          <button key={String(v)} onClick={() => setSelected((s) => ({ ...s, [l.id]: { ...sel, restock: v } }))} className={cn("h-touch rounded-lg border font-medium", sel.restock === v ? "border-primary bg-card text-accent-foreground" : "border-border bg-card/60 text-muted-foreground")}>
                            {v ? t("returns.restockYes") : t("returns.restockNo")}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div>
            <Label htmlFor="ret-reason">{t("returns.reason")}</Label>
            <div className="mb-2 flex flex-wrap gap-2">
              {REASONS.map((k) => (
                <button key={k} onClick={() => setReason(t(k))} className={cn("h-10 rounded-full border px-3 text-sm", reason === t(k) ? "border-primary bg-primary-soft" : "border-border")}>{t(k)}</button>
              ))}
            </div>
            <Input id="ret-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          </div>
          {preview && (
            <div className="rounded-lg bg-muted p-3">
              {preview.tenders.map((x) => (
                <div key={x.method} className="flex justify-between"><span>{x.method === "CASH" ? t("returns.refundCash") : x.method === "DEBT_REDUCTION" ? t("returns.refundDebt") : t("returns.refundCard")}</span><MoneyText amount={x.amount} className="font-semibold" /></div>
              ))}
              <div className="mt-1 flex justify-between border-t border-border pt-1 text-lg font-semibold"><span>{t("returns.total")}</span><MoneyText amount={preview.total} /></div>
            </div>
          )}
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Button variant="secondary" size="xl" onClick={() => setSale(null)}>{t("common.back")}</Button>
            <Button size="xl" disabled={!preview || !reason.trim() || !shiftId} onClick={() => void submit()}>{preview ? t("returns.submit") : t("returns.nothingSelected")}</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
