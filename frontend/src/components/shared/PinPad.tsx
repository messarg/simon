/**
 * PIN entry: dots, a keypad, and the message the server sent back (§16.2). The parent
 * clears it after a failed attempt by remounting it with a new `key`.
 */
import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { Keypad } from "./Keypad.tsx";

export interface PinPadProps {
  onSubmit: (pin: string) => void;
  busy?: boolean;
  error?: string | null;
  minLength?: number;
  maxLength?: number;
  /** Omitted where the screen already says what to type — the sign-in header does. */
  label?: string;
  /** The submit button's words; «Հաստատել» unless the caller says what submitting does. */
  submitLabel?: string;
}

export function PinPad({ onSubmit, busy, error, minLength = 4, maxLength = 8, label, submitLabel }: PinPadProps) {
  const [pin, setPin] = useState("");

  // Hardware keyboards type PINs too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy) return;
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < maxLength ? p + e.key : p));
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Enter" && pin.length >= minLength) onSubmit(pin);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, maxLength, minLength, onSubmit, pin]);

  const change = (next: string) => {
    setPin(next);
    // A PIN of full length submits itself; a shorter one is submitted with Enter or the check key,
    // since nothing can tell the fourth digit of a four-digit PIN from the fourth of a six-digit one.
    if (next.length === maxLength) onSubmit(next);
  };

  return (
    <div className="mx-auto w-full max-w-xs">
      {label && <p className="mb-3 text-center text-sm font-medium text-muted-foreground">{label}</p>}
      <div className="flex h-5 items-center justify-center gap-3.5" aria-live="polite" aria-label={`${pin.length}`}>
        {Array.from({ length: Math.max(minLength, pin.length) }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "size-3.5 rounded-xs transition-all duration-150",
              i < pin.length ? "scale-110 bg-primary" : "bg-border",
              error && pin.length === 0 && "bg-destructive/35",
            )}
          />
        ))}
      </div>
      {/* The line is reserved even when empty, so a message never pushes the keypad down. */}
      <div className="mt-2 flex min-h-8 items-center justify-center" role="alert">
        {error && (
          <p className="flex items-center gap-1.5 rounded-xs bg-destructive-soft px-3 py-1 text-center text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </div>
      <Keypad value={pin} onChange={change} maxLength={maxLength} allowDecimal={false} className="mt-2" />
      <Button type="button" size="lg" className="mt-3 w-full" disabled={busy || pin.length < minLength} onClick={() => onSubmit(pin)}>
        {busy ? <Loader2 className="animate-spin" aria-label={t("common.loading")} /> : (submitLabel ?? t("common.confirm"))}
      </Button>
    </div>
  );
}
