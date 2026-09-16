/**
 * Report periods. PRD §6.10: the default period is today and changing it is one tap. Periods are
 * business dates in the shop's timezone (§19.3), so "today" is never the host's or the phone's day.
 */

export type PeriodPreset = "today" | "yesterday" | "week" | "month" | "lastMonth";

export const PERIOD_PRESETS: readonly PeriodPreset[] = ["today", "yesterday", "week", "month", "lastMonth"];

/** `YYYY-MM-DD` plus `n` calendar days. Pure date arithmetic — no timezone can move it. */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week holding `date`; Armenian weeks start on Monday. */
export function startOfWeek(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((dow + 6) % 7));
}

export const startOfMonth = (date: string) => `${date.slice(0, 7)}-01`;

/** The inclusive business-date range a preset names, relative to the shop's today. */
export function periodRange(preset: PeriodPreset, today: string): { from: string; to: string } {
  switch (preset) {
    case "today": return { from: today, to: today };
    case "yesterday": { const y = addDays(today, -1); return { from: y, to: y }; }
    case "week": return { from: startOfWeek(today), to: today };
    case "month": return { from: startOfMonth(today), to: today };
    case "lastMonth": { const end = addDays(startOfMonth(today), -1); return { from: startOfMonth(end), to: end }; }
  }
}
