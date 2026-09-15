/**
 * Repayment (§6.4): pick an amount, see which charges it crosses off — oldest first unless the
 * worker chooses — in one tender, cash by default. Queued like a sale, so it records offline.
 */
import { CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { uuidv7 } from "@simon/shared";
import { Keypad, MoneyText } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { adjustCachedBalance } from "@/lib/customers.ts";
import { dateTime, money, moneyPlain } from "@/lib/format.ts";
import { outbox } from "@/lib/outbox.ts";

export interface OpenCharge { id: string; amount: number; balance: number; createdAt: string; saleNumber: string | null; days: number }

export function RepaymentSheet({ open, onOpenChange, customer, charges, outstanding, shiftId }: {
  open: boolean; onOpenChange: (o: boolean) => void; customer: { id: string; fullName: string | null }; charges: OpenCharge[]; outstanding: number; shiftId: string | null;
}) {
  // Remounted per opening by the parent's key.
  const [entry, setEntry] = useState("");
  const [method, setMethod] = useState<"CASH" | "CARD">("CASH");
  const [manual, setManual] = useState<string[] | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const amount = Number(entry || "0");
  const order = manual ?? charges.map((c) => c.id);

  const crossed = useMemo(() => {
    let left = amount;
    const out = new Map<string, number>();
    for (const id of order) {
      const c = charges.find((x) => x.id === id);
      if (!c || left <= 0) continue;
      const take = Math.min(left, c.balance);
      out.set(id, take);
      left -= take;
    }
    return out;
  }, [amount, order, charges]);

  const toggle = (id: string) => setManual((m) => {
    const cur = m ?? [];
    return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  });

  const submit = async () => {
    const id = uuidv7();
    const allocations = manual ? [...crossed.entries()].filter(([, a]) => a > 0).map(([chargeEntryId, a]) => ({ chargeEntryId, amount: a })) : undefined;
    await outbox.enqueue("debt-payment", id, { id, customerId: customer.id, amount, method, shiftId: method === "CASH" ? shiftId : null, allocations, createdAt: new Date().toISOString(), queued: false }, {
      afterSync: { print: true, drawer: method === "CASH" }, label: `${t("debt.repay")} · ${customer.fullName ?? ""} · ${money(amount)}`,
    });
    await adjustCachedBalance(customer.id, -amount);
    toast.success(t("debt.repaid"));
    setDone(amount);
  };

  const after = outstanding - amount;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("debt.repayTitle")} description={customer.fullName ?? undefined} className="md:max-w-xl">
      {done !== null ? (
        <div className="text-center">
          <CheckCircle2 className="mx-auto my-3 size-16 text-success" aria-hidden />
          <MoneyText amount={done} className="text-4xl font-bold" />
          <p className="mt-2 text-muted-foreground">{after >= 0 ? t("debt.remainingAfter", { amount: money(after) }) : t("debt.creditAfter", { amount: money(-after) })}</p>
          <Button size="xl" className="mt-5 w-full" onClick={() => onOpenChange(false)}>{t("common.done")}</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(["CASH", "CARD"] as const).map((m) => (
              <button key={m} onClick={() => setMethod(m)} className={cn("h-touch rounded-lg border font-semibold", method === m ? "border-primary bg-primary-soft text-accent-foreground" : "border-border")}>{m === "CASH" ? t("debt.cash") : t("debt.card")}</button>
            ))}
          </div>
          {method === "CASH" && !shiftId && <p className="rounded-lg bg-attention-soft p-2 text-sm text-attention-foreground">{t("debt.noShiftForCash")}</p>}
          <div className="flex items-end justify-between rounded-lg bg-muted px-4 py-3">
            <div><div className="text-sm text-muted-foreground">{t("debt.amount")}</div><div className="tabular text-4xl font-semibold">{moneyPlain(amount)} ֏</div></div>
            <Button variant="secondary" size="sm" onClick={() => setEntry(String(Math.max(outstanding, 0)))}>{t("debt.all")}</Button>
          </div>
          {charges.length > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{manual ? t("debt.manual") : t("debt.auto")}</span>
                <button className="h-10 px-2 text-primary" onClick={() => setManual(manual ? null : [])}>{manual ? t("debt.auto") : t("debt.manual")}</button>
              </div>
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {charges.map((c) => {
                  const take = crossed.get(c.id) ?? 0;
                  const cleared = take > 0 && take >= c.balance;
                  return (
                    <li key={c.id}>
                      <button disabled={!manual} onClick={() => toggle(c.id)} className={cn("flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left", take > 0 ? "border-primary bg-primary-soft/50" : "border-border", manual?.includes(c.id) && "ring-2 ring-primary")}>
                        <div className="flex-1">
                          <div className={cn("tabular font-medium", cleared && "line-through decoration-2")}>{money(c.balance)}</div>
                          <div className="text-xs text-muted-foreground">{dateTime(c.createdAt)} · {t("debt.days", { n: c.days })}{c.saleNumber ? ` · ${t("debt.saleNo", { number: c.saleNumber })}` : ""}</div>
                        </div>
                        {take > 0 && <span className="text-sm text-accent-foreground">{cleared ? t("debt.clears") : t("debt.partly", { amount: money(take) })}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <Keypad value={entry} onChange={setEntry} maxLength={8} />
          <p className="text-center text-sm text-muted-foreground">{amount > 0 ? (after >= 0 ? t("debt.remainingAfter", { amount: money(after) }) : t("debt.creditAfter", { amount: money(-after) })) : ""}</p>
          <Button size="xl" className="w-full" disabled={amount <= 0 || (method === "CASH" && !shiftId)} onClick={() => void submit()}>{t("debt.repaySubmit", { amount: money(amount) })}</Button>
        </div>
      )}
    </Sheet>
  );
}
