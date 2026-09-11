# Event Storming — Phase 1, Chaotic Exploration
# Persona: DEVELOPER (Technical Implementation)
# Domain: Simon (Սիմոն) — full buy–sell cycle
# Grounding: docs/prd.md §8.5, §10.4–10.8, §11–§22; CLAUDE.md invariants

---

## 0. Framing — how a developer reads this domain

**[Developer]** The business people in this room will name events that describe *intent*
("Sale Completed", "Goods Received", "Debt Repaid"). Almost none of those are the events the
code actually has to handle. The system's real event stream is dominated by things nobody in
the shop ever sees: a queue draining, a replay being detected, a projection being rebuilt, a
write lock being contended, a printer not answering. My job in this phase is to put those on
the wall.

**[Developer]** One structural observation that governs everything below. Simon has an
**append-only ledger** (`StockMovement`, `DebtEntry`, `CashMovement`, `Payment`, `AuditLog`)
and a small set of **rebuildable caches** (`Product.stockQty`, `Product.avgCostMdram`,
`ProductStats`, `Device.outboxDepth`/`parkedDepth`, `Session.lastSeenAt`). That split
determines the *grammar* of every event on this wall:

- **[Developer]** Anything that touches the ledger is a **fact**: `X Posted`, `X Recorded`,
  `X Written`. It is never `Stock Decremented`, `Balance Updated`, `Debt Reduced`. If someone
  writes a mutation-shaped event name on a sticky, the code underneath it will eventually be a
  mutation, and rule 3 (§10.4 — "why does it say 14 when the shelf has 11?") dies.
- **[Developer]** Anything that touches a cache is a **derived consequence**, never an
  independent event. `Stock Cache Recomputed` is not something that happens *to* the system —
  it happens *inside the same SQLite transaction* as the movement that caused it (§10.4). The
  only time it is a first-class event is when it runs as a **rebuild** or a **drift check**,
  which is the reconciliation job, not the sale path.
- **[Developer]** Corrections are facts pointing at facts. `reversesId` on `Sale`,
  `GoodsReceipt`, `DebtEntry` (§11) means "Receipt Reversed" is a *new document event*, never
  an edit event. There is no `Sale Amended` sticky anywhere on this wall, and if one appears
  it is a bug in the model.

**[Developer]** Second structural observation: Simon has **two event streams that must be kept
distinct** — events that happen on the *device* (IndexedDB, outbox, service worker, scanner)
and events that happen on the *host* (SQLite, printer, backup, fiscal). They are connected only
by four idempotent POSTs (§15.3). Every hard problem in this system lives at that seam.

---

## 1. Technical Events

Grouped by subsystem. Each carries the payload that must travel with it and, where relevant,
the transaction it must sit inside.

### 1.1 Device lifecycle, PWA, service worker

- **[Developer]** **App Shell Precached** — SW install completes; version hash recorded.
  Data: `swVersion`, `buildTag`, `precacheManifestHash`, `installedAt`.
- **[Developer]** **Service Worker Activated** — new SW takes control of clients.
- **[Developer]** **Service Worker Update Available (Waiting)** — a new build is precached but
  *must not* activate. Data: `currentVersion`, `waitingVersion`, `basketOpen: boolean`,
  `outboxDepth`. **This is the one to argue about:** auto-`skipWaiting()` swaps the app out
  from under a live basket and, worse, under a partially drained outbox. Activation must be
  gated on *no open basket and outbox empty* — realistically **at shift close**.
- **[Developer]** **App Update Deferred (Basket Open)** — the guard firing.
- **[Developer]** **Cold Start Completed** — `<3 s` interactive budget (§21). Data: `ttiMs`,
  `catalogueRowCount`, `cacheAgeMs`, `deviceClass`.
- **[Developer]** **App Resumed From Background** — Android Chrome killed and restored the tab.
  This is the event that silently discards in-memory state; the held basket must already be in
  IndexedDB (§12.1: "a parked basket that vanishes because the phone locked is a lost sale").
- **[Developer]** **Storage Quota Warning / Eviction Risk** — IndexedDB is evictable on Android
  unless `navigator.storage.persist()` was granted. Data: `usageBytes`, `quotaBytes`,
  `persisted: boolean`. **An evicted outbox is a lost sale** (§14.2 rule 1). Nothing in the PRD
  requests persistent storage — gap.
- **[Developer]** **Persistent Storage Granted / Denied**.
- **[Developer]** **Device Registered** — first successful login assigns `Device.prefix`
  (§11, §16.2). Data: `deviceId`, `prefix`, `label`, `registeredAt`.
- **[Developer]** **Device Deactivated** — must revoke sessions **in the same transaction**
  (§16.3).
- **[Developer]** **Receipt Number Block Allocated** *(conditional, §26 Q10)* — server hands
  `blockStart`/`blockEnd`. Data: `deviceId`, `blockStart`, `blockEnd`, `allocatedAt`.
- **[Developer]** **Receipt Number Block Exhausted / Running Low** — must be requested while
  online, never at the moment of a sale (§12.1).

### 1.2 Barcode / input path

- **[Developer]** **Scanner Keystroke Burst Started** — HID wedge begins emitting.
- **[Developer]** **Scan Terminator Received** — the `Enter`/`Tab` suffix. Keying off the
  terminator rather than a debounce timer is what keeps the 200 ms budget; a 50 ms idle timer
  spends a quarter of the budget doing nothing.
- **[Developer]** **Scan Discarded (Focus Lost)** — the wedge typed into a dialog, a search
  box, or nothing. The single most common real-world scanner failure. Data: `activeElement`,
  `rawKeys`.
- **[Developer]** **Barcode Resolved From Cache** — the hot path. Data: `barcode`, `productId`,
  `lookupMs`, `cacheAgeMs`.
- **[Developer]** **Barcode Cache Miss → Server Lookup Attempted** — `GET /products/by-barcode/:code`.
- **[Developer]** **Unknown Barcode Detected** — client-side `unknown-barcode` (§8.5); opens
  quick-add, sale continues.
