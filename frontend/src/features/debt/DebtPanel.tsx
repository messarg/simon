/**
 * The debt sale's decision screen (§6.3, J3). Four lines the worker and the customer read
 * together: what they owe, how old the oldest charge is, the limit, and the balance after this
 * sale. Those lines are the screen, not a dialog over it. Over the limit is the one genuine hard
 * confirm: an admin and a reason, or nothing in strict mode. Offline, the offline cap applies.
 */
import { ArrowLeft, Ban, UserRound } from "lucide-react";
import { useState } from "react";
import type { ClientSettings } from "@simon/shared";
import { MoneyText, ReauthSheet } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { useConnection } from "@/lib/connection.ts";
import { getCachedCustomer, putCustomers, queuedDebtFor } from "@/lib/customers.ts";
import { money } from "@/lib/format.ts";
import { http } from "@/lib/http.ts";
import type { CachedCustomer } from "@/lib/local-db.ts";
import type { DebtChoice } from "@/types/debt.ts";
import { CustomerPickerSheet } from "./CustomerPickerSheet.tsx";

const DUE_OPTIONS = [0, 7, 14, 30];
const dueDateIn = (days: number) => (days === 0 ? null : new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10));

export function DebtPanel({ debtAmount, settings, onBack, onComplete }: { debtAmount: number; settings: ClientSettings; onBack: () => void; onComplete: (d: DebtChoice) => void }) {
  const connection = useConnection();
  const [customer, setCustomer] = useState<CachedCustomer | null>(null);
  const [picking, setPicking] = useState(true);
  const [fresh, setFresh] = useState(false);
  const [due, setDue] = useState(0);
  const [reauth, setReauth] = useState(false);

  const choose = async (c: CachedCustomer) => {
    setCustomer(c);
    setFresh(false);
    if (connection === "offline") return;
    try {
      const ledger = await http.get<{ customer: CachedCustomer }>(`/customers/${c.id}/ledger`, { timeoutMs: 3000 });
      const updated = { ...c, ...ledger.customer };
      await putCustomers([updated]);
      setCustomer(updated);
      setFresh(true);
    } catch {
      const cached = await getCachedCustomer(c.id);
      if (cached) setCustomer(cached);
    }
  };

  if (!customer) {
    return (
      <div>
        <Button variant="ghost" onClick={onBack}><ArrowLeft />{t("common.back")}</Button>
        <Button size="xl" className="mt-2 w-full" onClick={() => setPicking(true)}><UserRound />{t("debt.pickTitle")}</Button>
        <CustomerPickerSheet open={picking} onOpenChange={setPicking} onPick={(c) => void choose(c)} />
      </div>
    );
  }

  const offline = connection === "offline";
  const after = customer.outstanding + debtAmount;
  const over = after - customer.creditLimit;
  const queued = offline ? queuedDebtFor(customer.id) : 0;
  const offlineCapHit = offline && queued + debtAmount > settings.offlineDebtCap;
  const strictBlock = over > 0 && settings.strictCreditLimit && !offline;
  const choice = (grant: string | null, reason: string | null): DebtChoice => ({ customerId: customer.id, limitGrant: grant, limitReason: reason, dueDate: dueDateIn(due) });

  const rows: Array<[string, React.ReactNode]> = [
    [t("debt.owes"), <MoneyText key="o" amount={customer.outstanding} />],
    [t("debt.oldest"), customer.oldestChargeDays !== null && customer.outstanding > 0 ? t("debt.days", { n: customer.oldestChargeDays }) : "—"],
    [t("debt.limit"), <MoneyText key="l" amount={customer.creditLimit} />],
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label={t("common.back")}><ArrowLeft /></Button>
        <button onClick={() => setPicking(true)} className="flex min-h-touch flex-1 items-center gap-2 rounded-lg px-2 text-left text-xl font-semibold hover:bg-muted">
          <UserRound className="size-5 text-primary" aria-hidden />{customer.fullName}
        </button>
      </div>
      <dl className="divide-y divide-border rounded-xl bg-card ring-1 ring-border shadow-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-4 py-2.5 text-lg"><dt className="text-muted-foreground">{label}</dt><dd className="tabular font-medium">{value}</dd></div>
        ))}
        <div className={cn("flex items-center justify-between px-4 py-3", over > 0 && "bg-attention-soft")}>
          <dt className="text-lg font-semibold">{t("debt.afterSale")}</dt>
          <dd><MoneyText amount={after} className="text-3xl font-bold" /></dd>
        </div>
      </dl>
      {customer.overdue > 0 && <p className="text-sm text-attention-foreground">{t("debt.overdue", { amount: money(customer.overdue) })}</p>}
      {offline && <p className="text-sm text-muted-foreground">{t("debt.lastKnown")}</p>}
      {!fresh && !offline && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}

      <div>
        <div className="mb-1 text-sm text-muted-foreground">{t("debt.dueDate")}</div>
        <div className="grid grid-cols-4 gap-2">
          {DUE_OPTIONS.map((d) => (
            <button key={d} onClick={() => setDue(d)} className={cn("h-touch rounded-lg border text-sm font-medium", due === d ? "border-primary bg-primary-soft" : "border-border")}>{d === 0 ? t("debt.dueNone") : t("debt.dueDays", { n: d })}</button>
          ))}
        </div>
      </div>

      {customer.isBlocked ? (
        <p className="flex items-center gap-2 rounded-lg bg-muted p-3"><Ban className="size-5 shrink-0" aria-hidden />{t("debt.blocked")}</p>
      ) : offlineCapHit ? (
        <p className="rounded-lg bg-attention-soft p-3 text-attention-foreground">{t("debt.offlineCap", { amount: money(settings.offlineDebtCap) })}</p>
      ) : strictBlock ? (
        <p className="rounded-lg bg-attention-soft p-3 text-attention-foreground">{t("debt.overLimitStrict")}</p>
      ) : over > 0 && !offline ? (
        <>
          <p className="rounded-lg bg-attention-soft p-3 text-attention-foreground">{t("debt.overLimit", { amount: money(over) })}</p>
          <Button size="xl" variant="attention" className="w-full" disabled={!fresh} onClick={() => setReauth(true)}>{t("debt.confirm")}</Button>
        </>
      ) : (
        <Button size="xl" className="w-full" disabled={!fresh && !offline} onClick={() => onComplete(choice(null, null))}>{t("debt.confirm")} · {money(debtAmount)}</Button>
      )}

      <CustomerPickerSheet open={picking} onOpenChange={setPicking} onPick={(c) => void choose(c)} />
      <ReauthSheet open={reauth} onOpenChange={setReauth} action="creditLimitOverride" description={t("debt.overLimit", { amount: money(over) })} onGranted={(grant, reason) => onComplete(choice(grant, reason))} />
    </div>
  );
}
