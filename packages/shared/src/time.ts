/**
 * Shop-local time. PRD §11 `Setting` (`shop.timezone`), §20.3.
 *
 * Timestamps are stored as RFC 3339 UTC; only the edges convert. `businessDate` is the
 * calendar day in the shop's timezone, never the host's locale.
 */
export const DEFAULT_TIMEZONE = "Asia/Yerevan";

export function nowIso(): string {
  return new Date().toISOString();
}

/** `YYYY-MM-DD` of an instant, in the given IANA timezone. */
export function businessDate(instant: Date | string, timeZone: string = DEFAULT_TIMEZONE): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Whole days between two business dates (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
