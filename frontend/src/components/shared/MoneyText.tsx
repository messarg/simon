import { cn } from "@/lib/cn.ts";
import { money, moneyPlain } from "@/lib/format.ts";
import type { Dram } from "@simon/shared";

/** Money is always tabular, right-aligned by its container, and formatted in one place. */
export function MoneyText({ amount, className, symbol = true, signed = false }: { amount: Dram; className?: string; symbol?: boolean; signed?: boolean }) {
  const sign = signed && amount > 0 ? "+" : "";
  return <span className={cn("tabular whitespace-nowrap", className)}>{sign}{symbol ? money(amount) : moneyPlain(amount)}</span>;
}