- **[Developer]** **Retired Barcode Resolved** — `ProductBarcode.retiredAt` non-null but the
  code still resolves (§11, §18 rule 4). Must be an explicit event because "resolves but is
  retired" is a state a naive `WHERE retiredAt IS NULL` will break.
- **[Developer]** **Weight-Embedded EAN Parsed** *(v2)* — `2x` prefix; qty derived from the code.
- **[Developer]** **Camera Scanner Permission Denied / Secure Context Missing** — §18: fails
  **silently** without TLS. Needs an explicit event so it becomes a visible failure.
- **[Developer]** **Scan-To-Line Budget Exceeded** — a *measured* event: `>200 ms`. This is how
  §21's p95 becomes enforceable instead of aspirational.

### 1.3 Basket, outbox, and the client transaction

- **[Developer]** **Sale Id Generated (UUIDv7)** — client-side, before any network (§14.3).
  Data: `saleId`, `generatedAt`, `deviceClockUtc`.
- **[Developer]** **Receipt Number Assigned On Device** — `{prefix}-{lastSequence}` (§12.1).
  Data: `deviceId`, `prefix`, `sequence`, `saleId`. **Must be written in the same IndexedDB
  transaction as the outbox row** (see TB-C1), or a crash between the two burns a number or,
  worse, reissues one.
- **[Developer]** **Sale Queued In Outbox** — status `PENDING`. Data: full sale document,
  `targetStatus` (`HELD` | `COMPLETED`), `queuedAt`, `attemptCount: 0`, `mode` (`LIVE`|`PRACTICE`).
- **[Developer]** **Basket Parked To Outbox (HELD)** — same queue, counted separately
  (§14.4, `Device.parkedDepth`).
- **[Developer]** **Outbox Drain Started / Head Claimed** — status `PENDING → SENDING`.
- **[Developer]** **Outbox Item Sent** — the fetch left the device.
- **[Developer]** **Outbox Item Acknowledged** — `200` with stored document + `warnings[]`
  persisted locally **before** the row is removed. Removing on response receipt rather than on
  persisted ack is a loss window.
- **[Developer]** **Outbox Item Retried (Backoff)** — network or `5xx` only (§14.4).
  Data: `attemptCount`, `nextAttemptAt`, `lastStatus`.
- **[Developer]** **Outbox Item Parked (Non-Retryable 4xx)** — `400`, `403`, `404`, `422`
  (§14.4: "never on other 4xx — park those and surface them"). Data: RFC 7807 `type`.
- **[Developer]** **Outbox Head Blocked** — FIFO and serial means one poisoned item blocks the
  whole queue including good sales behind it. **This is a design event that must exist**: the
  PRD says "drained FIFO and serially" and "park those and surface them", but does not say
  whether a parked item *steps aside* so the queue continues. It must, or one `422` on a debt
  sale stops every subsequent sale from ever reaching the server. Gap.
- **[Developer]** **Sale Synced** — outbox row removed, `Device.outboxDepth` decremented.
- **[Developer]** **Outbox Drained To Zero** — triggers the extra heartbeat (§16.3).
- **[Developer]** **Outbox Aged Beyond One Hour** — feeds §19.5 alert #3. **Sales only**,
  parked baskets excluded.
- **[Developer]** **Practice Outbox Discarded On Exit** — never drained to the real DB (§19.4).
  The single sharpest correctness risk in that feature; deserves its own event and its own test.
- **[Developer]** **Offline Debt Cap Reached** — client-side accumulator per customer per
  outage, default 20 000 ֏ (§14.5). Data: `customerId`, `offlineChargedTotal`, `cap`,
  `outageStartedAt`. Must survive app restart → it is IndexedDB state, not memory.
- **[Developer]** **Connection State Changed (Online ↔ Offline)** — `navigator.onLine` is
  unreliable on shop Wi-Fi (associated but no route to host). Needs an application-level probe
  against `/health`, so: **Reachability Probe Succeeded / Failed**, not a browser event.

### 1.4 Idempotency and replay

- **[Developer]** **Idempotent Replay Detected (Same Id, Same Target Status)** — returns the
  stored document with `200` and the **stored** `warnings[]` (§15.2: read back from
  `ReviewFlag`, never re-evaluated). Data: `documentId`, `targetStatus`, `originalCommittedAt`.
- **[Developer]** **Lifecycle Transition Accepted (Same Id, Different Status)** — `HELD →
  COMPLETED`. Not a replay (§14.3). This distinction is the difference between taking the
  money and silently not taking it.
- **[Developer]** **Illegal Transition Rejected** — `422 illegal-transition` (§8.5).
- **[Developer]** **Replay Detected Inside The Write Transaction** — §15.3 is explicit: detect
  by primary key *inside* the transaction that would otherwise write, "checking first and
  writing second is the same race as §13.1's oversell". Implementation: rely on the PK unique
  violation and catch it, or `SELECT ... ` under the same write transaction — never a separate
  read transaction.
- **[Developer]** **Duplicate Import File Detected (fileHash)** — §11 `ImportBatch.fileHash`.
- **[Developer]** **Import Row Skipped (naturalKey Already Applied)** — §19.1. The rule that
  stops opening debts doubling.
- **[Developer]** **Non-Queued POST Replayed** — **unspecified behaviour, flag it.** §15.1 says
  *every* POST carries a client-generated id, but §15.3 promises replay semantics for only four
  endpoints. What does a re-sent `POST /goods-receipts` with an existing id do? `409` is
  explicitly "not used". So it is a `422` or a `200` with the stored document, and the PRD does
  not say which. Gap.

### 1.5 Catalogue cache and sync

- **[Developer]** **Catalogue Snapshot Requested (since=)** — `GET /catalogue/snapshot?since=`
  (§15.4), driven by `updatedAt` (§11).
- **[Developer]** **Catalogue Cache Refreshed (Delta Applied)** — Data: `rowsApplied`,
  `newWatermark`, `durationMs`.
- **[Developer]** **Catalogue Cache Rebuilt (Full)** — the fallback when the watermark is lost
  or the schema version changed. On a low-end phone over shop Wi-Fi this is "the difference
  between a sync and a stall" (§11).
