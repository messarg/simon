/**
 * Settings. PRD §6.11, §15.4. Values are stored JSON-encoded in `Setting.value`; a key with
 * no row takes its §6.11 default.
 */
import { z } from "zod";
import { SETTING_DEFAULTS, TaxRegime, PriceBasis, toClientSettings, type ClientSettings, type SettingKey, type SettingValues } from "@simon/shared";
import type { Db, Tx } from "../lib/db.ts";
import { clock } from "../lib/time.ts";
import { writeAudit } from "./audit.service.ts";

const int = (min: number, max = Number.MAX_SAFE_INTEGER) => z.number().int().min(min).max(max);

/** One validator per key — the PATCH contract. */
export const SETTING_SCHEMAS: { [K in SettingKey]: z.ZodType } = {
  "shop.name": z.string().trim().max(120),
  "shop.address": z.string().trim().max(240),
  "shop.timezone": z.string().refine((tz) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } }),
  "tax.regime": TaxRegime,
  "tax.priceBasis": PriceBasis,
  "tax.rateBp": int(0, 10_000),
  "cash.roundingStep": z.union([z.literal(1), z.literal(10), z.literal(50), z.literal(100)]),
  "stock.strictNegative": z.boolean(),
  "debt.strictLimit": z.boolean(),
  "debt.enabled": z.boolean(),
  "discount.maxBp": int(0, 10_000),
  "debt.defaultLimit": int(0),
  "offline.debtCap": int(0),
  "offline.discountCeilingBp": int(0, 10_000),
  "retention.years": int(1, 50),
  "debt.consentStep": z.boolean(),
  "backup.destination": z.enum(["LOCAL", "LOCAL+USB"]),
  "shift.varianceNoteThreshold": int(0),
  "receiving.costVarianceRatio": int(1, 100),
  "reorder.safetyDays": int(0, 365),
  "connection.failureThreshold": int(1, 20),
  "connection.scanLatencyMs": int(100, 30_000),
  "settings.staleAfterMinutes": int(5, 10_080),
  "device.clockSkewMinutes": int(1, 1_440),
  "ui.textSize": z.enum(["normal", "large", "xlarge"]),
};

export async function readSettings(db: Db | Tx): Promise<SettingValues & { updatedAt: string | null }> {
  const rows = await db.setting.findMany();
  const values = { ...SETTING_DEFAULTS } as Record<string, unknown>;
  let updatedAt: string | null = null;
  for (const r of rows) {
    if (r.key in SETTING_DEFAULTS) values[r.key] = JSON.parse(r.value);
    if (!updatedAt || r.updatedAt > updatedAt) updatedAt = r.updatedAt;
  }
  return { ...(values as SettingValues), updatedAt };
}

export async function clientSettings(db: Db | Tx): Promise<ClientSettings & { updatedAt: string | null }> {
  const s = await readSettings(db);
  return { ...toClientSettings(s), updatedAt: s.updatedAt };
}

export async function writeSettings(tx: Tx, patch: Record<string, unknown>, userId: string | null) {
  const before = await readSettings(tx);
  const now = clock.iso();
  const parsed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const schema = SETTING_SCHEMAS[key as SettingKey];
    if (!schema) throw new z.ZodError([{ code: "custom", path: [key], message: "unknown setting", input: value }]);
    parsed[key] = schema.parse(value);
  }
  for (const [key, value] of Object.entries(parsed)) {
    const v = JSON.stringify(value);
    await tx.setting.upsert({ where: { key }, create: { key, value: v, updatedAt: now }, update: { value: v, updatedAt: now } });
  }
  if (userId) {
    const beforeSubset = Object.fromEntries(Object.keys(parsed).map((k) => [k, (before as Record<string, unknown>)[k]]));
    await writeAudit(tx, { userId, action: "settings.update", entityType: "Setting", entityId: Object.keys(parsed).join(","), before: beforeSubset, after: parsed });
  }
  return readSettings(tx);
}
