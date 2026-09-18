/**
 * One page of the Nisya book (§6.13, §6.15): the balance and its age, the charges oldest first
 * with what each payment crossed off, and a repayment. The owner also sees the controls — the
 * limit, the block, merge, erasure and repayment correction; for a worker they are absent.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Ban, Download, HandCoins, Pencil, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmSheet, EmptyState, MoneyText, ReauthSheet } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { useConnection } from "@/lib/connection.ts";
import { getCachedCustomer, putCustomers, syncCustomers } from "@/lib/customers.ts";
import { dateTime, money } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import type { CachedCustomer } from "@/lib/local-db.ts";
import { outbox } from "@/lib/outbox.ts";
import { CustomerPickerSheet } from "./CustomerPickerSheet.tsx";
import { RepaymentSheet, type OpenCharge } from "./RepaymentSheet.tsx";

interface LedgerEntry { id: string; type: "CHARGE" | "PAYMENT" | "ADJUSTMENT"; amount: number; method: string | null; saleNumber: string | null; dueDate: string | null; reversesId: string | null; reversed: boolean; createdAt: string; userName: string | null; balance: number | null; unallocated: number | null; settles: { chargeEntryId: string; amount: number }[] }
interface Ledger { customer: CachedCustomer & { discountBp?: number; notes?: string }; outstanding: number; overdue: number; aging: { d0_30: number; d31_60: number; d61_90: number; d90plus: number; oldestChargeDays: number | null }; entries: LedgerEntry[] }

const daysSince = (iso: string) => Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);

export function CustomerLedger({ customerId, admin, shiftId, onBack }: { customerId: string; admin: boolean; shiftId: string | null; onBack?: () => void }) {
  const connection = useConnection();
  const qc = useQueryClient();
  const [cached, setCached] = useState<CachedCustomer | null>(null);
  const [sheet, setSheet] = useState<null | "repay" | "edit" | "merge" | "erase" | "reverse">(null);
  const [mergeInto, setMergeInto] = useState<{ id: string; name: string } | null>(null);
  const [reversing, setReversing] = useState<LedgerEntry | null>(null);
  const ledger = useQuery({ queryKey: ["customers", customerId, "ledger"], enabled: connection === "online", queryFn: () => http.get<Ledger>(`/customers/${customerId}/ledger`) });
  useEffect(() => { void getCachedCustomer(customerId).then((c) => setCached(c ?? null)); }, [customerId]);
  useEffect(() => outbox.onResult((item) => { if (item.kind === "debt-payment") void qc.invalidateQueries({ queryKey: ["customers", customerId, "ledger"] }); }), [qc, customerId]);

  const refresh = async () => { await qc.invalidateQueries({ queryKey: ["customers"] }); await syncCustomers().catch(() => {}); };
  const data = ledger.data;
  const customer = data?.customer ?? cached;
  if (!customer) return null;
  const outstanding = data?.outstanding ?? customer.outstanding;
  const charges: OpenCharge[] = (data?.entries ?? []).filter((e) => e.type === "CHARGE" && !e.reversed && !e.reversesId && (e.balance ?? 0) > 0)
    .map((e) => ({ id: e.id, amount: e.amount, balance: e.balance!, createdAt: e.createdAt, saleNumber: e.saleNumber, days: daysSince(e.createdAt) }));
  const chargeById = new Map((data?.entries ?? []).map((e) => [e.id, e]));

  const exportCsv = () => {
    if (!data) return;
    const rows = [["date", "type", "amount", "method", "sale", "balance_after_allocation"], ...data.entries.map((e) => [e.createdAt, e.type, String(e.amount), e.method ?? "", e.saleNumber ?? "", String(e.balance ?? e.unallocated ?? "")])];
    const blob = new Blob(["﻿" + rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `statement-${customer.id.slice(-6)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      {onBack && <button onClick={onBack} className="mb-2 h-10 text-muted-foreground md:hidden">← {t("common.back")}</button>}
      <div className="mb-3 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold">{customer.fullName ?? t("customers.anonymised")}</h1>
          <p className="tabular text-muted-foreground">{customer.phone}</p>
        </div>
        {admin && !customer.anonymised && <Button variant="secondary" size="md" onClick={() => setSheet("edit")}><Pencil />{t("customers.edit")}</Button>}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-sm">
          <div className="text-sm text-muted-foreground">{outstanding >= 0 ? t("debt.owes") : t("debt.credit", { amount: "" })}</div>
          <MoneyText amount={Math.abs(outstanding)} className="text-3xl font-bold" />
          {connection === "offline" && <div className="text-xs text-attention-foreground">{t("debt.lastKnown")}</div>}
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-sm">
          <div className="text-sm text-muted-foreground">{t("debt.oldest")}</div>
          <div className="text-3xl font-bold">{(data?.aging.oldestChargeDays ?? customer.oldestChargeDays) !== null && outstanding > 0 ? t("debt.days", { n: data?.aging.oldestChargeDays ?? customer.oldestChargeDays ?? 0 }) : "—"}</div>
          <div className="text-sm text-muted-foreground">{t("debt.limit")} {money(customer.creditLimit)}</div>
        </div>
      </div>
      {(data?.overdue ?? customer.overdue) > 0 && <p className="mb-2 flex items-center gap-1 text-attention-foreground"><AlertTriangle className="size-4" aria-hidden />{t("debt.overdue", { amount: money(data?.overdue ?? customer.overdue) })}</p>}
      {customer.isBlocked && <p className="mb-2 flex items-center gap-2 rounded-lg bg-muted p-2 text-sm"><Ban className="size-4" aria-hidden />{t("debt.blocked")}</p>}

      {data && outstanding > 0 && (
        <div className="mb-3 grid grid-cols-4 gap-1 text-center text-xs">
          {(["d0_30", "d31_60", "d61_90", "d90plus"] as const).map((k) => (
            <div key={k} className={cn("rounded-lg p-2", data.aging[k] > 0 ? "bg-card ring-1 ring-border shadow-sm" : "bg-muted text-muted-foreground")}>
              <div>{t(`debt.buckets.${k}`)}</div>
              <MoneyText amount={data.aging[k]} symbol={false} className="text-sm font-semibold" />
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 grid grid-cols-[1fr_auto] gap-2">
        <Button size="xl" disabled={customer.anonymised} onClick={() => setSheet("repay")}><HandCoins />{t("debt.repay")}</Button>
        <Button variant="secondary" size="xl" disabled={!data} onClick={exportCsv} aria-label={t("debt.statement")}><Download /></Button>
      </div>

      {data ? (
        data.entries.length === 0 ? <EmptyState icon={HandCoins} title={t("debt.noDebt")} className="py-6" /> : (
          <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-border shadow-sm">
            {data.entries.map((e) => (
              <li key={e.id} className={cn("px-4 py-3", (e.reversed || e.reversesId) && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {e.reversesId ? t("debt.reversal") : e.type === "CHARGE" ? t("debt.charge") : e.type === "PAYMENT" ? `${t("debt.payment")} · ${e.method === "CARD" ? t("debt.card") : t("debt.cash")}` : t("debt.adjustment")}
                      {e.reversed && <span className="ml-2 text-xs text-muted-foreground">{t("debt.reversed")}</span>}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {dateTime(e.createdAt)}{e.saleNumber ? ` · ${t("debt.saleNo", { number: e.saleNumber })}` : ""}{e.userName ? ` · ${e.userName}` : ""}
                    </div>
                    {e.type !== "CHARGE" && e.settles.length > 0 && (
                      <div className="text-xs text-muted-foreground">{t("debt.crossesOff", { items: e.settles.map((s) => dateTime(chargeById.get(s.chargeEntryId)?.createdAt ?? "")).join(", ") })}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <MoneyText amount={e.type === "CHARGE" ? e.amount : -e.amount} signed className={cn("font-semibold", e.type === "CHARGE" && (e.balance ?? 0) === 0 && !e.reversed && "line-through decoration-2")} />
                    {e.type === "CHARGE" && !e.reversed && <div className="text-xs text-muted-foreground">{(e.balance ?? 0) === 0 ? t("debt.settled") : t("debt.balanceLeft", { amount: money(e.balance ?? 0) })}</div>}
                    {admin && e.type === "PAYMENT" && !e.reversed && !e.reversesId && (
                      <Button variant="ghost" size="sm" onClick={() => { setReversing(e); setSheet("reverse"); }}><Undo2 />{t("customers.reverse")}</Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : connection === "offline" ? <p className="text-muted-foreground">{t("stock.offlineHistory")}</p> : null}

      <RepaymentSheet key={sheet === "repay" ? "repay-open" : "repay-closed"} open={sheet === "repay"} onOpenChange={(o) => setSheet(o ? "repay" : null)} customer={customer} charges={charges} outstanding={outstanding} shiftId={shiftId} />
      {admin && data && (
        <>
          <EditCustomerSheet key={sheet === "edit" ? "edit-open" : "edit-closed"} open={sheet === "edit"} onOpenChange={(o) => setSheet(o ? "edit" : null)} ledger={data} onSaved={refresh} onMerge={() => setSheet("merge")} onErase={() => setSheet("erase")} />
          <CustomerPickerSheet
            open={sheet === "merge"}
            onOpenChange={(o) => setSheet(o ? "merge" : null)}
            onPick={(target) => { if (target.id !== customer.id) setMergeInto({ id: target.id, name: target.fullName ?? "" }); }}
          />
          {/* Merging moves one person's whole ledger onto another and cannot be undone (§27.16). */}
          <ConfirmSheet
            open={mergeInto !== null}
            onOpenChange={(o) => { if (!o) setMergeInto(null); }}
            title={t("customers.mergeConfirmTitle", { from: customer.fullName ?? "", into: mergeInto?.name ?? "" })}
            description={t("customers.mergeHint")}
            confirmLabel={t("customers.mergeConfirm")}
            onConfirm={() => {
              const target = mergeInto;
              setMergeInto(null);
              if (!target) return;
              void (async () => {
                try { await http.post(`/customers/${customer.id}/merge`, { intoId: target.id }); toast.success(t("customers.saved")); await refresh(); onBack?.(); }
                catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
              })();
            }}
          />
          <Sheet open={sheet === "erase"} onOpenChange={(o) => setSheet(o ? "erase" : null)} title={t("customers.erase")} description={t("customers.eraseHint")}>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="lg" onClick={() => setSheet(null)}>{t("common.cancel")}</Button>
              <Button variant="destructive" size="lg" onClick={async () => {
                try { await http.post(`/customers/${customer.id}/erase`); setSheet(null); await refresh(); await putCustomers([{ ...customer, fullName: null, phone: null, anonymised: true, isActive: false }]); }
                catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
              }}>{t("customers.eraseConfirm")}</Button>
            </div>
          </Sheet>
          <ReverseSheet key={reversing?.id ?? "none"} open={sheet === "reverse"} onOpenChange={(o) => { setSheet(o ? "reverse" : null); if (!o) setReversing(null); }} entry={reversing} onDone={refresh} />
        </>
      )}
    </div>
  );
}

