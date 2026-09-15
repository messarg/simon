/** Cash in or out of the drawer outside a sale (§11 `CashMovement`). Queued like a sale; the reason is required. */
import { useState } from "react";
import { toast } from "sonner";
import { uuidv7 } from "@simon/shared";
import { Keypad } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { money, moneyPlain } from "@/lib/format.ts";
import { outbox } from "@/lib/outbox.ts";

export type MovementType = "PAY_IN" | "PAY_OUT" | "DROP";
const CODES = ["EXPENSE", "WAGE", "OWNER_DRAW"] as const;

export function CashMovementSheet({ type, shiftId, onOpenChange }: { type: MovementType | null; shiftId: string; onOpenChange: (o: boolean) => void }) {
  // Keyed by movement type in the parent, so each opening starts empty.
  const [entry, setEntry] = useState("");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState<(typeof CODES)[number]>("EXPENSE");
  if (!type) return null;
  const amount = Number(entry || "0");
  const save = async () => {
    const id = uuidv7();
    await outbox.enqueue("cash-movement", id, { id, shiftId, type, amount, reasonCode: type === "PAY_OUT" ? code : null, reason: reason.trim(), createdAt: new Date().toISOString(), queued: false }, {
      afterSync: { print: false, drawer: true }, label: `${t(`shift.movementTitle.${type}`)} · ${money(amount)}`,
    });
    toast.success(t("shift.movementSaved"));
    onOpenChange(false);
  };
  return (
    <Sheet open onOpenChange={onOpenChange} title={t(`shift.movementTitle.${type}`)}>
      <div className="mb-3 rounded-lg bg-muted px-4 py-3">
        <div className="text-sm text-muted-foreground">{t("shift.amount")}</div>
        <div className="tabular text-4xl font-semibold">{moneyPlain(amount)} ֏</div>
      </div>
      {type === "PAY_OUT" && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {CODES.map((c) => (
            <button key={c} onClick={() => setCode(c)} className={cn("h-touch rounded-lg border text-sm font-medium", code === c ? "border-primary bg-primary-soft" : "border-border")}>{t(`shift.reasonCodes.${c}`)}</button>
          ))}
        </div>
      )}
      <Label htmlFor="cm-reason">{t("shift.reason")}</Label>
      <Input id="cm-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mb-3" maxLength={200} />
      <Keypad value={entry} onChange={setEntry} maxLength={8} />
      <Button size="xl" className="mt-3 w-full" disabled={amount <= 0 || !reason.trim()} onClick={() => void save()}>{t("common.save")}</Button>
    </Sheet>
  );
}
