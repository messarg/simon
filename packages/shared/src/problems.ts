/**
 * The error catalogue. PRD §8.5, §15.2.
 *
 * `type` values are a frozen contract: the server sends them, the client maps each to an
 * Armenian resource key. A `type` is either a blocking error or a warning, never both.
 */
import type { ReviewFlagType } from "./enums.ts";

export const PROBLEM_BASE = "https://simon.local/errors/";

export const ERROR_TYPES = [
  "credit-limit-exceeded", "customer-blocked", "insufficient-stock-strict", "return-exceeds-sold",
  "discount-above-cap", "tax-regime-not-set", "shift-not-open", "shift-has-open-baskets",
  "duplicate-barcode", "immutable-after-movements", "pin-incorrect", "account-locked",
  "too-many-attempts", "not-permitted", "session-expired", "not-found", "malformed-request",
  "illegal-transition", "internal-error", "setup-required", "reauth-required",
] as const;
export type ErrorType = (typeof ERROR_TYPES)[number];

export const WARNING_TYPES = [
  "customer-blocked-on-sync", "insufficient-stock", "credit-limit-exceeded-on-sync",
  "product-deactivated-on-sync", "held-basket-after-close", "return-exceeds-sold-on-sync",
  "price-changed-on-sync", "tax-rate-changed-on-sync", "device-clock-skew",
  "discount-above-cap-on-sync", "cost-variance",
] as const;
export type WarningType = (typeof WARNING_TYPES)[number];

/** Client-side states with no HTTP status (§8.5). */
export type ClientProblemType =
  | "unknown-barcode" | "offline-working" | "offline-pending" | "offline-not-available"
  | "offline-debt-cap" | "offline-discount-ceiling" | "sync-failed";

export interface Problem {
  type: string;
  title: string;
  status: number;
  [field: string]: unknown;
}

export interface Warning {
  type: WarningType;
  [field: string]: unknown;
}

/** A warning is read back from the `ReviewFlag` the transaction wrote (§15.2). The mapping is mechanical. */
export function warningTypeForFlag(flag: ReviewFlagType): WarningType | null {
  if (flag === "LEDGER_CACHE_DRIFT") return null; // raised by a job, not a request (§8.5)
  return flag.toLowerCase().replaceAll("_", "-") as WarningType;
}

export function problemSlug(type: string): string {
  return type.startsWith(PROBLEM_BASE) ? type.slice(PROBLEM_BASE.length) : type;
}
