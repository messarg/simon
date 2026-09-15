/**
 * A delivery after it was received: its lines as they arrived (3 spools, not 150 m — §27.31),
 * returning goods to the supplier by receipt line (§13.7), and for the owner, correcting a cost
 * that was typed wrongly (§10.5, §11 `CostCorrection`).
 */
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, Undo2, Wrench } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { parseQty, QTY_SCALE, uuidv7 } from "@simon/shared";
import { Keypad, MoneyText } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t, warningMessage } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { dateTime, money, moneyPlain, qty as formatQty } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";

interface ReceiptLine { id: string; productId: string; productName: string; stockUom: string; qty: number; uom: string; factorToStockUom: number; invoiceUnitCostMdram: number; landedUnitCostMdram?: number; returnedQty: number }
interface Receipt { id: string; number: string; supplierInvoiceNo: string; receivedAt: string; total: number; landedCostTotal: number; supplier: { id: string; name: string }; lines: ReceiptLine[] }

export function ReceiptListSheet({ open, onOpenChange, admin, supplierId }: { open: boolean; onOpenChange: (o: boolean) => void; admin: boolean; supplierId?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["goods-receipts", supplierId ?? "all"], enabled: open, queryFn: () => http.get<{ items: Array<{ id: string; number: string; supplierName: string; supplierInvoiceNo: string; receivedAt: string; total: number }> }>("/goods-receipts", { query: { supplierId, limit: 50 } }) });
  return (
    <>
      <Sheet open={open && !openId} onOpenChange={onOpenChange} title={t("buy.recent")}>
        <ul className="max-h-[60dvh] divide-y divide-border overflow-y-auto">
          {list.data?.items.map((r) => (
            <li key={r.id}>
              <button onClick={() => setOpenId(r.id)} className="flex min-h-touch-lg w-full items-center gap-3 py-2 text-left active:bg-muted">
                <div className="min-w-0 flex-1"><div className="font-medium">{r.number} · {r.supplierName}</div><div className="text-sm text-muted-foreground">{dateTime(r.receivedAt)} · {r.supplierInvoiceNo}</div></div>
                <MoneyText amount={r.total} className="font-semibold" />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
      {openId && <ReceiptSheet key={openId} receiptId={openId} admin={admin} onOpenChange={(o) => { if (!o) setOpenId(null); }} onChanged={() => void list.refetch()} />}
    </>
  );
}

export function ReceiptSheet({ receiptId, admin, onOpenChange, onChanged }: { receiptId: string; admin: boolean; onOpenChange: (o: boolean) => void; onChanged: () => void }) {
  const receipt = useQuery({ queryKey: ["goods-receipts", receiptId], queryFn: () => http.get<Receipt>(`/goods-receipts/${receiptId}`) });
  const [mode, setMode] = useState<"view" | "return">("view");
  const [back, setBack] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [correcting, setCorrecting] = useState<ReceiptLine | null>(null);
  const r = receipt.data;

  const submitReturn = async () => {
    if (!r) return;
    try {
      const res = await http.post<{ total: number; landedCostLost: number; warnings: { type: string }[] }>("/purchase-returns", {
        id: uuidv7(), receiptId: r.id, reason: reason.trim(), lines: Object.entries(back).filter(([, q]) => q > 0).map(([receiptLineId, qty]) => ({ id: uuidv7(), receiptLineId, qty })),
      });
      toast.success(t("buy.returned", { amount: money(res.total) }), { description: res.landedCostLost ? t("buy.lost", { amount: money(res.landedCostLost) }) : undefined });
      for (const w of res.warnings) toast.warning(warningMessage(w.type), { description: t("buy.flagged") });
      setMode("view"); setBack({}); setReason("");
      await receipt.refetch();
      onChanged();
    } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
  };

  return (
    <>
      <Sheet open={!correcting} onOpenChange={onOpenChange} title={r ? t("buy.receipt", { number: r.number }) : t("common.loading")} description={r ? `${r.supplier.name} · ${r.supplierInvoiceNo} · ${dateTime(r.receivedAt)}` : undefined} className="md:max-w-2xl">
        {r && (
          <div className="space-y-3">
            <ul className="divide-y divide-border rounded-xl ring-1 ring-border">
              {r.lines.map((l) => {
                const remaining = l.qty - l.returnedQty;
                const n = back[l.id] ?? 0;
                const step = l.qty % QTY_SCALE === 0 ? QTY_SCALE : 100;
                return (
                  <li key={l.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{l.productName}</div>
                      <div className="tabular text-sm text-muted-foreground">
                        {formatQty(l.qty, 3)} {l.uom} × {moneyPlain(l.invoiceUnitCostMdram / 1000)} ֏
                        {admin && l.landedUnitCostMdram !== undefined && l.landedUnitCostMdram !== l.invoiceUnitCostMdram ? ` → ${moneyPlain(l.landedUnitCostMdram / 1000)} ֏` : ""}
                        {l.returnedQty > 0 ? ` · ${t("buy.returnedQty", { qty: formatQty(l.returnedQty, 3) })}` : ""}
                      </div>
                    </div>
                    {mode === "return" ? (
                      <div className="flex items-center gap-1">
                        <Button variant="secondary" size="icon" disabled={n <= 0} onClick={() => setBack((b) => ({ ...b, [l.id]: Math.max(0, n - step) }))} aria-label="−"><Minus /></Button>
                        <span className="tabular w-12 text-center font-semibold">{formatQty(n, 3)}</span>
                        <Button variant="secondary" size="icon" disabled={n >= remaining} onClick={() => setBack((b) => ({ ...b, [l.id]: Math.min(remaining, n + step) }))} aria-label="+"><Plus /></Button>
                      </div>
                    ) : admin ? (
                      <Button variant="ghost" size="sm" onClick={() => setCorrecting(l)}><Wrench />{t("buy.correctCost")}</Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <div className="flex justify-between rounded-lg bg-muted p-3"><span>{t("buy.invoiceTotal")}</span><MoneyText amount={r.total} className="font-semibold" /></div>
            {mode === "view" ? (
              <Button variant="secondary" size="lg" className="w-full" onClick={() => setMode("return")}><Undo2 />{t("buy.returnGoods")}</Button>
            ) : (
              <>
                <Label htmlFor="pr-reason">{t("buy.returnReason")}</Label>
                <Input id="pr-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <Button variant="secondary" size="lg" onClick={() => { setMode("view"); setBack({}); }}>{t("common.cancel")}</Button>
                  <Button size="lg" disabled={!reason.trim() || !Object.values(back).some((q) => q > 0)} onClick={() => void submitReturn()}>{t("buy.returnSubmit")}</Button>
                </div>
              </>
            )}
          </div>
        )}
      </Sheet>
      {correcting && <CorrectCostSheet key={correcting.id} line={correcting} onClose={() => setCorrecting(null)} onDone={() => { setCorrecting(null); void receipt.refetch(); }} />}
    </>
  );
}

function CorrectCostSheet({ line, onClose, onDone }: { line: ReceiptLine; onClose: () => void; onDone: () => void }) {
  const [entry, setEntry] = useState("");
  const [reason, setReason] = useState("");
  const value = parseQty(entry, 3);
  const save = async () => {
    try {
      await http.post("/cost-corrections", { id: uuidv7(), goodsReceiptLineId: line.id, correctUnitCostMdram: value, reason: reason.trim() });
      toast.success(t("buy.corrected"));
      onDone();
    } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
  };
  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }} title={t("buy.correctCost")} description={`${line.productName} · ${moneyPlain(line.invoiceUnitCostMdram / 1000)} ֏ / ${line.uom}`}>
      <div className={cn("mb-2 rounded-lg bg-muted px-4 py-2")}><span className="text-sm text-muted-foreground">{t("buy.correctTo", { uom: line.uom })}</span><div className="tabular text-3xl font-semibold">{entry || "0"} ֏</div></div>
      <Label htmlFor="cc-reason">{t("buy.correctReason")}</Label>
      <Input id="cc-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mb-3" maxLength={200} />
      <Keypad value={entry} onChange={setEntry} allowDecimal maxDecimals={3} maxLength={10} />
      <Button size="xl" className="mt-3 w-full" disabled={value === null || value === line.invoiceUnitCostMdram || !reason.trim()} onClick={() => void save()}>{t("common.save")}</Button>
    </Sheet>
  );
}
