/** Price override from a long-press (§6.1, §12.1): a discount by another name, so it carries a reason and the same cap. */
import { useState } from "react";
import { Keypad, MoneyText } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { t } from "@/i18n/t.ts";
import type { BasketLine } from "./basket.ts";

export function PriceSheet({ line, onOpenChange, onConfirm }: { line: BasketLine | null; onOpenChange: (o: boolean) => void; onConfirm: (unitPriceMdram: number, reason: string) => void }) {
  // Keyed by line id in the parent, so each line starts empty.
  const [entry, setEntry] = useState("");
  const [reason, setReason] = useState("");
  if (!line) return null;
  const price = Number(entry || "0") * 1000;
  return (
    <Sheet open onOpenChange={onOpenChange} title={t("till.priceTitle")} description={t("till.priceHint")}>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted p-3">
          <div className="text-sm text-muted-foreground">{t("till.catalogue")}</div>
          <MoneyText amount={line.catalogueMdram / 1000} className="text-2xl font-semibold" />
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-sm text-muted-foreground">{t("till.newPrice")}</div>
          <div className="tabular text-2xl font-semibold">{entry || "—"}</div>
        </div>
      </div>
      <Label htmlFor="price-reason">{t("till.reason")}</Label>
      <Input id="price-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mb-3" maxLength={200} />
      <Keypad value={entry} onChange={setEntry} maxLength={9} />
      <Button size="xl" className="mt-3 w-full" disabled={!entry || !reason.trim()} onClick={() => { onConfirm(price, reason.trim()); onOpenChange(false); }}>{t("common.done")}</Button>
    </Sheet>
  );
}
