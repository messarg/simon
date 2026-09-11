# Event Storming — Phase 1 chaotic exploration
# Persona: **[Business Analyst]** — Process & Requirements
# Domain: Simon (Սիմոն), the full buy–sell cycle

Grounded in `docs/prd.md` v3.47 (§2, §5, §6, §8.1, §8.5, §10.6–10.7, §11 *Lifecycles*, §12, §13, §14, §15.3–15.4, §16) and `CLAUDE.md`.

Convention used throughout: **Command** (blue, imperative) → *Event* (orange, past tense). Actors (yellow) are named per command. Failure paths are given their own event, because "nothing happened" is never a domain event and the PRD's whole error catalogue (§8.5) is a set of outcomes a user acts on.

---

## 0. **[Business Analyst]** — Framing note before the stickies

**[Business Analyst]** Three structural observations that shape every command below, and which the domain expert will tend to skip:

1. **There are two kinds of "failure" in this domain, and they are not the same sticky.** §15.2 draws the line explicitly: a `422` is a *refusal* (the command did not happen), a `200 + warnings[]` is an *acceptance under protest* (the command happened, and a `ReviewFlag` row exists as its durable trace). On the wall these must be different colours. Modelling `insufficient-stock` as a rejection is the single easiest way to break design rule 1.
2. **Several apparently-obvious commands do not exist in this product.** "Void Sale" after payment, "Delete Product", "Delete Customer", "Edit Receipt", "Edit a Debt Entry". Their absence is load-bearing (rule 4, §10.7) and each one needs a red "this command is not offered" sticky, or someone will add it back in sprint 3.
3. **The client is a command source, not just a UI.** Sale ids are client-generated (§14.3, §15.1) and the outbox is a queue of *commands in flight*. A command issued at 14:02 offline may not become an event until 16:40. Anything modelled as "command and event are simultaneous" is wrong for this system.

---

## 1. Actors — the yellow stickies

### 1.1 System users (hold a `Session`, §16.3)

| Actor | Role token | Device / mode | Session policy |
|:--|:--|:--|:--|
| **[Business Analyst]** Գոռ — the worker | `WORKER` | Phone/tablet at the till, shared | 15-min idle; **ends at shift close** (§16.3) |
| **[Business Analyst]** The stock worker | `STOCK` | Same four destinations, extra capability inside Պահեստ (§5.1) | As `WORKER` |
| **[Business Analyst]** Արամ — the owner | `ADMIN` | Desktop, back room or home | 8-hour idle, **not** shift-bound |
| **[Business Analyst]** The owner *at the till* | `ADMIN` re-auth over a worker's session (§16.3) | Borrows the worker's device for one action | Elevation is per-action, not a login |

### 1.2 Non-user actors who nonetheless drive events

| Actor | How they act on the system | Notes |
|:--|:--|:--|
| **[Business Analyst]** The customer | Never touches the app. Issues commands *verbally* — "write it down", "I'm returning this", "here's 20,000 against what I owe" | **They are a reader of one screen**: §6.3 is explicitly designed to be legible to the customer standing at the counter. That makes the customer a stakeholder in a UI contract without being a user. |
| **[Business Analyst]** The supplier | Delivers goods with a paper invoice; issues credits | The invoice, not the supplier, is the input document. §13.2 says receiving *without* a prior order is the primary path — so the trigger is physical arrival, not a system state. |
| **[Business Analyst]** Սիրան — the bookkeeper | Consumes exports only (§2.1, §5.3 tier 4) | Not a user. Her only command is *Export*, issued through Արամ. |
| **[Business Analyst]** ՀԴՄ / fiscal device | Unresolved (§17, §26 Q10) | If a fiscal regime applies, it becomes the authority for `Sale.number` and issues `FiscalReceiptIssued`. **Placeholder actor — must be on the wall even though undefined.** |

### 1.3 System actors (no human at the keyboard)

| Actor | Commands it issues | Events |
|:--|:--|:--|
| **[Business Analyst]** Sync engine / outbox drainer | *Drain Outbox* (FIFO, serial) | `SaleAccepted`, `SaleReplayIgnored`, `SaleParkedForReview`, `ReviewFlagRaised` |
| **[Business Analyst]** Device heartbeat | *Report Device Depth* (≤1/min, plus once at queue zero) | `DeviceDepthReported` — deliberately **not** on the scan path (§16.3) |
| **[Business Analyst]** Session sweeper | *Expire Idle Session* | `SessionExpired` (15 min till / 8 h dashboard) |
| **[Business Analyst]** Lockout timer | *Release Lockout* | `LockoutExpired` after 15 min (§16.2) |
| **[Business Analyst]** Backup scheduler | *Run Backup* | `BackupCompleted` / `BackupFailed` (§19.2) |
| **[Business Analyst]** Reorder suggester | *Recompute Reorder Point* | `ReorderSuggestionUpdated` from `avgDailyQty30d × leadTimeDays` (§13.3) |
| **[Business Analyst]** Shift-close guard | *Block Close* | `ShiftCloseBlocked` on this shift's open baskets (§11) |

**[Business Analyst]** ⚠️ **Missing system actor.** Nothing in the PRD issues *Recompute Cached Balances* as a scheduled reconciliation. §4.3 promises the owner an alert — *"Պահեստը ստուգման կարիք ունի"* — for cache drift, but no actor is named who detects the drift. `Product.stockQty` is declared a rebuildable cache (CLAUDE.md, §10.4); a cache with no reprojection job is a cache that silently rots. **This is a missing yellow sticky and a missing command.**

---

## 2. Commands → Events — the blue and orange stickies

### 2.1 Authentication & session

| Command | Actor | Success event(s) | Failure event(s) |
|:--|:--|:--|:--|
| **[Business Analyst]** Sign In (enter PIN) | any user | `UserSignedIn`, `SessionOpened` | `SignInRejected` (`pin-incorrect`, 401, attempts remaining shown) → 5th → `AccountLocked` (`account-locked`, 423, 15 min); or `SignInThrottled` (`too-many-attempts`, 429, >10/min/device) |
| **[Business Analyst]** Re-Authenticate (admin PIN over an open screen) | `ADMIN` | `ElevatedActionAuthorized` | `ElevationRejected` — **basket survives either way** (§16.3) |
| **[Business Analyst]** Unlock Account | `ADMIN` | `AccountUnlocked` | — |
| **[Business Analyst]** Redeem Recovery Code | owner (`ADMIN`, sole-admin case) | `AccountUnlocked`, `RecoveryCodeReissued` | `RecoveryCodeRejected` (single-use, already spent) |
| **[Business Analyst]** Sign Out | any user | `SessionEnded` | — |
| **[Business Analyst]** Revoke Session | `ADMIN` | `SessionRevoked` (`revokedAt` set — **revoke, not delete**, §15.4) | — |
| **[Business Analyst]** Enter / Leave Practice Mode | any user | `PracticeModeEntered` / `PracticeModeLeft` | `PracticeWriteRejected` — a `PRACTICE` session may not write the real DB at all (§11, §19.4) |