- **[Developer]** **Catalogue Watermark Regression Detected** — `since` newer than server rows
  because of **clock skew between device and host**. `updatedAt` is server-set, so the watermark
  must be a **server-supplied token**, not a device timestamp. If it is a device timestamp,
  a fast device permanently misses rows. Gap worth naming.
- **[Developer]** **Cached Price Marked Stale** — §14.4: "last-known and must be labelled as
  such". A UI requirement backed by a data requirement: cache rows carry `fetchedAt`.
- **[Developer]** **Product Deactivated While Cached** — the sync conflict
  `product-deactivated-on-sync` (§8.5, §14.6).
- **[Developer]** **Cache Schema Version Changed** — an app upgrade whose IndexedDB schema moved.
  `onupgradeneeded` must migrate **without destroying the outbox**. Blowing away the object
  store on upgrade is the classic way to lose queued sales during a Friday-evening deploy.

### 1.6 Server: transaction and persistence events

- **[Developer]** **Write Transaction Begun / Committed / Rolled Back** — Data: `docType`,
  `docId`, `statementCount`, `durationMs`. p95 `<50 ms` (§21).
- **[Developer]** **Stock Movement Posted** — the atom. Data: `id`, `productId`, `type`,
  `qtyDelta`, `unitCostMdram`, `balanceAfter`, `sourceType`, `sourceId`, `userId`,
  `locationId: null`, `reasonCode?`, `createdAt`.
- **[Developer]** **Stock Cache Recomputed In Transaction** — `Product.stockQty` written from
  `balanceAfter` inside the same tx (§10.4). Not an independent event.
- **[Developer]** **Weighted Average Recomputed** — Data: `productId`, `oldAvg`, `newAvg`,
  `qtyBefore`, `qtyReceived`, `receiptUnitCost`, rounded half-up on store (§10.5).
- **[Developer]** **Average Cost Formula Skipped (Non-Positive Denominator)** — §10.5 and
  §13.7 both require *not evaluating* the formula when `stockQty ± qty ≤ 0`; set/leave the
  average and **flag the movement**. A distinct event because it is a distinct code path with a
  distinct output (`ReviewFlag`).
- **[Developer]** **Debt Charge Posted / Payment Posted / Credit Adjustment Posted** — always
  positive amounts, direction in `type` (§10.6).
- **[Developer]** **Allocation Written** — `sum(allocations) + credit == payment` (§10.6).
- **[Developer]** **Cash Movement Posted** — including `NO_SALE` at `amount = 0`.
- **[Developer]** **Audit Row Written** — inside the same tx, always; `reason` required for
  every justified override (§10.7, §11).
- **[Developer]** **Review Flag Raised** — `NEGATIVE_STOCK`, `CREDIT_LIMIT_ON_SYNC`,
  `PRODUCT_DEACTIVATED_ON_SYNC`, `LEDGER_CACHE_DRIFT` (§11). **Written inside the transaction**,
  because §15.2 requires the warning to be read back from it on replay.
- **[Developer]** **Warning Returned On 200** — assembled from `ReviewFlag` rows, never
  re-derived.
- **[Developer]** **Sale Shift Reassigned** — `Sale.shiftId` rewritten when a `HELD` basket is
  resumed on another till, only while `DRAFT`/`HELD`, frozen at `COMPLETED` (§11, §12.1).
  Audited (§10.7: "held-basket transfer between shifts").
- **[Developer]** **Response Shaped (Cost Fields Stripped)** — the explicit response-shaping
  step (§15.1: "never returns a raw ORM object"). Make it an event so it is a *place in the
  code* rather than a habit.

### 1.7 SQLite, concurrency, and storage

- **[Developer]** **SQLITE_BUSY Encountered** — should never surface to a user (§21).
- **[Developer]** **SQLITE_BUSY Retry Exhausted** — `busy_timeout` elapsed. Data: `docType`,
  `waitedMs`, `holderTx?`.
- **[Developer]** **Write Queue Depth Exceeded** — if (as I will argue) writes are serialised
  in-process, the app-level queue is the real contention signal, not `SQLITE_BUSY`.
- **[Developer]** **Long-Running Read Detected** — a dashboard report holding a WAL read
  snapshot.
- **[Developer]** **WAL Checkpoint Started / Completed / Starved** — `/health` reports
  "WAL checkpoint age" (§19.5). Starvation is caused by continuous readers, i.e. the owner's
  dashboard doing exactly what it is for.
- **[Developer]** **WAL File Growth Threshold Crossed** — this is someone's `C:` drive (§19.3).
- **[Developer]** **Foreign Keys Pragma Verified** — `foreign_keys=ON` is off by default in
  SQLite (§13.1) and is **per connection**. A pooled connection that missed the pragma silently
  drops `ON DELETE RESTRICT`. Worth an assertion at startup *and* per connection.
- **[Developer]** **Database Size Threshold Crossed** — `/health` (§19.5).
- **[Developer]** **Disk Full / Write Failure** — the failure mode a shop PC actually hits.
- **[Developer]** **Prisma Interactive Transaction Timed Out** — Prisma's own transaction
  timeout (default 5 s) is a second, independent timeout layered on `busy_timeout`. Two timeouts
  that do not know about each other is a config bug waiting to happen.

### 1.8 Projections, jobs, drift

- **[Developer]** **Ledger Replay Started / Completed** — the rebuild of `Product.stockQty`
  from `StockMovement` (§10.4).
- **[Developer]** **Ledger-vs-Cache Drift Detected** — asserts cache == replay and **surfaces
  drift rather than silently correcting it**. Writes `ReviewFlag(LEDGER_CACHE_DRIFT)`.
  Data: `productId`, `cachedQty`, `replayedQty`, `firstDivergingMovementId`.
  `balanceAfter` on every movement is what makes "first diverging movement" answerable — the
  ledger self-checks pointwise rather than only in aggregate. That field is load-bearing.
- **[Developer]** **Stock Cache Rebuilt (Manual, Admin)** — the repair action. It is *not*
  automatic (§10.4), so it is a command with an audit row.
