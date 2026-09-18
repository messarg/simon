/**
 * One supplier (§6.14, §13.8): receipts with what is still unpaid and when it falls due under the
 * agreed terms, payments with the receipts they settled, standing credits and returns. The owner
 * pays here — oldest receipt first unless chosen — and corrects a payment made to the wrong
 * supplier by a linked reversal.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Banknote, Pencil, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { uuidv7 } from "@simon/shared";
import { Keypad, MoneyText } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { dateTime, money, moneyPlain } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import { ReceiptSheet } from "./ReceiptSheet.tsx";
import { SupplierPickerSheet } from "./SupplierPickerSheet.tsx";

interface Ledger {
  /** `paymentTerms` is the owner's and absent for a manager (§16.5). */
  supplier: { id: string; name: string; phone: string | null; taxId: string | null; paymentTerms?: number; leadTimeDays: number; isActive: boolean };
  outstanding: number; overdue: number;
  receipts: Array<{ id: string; number: string; supplierInvoiceNo: string; receivedAt: string; total: number; unpaid: number; dueDate: string; overdue: boolean; daysPastDue: number }>;
  payments: Array<{ id: string; amount: number; method: string; paidAt: string; userName: string | null; reversesId: string | null; reversed: boolean; settles: { goodsReceiptId: string; amount: number }[] }>;
  returns: Array<{ id: string; receiptId: string | null; reason: string; total: number; landedCostLost: number; createdAt: string }>;
  credits: Array<{ id: string; amount: number; remaining: number; reason: string; createdAt: string }>;
}

