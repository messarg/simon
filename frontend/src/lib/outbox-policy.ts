/**
 * The outbox's decisions, as pure functions. PRD §14.4.
 *
 * - Network failure and 5xx: retry with backoff.
 * - 401: hold (the sale is complete; retry after the next sign-in), never park.
 * - 404 on a document that names another: to the back of the queue once, then park.
 * - Any other 4xx: park — it steps aside and never blocks the items behind it.
 */
import type { OutboxItem } from "./local-db.ts";

export type Outcome = { action: "done" } | { action: "retry"; nextAttemptAt: number } | { action: "hold" } | { action: "requeue" } | { action: "park" };

export function classify(status: number, item: Pick<OutboxItem, "attempts" | "dependsOn" | "requeuedOnce">, now: number): Outcome {
  if (status >= 200 && status < 300) return { action: "done" };
  if (status === 0 || status >= 500 || status === 408 || status === 429) {
    const delay = Math.min(60_000, 1000 * 2 ** Math.min(item.attempts, 6));
    return { action: "retry", nextAttemptAt: now + delay };
  }
  if (status === 401) return { action: "hold" };
  if (status === 404 && item.dependsOn.length > 0 && !item.requeuedOnce) return { action: "requeue" };
  return { action: "park" };
}

/**
 * The next item to send, or null. FIFO: a waiting item (backoff or held) stops the drain so
 * nothing overtakes it; parked items are skipped.
 */
export function nextToSend(items: readonly OutboxItem[], now: number): OutboxItem | null {
  const ordered = [...items].sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));
  const waitingIds = new Set(ordered.filter((i) => i.state !== "parked").map((i) => i.id));
  for (const item of ordered) {
    if (item.state === "parked") continue;
    if (item.state === "held" || item.nextAttemptAt > now) return null;
    // An antecedent still in the queue ahead of it holds it back (§14.4).
    if (item.dependsOn.some((d) => d !== item.id && waitingIds.has(d) && ordered.findIndex((o) => o.id === d) < ordered.indexOf(item))) return null;
    return item;
  }
  return null;
}

export function counts(items: readonly OutboxItem[]) {
  // Practice documents are discarded rather than sent, so counting them would give the owner a queue
  // figure that can never reach zero and an alert that never clears (§19.4).
  const real = items.filter((i) => i.mode !== "PRACTICE");
  const live = real.filter((i) => i.state !== "parked");
  const sales = live.filter((i) => !i.isParkedBasket);
  return {
    pendingSales: sales.filter((i) => i.kind === "sale").length,
    pendingDocuments: sales.length,
    parkedBaskets: live.filter((i) => i.isParkedBasket).length,
    needsAttention: real.filter((i) => i.state === "parked").length,
    oldestAt: sales.map((i) => i.enqueuedAt).sort()[0] ?? null,
  };
}
