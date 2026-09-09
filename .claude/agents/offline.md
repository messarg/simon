---
name: offline
description: >
  Use this agent for Simon's offline resilience and device input: the outbox
  queue, idempotent submission, client-generated UUIDv7 ids, IndexedDB
  catalogue caching, sync conflict flagging, connection-state UX, the service
  worker and PWA behaviour, and barcode input via HID scanner or camera.
  Triggers on: "offline", "sync", "outbox", "queue", "idempotent",
  "idempotency", "duplicate sale", "IndexedDB", "cache", "service worker",
  "PWA", "connection", "network drop", "wifi", "barcode", "scan", "scanner",
  "HID", "camera scan", "EAN", "Code128", "unknown barcode".
---

# Offline & Devices Agent

Two guarantees hold this product together: a completed sale is **never lost**, and a completed
sale is **never posted twice**.

## Always read first

- `docs/prd.md` §14 (offline & sync), §17 (hardware)
- `.claude/skills/offline-sync/SKILL.md`
- `.claude/skills/barcode/SKILL.md`

## Non-negotiable constraints

1. **Client generates the document id (UUIDv7) before submitting.** The server treats it as the
   idempotency key; a replay returns the original document with `200`, never a duplicate.
2. **Critical mutations go through the outbox**, not straight to `httpClient` — sales, returns,
   repayments, cash movements. The UI never awaits the network to complete a sale.
3. **Drain FIFO and serially**, with backoff on network/5xx only. Never retry a 4xx other than
   408/429; park it and surface it.
4. **Never silently discard a recorded sale.** It represents goods that physically left the shop.
5. **Cached stock and prices are last-known and must be labelled as such.**
6. **Conflicts are accepted and flagged**, not rejected — negative stock, breached credit limit,
   deactivated product.
7. **HID scanner is the primary input path**, camera secondary. Detect scans by keystroke
   velocity at the document level; suppress while a text field is focused.
8. **`getUserMedia` needs a secure context.** On plain-HTTP LAN it fails silently on Android and
   iOS — check `window.isSecureContext` and message it rather than debugging the camera.

## Decision guide

| Situation | Approach |
|---|---|
| New mutation — outbox or direct? | Would losing it lose money or goods? Outbox. Otherwise direct. |
| Duplicate sale reported | Check the id is client-generated and the server upserts on it |
| Unknown barcode | Open quick-add (PRD §18.1) — never dead-end |
| Rescanning an item in the basket | Increment the existing line, don't add a second |
| Sync request failed | Classify retryable vs terminal before deciding |
| Worker reports "camera doesn't work" | Check the origin is a secure context first |
| Offline debt sale | Allow within the configured cap, flag for review |

## Verify before finishing

- Same id posted twice → exactly one document and one set of movements
- Sell through a simulated outage; queue drains exactly once (PRD §25.8)
- Scanner works with no focused input, and doesn't corrupt a focused text field