export function SupplierLedger({ supplierId, shiftId, onBack }: { supplierId: string; shiftId: string | null; onBack: () => void }) {
  const qc = useQueryClient();
  const ledger = useQuery({ queryKey: ["suppliers", supplierId, "ledger"], queryFn: () => http.get<Ledger>(`/suppliers/${supplierId}/ledger`) });
  const [sheet, setSheet] = useState<null | "pay" | "edit">(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [reversing, setReversing] = useState<string | null>(null);
  const refresh = async () => { await qc.invalidateQueries({ queryKey: ["suppliers"] }); };
  const d = ledger.data;
  if (!d) return null;
  const numberOf = new Map(d.receipts.map((r) => [r.id, r.number]));

  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <button onClick={onBack} className="mb-2 h-10 text-muted-foreground md:hidden">← {t("common.back")}</button>
      <div className="mb-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold">{d.supplier.name}</h1>
          <p className="text-sm text-muted-foreground">{d.supplier.paymentTerms !== undefined ? `${t("suppliers.terms")}: ${d.supplier.paymentTerms} · ` : ""}{t("suppliers.lead")}: {d.supplier.leadTimeDays}{d.supplier.taxId ? ` · ${t("suppliers.taxId")} ${d.supplier.taxId}` : ""}</p>
        </div>
        <Button variant="secondary" onClick={() => setSheet("edit")}><Pencil />{t("suppliers.edit")}</Button>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-sm">
          <div className="text-sm text-muted-foreground">{d.outstanding >= 0 ? t("suppliers.owe") : t("suppliers.credit", { amount: "" })}</div>
          <MoneyText amount={Math.abs(d.outstanding)} className="text-3xl font-bold" />
        </div>
        <div className={cn("rounded-xl p-4 ring-1", d.overdue > 0 ? "bg-attention-soft ring-attention" : "bg-card ring-border")}>
          <div className="text-sm text-muted-foreground">{t("suppliers.overdue", { amount: "" })}</div>
          <MoneyText amount={d.overdue} className="text-3xl font-bold" />
        </div>
      </div>
      <Button size="xl" className="mb-4 w-full" onClick={() => setSheet("pay")}><Banknote />{t("suppliers.pay")}</Button>

      <h2 className="mb-1 font-semibold">{t("suppliers.receipts")}</h2>
      <ul className="mb-4 divide-y divide-border rounded-xl bg-card ring-1 ring-border shadow-sm">
        {d.receipts.slice().reverse().map((r) => (
          <li key={r.id}>
            <button onClick={() => setReceiptId(r.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-muted">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{r.number} · {r.supplierInvoiceNo}</div>
                <div className="text-sm text-muted-foreground">{dateTime(r.receivedAt)} · {t("suppliers.due", { date: dateTime(r.dueDate).split(" ").slice(0, 2).join(" ") })}</div>
                {r.overdue && <div className="flex items-center gap-1 text-sm text-attention-foreground"><AlertTriangle className="size-3.5" aria-hidden />{t("suppliers.daysLate", { n: r.daysPastDue })}</div>}
              </div>
              <div className="text-right">
                <MoneyText amount={r.total} className="font-semibold" />
                <div className="text-xs text-muted-foreground">{r.unpaid > 0 ? t("suppliers.unpaid", { amount: money(r.unpaid) }) : t("suppliers.paidOff")}</div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {d.payments.length > 0 && (
        <>
          <h2 className="mb-1 font-semibold">{t("suppliers.payments")}</h2>
          <ul className="mb-4 divide-y divide-border rounded-xl bg-card ring-1 ring-border shadow-sm">
            {d.payments.slice().reverse().map((p) => (
              <li key={p.id} className={cn("flex items-center gap-3 px-4 py-2.5", (p.reversed || p.reversesId) && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{t(`suppliers.method.${p.method as "CASH"}`)}{(p.reversed || p.reversesId) && <span className="ml-2 text-xs">{t("suppliers.reversed")}</span>}</div>
                  <div className="text-sm text-muted-foreground">{dateTime(p.paidAt)} · {p.userName}</div>
                  {p.settles.length > 0 && <div className="text-xs text-muted-foreground">{t("suppliers.settles", { items: p.settles.map((s) => numberOf.get(s.goodsReceiptId) ?? "").join(", ") })}</div>}
                </div>
                <MoneyText amount={-p.amount} signed className="font-semibold" />
                {!p.reversed && !p.reversesId && <Button variant="ghost" size="icon" onClick={() => setReversing(p.id)} aria-label={t("suppliers.reverse")}><Undo2 /></Button>}
              </li>
            ))}
          </ul>
        </>
      )}

      {d.credits.filter((c) => c.remaining > 0).length > 0 && (
        <p className="mb-3 rounded-lg bg-success-soft p-3 text-sm">{t("suppliers.credit", { amount: money(d.credits.reduce((a, c) => a + Math.max(0, c.remaining), 0)) })}</p>
      )}
      {d.returns.length > 0 && (
        <>
          <h2 className="mb-1 font-semibold">{t("suppliers.returns")}</h2>
          <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-border shadow-sm">
            {d.returns.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1"><div className="font-medium">{r.reason}</div><div className="text-sm text-muted-foreground">{dateTime(r.createdAt)}{r.landedCostLost ? ` · ${t("buy.lost", { amount: money(r.landedCostLost) })}` : ""}</div></div>
                <MoneyText amount={-r.total} signed />
              </li>
            ))}
          </ul>
        </>
      )}

      <PaySupplierSheet key={sheet === "pay" ? "pay-open" : "pay-closed"} open={sheet === "pay"} onOpenChange={(o) => setSheet(o ? "pay" : null)} ledger={d} shiftId={shiftId} onDone={refresh} />
      <EditSupplierSheet key={sheet === "edit" ? "edit-open" : "edit-closed"} open={sheet === "edit"} onOpenChange={(o) => setSheet(o ? "edit" : null)} ledger={d} onDone={refresh} />
      {receiptId && <ReceiptSheet key={receiptId} receiptId={receiptId} admin onOpenChange={(o) => { if (!o) setReceiptId(null); }} onChanged={() => void refresh()} />}
      <ReversePaymentSheet key={reversing ?? "none"} paymentId={reversing} onClose={() => setReversing(null)} onDone={refresh} />
    </div>
  );
}

function PaySupplierSheet({ open, onOpenChange, ledger, shiftId, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; ledger: Ledger; shiftId: string | null; onDone: () => Promise<void> }) {
  const [entry, setEntry] = useState("");
  const [method, setMethod] = useState<"CASH" | "CARD" | "TRANSFER">("TRANSFER");
  const amount = Number(entry || "0");
  const plan = useMemo(() => {
    let left = amount;
    const out: Array<{ number: string; amount: number }> = [];
    for (const r of ledger.receipts) {
      if (left <= 0 || r.unpaid <= 0) continue;
      const take = Math.min(left, r.unpaid);
      out.push({ number: r.number, amount: take });
      left -= take;
    }
    return { out, left };
  }, [amount, ledger.receipts]);
  const save = async () => {
    try {
      await http.post("/supplier-payments", { id: uuidv7(), supplierId: ledger.supplier.id, amount, method, shiftId: method === "CASH" ? shiftId : null });
      toast.success(t("suppliers.paid"));
      await onDone();
      onOpenChange(false);
    } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("suppliers.payTitle")} description={ledger.supplier.name}>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {(["TRANSFER", "CASH", "CARD"] as const).map((m) => (
          <button key={m} onClick={() => setMethod(m)} className={cn("h-touch rounded-lg border px-2 text-sm font-medium", method === m ? "border-primary bg-primary-soft" : "border-border")}>{t(`suppliers.method.${m}`)}</button>
        ))}
      </div>
      {method === "CASH" && !shiftId && <p className="mb-2 rounded-lg bg-attention-soft p-2 text-sm text-attention-foreground">{t("suppliers.cashNeedsShift")}</p>}
      <div className="mb-2 flex items-end justify-between rounded-lg bg-muted px-4 py-2">
        <div className="tabular text-3xl font-semibold">{moneyPlain(amount)} ֏</div>
        <Button variant="secondary" size="sm" onClick={() => setEntry(String(Math.max(0, ledger.outstanding)))}>{t("debt.all")}</Button>
      </div>
      {amount > 0 && (
        <p className="mb-2 text-sm text-muted-foreground">
          {plan.out.length > 0 && t("suppliers.willSettle", { items: plan.out.map((p) => `${p.number} (${money(p.amount)})`).join(", ") })}
          {plan.left > 0 && ` ${t("suppliers.toCredit", { amount: money(plan.left) })}`}
        </p>
      )}
      <Keypad value={entry} onChange={setEntry} maxLength={9} />
      <Button size="xl" className="mt-3 w-full" disabled={amount <= 0 || (method === "CASH" && !shiftId)} onClick={() => void save()}>{t("suppliers.paySubmit", { amount: money(amount) })}</Button>
    </Sheet>
  );
}

function EditSupplierSheet({ open, onOpenChange, ledger, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; ledger: Ledger; onDone: () => Promise<void> }) {
  const s = ledger.supplier;
  const [name, setName] = useState(s.name);
  const [phone, setPhone] = useState(s.phone ?? "");
  const [taxId, setTaxId] = useState(s.taxId ?? "");
  // A manager is not shown the terms, so is not given a field that would overwrite them.
  const showsTerms = s.paymentTerms !== undefined;
  const [terms, setTerms] = useState(String(s.paymentTerms ?? 0));
  const [lead, setLead] = useState(String(s.leadTimeDays));
  const save = async () => {
    try {
      await http.patch(`/suppliers/${s.id}`, { name, phone: phone || null, taxId: taxId || null, ...(showsTerms ? { paymentTerms: Number(terms || "0") } : {}), leadTimeDays: Number(lead || "0") });
      toast.success(t("suppliers.saved"));
      await onDone();
      onOpenChange(false);
    } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("suppliers.edit")}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div><Label htmlFor="es-name">{t("buy.supplierName")}</Label><Input id="es-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="es-phone">{t("suppliers.phone")}</Label><Input id="es-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></div>
          <div><Label htmlFor="es-tax">{t("suppliers.taxId")}</Label><Input id="es-tax" value={taxId} onChange={(e) => setTaxId(e.target.value)} className="tabular" /></div>
          {showsTerms && <div><Label htmlFor="es-terms">{t("suppliers.terms")}</Label><Input id="es-terms" value={terms} onChange={(e) => setTerms(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="tabular" /></div>}
          <div><Label htmlFor="es-lead">{t("suppliers.lead")}</Label><Input id="es-lead" value={lead} onChange={(e) => setLead(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="tabular" /></div>
        </div>
        <Button type="submit" size="lg" className="w-full">{t("common.save")}</Button>
      </form>
    </Sheet>
  );
}

function ReversePaymentSheet({ paymentId, onClose, onDone }: { paymentId: string | null; onClose: () => void; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [picking, setPicking] = useState(false);
  if (!paymentId) return null;
  const save = async () => {
    try {
      await http.post(`/supplier-payments/${paymentId}/reverse`, { reason: reason.trim(), reenterSupplierId: target?.id ?? null });
      toast.success(t("suppliers.saved"));
      await onDone();
      onClose();
    } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
  };
  return (
    <>
      <Sheet open={!picking} onOpenChange={(o) => { if (!o) onClose(); }} title={t("suppliers.reverseTitle")} description={t("suppliers.reverseHint")}>
        <Label>{t("suppliers.reenterFor")}</Label>
        <Button variant="secondary" size="lg" className="mb-3 w-full" onClick={() => setPicking(true)}>{target?.name ?? t("buy.pickSupplier")}</Button>
        <Label htmlFor="rp-reason">{t("suppliers.reason")}</Label>
        <Input id="rp-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mb-3" maxLength={200} />
        <Button size="lg" className="w-full" disabled={!reason.trim()} onClick={() => void save()}>{t("suppliers.reverse")}</Button>
      </Sheet>
      <SupplierPickerSheet open={picking} onOpenChange={setPicking} onPick={setTarget} />
    </>
  );
}
