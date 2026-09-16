/**
 * Payment. PRD §6.2, J2 step 4.
 *
 * Cash is first and largest. A tendered shortcut *is* the completing tap — no confirm on top.
 * Change is the largest number on screen. Short of the total, the button is simply inactive
 * with the shortfall shown (rule 7). Split takes part cash, part card.
 */
import { Banknote, BookUser, CheckCircle2, CreditCard, Printer, Split } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { DebtChoice } from "@/types/debt.ts";
import { Keypad, MoneyText } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { useConnection } from "@/lib/connection.ts";
import { money, moneyPlain } from "@/lib/format.ts";
import { http } from "@/lib/http.ts";
import { outbox } from "@/lib/outbox.ts";
import { toast } from "sonner";
import type { TenderInput } from "./checkout.ts";

export interface CompletedSale { id: string; number: string; total: number; change: number }

export interface PaymentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  onComplete: (payments: TenderInput[], debt?: DebtChoice) => Promise<CompletedSale>;
  /** Present only when the shop keeps a debt book (§5.1: absent, not disabled). */
  renderDebt?: (args: { debtAmount: number; onBack: () => void; onChosen: (d: DebtChoice) => void }) => ReactNode;
}

function shortcuts(total: number) {
  const up = (step: number) => Math.ceil((total + 1) / step) * step;
  return [...new Set([total, up(500), up(1000), up(5000)])].filter((v) => v >= total).slice(0, 4);
}

