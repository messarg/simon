/**
 * An on/off row: the label on the left, the switch on the right edge, the whole row the target.
 * A long Armenian label wraps and stays left-aligned; the switch stays centred against it.
 */
import { cn } from "@/lib/cn.ts";

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-touch w-full items-center justify-between gap-3 rounded-lg py-1 text-left"
    >
      <span className="min-w-0">{label}</span>
      <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-border")}>
        <span className={cn("absolute top-0.5 left-0.5 size-6 rounded-full bg-card shadow transition-transform", checked && "translate-x-5")} />
      </span>
    </button>
  );
}
