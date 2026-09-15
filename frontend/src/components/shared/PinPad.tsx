/**
 * PIN entry: dots, a keypad, and the message the server sent back (§16.2). The parent
 * clears it after a failed attempt by remounting it with a new `key`.
 */
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn.ts";
import { Keypad } from "./Keypad.tsx";

export interface PinPadProps {
  onSubmit: (pin: string) => void;
  busy?: boolean;
  error?: string | null;
  minLength?: number;
  maxLength?: number;
  label: string;
}

export function PinPad({ onSubmit, busy, error, minLength = 4, maxLength = 8, label }: PinPadProps) {
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
    // Four digits submit on their own; longer PINs submit with Enter or the check button.
    if (next.length === maxLength) onSubmit(next);
  };

  return (
    <div className="mx-auto w-full max-w-xs">
      <p className="mb-4 text-center text-lg font-medium">{label}</p>
      <div className="mb-3 flex h-6 items-center justify-center gap-3" aria-live="polite" aria-label={`${pin.length}`}>
        {Array.from({ length: Math.max(minLength, pin.length) }).map((_, i) => (
          <span key={i} className={cn("size-3.5 rounded-full border-2 border-primary transition-colors", i < pin.length && "bg-primary")} />
        ))}
      </div>
      <p className={cn("mb-4 min-h-6 text-center text-sm", error ? "text-destructive" : "text-transparent")} role="alert">{error ?? "·"}</p>
      <Keypad value={pin} onChange={change} maxLength={maxLength} allowDecimal={false} />
      <button
        type="button"
        disabled={busy || pin.length < minLength}
        onClick={() => onSubmit(pin)}
        className="mt-3 h-touch-lg w-full rounded-lg bg-primary text-lg font-semibold text-primary-foreground disabled:opacity-40"
      >
        {busy ? "…" : "✓"}
      </button>
    </div>
  );
}