function EditCustomerSheet({ open, onOpenChange, ledger, onSaved, onMerge, onErase }: { open: boolean; onOpenChange: (o: boolean) => void; ledger: Ledger; onSaved: () => Promise<void>; onMerge: () => void; onErase: () => void }) {
  const c = ledger.customer;
  const [name, setName] = useState(c.fullName ?? "");
  const [phone, setPhone] = useState(c.phone ?? "");
  const [limit, setLimit] = useState(String(c.creditLimit));
  const [blocked, setBlocked] = useState(c.isBlocked);
  const [discount, setDiscount] = useState(String((c.discountBp ?? 0) / 100));
  const [notes, setNotes] = useState(c.notes ?? "");
  const save = async () => {
    try {
      await http.patch(`/customers/${c.id}`, { fullName: name, phone: phone || null, creditLimit: Number(limit || "0"), isBlocked: blocked, discountBp: Math.round(Number(discount || "0") * 100), notes });
      toast.success(t("customers.saved"));
      await onSaved();
      onOpenChange(false);
    } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("customers.edit")}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div><Label htmlFor="ec-name">{t("debt.name")}</Label><Input id="ec-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label htmlFor="ec-phone">{t("debt.phone")}</Label><Input id="ec-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="ec-limit">{t("customers.creditLimit")}</Label><Input id="ec-limit" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="tabular" /></div>
          <div><Label htmlFor="ec-disc">{t("customers.discount")}</Label><Input id="ec-disc" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="tabular" /></div>
        </div>
        <button type="button" role="switch" aria-checked={blocked} onClick={() => setBlocked(!blocked)} className={cn("flex h-touch w-full items-center justify-between rounded-lg border px-3", blocked ? "border-attention bg-attention-soft" : "border-border")}>
          <span>{t("customers.block")}</span><Ban className="size-5" aria-hidden />
        </button>
        <div><Label htmlFor="ec-notes">{t("customers.notes")}</Label><Input id="ec-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("customers.notesHint")} /></div>
        <Button type="submit" size="lg" className="w-full">{t("common.save")}</Button>
        <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
          <Button type="button" variant="secondary" onClick={onMerge}>{t("customers.merge")}</Button>
          <Button type="button" variant="ghost" onClick={onErase}>{t("customers.erase")}</Button>
        </div>
      </form>
    </Sheet>
  );
}

