/**
 * The outbox. PRD §14.3–14.4, FR-SYN-02.
 *
 * Every queue-drained document — sales (completed and parked), returns, cash movements — is
 * written here first and the UI moves on. A single serial drain sends them in order. Printing
 * and the drawer run after the server accepts a document, and only for documents completed
 * while the host was reachable.
 */
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { Warning } from "@simon/shared";
import { t, warningMessage } from "@/i18n/t.ts";
import { connection } from "./connection.ts";
import { currentSequence } from "./device.ts";
import { ApiProblem, http } from "./http.ts";
import { localDb, type OutboxItem, type OutboxKind } from "./local-db.ts";
import { classify, counts, nextToSend } from "./outbox-policy.ts";
import { sessionStore } from "./session-store.ts";

const PATHS: Record<OutboxKind, string> = { sale: "/sales", "sale-return": "/sale-returns", "cash-movement": "/cash-movements", "debt-payment": "/debt-payments" };

let snapshot = counts([]);
let items: OutboxItem[] = [];
const listeners = new Set<() => void>();
const resultListeners = new Set<(item: OutboxItem, response: unknown) => void>();

async function refresh() {
  items = await (await localDb()).getAll("outbox");
  snapshot = counts(items);
  listeners.forEach((l) => l());
}

export const outbox = {
  async enqueue(kind: OutboxKind, id: string, body: unknown, opts: { dependsOn?: string[]; isParkedBasket?: boolean; afterSync?: OutboxItem["afterSync"]; label: string }) {
    const db = await localDb();
    const offline = connection.get() === "offline";
    await db.put("outbox", {
      id, kind, body, dependsOn: opts.dependsOn ?? [], enqueuedAt: new Date().toISOString(), attempts: 0, state: "pending", lastError: null,
      nextAttemptAt: 0, isParkedBasket: opts.isParkedBasket ?? false, requeuedOnce: false, enqueuedOffline: offline,
      afterSync: offline ? null : (opts.afterSync ?? null), label: opts.label,
    });
    await refresh();
    void drain();
  },
  /** Take back a document that has not been sent yet — resuming a basket parked on this till while offline. */
  async take(id: string): Promise<OutboxItem | null> {
    if (draining === id) return null;
    const db = await localDb();
    const item = await db.get("outbox", id);
    if (!item || item.state === "parked") return null;
    await db.delete("outbox", id);
    await refresh();
    return item;
  },
  has: (id: string) => items.some((i) => i.id === id && i.state !== "parked"),
  items: () => items,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  onResult(l: (item: OutboxItem, response: unknown) => void) { resultListeners.add(l); return () => { resultListeners.delete(l); }; },
  async dismissParked(id: string) { await (await localDb()).delete("outbox", id); await refresh(); },
  /** After a sign-in, held items (401) become sendable again. */
  async releaseHeld() {
    const db = await localDb();
    for (const i of await db.getAll("outbox")) if (i.state === "held") await db.put("outbox", { ...i, state: "pending", nextAttemptAt: 0 });
    await refresh();
    void drain();
  },
  refresh,
};

let draining: string | null = null;
let running = false;

export async function drain() {
  if (running || !sessionStore.get()) return;
  running = true;
  try {
    const db = await localDb();
    for (;;) {
      const all = await db.getAll("outbox");
      const item = nextToSend(all, Date.now());
      if (!item) break;
      draining = item.id;
      const body = { ...(item.body as object), queued: item.attempts > 0 || item.enqueuedOffline, sentAt: new Date().toISOString() };
      let status = 200;
      let response: unknown = null;
      try {
        response = await http.post(PATHS[item.kind], body, { timeoutMs: 10_000, keepSessionOn401: true });
        connection.reportSuccess();
      } catch (err) {
        status = err instanceof ApiProblem ? err.status : 0;
        if (status === 0) connection.reportFailure();
        response = err instanceof ApiProblem ? err.body : null;
      }
      const outcome = classify(status, item, Date.now());
      const lastError = status >= 300 || status === 0 ? { status, type: (response as { type?: string } | null)?.type ?? "network" } : null;
      if (outcome.action === "done") {
        await db.delete("outbox", item.id);
        await refresh();
        resultListeners.forEach((l) => l(item, response));
        void afterSync(item, response);
        continue;
      }
      if (outcome.action === "retry") await db.put("outbox", { ...item, attempts: item.attempts + 1, nextAttemptAt: outcome.nextAttemptAt, lastError });
      else if (outcome.action === "hold") await db.put("outbox", { ...item, attempts: item.attempts + 1, state: "held", lastError });
      else if (outcome.action === "requeue") await db.put("outbox", { ...item, attempts: item.attempts + 1, requeuedOnce: true, enqueuedAt: new Date().toISOString(), lastError });
      else {
        await db.put("outbox", { ...item, attempts: item.attempts + 1, state: "parked", lastError });
        toast.error(t("outbox.parkedTitle"), { description: item.label });
      }
      await refresh();
      if (outcome.action === "retry" || outcome.action === "hold") break;
    }
  } finally {
    draining = null;
    running = false;
  }
}

async function afterSync(item: OutboxItem, response: unknown) {
  const warnings = ((response as { warnings?: Warning[] } | null)?.warnings ?? []).filter((w) => w.type === "insufficient-stock");
  for (const w of warnings) toast.warning(warningMessage(w.type));
  if (!item.afterSync) return;
  const body = item.body as { id: string };
  if (item.afterSync.print) {
    const payload = item.kind === "sale" ? { saleId: body.id } : item.kind === "debt-payment" ? { debtPaymentId: body.id } : { saleReturnId: body.id };
    http.post("/print/receipt", payload, { timeoutMs: 8000 }).catch(() => toast.error(t("payment.printFailed"), { action: { label: t("payment.reprint"), onClick: () => void http.post("/print/receipt", payload) } }));
  }
  if (item.afterSync.drawer) {
    const type = item.kind === "sale" ? "Sale" : item.kind === "sale-return" ? "SaleReturn" : item.kind === "debt-payment" ? "DebtEntry" : "CashMovement";
    http.post("/cash-drawer/open", { document: { type, id: body.id } }, { timeoutMs: 5000 }).catch(() => toast.error(t("payment.drawerFailed")));
  }
}

export function useOutboxCounts() {
  return useSyncExternalStore(outbox.subscribe, () => snapshot);
}

export function useOutboxItems() {
  useSyncExternalStore(outbox.subscribe, () => snapshot);
  return items;
}

/** Drains on an interval and on reconnect; reports queue depths on a one-minute heartbeat (§16.3). */
export function startOutbox() {
  void refresh().then(() => drain());
  const tick = setInterval(() => void drain(), 3000);
  const unsub = connection.subscribe(() => { if (connection.get() === "online") void drain(); });
  const heartbeat = async () => {
    if (!sessionStore.get() || connection.get() === "offline") return;
    const c = counts(await (await localDb()).getAll("outbox"));
    http.post("/devices/heartbeat", { outboxDepth: c.pendingDocuments, parkedDepth: c.parkedBaskets, outboxOldestAt: c.oldestAt, lastSequence: await currentSequence() }, { timeoutMs: 5000 }).catch(() => {});
  };
  void heartbeat();
  const beat = setInterval(() => void heartbeat(), 60_000);
  return () => { clearInterval(tick); clearInterval(beat); unsub(); };
}
