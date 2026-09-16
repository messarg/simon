---
name: offline-sync
description: Offline resilience for Simon's LAN-primary architecture — IndexedDB catalogue cache, the outbox queue, idempotent submission with client-generated UUIDv7 ids, sync conflict flagging, and the connection-state UX. Use when work touches sale submission, the service worker, local caching, or anything that must survive a Wi-Fi drop.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Offline & sync

Simon is **LAN-primary with a resilient client**, not peer-to-peer offline-first (PRD §14.1).
The shop PC is authoritative. The client is built so a brief LAN interruption never costs a
sale — because a customer is standing at the counter and the queue must not stop.

## The two rules

1. **A completed sale is never lost.** It represents goods that physically left the shop.
2. **A completed sale is never posted twice.** One dropped response must not double-charge
   the customer and double-deduct stock.

Rule 2 is why idempotency is mandatory, not an optimisation.

## Idempotency

**The client generates the sale `id` before submitting.** UUIDv7 — time-sortable, so ids
cluster in index order rather than scattering B-tree writes.

```ts
// client
const saleId = uuidv7();
await outbox.enqueue({ id: saleId, kind: "sale", body });

// server — POST /sales
const existing = await tx.sale.findUnique({ where: { id: body.id } });
if (existing) return { status: 200, body: existing };   // replay: return the original
// ... otherwise post it, with id as the primary key
```

- The **primary key is the idempotency key**. A unique-constraint violation on retry is the
  safety net, not the mechanism — catch it and return the existing document.
- Applies to every queue-drained endpoint: sales, returns, repayments, cash movements.
- A replay returns `200` with the original document, never `409`. The client cannot
  distinguish "my retry succeeded" from "someone else did this" and must not have to.

## Outbox queue

```
IndexedDB
  catalogue   products, barcodes, prices, customer names + balances   (read cache)
  outbox      pending mutations, FIFO by createdAt                    (write queue)
  meta        lastSyncAt, deviceId
```

```ts
enqueue(op)   // write locally, resolve immediately — the UI never awaits the network
drain()       // FIFO, one at a time, stop on first non-retryable error
```

- **Write local, then drain.** Checkout completes against IndexedDB; the network is a
  background concern. Never block the confirm button on a request.
- **FIFO and serial.** Parallel draining reorders dependent operations (a repayment against
  a sale still in the queue).
- **Retry with backoff** on network/5xx. **Do not retry** 4xx other than 408/429 — park the
  item, flag it, and surface it to the owner. Silently dropping a 422 loses a real sale.
- Never clear an item until the server has acknowledged it.

## What may and may not happen offline

| Operation | Offline | Why |
|---|---|---|
| Scan, build a basket, take cash | ✅ | Catalogue is cached; nothing to validate |
| Complete a cash/card sale | ✅ | Queued, idempotent |
| Debt sale | ⚠️ capped | Credit limit cannot be checked — allow within a configurable cap, flag for review |
| Repayment | ✅ | Additive; allocation recomputed server-side on sync |
| Goods receipt, stocktake, price change | ❌ | Needs authoritative stock; block with a clear message |
| Any report | ❌ | Server-computed |

Stock levels shown offline are **last-known**, and must be labelled as such. Never let a
cached stock number look authoritative.

## Conflicts

Sales are additive, so genuine conflicts are rare and specific:

- **Stock goes negative on sync** → accept the movement, flag the product for recount
  (PRD §13.6). The goods are already gone; refusing the record does not bring them back.
- **Credit limit breached by a queued offline sale** → accept, flag for owner review.
- **Product deleted/deactivated between cache and sync** → accept, flag. Never reject.

**Never silently discard a recorded sale.** If it truly cannot be posted, park it in a
visible "needs attention" list with the reason.

## Connection UX

Three states, in Armenian, non-technical:

| State | Indicator |
|---|---|
| Connected, queue empty | quiet — no chrome |
| Working offline | persistent banner, plain language |
| N pending | count badge, tappable to a list |

- Never show a raw error or HTTP status to a worker.
- Never use a blocking modal for a sync problem — it stops the till.
- Show pending count at shift close; closing with unsynced sales needs an explicit
  acknowledgement, because the Z-report will be incomplete.

## Service worker (vite-plugin-pwa)

- Precache the app shell so a cold start with no LAN still boots to a usable till.
- **Never cache API GETs as a stale-while-revalidate default** — a stale price or stale
  stock is worse than no data. Cache the catalogue deliberately, in IndexedDB, on an
  explicit refresh, with a visible `lastSyncAt`.
- Handle service-worker updates explicitly: a POS must not swap its bundle mid-sale. Prompt
  at shift boundaries.

## Testing

- Unit: outbox ordering, backoff, retryable vs terminal error classification.
- Integration: submit the same sale id twice → exactly one sale, one set of movements.
- E2E (PRD §25.8): sell through a simulated two-minute outage; every queued sale syncs
  exactly once, no duplicates.

## Checklist

- [ ] Sale id generated client-side (UUIDv7) before submit
- [ ] Server treats the id as the idempotency key and replays return the original
- [ ] UI never awaits the network to complete a sale
- [ ] Drain is FIFO and serial, with backoff on retryable errors only
- [ ] Terminal failures are parked and visible, never dropped
- [ ] Cached stock/prices labelled as last-known
- [ ] Offline debt sales capped and flagged


---

## Simon additions (phases 4–5)

- **Every outbox item carries `mode`.** A document queued in practice mode is discarded when the
  person leaves practice — never drained into the real database — and is excluded from the queue
  depth the heartbeat reports, because a figure that can never reach zero teaches an owner to ignore
  the alert beside it (§19.4, §19.5).
- **Leaving or entering practice drops the local caches** (catalogue, customers, basket) and their
  `since` markers: the two databases answer the same questions differently.
- **The service worker precaches the shell only** (`vite-plugin-pwa`, `globPatterns` for built
  assets, `navigateFallbackDenylist` for `/api/`). A worker answering an API call from a cache would
  be a second, silent source of truth beside IndexedDB and the outbox.