- **[Developer]** **Reorder Stats Job Run** — refreshes `ProductStats`, nightly and on demand,
  **outside any document transaction** (§11, §13.1). Explicitly *not* part of the drift check.
- **[Developer]** **Reorder Point Suggestion Recomputed** — §13.3.
- **[Developer]** **Dead Stock Recomputed** — `daysSinceLastSale`.
- **[Developer]** **Log Rotated** — a requirement, not hygiene (§19.5).

### 1.9 Auth, session, device

- **[Developer]** **PIN Verified (Argon2id, ≥250 ms)** — §16.2.
- **[Developer]** **PIN Rejected** — `401 pin-incorrect`, remaining attempts returned.
- **[Developer]** **Account Locked (5 Failures / 15 min)** — `423`, a *state* not a rate.
- **[Developer]** **Rate Limit Tripped (10/min/device)** — `429`, a *rate* not a state.
  Two different events that a lazy implementation will conflate; §8.5 keeps them apart on purpose.
- **[Developer]** **Lockout Cleared By Admin / Expired / Recovery Code Redeemed** — the third
  path regenerates `recoveryCodeHash` and is single-use (§16.2).
- **[Developer]** **Session Issued** — token hashed with argon2id, never stored raw (§11).
- **[Developer]** **Session Heartbeat Throttled** — `lastSeenAt` moves only when >60 s stale,
  **never inside another transaction** (§16.3). A write on the barcode path against a single
  writer is exactly how `SQLITE_BUSY` reaches the one screen §21 forbids it on.
- **[Developer]** **Device Counters Reported (Heartbeat)** — `outboxDepth`, `parkedDepth`,
  one-minute cadence plus once at zero. **Client-reported and bounded on write** (§11) — the
  server displays them without arithmetic, so a device reporting nonsense shows the owner
  nonsense.
- **[Developer]** **Session Expired (Idle)** — 15 min till, 8 h dashboard.
- **[Developer]** **Session Revoked (Admin / Shift Close / Device Deactivation)**.
- **[Developer]** **Re-Authentication Required / Granted** — discount above cap, blind return,
  price change, stock adjustment, drawer outside a sale (§16.3). **Never discards the basket.**
- **[Developer]** **Practice Mode Entered / Exited** — second SQLite file opened/deleted
  (§19.4); audited **in the real database**, `before`/`after` null.
- **[Developer]** **Cost Field Strip Applied / Bypass Attempted** — §16.5. The `STOCK`
  exception is scoped to `GoodsReceiptLine`/`PurchaseOrderLine` only.

### 1.10 Peripherals and the fiscal seam

- **[Developer]** **Print Job Enqueued (Post-Commit)** — printing happens **after** commit
  (§12.1) and there is **no I/O inside a transaction** (§13.1).
- **[Developer]** **Receipt Printed / Print Failed / Printer Unreachable / Out Of Paper**.
- **[Developer]** **Receipt Reprinted** — must **not** emit the drawer kick (§18).
- **[Developer]** **Cash Drawer Pulse Emitted** — a *separate* ESC/POS command, deliberately
  decoupled from printing (§18). This decoupling is a security control, not a convenience.
- **[Developer]** **Drawer Opened Outside A Sale** — re-auth + `NO_SALE` movement (§16.3, §18).
- **[Developer]** **Practice Receipt Printed (Watermarked ՓՈՐՁՆԱԿԱՆ)** — never opens the
  drawer, never issues a fiscal receipt (§19.4).
- **[Developer]** **Fiscal Receipt Requested / Issued / Print Failed / Device Unreachable**
  *(v2, §17)* — `Sale.fiscalReceiptId` is the reserved seam. Data: `saleId`, `fiscalDeviceId`,
  `fiscalReceiptId`, `issuedAt`, adapter error code.
- **[Developer]** **Fiscal Adapter Timed Out With Unknown Outcome** — the genuinely hard one:
  the sale is committed, the fiscal device may or may not have printed. Retrying may
  double-issue; not retrying may under-report. **A fiscal device is not idempotent** unless its
  protocol says so, and §17 does not yet know. Top-tier risk.
- **[Developer]** **Label Printed** *(v2)* — internal Code128, reserved prefix (§18).

### 1.11 Backup, restore, operations

- **[Developer]** **Backup Started / Completed / Failed** — `BackupRun` row (§11, §19.2).
  Data: `destination` (LOCAL|USB), `sizeBytes`, `outcome`, `error?`, `startedAt`, `completedAt`.
- **[Developer]** **Backup Size Anomaly Detected** — §19.5: "a backup suddenly a tenth of the
  database is a failed backup that reported success". Compare against the previous `OK` run.
- **[Developer]** **No Successful Backup In 24 Hours** — owner alert #1 (§19.5).
- **[Developer]** **USB Destination Missing** — the stick is not plugged in. Routine, not
  exceptional.
- **[Developer]** **Backup Encrypted** — contains PII (§19.2, §19.6).
- **[Developer]** **Restore Started / Completed / Drill Performed** — §27.10.
- **[Developer]** **VACUUM INTO Contended With Trading Writes** — a consistent snapshot is a
  long read; hourly during trading hours (§19.2) puts it directly against the single writer.
- **[Developer]** **Health Payload Served** — `/health`: version, uptime, db size, WAL
  checkpoint age, last OK backup time **and size**, outbox depth across devices (sales, with
  parked beside not inside), open `LEDGER_CACHE_DRIFT` count (§19.5).
- **[Developer]** **Diagnostics Bundle Written To File** — nothing leaves the shop unless the
  owner sends it (§19.5).
- **[Developer]** **Structured Log Line Emitted** — one per request: method, route, status,
  duration, user id, and for the four queue-drained endpoints the **document id**. Never a PIN,
  hash, name or phone (§19.5, §19.6).

### 1.12 Import and data lifecycle

