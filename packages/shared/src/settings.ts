/**
 * Settings. PRD §6.11, §14.4, §15.4.
 *
 * `ClientSettings` is the explicit shape `GET /settings/client` returns to any session: what
 * a till must enforce or render, and nothing else. A key added to `SETTING_DEFAULTS` is
 * invisible to a worker until it is added here too — the shape is the control (§16.5).
 */
import type { PriceBasis, TaxRegime } from "./enums.ts";

export interface ClientSettings {
  shopName: string;
  taxRegime: TaxRegime | null;
  priceBasis: PriceBasis;
  taxRateBp: number;
  cashRoundingStep: number;
  maxDiscountBp: number;
  offlineDebtCap: number;
  offlineDiscountCeilingBp: number;
  strictNegativeStock: boolean;
  strictCreditLimit: boolean;
  connectionFailureThreshold: number;
  scanLatencyThresholdMs: number;
  settingsStaleAfterMinutes: number;
  debtBookEnabled: boolean;
  textSize: "normal" | "large" | "xlarge";
  varianceNoteThreshold: number;
  timezone: string;
}

/** Every §6.11 setting, keyed as stored in `Setting.key`, with its default. */
export const SETTING_DEFAULTS = {
  "shop.name": "",
  "shop.address": "",
  "shop.timezone": "Asia/Yerevan",
  "tax.regime": null as TaxRegime | null,
  "tax.priceBasis": "INCLUSIVE" as PriceBasis,
  "tax.rateBp": 2000,
  "cash.roundingStep": 1,
  "stock.strictNegative": false,
  "debt.strictLimit": false,
  "debt.enabled": true,
  "discount.maxBp": 500,
  "debt.defaultLimit": 50_000,
  "offline.debtCap": 20_000,
  "offline.discountCeilingBp": 1000,
  "retention.years": 10,
  "debt.consentStep": false,
  "backup.destination": "LOCAL+USB",
  "shift.varianceNoteThreshold": 500,
  "receiving.costVarianceRatio": 3,
  "reorder.safetyDays": 3,
  "connection.failureThreshold": 2,
  "connection.scanLatencyMs": 1500,
  "settings.staleAfterMinutes": 240,
  "device.clockSkewMinutes": 2,
  "ui.textSize": "normal" as ClientSettings["textSize"],
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type SettingValues = { -readonly [K in SettingKey]: (typeof SETTING_DEFAULTS)[K] | (K extends "tax.regime" ? TaxRegime : never) };

export function toClientSettings(v: SettingValues): ClientSettings {
  return {
    shopName: v["shop.name"],
    taxRegime: v["tax.regime"],
    priceBasis: v["tax.priceBasis"],
    taxRateBp: v["tax.regime"] === "VAT" ? v["tax.rateBp"] : 0,
    cashRoundingStep: v["cash.roundingStep"],
    maxDiscountBp: v["discount.maxBp"],
    offlineDebtCap: v["offline.debtCap"],
    offlineDiscountCeilingBp: v["offline.discountCeilingBp"],
    strictNegativeStock: v["stock.strictNegative"],
    strictCreditLimit: v["debt.strictLimit"],
    connectionFailureThreshold: v["connection.failureThreshold"],
    scanLatencyThresholdMs: v["connection.scanLatencyMs"],
    settingsStaleAfterMinutes: v["settings.staleAfterMinutes"],
    debtBookEnabled: v["debt.enabled"],
    textSize: v["ui.textSize"],
    varianceNoteThreshold: v["shift.varianceNoteThreshold"],
    timezone: v["shop.timezone"],
  };
}