**[Business Analyst]** Note the shape: `423` (locked, a *state*) and `429` (throttled, a *rate*) are two distinct events with two distinct recoveries, and §8.5 insists they never share a message. On the wall they are two stickies.

### 2.2 Shift & cash drawer

| Command | Actor | Success event(s) | Failure / alternative |
|:--|:--|:--|:--|
| **[Business Analyst]** Open Shift (count float, one number) | `WORKER`/`STOCK`/`ADMIN` | `ShiftOpened` (`OPEN`), `OpeningFloatRecorded` | `ShiftOpenRejected` — guard: no other `OPEN` shift for this user (§11) |
| **[Business Analyst]** Record Cash In | worker | `CashMovementRecorded` (`PAY_IN`) | — |
| **[Business Analyst]** Record Cash Out | worker | `CashMovementRecorded` (`PAY_OUT`) | — |
| **[Business Analyst]** Record Drop (to safe) | worker | `CashMovementRecorded` (`DROP`) | — |
| **[Business Analyst]** Open Drawer, no sale | worker + **admin re-auth** (§16.3) | `DrawerOpened`, `CashMovementRecorded` (`NO_SALE`, `amount = 0`) | `ElevationRejected` → **drawer stays shut** |
| **[Business Analyst]** Request X-Report | worker / `ADMIN` | `XReportIssued` — mid-shift, **non-resetting** | — |
| **[Business Analyst]** Begin Shift Close | worker | `ShiftCloseStarted` (`CLOSING`), `ExpectedCashComputed` | `ShiftCloseBlocked` (`shift-has-open-baskets`, 422, listed by time + first item); `UnsyncedSalesAcknowledgementRequired` |
| **[Business Analyst]** Cancel Shift Close | worker | `ShiftCloseCancelled` (→ `OPEN`) | Guard: **nothing counted yet** (§11) |
| **[Business Analyst]** Count Cash (by denomination) | worker | `CashCounted` | — |
| **[Business Analyst]** Close Shift *(hard confirm, §8.1)* | worker | `ShiftClosed` (`CLOSED`), `CashVarianceRecorded`, `ZReportIssued`, `SessionsEnded` | `VarianceNoteRequested` (large variance — **asked for, not demanded**, §6.6) |

**[Business Analyst]** The expected-cash formula (§12.5) is a **query over rows, never a running total** — that is a requirement, not an implementation preference, because rule 3 says the owner must be able to drill into it. Any design that increments a counter on the `Shift` row fails the acceptance criterion in §4 below.

### 2.3 Selling — building the basket