- **[Developer]** **Import Batch Received (Multipart)** — the one non-JSON endpoint (§15).
- **[Developer]** **File Hash Computed** / **Duplicate File Detected**.
- **[Developer]** **Import Row Applied / Skipped / Failed** — per-row `ImportRow` status.
- **[Developer]** **Opening Balance Movements Posted** — `OPENING_BALANCE` type.
- **[Developer]** **Back-Dated Charges Posted** — opening debts with their **original dates**,
  so aging is right on day one (§19.1). Back-dating means `createdAt` ≠ UUIDv7 timestamp —
  anything that infers time from the id will be wrong for these rows.
- **[Developer]** **Customer Anonymised** — `anonymisedAt` set, name and phone null, ledger
  intact (§19.6). The only nullable-`fullName` case.
- **[Developer]** **Customer Merged** — `DebtEntry` rows re-pointed, `mergedIntoId` set,
  `isActive = false`, audit row (§15.4). A multi-row repoint that must be one transaction.

### 1.13 Time

- **[Developer]** **Device Clock Skew Detected** — **not in the PRD, and it should be.**
  UUIDv7 embeds device time; `Sale.createdAt` comes from the device; shift boundaries and
  Z-reports are shop-local `Asia/Yerevan`; aging is measured from the charge date. A phone
  with a wrong clock produces ids that sort wrongly, sales that land in the wrong shift, and
  debt that ages wrongly. The server should record `receivedAt` alongside `createdAt` and flag
  a delta beyond a threshold.
- **[Developer]** **Shift Day Boundary Crossed** — a shift open across midnight; every report
  grouped by day has to decide shift-local vs calendar-local.
- **[Developer]** **DST / Timezone Change** — Armenia does not observe DST, which removes the
  worst case, but `TZ` is pinned to `Asia/Yerevan` in `vitest.config.ts` precisely because an
  unpinned machine computes different boundaries. The same pinning must exist on the host.

---

## 2. Integration Points

**[Developer]** Every external dependency, its call style, and how it fails. "Failure mode"
here means *what the code must do*, not what the user sees.

| Integration | Style | Owned by | Failure modes | Required handling |
|:--|:--|:--|:--|:--|
| **[Developer]** HID barcode wedge (USB/BT) | Sync, keystrokes | Client | Focus stolen; partial burst; missing terminator; BT disconnect mid-scan; keyboard layout mangles digits | Global capture with focus discipline; terminator-driven; never a debounce timer; re-focus after every dialog close |
| **[Developer]** Phone camera scanner | Async, stream | Client | **Silent failure without a secure context** (§18); permission denied; poor light; slow decode on low-end device | TLS in v1 removes the silent case; explicit permission and secure-context events; HID stays primary |
| **[Developer]** Receipt printer (ESC/POS, TCP:9100 or USB) | Async, **backend-owned** | Host | Unreachable; out of paper; jam; queue backlog; half-printed | **After commit, never inside the tx** (§12.1, §13.1). Print failure must never roll back a sale. Reprint from the sale record (§8.2) |
| **[Developer]** Cash drawer (printer kick-out port) | Async, **separate command** | Host | Pulse lost; printer down means drawer down; drawer physically jammed | Never a side effect of printing; **not emitted on reprint**; deliberate open = re-auth + `NO_SALE` (§16.3, §18) |
| **[Developer]** ՀԴՄ fiscal device *(v2)* | Sync-ish, adapter | Host | Unreachable; timeout with unknown outcome; rejects the document; numbering authority conflict with `Sale.number` | Adapter seam exists from v1 (`fiscalReceiptId`). **Outcome-unknown must be a durable state**, not a retry loop |
| **[Developer]** Label printer *(v2)* | Async | Host | Same as receipt printer | Internal Code128 with reserved prefix |
| **[Developer]** Scale | Manual entry v1 | Client | Human transcription error | Weight-embedded EAN later |
| **[Developer]** LAN / shop Wi-Fi | Async, implicit | Both | Associated-but-no-route; router lease change; AP roam mid-request; captive portal | **Never a hardcoded LAN IP** (§15.1, §22). Reachability probe against `/health`, not `navigator.onLine` |
| **[Developer]** TLS certificate on the host | Sync | Host | Expiry; not trusted on a new staff device; hostname mismatch after a lease change | **Expiry is a total outage of the till and of camera scanning.** Needs a health check and a long-lived cert with a documented re-trust procedure. Not in the PRD — gap |
| **[Developer]** Nginx (SPA + API, one origin) | Sync | Host | Misrouted `/api`; body size limit on the import multipart; buffering the print path | Same-origin is what keeps CORS irrelevant (§16.6) |
| **[Developer]** SQLite file on `C:` | Sync | Host | Disk full; antivirus locking the file; OneDrive/Dropbox syncing the directory (corruption); host sleeps | Antivirus and cloud-sync exclusions belong in the operator runbook |
| **[Developer]** Local disk backup target | Async job | Host | Same disk as the database — no protection against disk failure | Local **plus** USB (§19.2) |
| **[Developer]** Removable USB backup | Async job | Host | Not plugged in; full; removed mid-write; **unencrypted stick of customer debts in a drawer** (§19.6) | Encrypt; report missing destination as a normal outcome, not a crash |
| **[Developer]** IndexedDB | Async, client | Client | Evicted under storage pressure; blocked upgrade; **transaction auto-closes across a non-IDB await**; private-mode restrictions | Request persistent storage; never `await fetch` inside an IDB transaction; migrate without dropping the outbox |
| **[Developer]** Service worker / PWA | Async, client | Client | Stale precache; update activating mid-sale; navigation fallback breaking deep links | Gate activation on empty basket + empty outbox |
| **[Developer]** Host OS power management | — | Host | The PC sleeps → the shop stops (§14.1 names this exact scenario) | A runbook item and a health signal, not a code fix |

---

## 3. Technical Constraints

- **[Developer]** **Scan → line rendered < 200 ms p95, on a three-year-old mid-range Android**
  (§21). My working budget: scanner burst ≤20 ms · key handling + normalisation ≤20 ms ·
  IndexedDB barcode index lookup ≤30 ms · price/tax computation in `@simon/shared` ≤10 ms ·
  React commit + paint ≤60 ms · ≥60 ms slack. **The network is not in this budget** — the
  lookup is cache-first, always, even when online. That makes the offline path the *normal*
  path, which is the right way round.
