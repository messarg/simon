/**
 * The drawer's rows (§27.45): each names where it came from, so a repayment opens the customer
 * who paid and a refund the sale it reversed. A mistyped pay-in, pay-out or drop is corrected by
 * a linked reversal — the original row stays.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Undo2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { MoneyText } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t, type StringKey } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { time } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";

interface Movement {
  id: string; type: string; amount: number; reason: string | null; createdAt: string; userName: string; reversesId: string | null; reversed: boolean;
  source: { type: string; id: string; customerId?: string | null; customerName?: string | null; originalSaleNumber?: string | null };
}

const SIGN: Record<string, number> = { REPAYMENT: 1, PAY_IN: 1, REFUND: -1, PAY_OUT: -1, DROP: -1, NO_SALE: 0 };

export function CashMovementsList({ shiftId, onChanged }: { shiftId: string; onChanged: () => void }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["shifts", shiftId, "cash-movements"], queryFn: () => http.get<{ items: Movement[] }>(`/shifts/${shiftId}/cash-movements`) });
  const [reversing, setReversing] = useState<Movement | null>(null);
  const [reason, setReason] = useState("");
  if (!list.data?.items.length) return null;

  const reverse = async () => {
    if (!reversing) return;
    try {
      await http.post(`/cash-movements/${reversing.id}/reverse`, { reason });
      setReversing(null);
      setReason("");
      await qc.invalidateQueries({ queryKey: ["shifts", shiftId, "cash-movements"] });
      onChanged();
    } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-1 font-semibold">{t("shift.movements")}</h2>
      <ul className="divide-y divide-border">
        {list.data.items.map((m) => {
          const struck = m.reversed || Boolean(m.reversesId);
          return (
            <li key={m.id} className={cn("flex items-center gap-3 py-2", struck && "opacity-60")}>
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {t(`shift.movementTypes.${m.type}` as StringKey)}
                  {struck && <span className="ml-2 text-xs text-muted-foreground">{t("shift.reversedLabel")}</span>}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {time(m.createdAt)} · {m.userName} ·{" "}
                  {m.source.type === "DebtEntry" && m.source.customerId ? <Link className="text-primary underline" to={`/debts?customer=${m.source.customerId}`}>{m.source.customerName ?? t("customers.anonymised")}</Link>
                    : m.source.type === "SaleReturn" ? t("shift.sourceReturn", { number: m.source.originalSaleNumber ?? "—" })
                    : m.reason}
                </div>
              </div>
              <MoneyText amount={SIGN[m.type] * m.amount} signed={SIGN[m.type] > 0} className="font-semibold" />
              {["PAY_IN", "PAY_OUT", "DROP"].includes(m.type) && !struck && (
                <Button variant="ghost" size="icon" onClick={() => setReversing(m)} aria-label={t("shift.reverseMovement")}><Undo2 /></Button>
              )}
            </li>
          );
        })}
      </ul>
      <Sheet open={reversing !== null} onOpenChange={(o) => { if (!o) setReversing(null); }} title={t("shift.reverseMovement")}>
        {reversing && <div className="mb-3 rounded-lg bg-muted p-3">{t(`shift.movementTypes.${reversing.type}` as StringKey)} · <MoneyText amount={reversing.amount} className="font-semibold" /></div>}
        <Label htmlFor="rev-reason">{t("shift.reverseReason")}</Label>
        <Input id="rev-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mb-3" maxLength={200} />
        <Button size="lg" className="w-full" disabled={!reason.trim()} onClick={() => void reverse()}>{t("shift.reverseMovement")}</Button>
      </Sheet>
    </div>
  );
}