export function PaymentSheet({ open, onOpenChange, total, onComplete, renderDebt }: PaymentSheetProps) {
  const connection = useConnection();
  const [mode, setMode] = useState<"choose" | "cash" | "split" | "debt" | "split-debt">("choose");
  const [rest, setRest] = useState<"CARD" | "DEBT">("CARD");
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<CompletedSale | null>(null);
  const [offlineAtCompletion, setOfflineAtCompletion] = useState(false);
  const amount = Number(entry || "0");
  const options = useMemo(() => shortcuts(total), [total]);

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) { setMode("choose"); setEntry(""); setDone(null); }
  };

  const finish = async (payments: TenderInput[], debt?: DebtChoice) => {
    if (busy) return;
    setBusy(true);
    try {
      setOfflineAtCompletion(connection === "offline");
      setDone(await onComplete(payments, debt));
    } finally {
      setBusy(false);
    }
  };

  const reprint = async () => {
    if (!done) return;
    if (outbox.has(done.id)) { toast.message(t("status.pending", { n: 1 })); return; }
    try { await http.post("/print/receipt", { saleId: done.id }, { timeoutMs: 8000 }); } catch { toast.error(t("payment.printFailed")); }
  };

  return (
    <Sheet open={open} onOpenChange={close} title={done ? t("payment.done") : t("payment.title")} className="md:max-w-xl">
      {done ? (
        <div className="text-center">
          {done.change > 0 ? (
            <>
              <div className="text-lg text-muted-foreground">{t("payment.change")}</div>
              <div className="tabular my-2 text-7xl font-bold text-primary">{moneyPlain(done.change)}<span className="ml-2 text-4xl">֏</span></div>
            </>
          ) : (
            <CheckCircle2 className="mx-auto my-4 size-20 text-success" aria-hidden />
          )}
          <div className="tabular text-muted-foreground">{t("payment.number", { number: done.number })} · {money(done.total)}</div>
          {offlineAtCompletion && <p className="mt-4 rounded-lg bg-attention-soft p-3 text-left text-sm text-attention-foreground">{t("payment.offlineNoPrint")}</p>}
          <div className="mt-6 grid grid-cols-[auto_1fr] gap-2">
            <Button variant="secondary" size="lg" onClick={reprint} aria-label={t("payment.reprint")}><Printer /></Button>
            <Button size="xl" onClick={() => close(false)} autoFocus>{t("payment.newSale")}</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-baseline justify-between rounded-lg bg-muted px-4 py-3">
            <span className="text-muted-foreground">{t("common.total")}</span>
            <MoneyText amount={total} className="text-4xl font-bold" />
          </div>

          {mode === "choose" && (
            <div className="space-y-3">
              <div className="rounded-xl border-2 border-primary/30 bg-primary-soft p-3">
                <div className="mb-2 flex items-center gap-2 font-semibold text-accent-foreground"><Banknote className="size-5" aria-hidden />{t("payment.cash")}</div>
                {/* An odd count gives «exact» — the commonest tap — the whole first row, so no button is left alone. */}
                <div className="grid grid-cols-2 gap-2">
                  {options.map((v, i) => (
                    <Button key={v} size="xl" disabled={busy} onClick={() => finish([{ method: "CASH", amount: total, tenderedAmount: v }])} className={cn("tabular", i === 0 && options.length % 2 === 1 && "col-span-2")}>
                      {i === 0 ? t("payment.exact") : moneyPlain(v)}
                    </Button>
                  ))}
                </div>
                <Button variant="ghost" className="mt-2 w-full" onClick={() => setMode("cash")}>{t("payment.other")}</Button>
              </div>
              {/* Icon over label: three tenders side by side must fit the narrowest phone unclipped. */}
              <div className={cn("grid gap-2", renderDebt ? "grid-cols-3" : "grid-cols-2")}>
                <Button variant="secondary" size="xl" className="flex-col gap-1 px-1 text-sm" disabled={busy} onClick={() => finish([{ method: "CARD", amount: total }])}><CreditCard />{t("payment.card")}</Button>
                {renderDebt && <Button variant="secondary" size="xl" className="flex-col gap-1 px-1 text-sm" onClick={() => setMode("debt")}><BookUser />{t("payment.debt")}</Button>}
                <Button variant="secondary" size="xl" className="flex-col gap-1 px-1 text-sm" onClick={() => setMode("split")}><Split />{t("payment.split")}</Button>
              </div>
            </div>
          )}

          {mode === "cash" && (
            <div>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-sm text-muted-foreground">{t("payment.tendered")}</div>
                  <div className="tabular text-3xl font-semibold">{moneyPlain(amount)}</div>
                </div>
                <div className={cn("rounded-lg p-3", amount >= total ? "bg-primary-soft" : "bg-muted")}>
                  <div className="text-sm text-muted-foreground">{amount >= total ? t("payment.change") : t("payment.short", { amount: "" })}</div>
                  <div className="tabular text-4xl font-bold">{moneyPlain(Math.abs(amount - total))}</div>
                </div>
              </div>
              <Keypad value={entry} onChange={setEntry} maxLength={8} />
              <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
                <Button variant="secondary" size="xl" onClick={() => setMode("choose")}>{t("common.back")}</Button>
                <Button size="xl" disabled={busy || amount < total} onClick={() => finish([{ method: "CASH", amount: total, tenderedAmount: amount }])}>{t("payment.complete")}</Button>
              </div>
            </div>
          )}

          {mode === "debt" && renderDebt?.({ debtAmount: total, onBack: () => setMode("choose"), onChosen: (d) => void finish([{ method: "DEBT", amount: total }], d) })}

          {mode === "split-debt" && renderDebt?.({
            debtAmount: total - amount, onBack: () => setMode("split"),
            onChosen: (d) => void finish([{ method: "CASH", amount, tenderedAmount: amount }, { method: "DEBT", amount: total - amount }], d),
          })}

          {mode === "split" && (
            <div>
              <p className="mb-2 text-sm text-muted-foreground">{t("payment.splitHint")}</p>
              {renderDebt && (
                <div className="mb-3 grid grid-cols-2 gap-2">
                  {(["CARD", "DEBT"] as const).map((m) => (
                    <button key={m} onClick={() => setRest(m)} className={cn("h-touch rounded-lg border text-sm font-medium", rest === m ? "border-primary bg-primary-soft" : "border-border")}>{m === "CARD" ? t("payment.restByCard") : t("payment.restByDebt")}</button>
                  ))}
                </div>
              )}
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-sm text-muted-foreground">{t("payment.cashPart")}</div>
                  <div className="tabular text-3xl font-semibold">{moneyPlain(Math.min(amount, total))}</div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-sm text-muted-foreground">{rest === "DEBT" ? t("payment.restByDebt") : t("payment.cardPart")}</div>
                  <div className="tabular text-3xl font-semibold">{moneyPlain(Math.max(total - amount, 0))}</div>
                </div>
              </div>
              <Keypad value={entry} onChange={setEntry} maxLength={8} />
              <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
                <Button variant="secondary" size="xl" onClick={() => setMode("choose")}>{t("common.back")}</Button>
                <Button size="xl" disabled={busy || amount <= 0 || amount >= total} onClick={() => (rest === "DEBT" ? setMode("split-debt") : finish([{ method: "CASH", amount, tenderedAmount: amount }, { method: "CARD", amount: total - amount }]))}>
                  {t("payment.complete")}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