- **[Developer]** **Rendering discipline follows from that budget.** Adding a line must not
  re-render the whole basket; the basket list is the only component allowed to be hot. Any
  context that changes on every keystroke will blow the budget on a low-end device.
- **[Developer]** **SQLite has exactly one writer.** WAL lets readers proceed, so the owner's
  dashboard is free, but three tills selling is three writers contending for one lock. p95 write
  transaction `<50 ms` over ten minutes of continuous three-device selling (§21).
- **[Developer]** **Recommendation: serialise writes in-process.** A single application-level
  write queue in front of Prisma turns lock contention into queue latency you can measure and
  bound, and makes "no `SQLITE_BUSY` ever surfaced to a user" (§21) an architectural property
  rather than a tuning hope. `busy_timeout` then becomes a backstop for other processes
  (the backup job) rather than the primary mechanism.
- **[Developer]** **No I/O inside a transaction** (§13.1) — no printing, no HTTP, no file
  writes, no fiscal call, no logging to disk. A slow call inside the write lock blocks every
  till. This constraint alone forces printing and fiscalisation to be post-commit, which forces
  them to be independently recoverable, which is why they need their own durable state.
- **[Developer]** **Reads that inform a write happen inside the write transaction** (§13.1) —
  the oversell race. Same rule, restated for replay detection in §15.3.
- **[Developer]** **Session and device writes never sit inside another transaction** and are
  throttled to once a minute (§16.3). This is the counter-rule: the *only* writes allowed to be
  loose are the ones that must never contend.
- **[Developer]** **Offline-first client, LAN-primary server** (§14.1). The client never awaits
  the network to complete a sale. Every write path therefore has two implementations — the
  optimistic local one and the authoritative server one — and `@simon/shared` exists so the
  money rules are not one of the things that differ (§22).
- **[Developer]** **Client-generated UUIDv7 ids** (§11, §15.1). Time-sortable, index-friendly,
  and generatable offline. Consequence: ids leak device clock state, and back-dated import rows
  break the id↔time correspondence.
- **[Developer]** **Idempotency key = id + target status, for sales only** (§14.3). Returns,
  repayments and cash movements key on id alone. Getting this backwards is the "money is never
  taken" bug the PRD calls out explicitly.
- **[Developer]** **Append-only ledger, rebuildable caches** (§10.4). No `UPDATE` on a movement,
  a debt entry, a payment, a cash movement or an audit row. Ever. Enforce it: no update path in
  the repository layer, and a `CHECK`/trigger if that is cheap.
- **[Developer]** **Correction is a linked reversing document** (§10.7). `reversesId` is the
  only mechanism.
- **[Developer]** **Money is integer drams / milli-drams; quantity is milli-units** (§10.1–10.2,
  CLAUDE.md). Integers on the wire (§15.1). A lint rule fails the build on a float literal in
  money or quantity code (§21).
- **[Developer]** **Rounding half-up to a whole milli-dram, once, on store** — for
  `avgCostMdram` (§10.5) and the purchase-return reversal (§13.7).
- **[Developer]** **Cost stripped server-side for every non-ADMIN token**, on list, search,
  detail, report, export and **inside error messages that echo the record** (§16.5). The audit
  log is gated as a whole route because field stripping cannot see inside a JSON snapshot.
- **[Developer]** **Cursor pagination everywhere** (§15.1) — offset pagination over a growing
  append-only ledger skips rows.
- **[Developer]** **RFC 7807 with a frozen machine-readable `type`** (§8.5, §15.2). The same
  `type` is never both a warning and an error. `409` is never used.
- **[Developer]** **Every warning corresponds to a durable `ReviewFlag`** (§15.2). A warning
  with no durable trace is a bug, because a replay must reproduce the original response.
- **[Developer]** **Practice mode is a second database file**, not a column (§19.4). No
  transactional table gains a flag; `Session.mode` is the only row that knows.
- **[Developer]** **TLS is unconditional** (§16.6). It is a hard dependency of camera scanning
  and of any future `crypto.subtle` or persistent-storage behaviour.
- **[Developer]** **One repository, one artifact, one version** (§22). Client and server ship
  together, so the API contract can evolve without versioning — but only if the deploy is
  atomic. A phone running yesterday's cached SPA against today's API breaks that assumption,
  which is another reason the service worker's update policy is a correctness concern.
- **[Developer]** **`TZ=Asia/Yerevan`** on host and in tests; timestamps RFC 3339 UTC on the
  wire, shop-local only at the edges (§11, §15.1, §20.3).

---

## 4. Data Requirements and Transaction Boundaries

### 4.1 Server-side transaction boundaries (SQLite)

**[Developer]** The rule that generates all of these: **a document and every ledger row and
cache update it causes commit together, or none of them do.** Partial writes are the failure
mode that corrupts a POS beyond repair (§13.1).

- **[Developer]** **TB-1 — Sale `COMPLETED`.** One transaction:
  replay check by (`id`, `COMPLETED`) → `Sale` header → `SaleLine[]` (with `unitPriceMdram`,
  **`unitCostMdram` snapshotted**, `taxRateBp`, `factorToStockUom` all frozen) → `Payment[]` →
  `StockMovement[]` type `SALE` with `balanceAfter` → `Product.stockQty` + (no avg change on
  sale) → `DebtEntry(CHARGE)` if any payment is `DEBT` → `ReviewFlag[]` for negative stock /
  sync conflicts → `AuditLog`. **Printing, drawer, fiscal are all outside.**
- **[Developer]** **TB-2 — Sale `HELD`.** One transaction, **posts to no ledger at all**
  (§15.3). Header + lines only. No payments, no movements, no debt. This is why `HELD` is safe
  to replay and cheap to contend on.
- **[Developer]** **TB-3 — `HELD → COMPLETED`.** TB-1's contents plus the `shiftId` rewrite to
  the completing shift, plus the transfer audit row (§10.7). The rewrite is legal only while
  the sale is `DRAFT`/`HELD`; at `COMPLETED` the field freezes.