| Command | Actor | Success event(s) | Failure / alternative |
|:--|:--|:--|:--|
| **[Business Analyst]** Scan Item (HID wedge) | worker | `ItemAddedToBasket` (line at top, <200 ms) — or `BasketLineIncremented` on rescan; first line also emits `SaleDrafted` (`DRAFT`) | `UnknownBarcodeEncountered` (`unknown-barcode`, **client-side, no HTTP status**) → opens the quick-add sheet. **Never a dead end.** |
| **[Business Analyst]** Scan Item (camera) | worker | as above | `CameraUnavailable` — silent failure without a secure context; §16.6 ships TLS in v1 precisely to kill this event |
| **[Business Analyst]** Search Item (Armenian or Latin-typed) | worker | `ItemAddedToBasket` | `NoMatchFound` |
| **[Business Analyst]** Tap Quick Tile | worker | `ItemAddedToBasket` | — |
| **[Business Analyst]** Quick-Add Product (name + price + unit) | **`WORKER`** | `ProductCreated` (stub), `ItemAddedToBasket`, `ProductFlaggedIncomplete` (→ §6.12's default view) | `DuplicateBarcodeRejected` (`duplicate-barcode`, 422, names the other product) |
| **[Business Analyst]** Change Line Quantity | worker | `LineQuantityChanged` + **5 s undo** | `DecimalRejected` — a piece-count refuses `2.5` (§6.1). *Prevented, not scolded.* |
| **[Business Analyst]** Remove Line (swipe) | worker | `LineRemoved` + **5 s undo** | — |
| **[Business Analyst]** Override Line Price (long-press) | worker **"if permitted"** — see §5, finding F1 | `LinePriceOverridden`, `AuditLogged` (reason required) | `NotPermitted` (`not-permitted`, 403) |
| **[Business Analyst]** Apply Discount (line or sale, % or fixed) | worker within cap (default 5%) | `DiscountApplied` | `DiscountRejected` (`discount-above-cap`, 422) → *Authorize Discount* |
| **[Business Analyst]** Authorize Discount | `ADMIN` (PIN + reason) | `DiscountApproved`, `AuditLogged` | `ElevationRejected` |
| **[Business Analyst]** Hold Sale (Պահել) | worker | `SaleHeld` (`HELD`) — **posts to no ledger at all** (§15.3) | Guard: basket not empty. Offline → held in IndexedDB, `SaleHeldLocally`; **no other till can resume it until this device syncs** (§14.5) |
| **[Business Analyst]** Resume Held Sale | worker, **any open shift** | `SaleResumed` (→ `DRAFT`); if a different shift → `HeldBasketTransferred` + `AuditLogged` | `IllegalTransition` (`illegal-transition`, 422 — someone already completed it) |
| **[Business Analyst]** Void Basket | worker | `SaleVoided` (`VOIDED`), `AuditLogged` | Guard: `DRAFT`/`HELD` **only**. Never automatic (§11) |
| **[Business Analyst]** ~~Void Completed Sale~~ | — | **COMMAND DOES NOT EXIST** | §6.5: *"'Void this sale' is not an action the product offers after payment."* `VOIDED` is unreachable from `COMPLETED`. The only correction is a return. |

### 2.4 Selling — taking payment

| Command | Actor | Success event(s) | Failure / alternative |
|:--|:--|:--|:--|
| **[Business Analyst]** Take Cash Payment | worker | `SaleCompleted`, `PaymentRecorded(CASH)`, `StockMovementsPosted(SALE)`, `ReceiptNumberAssigned` (`{Device.prefix}-{lastSequence}`, on-device), `ChangeComputed`, `AuditLogged` → **then** `ReceiptPrinted` (after commit) | `PaymentInsufficient` — **the button is simply inactive with the shortfall shown** (rule 7). *This is a non-event: prevention, not rejection.* |
| **[Business Analyst]** Take Card Payment | worker | as above, `PaymentRecorded(CARD)`, no change | — |
| **[Business Analyst]** Record Nisya (debt sale) | worker | `SaleCompleted`, `PaymentRecorded(DEBT)`, `DebtChargeCreated` (`CHARGE`, positive, optional `dueDate`), stock movements, audit — **one transaction** | `CreditLimitExceeded` (`credit-limit-exceeded`, 422, carries `limit`/`current`/`wouldBe` as **fields**); `CustomerBlocked` (`customer-blocked`, 422); offline → `OfflineDebtCapReached` (client-side, 20 000 ֏ default) |
| **[Business Analyst]** Authorize Credit-Limit Override | `ADMIN` (PIN + reason) — **a genuine hard confirm, because money is being lent** | `CreditLimitOverridden`, `AuditLogged`, then `SaleCompleted` | `ElevationRejected` → reduce the sale instead |
| **[Business Analyst]** Split Tender (Բաժանել) | worker | `SaleCompleted` with ≥2 `Payment` rows summing ≥ `total` | `PaymentInsufficient` (inactive button) |
| **[Business Analyst]** Create Customer inline (name + phone) | **`WORKER`** — the only write a worker makes on §6.13 | `CustomerCreated` (limit defaults from settings) | `DuplicatePhoneDetected` — caught **at the point of typing** |
| **[Business Analyst]** Reprint Receipt | worker | `ReceiptPrinted` | Printer jam is **never** a domain failure: the sale is already committed (§8.2) |

**[Business Analyst]** Two orange stickies that are easy to miss and are business-critical:
- `PriceBasisSnapshotted` — `Sale.priceBasis` is set at completion and **immutable**; a reprint reads it and never recomputes from the current setting (§11).
- `UnitCostSnapshotted` — `SaleLine.unitCostMdram` is copied at completion. This is what makes every historical margin immutable (CLAUDE.md invariants, §10.5). It is a *domain event with no UI*, and it is exactly the sort of thing that gets dropped when someone "simplifies" the sale write.

### 2.5 Returns and corrections

| Command | Actor | Success event(s) | Failure / alternative |
|:--|:--|:--|:--|
| **[Business Analyst]** Find Original Sale (scan receipt no.) | worker | `SaleLocated` | `NotFound` (`not-found`, 404 — means *never existed*; a `VOIDED` or deactivated record **still opens**) |
| **[Business Analyst]** Record Return *(hard confirm)* | worker | `SaleReturnRecorded`, per line either `StockMovementsPosted(SALE_RETURN)` at the **original** `unitCostMdram` **or** `WriteOffPosted(reasonCode)`; then `RefundPaid` (cash out) **or** `DebtReduced` (credit `ADJUSTMENT` allocated via `DebtAllocation.creditEntryId`); `AuditLogged` | `ReturnExceedsSold` (`return-exceeds-sold`, 422 — checked **per line**, not per sale); `SaleAlreadyReturned` (`sale-already-returned`, 422) |
| **[Business Analyst]** Record Blind Return (no original) | **`ADMIN` only** | `SaleReturnRecorded` valued at the **current average** | `NotPermitted` (403) — *"the classic fraud path"* (§6.5) |
| **[Business Analyst]** Reverse a Repayment | `ADMIN` | `DebtEntryReversed` (linked `reversesId`), `AuditLogged` | Never an edit, never a delete (§10.7) |
| **[Business Analyst]** Correct a Receipt Entered Against the Wrong Supplier | `ADMIN` | `GoodsReceiptReversed` (linked correction) | Never an edit (§6.14) |

**[Business Analyst]** The restock decision is **per line**, not per header (§12.4) — one return can put three fittings back on the shelf and write off a fourth. The user is asked *"Ապրանքը վերադարձվե՞ց պահեստ"* and never asked to choose between `SALE_RETURN` and `WRITE_OFF`. **The command has a plain-language shape and a two-branch technical shape, and the wall needs both.**

### 2.6 Debt (Nisya)

| Command | Actor | Success event(s) | Failure / alternative |
|:--|:--|:--|:--|
| **[Business Analyst]** Take Repayment (Մարում) | worker | `DebtPaymentRecorded` (`PAYMENT`), `DebtAllocationsPosted` (oldest-first), `CashMovementRecorded(REPAYMENT)` **if cash**, `ReceiptPrinted` | Over-payment → `CreditAdjustmentPosted` (`ADJUSTMENT`, **never a negative charge**) so `sum(allocations) + credit == payment` |
| **[Business Analyst]** Override Allocation | worker | `AllocationsOverridden` | `AllocationExceedsCharge` — each allocation ≤ its charge's remaining balance |
| **[Business Analyst]** Set / Raise Credit Limit | **`ADMIN` only** (+ re-auth + reason when done mid-sale) | `CreditLimitChanged`, `AuditLogged` | `NotPermitted` (403) |
| **[Business Analyst]** Block / Unblock Customer | **`ADMIN` only** | `CustomerBlocked` / `CustomerUnblocked` | — |
| **[Business Analyst]** Merge Duplicate Customers | `ADMIN` | `CustomersMerged`, `DebtEntriesRepointed`, `MergedIntoIdSet`, `AuditLogged` | **Never a delete, and never re-typing a balance by hand** (§6.13) |
| **[Business Analyst]** Anonymise Customer (data-subject request) | `ADMIN` | `CustomerAnonymised` — name and phone cleared, **ledger rows and amounts remain** | Retention obligation unconfirmed (§17 item 5) |
| **[Business Analyst]** Print / Export Statement | `ADMIN` (owner) | `StatementIssued` | — |
| **[Business Analyst]** ~~Delete a Customer who owes money~~ | — | **NOT OFFERED** — deactivate only | §6.13 |

**[Business Analyst]** Aging is measured from the **charge** date, and `dueDate` **never affects aging** (§10.6). *"How old is this money"* and *"did they miss a promise"* are two different questions and must never collapse into one number. The debt-sale screen (§6.3) shows both, side by side, and that is a functional requirement (§12.2), not decoration.

### 2.7 Buying & inventory

| Command | Actor | Success event(s) | Failure / alternative |
|:--|:--|:--|:--|
| **[Business Analyst]** Receive Goods (Ընդունում) | **`STOCK` / `ADMIN`** | `GoodsReceiptPosted`, `StockMovementsPosted(PURCHASE_RECEIPT)`, `LandedCostApportioned`, `WeightedAverageCostRecalculated`, `SupplierPayableCreated`, `AuditLogged` — **one transaction** | `OfflineNotAvailable` (client-side) — **receiving is blocked offline**; it needs authoritative stock (§14.5) |
| **[Business Analyst]** Enter Delivery Charge (Առաքման ծախս) | `STOCK` | `LandedCostApportioned` (spread **by value**) | — |
| **[Business Analyst]** Record Purchase Return | `STOCK` / `ADMIN` | `PurchaseReturnPosted`, `StockMovementsPosted(PURCHASE_RETURN)` at the **receipt's landed cost, not the current average**, `WeightedAverageCostRecalculated`, `SupplierCreditAllocated`, `LandedCostLostRecorded` | If `stockQty − returnQty ≤ 0` → `AverageCostLeftUnchanged` + `MovementFlagged`. **Blind purchase return is `ADMIN`-only**, valued at the current average |
| **[Business Analyst]** Pay Supplier | `ADMIN` | `SupplierPaymentRecorded`, `SupplierAllocationsPosted`, `CashMovementRecorded(PAY_OUT)` if from the drawer | A fully-allocated receipt **cannot be selected again**; over-payment → supplier credit, never a negative payable |
| **[Business Analyst]** Adjust Stock | `STOCK`/`ADMIN` + **re-auth** (§16.3) | `StockAdjusted`, `AuditLogged` | `OfflineNotAvailable` |
| **[Business Analyst]** Write Off Stock | `STOCK`/`ADMIN` | `WriteOffPosted` with a **coded** `reasonCode` (damage/expiry/theft/internal/sample) | `ReasonCodeRequired` — required when `type = WRITE_OFF`, null for every other type. *"A `note` column would only ever produce a list nobody can total."* |
| **[Business Analyst]** Approve Stocktake *(v2, hard confirm showing total value impact)* | `STOCK`/`ADMIN` | `StocktakeApproved`, `StockMovementsPosted(STOCKTAKE)`, `ShrinkageValued` | Irreversible except by a further adjustment (§11) |
| **[Business Analyst]** Create / Cancel Purchase Order *(v2)* | `ADMIN` | `PurchaseOrderOpened` / `PurchaseOrderCancelled` (`DRAFT`/`OPEN` only); `PARTIAL`/`RECEIVED` are **derived, never set by hand** | — |

### 2.8 Catalogue & administration

| Command | Actor | Success event(s) | Failure / alternative |
|:--|:--|:--|:--|
| **[Business Analyst]** Change Price | `ADMIN` + **re-auth** | `PriceChanged`, `PriceHistoryWritten`, `AuditLogged` — previous price stays visible (*"was 1 100 ֏ until 12 March"*) | `OfflineNotAvailable`. Concurrent edit → **last write wins**, both survive in history (§15.2 — a decision, not an omission) |
| **[Business Analyst]** Add Barcode | `ADMIN` | `BarcodeAdded` | `DuplicateBarcodeRejected` (422, names the other product, **never a silent reassign**) |
| **[Business Analyst]** Retire Barcode | `ADMIN` | `BarcodeRetired` — stops being printed, **never stops scanning** | **No delete endpoint exists**: a code on a two-year-old label must still resolve |
| **[Business Analyst]** Deactivate Product | `ADMIN` | `ProductDeactivated` — keeps appearing in history, stops being sellable | Allowed with stock on hand, showing remaining value at cost |
| **[Business Analyst]** Change `stockUom` / `decimalPlaces` after movements exist | `ADMIN` | — | **`ImmutableAfterMovements` (422). Blocked outright**: it reinterprets every historical quantity. Add a `ProductUnit` instead |
| **[Business Analyst]** Create / Edit User, Change Role | `ADMIN` | `UserCreated` / `RoleChanged`, `AuditLogged` | — |
| **[Business Analyst]** Change Setting | `ADMIN` | `SettingChanged` | — |
| **[Business Analyst]** Run Import | `ADMIN` | `ImportBatchCreated`, per-row `RowApplied` / `RowRejected` — idempotent on `naturalKey` unique per `kind` among `APPLIED` rows | — |
| **[Business Analyst]** Resolve Review Flag | `ADMIN` | `ReviewFlagResolved` | — |
| **[Business Analyst]** Read Audit Log | **`ADMIN` — gated as a whole route**, not field-stripped | `AuditLogRead` | `NotPermitted` (403). §16.5: field filters cannot see inside a JSON snapshot |

### 2.9 Sync — the system actor's commands

| Command | Actor | Success event(s) | Failure / alternative |
|:--|:--|:--|:--|
| **[Business Analyst]** Drain Outbox | sync engine | `SaleAccepted` (200, possibly `+ warnings[]`) | `SaleReplayIgnored` — same id **+ same target status** → original document, 200, **never 409** |
| **[Business Analyst]** Post Held Basket then Complete It | sync engine | Two posts of one id: `HELD` then `COMPLETED` — **the second is a transition, not a replay** | `IllegalTransition` (422) on an illegal edge |
| **[Business Analyst]** Post a Queued Debt Sale that breaches a limit | sync engine | `SaleAccepted` **+** `CreditLimitExceededOnSync` warning **+** `ReviewFlagRaised` → owner's needs-attention list | **Never rejected.** §14.6: accept and flag |
| **[Business Analyst]** Post a Sale for a Deactivated Product | sync engine | `SaleAccepted` + `ProductDeactivatedOnSync` + `ReviewFlagRaised` | — |
| **[Business Analyst]** Post a Sale that takes stock negative | sync engine | `SaleAccepted` + `InsufficientStock` warning + `ReviewFlagRaised(NEGATIVE_STOCK)` → **that row *is* the recount list** | Strict mode only → `insufficient-stock-strict` (422) |
| **[Business Analyst]** Post a Malformed Sale | sync engine | — | `SaleParkedForReview` (`malformed-request`, 400) — **never retried**, surfaced to the owner. *A bug, not a business state.* |

**[Business Analyst]** §15.2's rule with teeth, restated as an acceptance criterion for the whole sync context: **a warning with no durable `ReviewFlag` row is a bug**, because it cannot survive the retry it is most likely to be lost in.

---

## 3. Process flows

### 3.1 (a) The sell cycle — happy path

**[Business Analyst]**

```
[Worker arrives]
  → Sign In (PIN)                       → UserSignedIn
  → Open Shift (count float)            → ShiftOpened
  ┌─ per customer ─────────────────────────────────────────────┐
  │ → Scan Item ×n                      → ItemAddedToBasket ×n  │
  │                                       (first → SaleDrafted) │
  │ → Tap ՎՃԱՐԵԼ                        → PaymentScreenOpened   │
  │ → Tap ԿԱՆԽԻԿ + tendered shortcut    → SaleCompleted         │
  │                                       PaymentRecorded        │
  │                                       StockMovementsPosted   │
  │                                       ReceiptNumberAssigned  │
  │                                       UnitCostSnapshotted    │
  │                                     → ReceiptPrinted (after) │
  └────────────────────────────────────────────────────────────┘
  → Begin Shift Close                   → ExpectedCashComputed
  → Count Cash (denominations)          → CashCounted
  → Close Shift (HARD CONFIRM)          → ShiftClosed
                                          CashVarianceRecorded
                                          ZReportIssued
                                          SessionsEnded
```

Budget: **four taps for one item** — scan, pay, cash, done — which is §21.1's budget exactly, *"and it is why there is no room for a dialog."*

### 3.2 (a) The sell cycle — branch points, stated where they happen

**[Business Analyst]**

| # | Branch point | Condition | Path taken |
|:--|:--|:--|:--|
| B1 | On scan | Barcode unknown | → Quick-add sheet (2 fields) → `ProductCreated` + `ItemAddedToBasket` → **back into the sale**. Never a dead end |
| B2 | On scan | Same item rescanned | → `BasketLineIncremented`, **never a duplicate line** |
| B3 | On scan | Stock is 0 | → `SaleAccepted` + `insufficient-stock` **warning** + recount flag. Default: allow. Strict mode: 422 |
| B4 | Mid-basket | Wrong item / wrong qty | → swipe or tap → 5 s undo. **No confirm dialog** |
| B5 | Mid-basket | Queue behind / customer forgot something | → *Hold Sale* → `SaleHeld` on the **server** → resumable **on any till** |
| B6 | Mid-basket | Discount above cap | → 422 → *Authorize Discount* (admin PIN + reason) → `DiscountApproved` |
| B7 | At payment | Customer wants credit | → *Record Nisya* → §3.3 |
| B8 | At payment | Part cash, part credit | → *Split Tender* → payments sum ≥ total |
| B9 | At payment | Tendered < total | → **button inactive**, shortfall shown. Not an error path — a prevented one |
| B10 | At commit | Wi-Fi down | → outbox, sale completes **locally**, `ReceiptNumberAssigned` **on-device** (`{prefix}-{seq}`) |
| B11 | After commit | Printer jams | → sale already saved → offer reprint. **Never a rollback** |
| B12 | At shift close | This shift has `HELD` baskets | → `shift-has-open-baskets` (422). Complete, void, **or let another till take one** — which moves it off this shift |
| B13 | At shift close | Unsynced sales | → **explicit acknowledgement**, because the Z-report would be incomplete |

### 3.3 (a) Debt-sale sub-flow (J3) — *"the reason the product exists"*

**[Business Analyst]**

```
Basket built (as J2)
  → Tap ՎՃԱՐԵԼ → ՊԱՐՏՔ
  → Type first letters of name (recent customers first, Latin-typed OK)
      ├─ not found → Create Customer (name + phone) inline, without leaving the sale
      │              └─ duplicate phone caught AT THE POINT OF TYPING
      └─ found
  → READ THE FOUR LINES: owed · age of oldest · limit · balance after this sale
      (these ARE the screen, not a dialog over it — a functional requirement, §12.2,
       precisely so they are read in passing rather than tapped through)
      ├─ within limit  → completing tap → SaleCompleted + DebtChargeCreated
      ├─ over limit    → credit-limit-exceeded (422)
      │                   ├─ Authorize Override (ADMIN PIN + reason) → hard confirm
      │                   │    → CreditLimitOverridden + SaleCompleted
      │                   └─ or reduce the sale
      ├─ customer blocked → customer-blocked (422). Only an admin unblocks
      └─ OFFLINE       → limit is UNCHECKABLE. Allowed to the offline cap
                          (20 000 ֏ / customer / outage), then
                          → SaleAccepted + credit-limit-exceeded-on-sync + ReviewFlag
```

### 3.4 (a) Return sub-flow — exception path

**[Business Analyst]**

```
→ Find Original Sale (scan receipt number, or recent sales)
     └─ no original → BLIND RETURN → ADMIN ONLY → valued at current average
→ Select lines, enter quantities   (≤ sold, less already returned — PER LINE)
→ Per line, in plain language: "Ապրանքը վերադարձվե՞ց պահեստ?"
     ├─ yes → SALE_RETURN at the ORIGINAL snapshotted unitCostMdram
     └─ no  → WRITE_OFF with a reasonCode
→ Refund routing (Simon decides and says so):
     ├─ original was cash/card → RefundPaid (cash out of the drawer) — HARD CONFIRM
     └─ original was a debt sale → DebtReduced via credit ADJUSTMENT allocated to
                                    the original charge. NEVER money out of the drawer
                                    for goods that were never paid for
→ AuditLogged
```

### 3.5 (b) The buy cycle — happy path (J5)

**[Business Analyst]**

```
[Delivery arrives with a paper invoice, usually with NO prior order]
  → Open Պահեստ → Ընդունում            (STOCK or ADMIN only)
     └─ OFFLINE → BLOCKED CLEARLY. Receiving needs authoritative stock
  → Pick supplier, type invoice number
  ┌─ per invoice line ────────────────────────────────────────────┐
  │ → Scan or search the item                                      │
  │ → Enter quantity + unit cost FROM THE INVOICE                  │
  │    packaging converts itself: 3 spools × 50 m posts 150 m      │
  └────────────────────────────────────────────────────────────────┘
  → Enter Առաքման ծախս (delivery charge), if any
  → Submit → ONE TRANSACTION:
        GoodsReceiptPosted
        LandedCostApportioned         (spread by value)
        StockMovementsPosted(PURCHASE_RECEIPT)
        WeightedAverageCostRecalculated
        SupplierPayableCreated
        AuditLogged
  [Throughout: the NEW average cost is never shown to STOCK —
   only the invoice costs they typed themselves]
```

### 3.6 (b) The buy cycle — alternative and exception paths

**[Business Analyst]**

| # | Branch point | Condition | Path |
|:--|:--|:--|:--|
| C1 | Before receiving | A PO exists (v2) | Receipt links to it; PO → `PARTIAL` or `RECEIVED`, **derived from receipt lines** |
| C2 | Before receiving | No PO | **This is the primary path** (§6.7, assumption A1) |
| C3 | At receiving | Received qty ≠ ordered qty | Allowed; PO moves to `PARTIAL` |
| C4 | At receiving | Item not in the catalogue | Create it here (cost known this time, unlike quick-add) |
| C5 | At receiving | Offline | **Hard block** (`offline-not-available`) — the one place rule 1 yields, because the shop is not selling on this screen |
| C6 | After receiving | Goods wrong / damaged / over-delivered | **Purchase Return**, naming **receipt lines, not products**, reversed at the **receipt's landed cost**, with `landedCostLost` recorded because *"the freight does not come back"* |
| C7 | After receiving | `stockQty − returnQty ≤ 0` | **Do not evaluate the WAC formula.** Leave the average and flag the movement |
| C8 | Settlement | Pay the supplier | Allocations against specific receipts; a settled receipt cannot be selected again; over-payment → supplier credit |
| C9 | Settlement | Receipt entered against the wrong supplier | **Linked correction, never an edit** |
| C10 | Ongoing | Reorder point reached | `ReorderSuggestionUpdated` → owner sees a **plain sentence**, not a formula. Turning it into a PO is v2 |
| C11 | Ongoing | Stock disappears without a document | Write-off with a **coded** reason; or `NEGATIVE_STOCK` flag → recount list; or stocktake (v2) |

### 3.7 The two cycles meet

**[Business Analyst]** The buy and sell cycles are coupled at exactly three points, and every one of them is a place where a mistake is expensive and silent:

1. **`WeightedAverageCostRecalculated`** (buy) → **`UnitCostSnapshotted`** (sell). The receipt sets the number the sale freezes. Get the apportionment wrong on Monday and every margin reported after it is wrong, with nothing on screen saying so.
2. **`StockMovementsPosted`** — one ledger, both directions. `Product.stockQty` is a *cache* of it, and §3.7's missing reprojection actor (see §1.3) is what keeps that honest.
3. **The cash drawer** — `CashMovement(PAY_OUT)` for a supplier payment sits in the same shift reconciliation as `Payment(CASH)` from a sale (§12.5). **Paying a supplier from the till changes the worker's expected cash**, and the worker did not issue that command. Worth a red sticky: *whose variance is it?*

---

## 4. Acceptance criteria — Given / When / Then

**[Business Analyst]** The ten commands where money, stock or debt actually move. Each is written so it can become a test (§22 / `testing` skill) without further interpretation.

### AC-1 · Take Cash Payment
```
GIVEN an OPEN shift and a DRAFT sale totalling 4 300 ֏
  AND the worker holds a WORKER token
WHEN  the worker taps ԿԱՆԽԻԿ with 5 000 ֏ tendered
THEN  the sale, its lines, its payments, its stock movements and its audit row
        commit in ONE transaction
  AND change of 700 ֏ is displayed as the largest number on the screen
  AND SaleLine.unitCostMdram is snapshotted from Product.avgCostMdram at commit time
  AND Sale.priceBasis is snapshotted from settings and is thereafter immutable
  AND Sale.number is assigned on the device as {Device.prefix}-{lastSequence}
  AND the receipt prints AFTER commit
  AND no printing, HTTP call or file write occurs inside the transaction
```
```
GIVEN the same sale
WHEN  4 000 ֏ is tendered
THEN  the completing button is INACTIVE and the 300 ֏ shortfall is shown
  AND NO error is raised — this is prevention, not rejection (rule 7)
```
```
GIVEN the same sale and no network
WHEN  the worker taps ԿԱՆԽԻԿ
THEN  the sale completes locally in under the §21 budget
  AND it is written to the outbox with a client-generated UUIDv7 id
  AND the UI NEVER awaits the network
  AND the connection strip stays calm — never a blocking modal
```

### AC-2 · Take Cash Payment, replayed
```
GIVEN a sale with id X already stored with status COMPLETED
WHEN  POST /api/sales arrives again with id X and status COMPLETED
THEN  the server returns 200 with the ORIGINAL stored document
  AND its ORIGINAL warnings[], read back from ReviewFlag rows —
        never re-evaluated against current state
  AND no second set of stock movements, payments or debt charges is written
  AND the response is INDISTINGUISHABLE from the first
  AND the status code is NEVER 409
```
```
GIVEN a sale with id X stored with status HELD
WHEN  POST /api/sales arrives with id X and status COMPLETED
THEN  this is a TRANSITION, not a replay
  AND the money IS taken
  AND the replay check is by primary key AND target status, INSIDE the transaction
        that would otherwise write it
```
```
GIVEN a sale with id X stored with status COMPLETED
WHEN  POST /api/sales arrives with id X and status HELD
THEN  422 illegal-transition — COMPLETED has no outgoing edge
```

### AC-3 · Record Nisya (debt sale)
```
GIVEN customer Դավիթ with 45 000 ֏ outstanding, oldest charge 62 days, limit 50 000 ֏
  AND a basket totalling 2 900 ֏
WHEN  the debt-sale screen opens
THEN  all four figures are visible ON the screen, not in a dialog over it:
        owed 45 000 · oldest 62 օր · limit 50 000 · after this sale 47 900
  AND the copy is factual and never shaming — the customer can read it too
WHEN  the worker completes the sale
THEN  sale + lines + stock movements + a DebtEntry of type CHARGE commit in ONE transaction
  AND the charge amount is POSITIVE — direction lives in `type`, never in the sign
  AND aging for that charge is measured from the CHARGE date
  AND an optional dueDate drives ONLY the overdue marker and NEVER the aging bucket
```
```
GIVEN the same customer and a basket of 6 000 ֏ (would be 51 000, over the 50 000 limit)
WHEN  the worker attempts to complete
THEN  422 credit-limit-exceeded carrying customerId, limit, current and wouldBe
        AS FIELDS, not inside a sentence
  AND the worker may either reduce the sale
        OR obtain an ADMIN PIN plus a typed reason — a genuine HARD CONFIRM,
           because money is being lent
  AND the override writes CreditLimitOverridden and an AuditLog row carrying the reason
  AND if the shop's setting is STRICT, no override is offered and the sale is blocked
```
```
GIVEN no network and an offline debt cap of 20 000 ֏
WHEN  a queued debt sale would take that customer past the cap for this outage
THEN  the client shows offline-debt-cap and offers cash instead
WHEN  a queued debt sale within the cap later syncs and breaches the real limit
THEN  the server returns 200, accepts the sale, emits credit-limit-exceeded-on-sync
        as a WARNING, and writes a ReviewFlag to the owner's needs-attention list
  AND the sale is NEVER rejected or discarded
```

### AC-4 · Take Repayment
```
GIVEN Դավիթ owes 45 000 ֏ across charges of 30 000 (90 d), 10 000 (40 d) and 5 000 (8 d)
WHEN  the worker records a 35 000 ֏ CASH repayment with no manual override
THEN  a DebtEntry of type PAYMENT for 35 000 is written
  AND DebtAllocation rows clear the 30 000 charge in full and 5 000 of the 10 000 charge
  AND a CashMovement of type REPAYMENT for 35 000 is written against the open shift
  AND sum(allocations) + credit == payment exactly
  AND the screen shows charges being crossed off oldest first
  AND the word "allocation" appears NOWHERE in the UI
  AND a receipt prints
```
```
GIVEN the same customer owing 45 000 ֏
WHEN  a 50 000 ֏ repayment is recorded
THEN  45 000 is allocated and 5 000 is posted as a credit ADJUSTMENT
  AND NEVER as a negative charge
```
```
GIVEN a repayment recorded against the wrong customer, already committed
WHEN  correction is requested
THEN  an ADMIN posts a LINKED reversing DebtEntry (reversesId)
  AND the original entry is NEITHER edited NOR deleted
```

### AC-5 · Record Return
```
GIVEN a COMPLETED sale with a line of 10 pieces, of which 4 have already been returned
WHEN  a return of 7 is attempted against that line
THEN  422 return-exceeds-sold, showing the 6 remaining
  AND the check is PER SALE LINE — two half-returns must not pass a whole-sale test
WHEN  a return of 6 is recorded, 4 restocked and 2 damaged
THEN  a SALE_RETURN movement of +4 posts at the unitCostMdram COPIED FROM THE
        ORIGINAL SALE LINE — never the current average
  AND a WRITE_OFF movement of +0/−2 posts with a required reasonCode
  AND the restock decision is per line, because one return can do both
  AND the user was asked only "Ապրանքը վերադարձվե՞ց պահեստ?" — never SALE_RETURN vs WRITE_OFF
```
```
GIVEN the original sale was a DEBT sale
WHEN  the return is recorded
THEN  a credit ADJUSTMENT is allocated against the original charge via
        DebtAllocation.creditEntryId
  AND NO cash leaves the drawer
  AND Simon chooses this automatically and SAYS SO
```
```
GIVEN a customer with goods and no receipt
WHEN  a WORKER attempts a blind return
THEN  403 not-permitted, naming the role required
  AND an ADMIN may record it, valued at the CURRENT average
```

### AC-6 · Close Shift
```
GIVEN an OPEN shift with openingFloat 20 000, cash sales 150 000, cash repayments 25 000,
      a PAY_IN of 3 000, a PAY_OUT of 10 000 and a NO_SALE
WHEN  close is begun
THEN  expected = 20 000 + 150 000 + 25 000 + 3 000 − 10 000 = 188 000
  AND every term after openingFloat is a QUERY OVER ROWS, not a running total
  AND repayments are counted EXACTLY ONCE, as REPAYMENT cash movements —
        never additionally as pay-ins
  AND NO_SALE carries amount = 0 and cannot move the figure
WHEN  the worker counts by denomination and enters 187 600
THEN  variance = −400 is displayed NEUTRALLY: "Տարբերություն: −400 ֏"
  AND never "Missing", never "Shortage", never a red alarm
  AND a large variance PROMPTS for a note rather than demanding an explanation
  AND closing requires a HARD CONFIRM
  AND on close: Shift → CLOSED, a Z-report is issued, and every session bound to
        the shift ends
  AND a sale that arrived by held-basket transfer is LISTED SEPARATELY on the Z-report
```
```
GIVEN this shift has a HELD basket
WHEN  close is begun
THEN  422 shift-has-open-baskets, listing them by time and first item
  AND ONLY THIS SHIFT's baskets are listed — one another till has picked up is no
        longer here, and one till's open basket never blocks another till's close
```
```
GIVEN unsynced sales in the outbox
WHEN  close is begun
THEN  explicit acknowledgement is required, because the Z-report would be incomplete
```

### AC-7 · Receive Goods
```
GIVEN 10 units on hand at an average of 12 000 mdram
  AND an invoice for 10 units at 14 000 mdram plus a 3 000 ֏ delivery charge
WHEN  the receipt is submitted
THEN  the delivery charge is apportioned across the lines BY VALUE
  AND PURCHASE_RECEIPT movements, the recalculated weighted average, the supplier
        payable and the audit row commit in ONE transaction
  AND the stock read that informs the write happens INSIDE that transaction
  AND the resulting avgCostMdram is rounded half-up to a whole milli-dram
  AND a STOCK token sees ONLY the invoice costs it typed — never the resulting average,
        never the margin, never the supplier's terms
  AND receiving 3 spools of 50 m posts 150 m of stock, invisibly and automatically
```
```
GIVEN no network
WHEN  receiving is opened
THEN  it is blocked CLEARLY (offline-not-available)
  AND this is the one place the "never block" rule yields, because the shop is not
      selling on this screen
```

### AC-8 · Record Purchase Return
```
GIVEN 10 units at 12 ֏, then a delivery of 10 at 14 ֏, giving 20 at an average of 13
WHEN  that whole delivery is returned to the supplier
THEN  the movements post at the RECEIPT'S LANDED unit cost, not the current average
  AND newAvgCost = (20×13 − 10×14) ÷ (20−10) = 12 — the shop is back where it started
  AND the apportioned freight is NOT refunded: it is recorded as
        PurchaseReturn.landedCostLost, never absorbed silently into the average
  AND a supplier credit is allocated to the original receipt
  AND all of it commits in one transaction
```
```
GIVEN stockQty − returnQty ≤ 0
WHEN  the return is posted
THEN  the average-cost formula is NOT evaluated
  AND the existing average stands
  AND the movement is FLAGGED — an average describing goods the system no longer
      holds is not evidence about anything
```

### AC-9 · Sell an item with zero stock
```
GIVEN Product P with stockQty = 0 and the shop's default (non-strict) setting
WHEN  a sale including P is completed
THEN  the sale COMPLETES
  AND a StockMovement is written taking stockQty negative
  AND a ReviewFlag of type NEGATIVE_STOCK is written — and THAT ROW IS THE RECOUNT LIST
  AND the response is 200 with an insufficient-stock WARNING, never a 422
  AND COGS uses the last known average
  AND the same `type` is NEVER both a warning and a blocking error
WHEN  the shop has switched to strict
THEN  422 insufficient-stock-strict, and an admin must adjust stock first
```

### AC-10 · Change Price
```
GIVEN Product P priced at 1 100 ֏ and an ADMIN session
WHEN  the price is changed to 1 200 ֏
THEN  admin RE-AUTHENTICATION is required
  AND a PriceHistory row and an AuditLog row (before/after/actor/timestamp) are written
  AND the previous price stays visible as "was 1 100 ֏ until 12 March"
  AND a HELD sale already carrying a line for P is UNAFFECTED — the line snapshotted
      its price
  AND the operation is unavailable offline
  AND if two admins edit in the same minute, LAST WRITE WINS and both edits survive
      in PriceHistory and AuditLog — a decision, not an omission
```

### AC-11 · Field-level authorization (cross-cutting, and the commercially expensive one)
```
GIVEN a WORKER token
WHEN  ANY endpoint returns a product, a sale line, a report, an export or an error
      that echoes a record
THEN  avgCostMdram, margin and supplier payment terms are ABSENT from the payload
  AND absent means absent, not null and not zero
  AND no raw ORM object is ever returned
GIVEN a STOCK token
WHEN  it reads or writes GoodsReceiptLine.unitCostMdram or PurchaseOrderLine.unitCostMdram
THEN  the value is permitted — the number is on the paper in the user's hand
  AND the exception extends to NOTHING else: not Product.avgCostMdram, not
      SaleLine.unitCostMdram, not any margin, COGS or valuation report
GIVEN any non-ADMIN token
WHEN  /api/audit-log is requested
THEN  403 — the route is gated WHOLE, because AuditLog.before/after hold record
      snapshots as JSON and no field filter can see inside them
  AND anything that stores a record snapshot inherits that rule
```

---

## 5. **[Business Analyst]** — Findings: where the specification does not yet decide

These are the stickies I would put on the wall in red and refuse to take down.

### F1 — "Line price override, **if permitted**" is undefined, and it bypasses the discount cap
§6.1 offers *"long-press a line → price override, if permitted; requires a reason."* §12.1 caps discounts at a configurable maximum (default 5%) and requires an admin PIN above it. **Nothing binds the two.** A worker who can set a line price to 900 ֏ on a 1 200 ֏ item has granted a 25% discount without touching the discount control. Either the override is gated by the same cap and the same admin PIN, or the cap is decorative. §16.1 names *"a worker … discounting their own sales to cover cash theft"* as threat #2, and this is the open door to it. **This is the single most important unresolved authorization question in the sell cycle.**

### F2 — `STOCK` can *write* the number that moves the owner's margin, and never sees the result
§16.5's exception is well-argued for **reading**: concealing a number someone is currently typing is theatre. But writing `GoodsReceiptLine.unitCostMdram` moves `Product.avgCostMdram`, which moves every margin the owner sees, and the `STOCK` user is structurally unable to notice they have done it — they cannot see the resulting average by design. There is **no cost-variance alert** ("this receipt's unit cost is 40% above the last one for this product") anywhere in §6.7, §13.2 or §20.2. A read control without a corresponding write control on a derived figure is a half-closed door. **Recommend: a `ReviewFlag` type for anomalous receipt cost, surfaced on the owner's needs-attention list.**

### F3 — The offline debt cap is a UI convention, not a control
§6.11's 20 000 ֏ offline cap is enforced on the client, which is the only place it *can* be enforced. §14.6 then says the server accepts and flags whatever arrives. So the cap bounds an honest client and nothing else. That is probably the right trade (rule 1 demands it), **but it should be written down as a deliberate acceptance, not left looking like a control**, and the owner's needs-attention list is the compensating detective control. Worth a line in §16.1's threat model, which currently does not mention it.

### F4 — Blind returns are gated; ordinary returns are not, and nothing counts them
§6.5 correctly makes blind returns admin-only — *"the classic fraud path."* But a return against a **genuine old sale** is a `WORKER` command that takes cash out of the drawer, gated only by a hard confirm, and the per-line quantity check is the only limit. §12.1 gives discounts a dedicated countermeasure — *"the discount-by-worker report exists because of it"* — and §20.2 has no equivalent **returns-by-worker** report. Repeated small returns against real sales are the same shrinkage route with less friction. **Recommend: a returns-by-worker report, and a `ReviewFlag` above a configurable per-shift refund total.**

### F5 — `NO_SALE` requires an admin PIN, and that may violate rule 1
§16.3 lists *"opening the drawer outside a sale"* among the actions requiring admin re-auth. In a shop where Գոռ is alone and Արամ is at home, a customer wanting change for a note cannot be served. Opening the drawer is the classic legitimate no-sale action **and** the classic theft action, so the tension is real — but the current rule resolves it toward "the queue stops," which is what design rule 1 forbids. **Recommend: allow `NO_SALE` on a `WORKER` token, require a coded reason, and put every `NO_SALE` on the Z-report and the owner's home.** Detective, not preventive — the same trade §13.6 makes for negative stock.

### F6 — A held basket can be pulled by any user on any open shift, with no re-auth
§11 makes the guard *"any open shift"*, deliberately, so a dead battery costs nothing. The compensations are real: an audit row, and separate listing on the Z-report. But the **command itself has no ownership check** — Գոռ can complete Անի's parked basket and the takings land in Գոռ's drawer. §16.1's threat #2 is about exactly this kind of muddying. **This is a deliberate design choice and should stay**, but it belongs in §16.1's threat list with its compensating controls named, rather than only in §11's guard column.

### F7 — `WORKER` sets the selling price of a product that did not exist ten seconds ago
Quick-add (§7.4) lets the least-privileged role create a catalogue row with a **price** and no cost. That is right — rule 1, and A2 says nobody will type in 3 000 products — but it means a worker can create, price and sell an item in one motion, and the shop has **no cost basis for that line ever**. The compensating control (the "needs detail" list being the default view of §6.12) is good and should be called out as a *control*, not just as an onboarding convenience.

### F8 — No actor owns cache reprojection
Repeated from §1.3 because it is a requirements gap, not just a missing sticky. `Product.stockQty` and the debt balances are declared rebuildable caches; §4.3 promises the owner a drift alert; **no command, actor or schedule produces it.** Either a scheduled `Recompute Cached Balances` exists and can be triggered by the owner, or the alert in §4.3 can never fire.

### F9 — Role boundary: genuine business rule vs UI convenience

**[Business Analyst]** Worth separating explicitly, because the two get enforced in different places and only one of them is security.

| Boundary | Verdict |
|:--|:--|
| Cost / margin / supplier terms stripped for non-`ADMIN` | **Business rule.** Server-side, §16.5. *"Hiding cost in the UI is not a control."* |
| Audit log gated as a whole route | **Business rule**, and the one place the control is the endpoint rather than the field |
| Set/raise credit limit, block customer — `ADMIN` | **Business rule.** These two fields are the only things bounding debt |
| Blind return — `ADMIN` | **Business rule.** Named fraud path |
| Price change — `ADMIN` + re-auth | **Business rule** |
| Discount above cap — `ADMIN` PIN + reason | **Business rule.** Named shrinkage vector |
| Stock adjustment — re-auth | **Business rule** |
| Receiving — `STOCK`/`ADMIN` | **Business rule**, but only weakly: the real control is that receiving is online-only and fully audited |
| `STOCK` gets no extra nav tab; receiving lives inside Պահեստ | **UI convenience.** §5.1: *"the role adds capability, not navigation"* |
| Owner destinations "absent, not disabled" for a worker | **UI convenience.** Real enforcement is the server; absence is a §5.1 design rule about *concepts*, not a permission |
| `WORKER` may create a customer (name + phone only) | **Deliberate hole in a business rule**, justified by rule 1 — and bounded, because the *limit* is not theirs to set |
| Line price override "if permitted" | **UNDECIDED — see F1** |
| `NO_SALE` requires admin | **Probably an over-tight business rule — see F5** |

---

## 6. **[Business Analyst]** — Commands that must be reversals, never deletes

Collected in one place, because this is where a developer under time pressure reaches for `DELETE`:

| Instead of | The product offers | Why |
|:--|:--|:--|
| Delete a completed sale | **Linked `SaleReturn`**, full or partial | §6.5, §10.7. `COMPLETED` has no outgoing edge at all |
| Delete an abandoned basket | **Void** (`DRAFT`/`HELD` → `VOIDED`) | Nothing was posted, so nothing to reverse — but an abandoned basket is worth being able to see |
| Delete a product | **Deactivate** | Keeps appearing in history and reports |
| Delete a barcode | **Retire** | A code on a two-year-old label must still scan. There is no delete endpoint |
| Delete a customer | **Deactivate**, or **anonymise** for a data-subject request (ledger amounts survive) | §6.13, §19.6 |
| Merge two customer records | **Merge** — re-points every `DebtEntry`, sets `mergedIntoId`, audits | *"Never a delete, and never re-typing a balance by hand"* |
| Edit a wrong repayment | **Linked reversing `DebtEntry`** | §10.7 |
| Edit a receipt against the wrong supplier | **Linked correction** | §6.14 |
| Delete a session | **Revoke** (`revokedAt`) | The record of who was signed in, where, until when — what an owner needs after a theft |
| Reverse an approved stocktake | **A further adjustment** | §11: approval is irreversible |
| Change `stockUom` / `decimalPlaces` after movements | **Blocked outright**; add a `ProductUnit` | It reinterprets every historical quantity |

---

## 7. **[Business Analyst]** — Commands requiring elevation, in one list

| Command | Elevation | Extra requirement |
|:--|:--|:--|
| Apply a discount above the cap | `ADMIN` PIN re-auth | **Typed reason** + hard confirm + audit |
| Override a credit limit | `ADMIN` PIN re-auth | **Typed reason** + hard confirm + audit |
| Blind return (no original sale) | `ADMIN` role | Audit |
| Change a price | `ADMIN` role + re-auth | `PriceHistory` + audit |
| Adjust stock | re-auth | Audit |
| Open the drawer outside a sale | re-auth *(**F5** — questioned)* | `NO_SALE`, amount 0 |
| Set or raise a credit limit, block a customer | `ADMIN` role | Audit; reason when done mid-sale |
| Merge customers | `ADMIN` role | Audit |
| Blind purchase return | `ADMIN` role | Valued at current average |
| Read the audit log | `ADMIN` role | **Route-level**, not field-level |
| Users, settings, categories, cost-bearing reports | `ADMIN` role | Every route |
| Unlock a locked account | any `ADMIN`, one action | Or 15-min expiry, or the owner's single-use recovery code |

**[Business Analyst]** And the invariant that makes all of this usable at a counter: **a re-authentication prompt never discards a basket** (§16.3). It sits on top of one. Any implementation where elevation navigates away has broken the till.
