/**
 * Quantity on the keypad (§6.1). Decimals only where the unit allows them, and the line total
 * updates as the worker types — that is the number they check against the customer.
 */
import { useState } from "react";
import { lineTotal, parseQty, QTY_SCALE, type MilliDram, type MilliUnit } from "@simon/shared";
import { Button } from "@/components/ui/button.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { t } from "@/i18n/t.ts";
import { money } from "@/lib/format.ts";
import { Keypad } from "./Keypad.tsx";

export interface QuantitySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  uom: string;
  decimalPlaces: number;
  initial: MilliUnit;
  unitPriceMdram?: MilliDram;
  /** A stocktake count may be zero: an empty shelf is a count, not a mistake. */
  allowZero?: boolean;
  /** The "sold in whole pieces" line is about selling; a count does not need it. */
  hidePieceHint?: boolean;
  confirmLabel?: string;
  onConfirm: (qty: MilliUnit) => void;
}

const toText = (qty: MilliUnit, dp: number) => (qty % QTY_SCALE === 0 ? String(qty / QTY_SCALE) : (qty / QTY_SCALE).toFixed(dp).replace(/0+$/, ""));

export function QuantitySheet({ open, onOpenChange, title, uom, decimalPlaces, initial, unitPriceMdram, allowZero = false, hidePieceHint = false, confirmLabel, onConfirm }: QuantitySheetProps) {
  const [text, setText] = useState(() => toText(initial, decimalPlaces));
  const [touched, setTouched] = useState(false);
  const parsed = parseQty(text, decimalPlaces);
  const valid = parsed !== null && (allowZero ? parsed >= 0 : parsed > 0);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
      <div className="mb-4 flex items-end justify-between rounded-lg bg-muted px-4 py-3">
        <div>
          <div className="text-sm text-muted-foreground">{t("till.qtyTitle")}</div>
          <div className="tabular text-4xl font-semibold">{text || "0"} <span className="text-xl text-muted-foreground">{uom}</span></div>
        </div>
        {unitPriceMdram !== undefined && (
          <div className="text-right">
            <div className="text-sm text-muted-foreground">{t("till.lineTotal")}</div>
            <div className="tabular text-2xl font-semibold">{money(valid ? lineTotal(parsed, unitPriceMdram) : 0)}</div>
          </div>
        )}
      </div>
      {decimalPlaces === 0 && !hidePieceHint && <p className="mb-2 text-sm text-muted-foreground">{t("till.decimalsRefused")}</p>}
      <Keypad
        value={touched ? text : ""}
        onChange={(v) => { setTouched(true); setText(v); }}
        allowDecimal={decimalPlaces > 0}
        maxDecimals={decimalPlaces}
        maxLength={7}
      />
      <Button size="xl" className="mt-3 w-full" disabled={!valid} onClick={() => { onConfirm(parsed!); onOpenChange(false); }}>
        {confirmLabel ?? t("common.done")}
      </Button>
    </Sheet>
  );
}
