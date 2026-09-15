/**
 * Receipt numbers belong to the till: `{prefix}-{sequence}`, assigned on the device so an
 * offline sale is numbered like any other (§12.1). The device's counter is authoritative.
 */
import { getMeta, setMeta } from "./local-db.ts";
import { sessionStore } from "./session-store.ts";

export async function nextReceiptNumber(): Promise<string> {
  const session = sessionStore.get();
  if (!session) throw new Error("no session");
  const key = `device.sequence.${session.device.id}`;
  const stored = (await getMeta<number>(key)) ?? 0;
  const next = Math.max(stored, session.device.lastSequence) + 1;
  await setMeta(key, next);
  return `${session.device.prefix}-${next}`;
}

export async function currentSequence(): Promise<number> {
  const session = sessionStore.get();
  if (!session) return 0;
  return Math.max((await getMeta<number>(`device.sequence.${session.device.id}`)) ?? 0, session.device.lastSequence);
}
