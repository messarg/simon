/**
 * Review flags — the durable state behind every warning (§11 `ReviewFlag`, §15.2). A warning
 * is read back from these rows, never re-derived, so a replay returns the same warnings.
 */
import { uuidv7, warningTypeForFlag, type ReviewFlagType, type Warning } from "@simon/shared";
import type { Db, Tx } from "../lib/db.ts";
import { clock } from "../lib/time.ts";

export async function raiseFlag(tx: Tx, f: { type: ReviewFlagType; sourceType: string; sourceId: string; productId?: string | null; customerId?: string | null; note?: unknown }) {
  return tx.reviewFlag.create({
    data: {
      id: uuidv7(), type: f.type, sourceType: f.sourceType, sourceId: f.sourceId,
      productId: f.productId ?? null, customerId: f.customerId ?? null,
      note: f.note === undefined ? "" : typeof f.note === "string" ? f.note : JSON.stringify(f.note), createdAt: clock.iso(),
    },
  });
}

export async function warningsFor(db: Db | Tx, sourceType: string, sourceId: string): Promise<Warning[]> {
  const flags = await db.reviewFlag.findMany({ where: { sourceType, sourceId }, orderBy: { createdAt: "asc" } });
  return flags.flatMap((f) => {
    const type = warningTypeForFlag(f.type as ReviewFlagType);
    if (!type) return [];
    const note = f.note ? safeJson(f.note) : undefined;
    return [{ type, flagId: f.id, productId: f.productId, customerId: f.customerId, ...(note && typeof note === "object" ? note : {}) }];
  });
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return undefined; }
}
