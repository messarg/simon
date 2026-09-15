/** Display formatting only — never feed a formatted value back into arithmetic (§10.1). */
import { formatDram, QTY_SCALE, type Dram, type MilliUnit } from "@simon/shared";

const qtyFormatters = new Map<number, Intl.NumberFormat>();

export const money = (amount: Dram) => formatDram(amount);
export const moneyPlain = (amount: Dram) => new Intl.NumberFormat("hy-AM").format(amount);

export function qty(value: MilliUnit, decimalPlaces: number) {
  let f = qtyFormatters.get(decimalPlaces);
  if (!f) {
    f = new Intl.NumberFormat("hy-AM", { minimumFractionDigits: 0, maximumFractionDigits: decimalPlaces });
    qtyFormatters.set(decimalPlaces, f);
  }
  return f.format(value / QTY_SCALE);
}

export function time(iso: string) {
  return new Intl.DateTimeFormat("hy-AM", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function dateTime(iso: string) {
  return new Intl.DateTimeFormat("hy-AM", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