- **[Developer]** **TB-4 — Goods receipt.** `GoodsReceipt` → `GoodsReceiptLine[]` with landed
  cost **apportioned by value before the average moves** → `PURCHASE_RECEIPT` movements →
  `Product.avgCostMdram` recomputed and rounded half-up → `Product.stockQty` → supplier payable
  → `AuditLog`. Server-assigned sequential `number` (receiving is online-only).
- **[Developer]** **TB-5 — Purchase return.** Document → lines naming `GoodsReceiptLine`s →
  `PURCHASE_RETURN` movements with negative `qtyDelta` **at the receipt's landed unit cost, not
  the current average** → recalculated average (skip if `stockQty − returnQty ≤ 0`, and flag) →
  `landedCostLost` recorded, never absorbed → supplier credit + `SupplierAllocation` →
  `AuditLog` (§13.7).
- **[Developer]** **TB-6 — Sale return.** `SaleReturn` → `SaleReturnLine[]` carrying
  **the original line's `unitCostMdram`, copied** → per line either a `SALE_RETURN` movement
  (restock) or a `WRITE_OFF` movement with a `reasonCode` (damaged) → refund: `CashMovement`
  for cash, or a **credit `ADJUSTMENT` + `DebtAllocation`** against the original charge for a
  debt sale → `AuditLog`. Per-line quantity guard (`≤` sold less already returned) must be
  computed **inside** this transaction.
- **[Developer]** **TB-7 — Debt payment.** `DebtEntry(PAYMENT)` → `DebtAllocation[]` oldest-first
  → excess as a credit `ADJUSTMENT` so `sum(allocations) + credit == payment` →
  `CashMovement(REPAYMENT)` **only if taken in cash** → `AuditLog`. The cash movement, not the
  debt entry, is what §12.5 counts.
- **[Developer]** **TB-8 — Cash movement.** Movement → `AuditLog`. `NO_SALE` at `amount = 0`.
- **[Developer]** **TB-9 — Shift close.** Guard query for `DRAFT`/`HELD` sales **on this shift**
  → `expectedCash` computed from queries over rows (never a running total) → `countedCash`,
  `countedBreakdown`, `variance`, `unsyncedAtClose` → status `CLOSED` → **session revocations**
  → `AuditLog`. The guard and the write must share a transaction or a basket can be parked
  during the close.
- **[Developer]** **TB-10 — Device deactivation.** `Device.isActive = false` + revoke every
  session on it, one transaction (§16.3).
- **[Developer]** **TB-11 — Customer merge.** Re-point every `DebtEntry` → set `mergedIntoId`,
  `isActive = false` → `AuditLog`. Unbounded row count; on a large debtor this is a long write
  transaction against the single writer. Should not run during peak trading.
- **[Developer]** **TB-12 — Adjustment / write-off.** Self-sourced movement
  (`sourceType='StockMovement'`, `sourceId=id`) → `stockQty` → `AuditLog` with the typed
  `reason` (re-auth required) → `reasonCode` mandatory for `WRITE_OFF`.
- **[Developer]** **TB-13 — Import.** §19.1 requires "never applies partially", which reads as
  one transaction per batch. **A 3 000-row batch in one write transaction holds the single
  writer for seconds and stops every till.** Two ways out, and the PRD picks neither:
  (a) declare import an offline-hours operation, or (b) make the unit of atomicity the *row*
  and let `ImportRow.naturalKey` uniqueness carry the idempotency, so a crashed batch resumes
  rather than rolls back. I would argue for (b) plus a batch-level `completedAt` — the guarantee
  users need is "never applies twice", which (b) gives, more than "all or nothing".
- **[Developer]** **Explicitly OUTSIDE any document transaction:** `Session.lastSeenAt`,
  `Device.outboxDepth`/`parkedDepth`, `ProductStats` refresh, backup, log writes, printing, the
  drawer pulse, the fiscal call, `/health`, and the drift-check job.

### 4.2 Client-side transaction boundaries (IndexedDB)

**[Developer]** These matter exactly as much as the SQLite ones and are much easier to get
wrong, because IndexedDB transactions close silently.

- **[Developer]** **TB-C1 — Completing a sale locally.** One IDB transaction:
  advance `Device.lastSequence` → write the sale document to the outbox with its assigned
  `number` and `PENDING` status → clear the basket. If the counter advances in one transaction
  and the outbox write happens in another, a crash between them either burns a receipt number
  (explainable) or reissues one (**two receipts sharing a number** — the failure §11 says the
  `prefix` immutability rule exists to prevent).
- **[Developer]** **TB-C2 — Draining.** Read head in transaction 1 → mark `SENDING` →
  **close the transaction** → `fetch` → transaction 2 records the ack and removes the row.
  You cannot `await fetch` inside an IDB transaction; it auto-commits. A crash while `SENDING`
  re-sends, which is safe precisely because of §14.3.
- **[Developer]** **TB-C3 — Applying a catalogue delta.** Rows + new watermark in one
  transaction, or a crash leaves the cache ahead of or behind its watermark.
- **[Developer]** **TB-C4 — Offline debt cap accounting.** The per-customer offline accumulator
  updates in the same transaction that queues the debt sale, or the cap is enforceable only
  until the next tab reload.
- **[Developer]** **TB-C5 — Schema upgrade.** `onupgradeneeded` must migrate the outbox store,
  never recreate it.

### 4.3 Payloads that must travel with the significant events

- **[Developer]** **`POST /api/sales`** — `id`, `status`, `shiftId`, `deviceId`, `number`,
  `customerId?`, `priceBasis`, lines (`productId`, `qty`, `uom`, `factorToStockUom`,
  `unitPriceMdram`, `taxRateBp`, `discountAmount`, `discountReason?`, `priceOverridden`),
  payments (`method`, `amount`, `tenderedAmount?`, `changeGiven?`), `createdAt`,
  `clientVersion`. **`unitCostMdram` is *not* sent** — the server snapshots the authoritative
  average. A client-supplied cost would be both a trust hole and a cost leak.