function ReverseSheet({ open, onOpenChange, entry, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; entry: LedgerEntry | null; onDone: () => Promise<void> }) {
  const [target, setTarget] = useState<CachedCustomer | null>(null);
  const [picking, setPicking] = useState(false);
  const [reauth, setReauth] = useState(false);
  if (!entry) return null;
  return (
    <>
      <Sheet open={open && !picking && !reauth} onOpenChange={onOpenChange} title={t("customers.reverseTitle")} description={t("customers.reverseHint")}>
        <div className="mb-3 rounded-lg bg-muted p-3"><MoneyText amount={entry.amount} className="text-2xl font-semibold" /> · {dateTime(entry.createdAt)}</div>
        <Label>{t("customers.reenterFor")}</Label>
        <Button variant="secondary" size="lg" className="mb-3 w-full" onClick={() => setPicking(true)}>{target?.fullName ?? t("debt.pickTitle")}</Button>
        <Button size="lg" className="w-full" onClick={() => setReauth(true)}>{t("customers.reverse")}</Button>
      </Sheet>
      <CustomerPickerSheet open={picking} onOpenChange={setPicking} onPick={setTarget} />
      <ReauthSheet open={reauth} onOpenChange={setReauth} action="repaymentReversal" onGranted={async (grant, reason) => {
        try {
          await http.post(`/debt-payments/${entry.id}/reverse`, { reauthGrant: grant, reason, reenterCustomerId: target?.id ?? null });
          toast.success(t("customers.saved"));
          await onDone();
          onOpenChange(false);
        } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
      }} />
    </>
  );
}
