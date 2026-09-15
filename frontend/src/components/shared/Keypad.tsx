/**
 * The large numeric keypad. Not a spinner and not `type="number"` (§6.1). It edits a
 * string of digits; the caller parses it with @simon/shared (`parseQty`) so decimals are
 * refused where the unit does not allow them.
 */
import { Delete } from "lucide-react";
import { cn } from "@/lib/cn.ts";
import { t } from "@/i18n/t.ts";
import { applyKey } from "@/lib/keypad.ts";

export interface KeypadProps {
  value: string;
  onChange: (next: string) => void;
  /** Allow a decimal point (the product's decimalPlaces > 0). */
  allowDecimal?: boolean;
  maxDecimals?: number;
  maxLength?: number;
  className?: string;
  /** Mask digits (PIN entry) — the value still flows through `onChange`. */
  onKey?: (key: string) => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"] as const;

export function Keypad({ value, onChange, allowDecimal = false, maxDecimals = 3, maxLength = 9, className, onKey }: KeypadProps) {
  const press = (key: string) => {
    onKey?.(key);
    onChange(applyKey(value, key, allowDecimal, maxDecimals, maxLength));
  };
  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {KEYS.map((key) => {
        if (key === "." && !allowDecimal) return <div key={key} aria-hidden />;
        const isBack = key === "back";
        return (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            onContextMenu={(e) => { if (isBack) { e.preventDefault(); onChange(""); } }}
            aria-label={isBack ? t("keypad.backspace") : key}
            className="tabular grid h-touch-lg place-items-center rounded-lg bg-muted text-2xl font-medium text-foreground transition-colors active:bg-border select-none"
          >
            {isBack ? <Delete className="size-7" aria-hidden /> : key}
          </button>
        );
      })}
    </div>
  );
}