- **[Developer]** **Sale response** — the stored document (cost-stripped by role) plus
  `warnings[]` read from `ReviewFlag`, plus the server's `completedAt`. Persist all of it
  locally before removing the outbox row.
- **[Developer]** **`StockMovement`** — never without `sourceType`+`sourceId` (a movement with
  no source is a bug, §10.4) and never without `balanceAfter`.
- **[Developer]** **Heartbeat** — `deviceId`, `outboxDepth`, `parkedDepth`, `appVersion`,
  `deviceClockUtc` (so skew is detectable), `lastDrainAt`.
- **[Developer]** **`/health`** — version, uptime, dbSizeBytes, walCheckpointAgeSeconds,
  lastBackup{at,sizeBytes,destination}, outboxSalesTotal, parkedTotal, openDriftFlagCount.

---

## 5. Facts vs mutations — where the ledger forces the event shape

- **[Developer]** **"Stock Decremented" is not an event in this system.** The event is
  **Stock Movement Posted**; the decrement is a projection recomputed inside the same
  transaction. Any sticky on the wall phrased as a mutation of `stockQty` should be rewritten.
- **[Developer]** **"Debt Reduced" is not an event.** It is either **Payment Posted +
  Allocations Written** or **Credit Adjustment Posted** (a refund onto a debt, §12.4). Never a
  negative charge, never an edit to a charge.
- **[Developer]** **"Sale Corrected" is not an event.** It is **Sale Return Posted** with a
  link to the original, or — before money moved — **Basket Voided**.
- **[Developer]** **"Receipt Edited" is not an event.** It is **Goods Receipt Reversed**
  (`reversesId`) followed by a fresh receipt (§6.14, §10.7).
- **[Developer]** **"Barcode Reassigned" is not an event.** It is **Barcode Retired** plus
  **Barcode Added**; a retired code still resolves and is never reused (§11, §18).
- **[Developer]** **"Customer Deleted" is not an event.** It is **Customer Deactivated**,
  **Customer Merged**, or **Customer Anonymised** (§19.6).
- **[Developer]** **The three legitimate mutations in the whole system** are: lifecycle status
  on `Sale`, `Shift`, `PurchaseOrder`, `Stocktake`; cache projections; and `updatedAt` on the
  five client-cached catalogue tables. Everything else is insert-only. That is a rule a reviewer
  can apply mechanically, which is what makes it worth stating.

---

## 6. Replay safety — which events are safe to send twice

| Class | Events | Safe to replay? | Mechanism |
|:--|:--|:--|:--|
| **[Developer]** A — queue-drained | sales, sale returns, debt payments, cash movements | **Yes, by contract** | Client id (+ target status for sales), checked inside the write tx; returns stored doc + stored warnings |
| **[Developer]** B — natural key | import rows | **Yes** | `ImportRow.naturalKey` unique among `APPLIED` |
| **[Developer]** C — other POSTs | goods receipts, purchase returns, adjustments, write-offs, supplier payments | **PK collision protects against duplication, but the response is unspecified** | Gap: §15.1 gives them ids, §15.3 gives only four of them replay semantics |
| **[Developer]** D — projections | stock cache rebuild, drift check, `ProductStats` refresh, catalogue snapshot | **Yes, idempotent by construction** | Pure functions of the ledger. This is the payoff of append-only |
| **[Developer]** E — side effects | receipt print, **cash drawer pulse**, **fiscal receipt issue** | **NO** | At-most-once semantics against an at-least-once queue. Must be driven by durable job state with an explicit outcome, never by retrying the sale POST |
| **[Developer]** F — auth | login, re-auth, lockout clear, recovery-code redemption | **No** — recovery code is single-use | Redemption must be transactional with reissue |

**[Developer]** Class E is where the architecture is thinnest. A replayed sale POST is
harmless; a replayed *print-and-kick* is a drawer that opens twice, which is §16.1's second
threat handed a mechanism. Printing must therefore be a **post-commit job keyed on `saleId`**
with its own state (`PENDING/PRINTED/FAILED`), not a call made from the request handler.

---

## 7. Top technical risks (my ranking)

1. **[Developer]** **Class-E side effects have no durable job model.** Print, drawer and fiscal
   are post-commit, non-idempotent, and currently implicit. Without a keyed job table, a retry
   double-opens the drawer or double-issues a fiscal receipt, and a failure loses the receipt
   silently. §12.1 says "printing happens after commit" and stops there.
2. **[Developer]** **Fiscal timeout with unknown outcome** *(v2, but the seam is v1)*. The sale
   is committed; the ՀԴՄ may or may not have printed. Simon cannot resolve this without knowing
   the device's protocol, and §17 explicitly does not. If the regime also demands a gapless
   number, §12.1's block-allocation fallback interacts with the offline design.
3. **[Developer]** **Outbox head-of-line blocking.** FIFO + serial + "park non-retryable 4xx"
   is under-specified. If a parked item does not step aside, one `422` freezes every subsequent
   sale on that till — and the till keeps happily selling, because rule 1 says it must.
4. **[Developer]** **Single-writer contention from the non-selling paths.** Hourly
   `VACUUM INTO` during trading, a full import batch, a customer merge, and the drift-check job
   all contend with three tills against one write lock. §21 forbids `SQLITE_BUSY` reaching a
   user; nothing currently schedules these away from the till.
5. **[Developer]** **Cost leakage through the catalogue snapshot and the outbox cache.**
   `GET /catalogue/snapshot` writes durably to a worker's phone. If `avgCostMdram` ever appears
   in it, the leak persists on the device after the bug is fixed. The same cache holds customer
   names, phones and balances — PII at rest on a personal Android, which §19.6 does not cover.
6. **[Developer]** **Device clock skew.** Unmodelled, and it corrupts UUIDv7 ordering, shift
   attribution, Z-report boundaries and debt aging simultaneously.
7. **[Developer]** **IndexedDB eviction / upgrade destroying the outbox.** Violates §14.2's
   first guarantee, and does so silently.
8. **[Developer]** **TLS certificate expiry** takes down the till *and* the camera at once,
   with no remote access to fix it (§24.1).

