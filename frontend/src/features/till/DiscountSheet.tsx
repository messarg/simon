/** A sale-level discount in whole drams (§12.1). The cap is checked when paying, in one place. */
import { useState } from "react";
import { Keypad } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { t } from "@/i18n/t.ts";
import { moneyPlain } from "@/lib/format.ts";

export function DiscountSheet({ open, onOpenChange, subtotal, current, onApply }: { open: boolean; onOpenChange: (o: boolean) => void; subtotal: number; current: number; onApply: (amount: number, reason: string | null) => void }) {
  // Remounted per opening by the parent's key, so it starts from the current discount.
  const [entry, setEntry] = useState(current ? String(current) : "");
  const [reason, setReason] = useState("");
  const amount = Math.min(Number(entry || "0"), subtotal);
  const pct = subtotal > 0 ? Math.round((amount * 1000) / subtotal) / 10 : 0;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("till.discountTitle")}>
      <div className="mb-3 flex items-end justify-between rounded-lg bg-muted px-4 py-3">
        <div>
          <div className="text-sm text-muted-foreground">{t("till.discountAmount")}</div>
          <div className="tabular text-3xl font-semibold">{moneyPlain(amount)} ֏</div>
        </div>
        <div className="tabular text-xl text-muted-foreground">{pct}%</div>
      </div>
      <Label htmlFor="disc-reason">{t("till.reason")}</Label>
      <Input id="disc-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mb-3" maxLength={120} />
      <Keypad value={entry} onChange={setEntry} maxLength={8} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" size="lg" onClick={() => { onApply(0, null); onOpenChange(false); }}>{t("till.removeDiscount")}</Button>
        <Button size="lg" onClick={() => { onApply(amount, reason.trim() || null); onOpenChange(false); }}>{t("till.apply")}</Button>
      </div>
    </Sheet>
  );
}
