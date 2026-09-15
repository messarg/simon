import { describe, expect, it } from "vitest";
import { classify, counts, nextToSend } from "./outbox-policy.ts";
import type { OutboxItem } from "./local-db.ts";

const item = (id: string, at: string, over: Partial<OutboxItem> = {}): OutboxItem => ({
  id, kind: "sale", body: {}, dependsOn: [], enqueuedAt: at, attempts: 0, state: "pending", lastError: null, nextAttemptAt: 0,
  isParkedBasket: false, requeuedOnce: false, enqueuedOffline: false, afterSync: null, label: id, ...over,
});

describe("outbox policy — §14.4, §27.34", () => {
  it("retries network failures and 5xx with backoff; holds a 401; parks a 422", () => {
    expect(classify(0, item("a", "1"), 1000)).toEqual({ action: "retry", nextAttemptAt: 2000 });
    expect(classify(503, item("a", "1", { attempts: 3 }), 0)).toEqual({ action: "retry", nextAttemptAt: 8000 });
    expect(classify(401, item("a", "1"), 0)).toEqual({ action: "hold" });
    expect(classify(422, item("a", "1"), 0)).toEqual({ action: "park" });
    expect(classify(400, item("a", "1"), 0)).toEqual({ action: "park" });
  });

  it("requeues a dependent 404 once, then parks it", () => {
    expect(classify(404, item("r", "1", { dependsOn: ["s"] }), 0)).toEqual({ action: "requeue" });
    expect(classify(404, item("r", "1", { dependsOn: ["s"], requeuedOnce: true }), 0)).toEqual({ action: "park" });
    expect(classify(404, item("r", "1"), 0)).toEqual({ action: "park" });
  });

  it("drains FIFO; a parked item steps aside; a waiting item stops the drain", () => {
    const items = [item("b", "2"), item("a", "1", { state: "parked" }), item("c", "3")];
    expect(nextToSend(items, 0)?.id).toBe("b");
    expect(nextToSend([item("b", "2", { nextAttemptAt: 99 }), item("c", "3")], 0)).toBeNull();
    expect(nextToSend([item("b", "2", { state: "held" }), item("c", "3")], 0)).toBeNull();
  });

  it("counts parked baskets apart from sales in transit", () => {
    const c = counts([item("s", "1"), item("h", "2", { isParkedBasket: true }), item("p", "3", { state: "parked" })]);
    expect(c).toMatchObject({ pendingSales: 1, parkedBaskets: 1, needsAttention: 1, oldestAt: "1" });
  });
});
