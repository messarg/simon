/** Display formatting only — never feed a formatted value back into arithmetic (§10.1). */
import { formatDram, groupDigits, QTY_SCALE, type Dram, type MilliUnit } from "@simon/shared";
import { hy } from "@/i18n/hy.ts";

export const money = (amount: Dram) => formatDram(amount);
export const moneyPlain = (amount: Dram) => groupDigits(amount);

/** Up to the product's decimal places, trailing zeros dropped: a piece count never shows ".000" (§10.2). */
export function qty(value: MilliUnit, decimalPlaces: number) {
  const fixed = (value / QTY_SCALE).toFixed(decimalPlaces);
  return groupDigits(Number(decimalPlaces > 0 ? fixed.replace(/\.?0+$/, "") : fixed));
}

/** 24-hour time. Chromium's hy-AM default is a 12-hour clock, which no Armenian shop uses. */
export function time(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "15 սեպ 20:48" — month names from the resource file, since Chromium has no short Armenian months ("M09"). */
export function dateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${hy.dates.months[d.getMonth()]} ${time(iso)}`;
}
