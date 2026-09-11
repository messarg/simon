# Event Storm: Simon — the full buy–sell cycle

**Date:** 2026-09-10
**Mode:** full-simulation (5 personas, 6 phases)
**Scope:** multiple bounded contexts
**Participants:** AI-simulated — Domain Expert, Developer, Business Analyst, Product Owner, Devil's Advocate
**Source of truth:** `docs/prd.md` v3.47 (commit `4dd4d5a`, 3 227 lines) and `CLAUDE.md`

---

## Executive summary

Five personas explored the buy–sell cycle independently, then the synthesis was put back to the
Devil's Advocate to attack. The storm produced roughly **250 distinct events**, a
**seven-context** model, and — the useful output — **a ranked list of decisions the PRD has not
yet made**, separated from the much longer list it has.

Three things are worth knowing before reading further.

**The PRD is unusually good, and that is why the findings are sharp.** It states its invariants
precisely enough to be caught contradicting them. Almost nothing below is "the spec is vague";
most findings are of the form "§X and §Y are both emphatic and they disagree", with line numbers.

**The most valuable findings came from single personas, not from consensus.** Ranking hot spots
by how many personas independently hit them — which was the first synthesis's approach —
systematically demoted the defects only one persona was equipped to see. That ranking was
discarded during Phase 6 in favour of **irreversibility × undetectability**: does getting this
wrong write permanently incorrect rows, and would anyone notice? The current ranking uses that
axis.

**One Phase 5 conclusion was overturned in Phase 6 and the reversal is load-bearing.** The
initial model made costing a *shared kernel* in `packages/shared`. The Devil's Advocate showed
that the weighted average is not a pure function but a stateful ordered fold over the ledger,
and produced the receipt: §13.7 says of purchase-return costing that it is *"the one v1 document
whose costing rule was never written down"* — which is precisely the failure the Product Owner
feared (costing built as a side effect of a receipt handler), already observed in the source
document. Costing now lives in the Stock Ledger context. See [A-5](#a-5).

---

## How to read this document

Contributions carry their source: **[DE]** Domain Expert · **[DEV]** Developer ·
**[BA]** Business Analyst · **[PO]** Product Owner · **[DA]** Devil's Advocate ·
**[SYN]** synthesis · **[VERIFIED]** checked directly against the PRD or by arithmetic during
synthesis, not taken on a persona's word.

Sticky colours follow the skill's convention: 🟧 event · 🟦 command · 🟨 actor ·
🟪 policy · 🟩 read model · 🩷 external system · ❗ hot spot.

---

## Bounded contexts

Seven contexts, plus three things that deliberately are **not** contexts. The boundary evidence
is linguistic: a term that changes meaning across a line confirms the line.

| # | Context | Type | Owns | Key events |
|:--|:--|:--|:--|:--|
| C1 | **Catalogue & Product Identity** | Supporting | Product, ProductBarcode, ProductUnit, Category, PriceHistory | Barcode Retired · Price Changed · Product Deactivated · Product Quick-Added Mid-Sale |
| C2 | **Selling / Checkout** | **Core** | Sale, SaleLine, Payment | Item Scanned · Sale Completed · Basket Parked · Discount Above Cap Authorised |
| C3 | **Credit / Nisya** | **Core** (differentiator) | Customer, DebtEntry, DebtAllocation | Debt Sale Recorded · Debt Partially Repaid · Payment Allocated Oldest-First · Debt Crossed Into 90+ Days |
| C4 | **Cash & Shift** | **Core** | Shift, CashMovement | Shift Opened · Cash Counted By Denomination · Cash Variance Recorded · Z-Report Issued |
| C5 | **Stock Ledger & Costing** | **Core** | StockMovement, `stockQty`, `avgCostMdram`, Stocktake (v2) | Stock Movement Posted · Weighted Average Recomputed · Stock Went Negative · Ledger-vs-Cache Drift Detected |
| C6 | **Procurement & Supplier** | Supporting | Supplier, GoodsReceipt, PurchaseReturn, SupplierPayment, PO (v2) | Delivery Arrived Unannounced · Delivery Charge Spread Across The Goods · Goods Returned To Supplier |
| C7 | **Sync & Device** | Supporting (technical) | Outbox, idempotency, Device registry, receipt numbering | Sale Queued In Outbox · Idempotent Replay Detected · Outbox Head Blocked · Sale Synced |

### What is deliberately not a context

**Money & unit arithmetic = a Shared Kernel.** `packages/shared` — rounding, dram/milli-dram
conversion, tax extraction, apportionment by value, UoM conversion. Stateless, no aggregate.
`CLAUDE.md` already names this as "the load-bearing reason this is a monorepo: the money rules
must exist exactly once". **[SYN]**

**Allocation = a Shared Kernel too, and this one is currently missing.** **[DA]** §11 says
`SupplierAllocation` is *"deliberately the same shape as `DebtAllocation`"*. Oldest-first,
overpayment becomes a credit `ADJUSTMENT`, `amount ≤ remaining balance`, aging from the charge
date — that genuinely is a pure function `(charges, payment, strategy) → allocations`. It
currently sits in two contexts (C3 and C6) where it will be written twice and diverge. It is
more kernel-shaped than costing ever was.

**Identity, Roles & Audit = a cross-cutting policy**, enforced in response shaping, not a
context. **[PO]** Field stripping must be in the response shaping of the *first* endpoint or it
will be missed on exactly one route — and that one is the leak.

**`ReviewFlag` = cross-cutting notification, beside Audit.** **[DA]** Its four types span three
contexts (`NEGATIVE_STOCK` and `LEDGER_CACHE_DRIFT` → C5, `CREDIT_LIMIT_ON_SYNC` → C3,
`PRODUCT_DEACTIVATED_ON_SYNC` → C1). Housing it inside the Stock Ledger would make Credit depend
on Stock for a reason with no stock in it.

**Reporting = read-side projections**, owns no writes. **Fiscal = a reserved seam**, v2.

### Context map

```
                        ┌──────────────────────────┐
                        │  C1 Catalogue & Identity │
                        └───────────┬──────────────┘
                                    │ published language:
                                    │ product, price, barcode, unit
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
      ┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐
      │ C2 Selling       │  │ C3 Credit    │  │ C6 Procurement   │
      │    /Checkout     │─▶│    /Nisya    │  │    & Supplier    │
      └────────┬─────────┘  └──────┬───────┘  └────────┬─────────┘
               │                   │                   │
               │  ═══ posts movements / entries ═══    │
               ▼                   ▼                   ▼
      ┌────────────────────────────────────────────────────────┐
      │ C5 Stock Ledger & Costing   (published language:       │
      │    StockMovement{type,qtyDelta,unitCost,balanceAfter,  │
      │                  sourceType,sourceId})                 │
      └────────────────────────────────────────────────────────┘
               │                   │
               ▼                   ▼
      ┌──────────────────┐  ┌──────────────────────────────────┐
      │ C4 Cash & Shift  │  │ Reporting (read models only)      │
      └──────────────────┘  └──────────────────────────────────┘

      C7 Sync & Device wraps C2/C3/C4 at the device↔host seam —
      four idempotent POSTs. Every hard problem lives here. [DEV]
```

| Upstream | Downstream | Relationship |
|:--|:--|:--|
| C1 Catalogue | C2, C3, C6 | Published Language — product/price/unit shape |
| C2 Selling, C3 Credit, C6 Procurement | C5 Stock Ledger | Customer–Supplier; the ledger publishes the movement contract, everyone conforms |
| C2 Selling, C3 Credit | C4 Cash & Shift | Customer–Supplier — Shift **owns drawer truth**, Selling posts into it **[PO]** |
| C6 Procurement | C2 Selling | via C5 — `WeightedAverageRecomputed` → `UnitCostSnapshotted`. **The single most expensive coupling in the system** **[BA]** |
| everything | Reporting | Conformist, read-only |
| C7 Sync | C2, C3, C4 | Anti-corruption layer at the device↔host seam |

### Pivot events — where the language changes

**[SYN]** These are the five places to watch, because a mistake at a pivot is silent.

1. `WeightedAverageRecomputed` (C6→C5) → `UnitCostSnapshotted` (C5→C2). The receipt sets the
   number the sale freezes. Get Monday's apportionment wrong and every margin after it is
   wrong, with nothing on screen saying so. **[BA]**
2. `SaleCompleted` with `Payment.method = DEBT` → `DebtChargePosted` (C2→C3). The same money is
   recorded in two ledgers in one transaction, and **nothing says which is authoritative** for
   revenue versus balance. Any sum across both doubles it. **[DE]**
3. `DebtPaymentRecorded` in cash → `CashMovementRecorded(REPAYMENT)` (C3→C4). That row, never
   the debt entry, is what the drawer counts (§12.3).
4. `SaleCompleted` → `StockMovementPosted` (C2→C5).
5. `SaleQueuedInOutbox` → `SaleAccepted` (device→host, C7).

### The term that proves the boundaries

**[DE][VERIFIED]** `unitCostMdram` means three different things in three models, and each
meaning belongs to a different context — which confirms the boundaries rather than undermining
them:

| Model | Meaning | Context |
|:--|:--|:--|
| `SaleLine.unitCostMdram` | the weighted average at the moment of sale | C2 Selling |
| `GoodsReceiptLine.unitCostMdram` | the **invoice** cost (freight is separate, in `apportionedLandedCost`) | C6 Procurement |
| `PurchaseReturnLine.unitCostMdram` | the **landed** cost — invoice *plus* freight (§11, line 1888) | C6 Procurement |

The first two are a boundary signal. **The second and third are a naming bug**: same name, same
document family, invoice cost in one row and invoice-plus-freight in the other, and §13.7's
entire costing rule turns on which one you grabbed. **[DA]** Rename per role before either is
implemented.

---

## Event timelines

### Happy path — the sell cycle

```
🟨 Գոռ (WORKER)
🟦 Sign In (PIN, verified server-side)      → 🟧 Worker Signed In · Session Opened
🟦 Open Shift (count float, one number)     → 🟧 Opening Float Counted · Shift Opened

┌─ per customer ──────────────────────────────────────────────────────────┐
│ 🟦 Scan Item ×n     → 🟧 Item Scanned → Barcode Resolved From Cache      │
│                       → 🟧 Basket Started (first line) / Line Incremented│
│                       ⏱ budget: scan → line rendered < 200 ms p95       │
│ 🟦 Tap ՎՃԱՐԵԼ → ԿԱՆԽԻԿ                                                  │
│                     → 🟧 Change Computed · Cash Rounding Applied         │
│                     → 🟧 SALE COMPLETED  ══ ONE TRANSACTION ══           │
│                          sale → lines → payments → stock movements       │
│                          → debt charge (if any) → review flags → audit   │
│                     → 🟧 Unit Cost Snapshotted (server-authoritative)    │
│                     → 🟧 Price Basis Snapshotted                         │
│                     → 🟧 Receipt Number Assigned ON DEVICE {prefix}-{seq}│
│                     ── commit boundary ──────────────────────────────    │
│                     → 🟧 Receipt Printed        (after commit, never in) │
│                     → 🟧 Cash Drawer Pulse      (separate ESC/POS cmd)   │
└─────────────────────────────────────────────────────────────────────────┘

🟦 Begin Shift Close  → 🟧 Expected Cash Computed  (a QUERY over rows,
                                                    never a running total)
🟦 Count Cash         → 🟧 Cash Counted By Denomination
🟦 Close Shift        → 🟧 Cash Variance Recorded  («Տարբերություն −400 ֏»,
                                                    neutral, never "missing")
                      → 🟧 Shift Closed · Z-Report Issued · Sessions Ended
```

🟪 **Policy** — whenever a shift closes → every session bound to it ends.
🟪 **Policy** — whenever a cash repayment is taken → a `REPAYMENT` cash movement is written,
and that row alone counts toward the drawer.

### Happy path — the buy cycle

```
🟨 Supplier's driver 🩷 arrives UNANNOUNCED with a paper invoice
   (this is the PRIMARY path, not the exception — assumption A1)

🟨 STOCK / ADMIN
🟦 Receive Goods (Ընդունում)          ✋ BLOCKED OFFLINE — needs authoritative stock
🟦 Enter qty + unit cost from the invoice
     → 🟧 Purchase Unit Converted To Stock Unit  (3 spools × 50 m posts 150 m)
🟦 Enter Առաքման ծախս (delivery charge)
     → 🟧 Landed Cost Apportioned BY VALUE   ← before the average moves
🟦 Submit                              ══ ONE TRANSACTION ══
     → 🟧 Goods Receipt Posted
     → 🟧 Stock Movements Posted (PURCHASE_RECEIPT)
     → 🟧 Weighted Average Recomputed   (round half-up, once, on store)
     → 🟧 Supplier Payable Created
     → 🟧 Audit Row Written

   [Throughout: the STOCK user never sees the resulting average — only the
    invoice costs they typed themselves. §16.5, and see hot spot C-3.]
```

### Exception path — the outage that defines the architecture

```
18:40  🟧 Reachability Probe Failed        (NOT navigator.onLine — it lies
                                            on shop Wi-Fi: associated, no route)
       🟧 Connection State Changed → offline
       ── the worker keeps selling; rule 1 says the till never blocks ──
18:45  🟦 Take Cash Payment
       → 🟧 Sale Id Generated (UUIDv7, client-side, BEFORE any network)
       → 🟧 Receipt Number Assigned On Device
       → 🟧 Sale Queued In Outbox     ══ ONE IndexedDB TRANSACTION ══
             advance lastSequence + write outbox row + clear basket
             (split these and a crash reissues a receipt number)
19:00  🟦 Close Shift → 🟧 Unsynced Sales Acknowledged (unsyncedAtClose = 4)
       → 🟧 Z-Report Issued          ← printed, cash counted
19:20  🟧 Reachability Probe Succeeded
       → 🟧 Outbox Drain Started (FIFO, serial)
       → 🟧 Sale Accepted (200 + warnings[] read back from ReviewFlag rows)
       ❗ …naming a shift that is now CLOSED.  See hot spot A-1.
```

---

## Hot spots

Ranked by **irreversibility × undetectability**, not by how many personas found them. Tier A
items write permanently wrong rows or fix a protocol; Tier B are architectural; Tier C are
policy and can land at week ten for the same cost as week one.

### Tier A — settle before the code that touches them

<a name="a-1"></a>
#### A-1 · A sale belongs to a drawer *and* to a period, and offline guarantees they diverge — **CRITICAL**
**[DA][DE][DEV][BA] — all five personas reached this from different directions**

§11 (line 2029): `Sale.shiftId` *"Names an **OPEN** shift at every write, and must not change
once `status = COMPLETED`."* §6.6 (line 953) designs for closing with unsynced sales. §11
(line 1902) *counts* them in `unsyncedAtClose`. §14.2 guarantee 1: *"A completed sale is never
lost."*

**The PRD explicitly designs for, counts, and prints the case its own validation rule makes
unpostable.** Every exit is blocked: reject → violates §14.2 (and a `422` is never retried per
§14.4, so it dies unresolvable); accept against the closed shift → violates line 2029 and
rewrites a printed Z-report; re-point → violates the frozen-`shiftId` rule and puts yesterday's
takings in today's drawer.

**This is a missing entity, not a wording problem** — there is no concept of an accounting
period distinct from a drawer session, and `Sale.shiftId` conflates them. Applies identically to
`POST /cash-movements` and to offline repayments.

**Bundled with it: two workers, one drawer.** **[DE][DA]** `Shift` has `userId` and **no
`deviceId`**; the guard is only *"no other `OPEN` shift for this user"*. But the drawer is
physical, opens via the printer's kick-out port, and §21 budgets for *three tills selling
simultaneously*. Two shifts against one cash box makes `expectedCash` meaningless for both and
dumps the variance on whoever closes last. **This is the same defect** — the shift model does
not know what a drawer is — and solving A-1 without it will foreclose the fix. **[DA]**

<a name="a-2"></a>
#### A-2 · Nobody owns the clock, and the ledger has no stated replay order — **CRITICAL**
**[DEV][DA][VERIFIED]**

`Sale.createdAt`, `DebtEntry.createdAt` and the UUIDv7 sort order all come from the *device*.
Nothing says whether the client's or the server's clock supplies them, and nothing validates
skew. **[VERIFIED] "timezone" occurs zero times in 3 227 lines**; `TZ=Asia/Yerevan` is pinned
only in `vitest.config.ts`, never on the host, and §6.11 has no setting for it.

Four consequences, each with money attached:

- a debt charge from a device a month fast lands straight in the 30-day aging bucket, and
  §27.5 ("aging matches the paper book") fails for reasons nobody will find;
- a sale dated after midnight lands in tomorrow's daily report while its `shiftId` says
  yesterday's shift, so the two reports the owner compares disagree;
- `StockMovement.balanceAfter` is assigned at *post* time but the index is
  `(productId, createdAt)` — read in event order, `balanceAfter` jumps backwards;
- **§10.4's drift job asserts cache == replay. In which order?** If by `createdAt`, every
  late-syncing sale raises a spurious `LEDGER_CACHE_DRIFT` — one of only three alerts that
  reach the owner. An alert that fires on ordinary Wi-Fi drops is muted by week two, and then
  the real drift arrives silently.

Armenia has no DST, which makes a misconfiguration a one-time silent error rather than a
twice-yearly visible one — *less* likely to be noticed, not more.

<a name="a-3"></a>
#### A-3 · The client is the authority on price, discount and line total — **CRITICAL**
**[DA][BA][DEV]**

`POST /api/sales` carries lines with `unitPriceMdram`, `discountAmount`, `lineTotal` and
`priceOverridden`. **Nowhere does the PRD say the server recomputes or validates the money on an
incoming sale.**

If it trusts the client, §12.1's discount cap is a client-side control and anyone on the LAN
with `curl` gets 100% discounts. §16.6 states in bold that *"CORS is not a security control"*
and then leaves the money field unguarded. §16.5 spends a page on *"hiding cost in the UI is not
a control"* — for **reading**. This is the same principle applied to **writing**, and it is the
more expensive direction. §27.9 tests the read side; nothing tests the write side.

**Compounding it** **[BA]**: §6.1's line price override is gated only by *"if permitted"* and is
**unbound to** §12.1's discount cap. Setting a 1 200 ֏ line to 900 ֏ is a 25% discount that
never touches the discount control and never appears in the discount-by-worker report that
exists precisely to catch it. §16.1 ranks this as threat #2.

**The Developer independently prescribed the fix**: `unitCostMdram` is never sent — the server
snapshots the authoritative average — *"a client-supplied cost would be both a trust hole and a
cost leak."* Extend that rule to price, discount and line total, or say in one sentence why not.

<a name="a-4"></a>
#### A-4 · `avgCostMdram = 0` means both "free" and "unknown" — **CRITICAL, and the cheapest fix in the document**
**[DA][DE][BA][VERIFIED]**

`Product.avgCostMdram` is **NOT NULL** (the `?` convention marks nullables; it has none). Yet
§6.12's *default screen* is the needs-detail list showing «⚠ ինքնարժեքը լրացված չէ» — *cost not
filled in* — for quick-add products. **The PRD's own primary screen displays a state the schema
cannot represent.**

A product quick-added at the till and sold five minutes later snapshots cost `0` onto the sale
line, permanently (§10.5). Consequences: 100% margin on those lines forever, unfixable per
[A-8](#a-8); the first real receipt computes
`(stockQty × 0 + receivedQty × cost) ÷ (stockQty + receivedQty)`, **diluting** true cost for as
long as that stock lasts; dead-stock and valuation reports value the shelf at nothing.

`sellPriceMdram` explicitly permits zero with a stated reason (*"a free sample still moves
stock"*). Nobody asked the same question of cost, where zero is almost never a fact and almost
always an absence. Make it nullable, teach the WAC to seed from the receipt when null (it
already has that branch for the non-positive denominator, §10.5 line 1747), and refuse to report
a margin on a line whose cost was unknown.

<a name="a-5"></a>
#### A-5 · The WAC state machine — a false average, an acceptance test that blesses it, and an unchecked cache — **CRITICAL**
**[DA][VERIFIED by arithmetic and by grep during synthesis]**

**Three findings that are one problem.**

**(i) §13.7's reversal formula is wrong whenever stock has turned over.** The PRD's worked
example has no sales between receipt and return — but you discover goods are wrong *by selling
one*.

| Step | Qty | Avg | Value |
|:--|--:|--:|--:|
| Opening | 10 | 12 | 120 |
| Receipt 10 @ 14 | 20 | 13 | 260 |
| **Sell 8** | 12 | 13 | 156 |
| Return the delivery, 10 @ landed 14 | 2 | **8** | 16 |

`(156 − 140) ÷ (12 − 10) = 8` — **below any price the shop has ever paid**, understated by a
third, and every margin on those units overstated to match. The denominator guard does not fire;
the numerator is positive; nothing flags. §13.7 warns about exactly this failure one paragraph
above the formula: *"it quietly misvalues every unit still on the shelf and every margin
reported after it."* It is not backwards — it is right for the clean case and wrong for the
ordinary one.

**(ii) §27.22 is worded so it can only pass in the lab.** *"Returning a delivery to a supplier
restores the weighted average to what it was **before that delivery arrived**"* — satisfiable
only with no intervening sale. The test will be written the way the criterion is worded, pass,
and certify the bug. `FR-BUY-06` names §27.22 as its **only** verification. **[VERIFIED]**

**(iii) `avgCostMdram` is a cache that nobody declared and nothing checks.** **[VERIFIED]** §10.4
declares only `Product.stockQty` a cached projection and runs the drift job against it.
`avgCostMdram` is never declared a cache anywhere in the PRD — yet every `StockMovement` carries
`unitCostMdram`, so **it is equally replayable**. Nobody said so, so nothing checks it, so the
8 ֏ average above would be verified never.

**This is why costing belongs inside C5 Stock Ledger and not in a kernel.** WAC is not a pure
function; it is a stateful ordered fold whose accumulator is `avgCostMdram`, with four branches
(normal receipt, non-positive denominator, §13.7 reversal, and the seed-when-unknown branch
[A-4](#a-4) requires). A kernel cannot own a branch that depends on ledger history — and calling
it a kernel puts the state somewhere else by default, which is the receipt handler. §13.7's own
admission that purchase-return costing is *"the one v1 document whose costing rule was never
written down"* is that failure, already observed. **One home, one replay, one drift check, both
columns.** **[DA]**

<a name="a-6"></a>
#### A-6 · `ProductUnit.factorToStockUom` is mutable — **CRITICAL**
**[DE][DA][VERIFIED]**

§6.12 blocks changing `stockUom` and `decimalPlaces` once movements exist, for a stated and good
reason. **`factorToStockUom`'s only validation is `> 0`.**

The supplier changes their spool from 50 m to 100 m, or the box from 24 to 20. Someone edits the
number. **Every historical goods receipt silently re-reads** — 3 boxes received last March
become 60 metres instead of 72 — replaying the ledger no longer reproduces the shelf, and a
§13.7 purchase return against an old receipt line reverses the wrong quantity.

The lesser, additive half: **`SaleLine` snapshots `uom` and `factorToStockUom`;
`GoodsReceiptLine` snapshots neither.** After commit the receipt says `150` and can no longer
say `3 spools`, so reconciling a delivery against the supplier's paper invoice — the actual
daily job, and §27.3's acceptance criterion — requires dividing by a factor stored on a mutable
row. The asymmetry is the tell: the selling side snapshotted the factor because someone thought
about reprints; the buying side did not.

<a name="a-7"></a>
#### A-7 · `DebtAllocation` — append-only or not? — **CRITICAL**
**[DA]**

§14.5 (line 2289): *"Repayment ✅ Additive; **allocation recomputed on sync**."* §11's Lifecycles
list of never-updated financial tables — `GoodsReceipt`, `SaleReturn`, `DebtEntry`,
`StockMovement`, `CashMovement` — **conspicuously omits `DebtAllocation`**. `CLAUDE.md` states
debt works append-only like stock. So the one financial table the PRD permits itself to rewrite
gets that permission in a table cell in a different section, contradicting a stated invariant.

And it is not merely permitted but *required*: two tills offline, one debtor, both allocating
oldest-first against the same 25 000 ֏ charge — on sync the allocations sum to 45 000, violating
`amount ≤ the remaining balance of its charge`. §14.6 says *accept and flag, never reject*, but
there is **no warning type, no `ReviewFlag` type, and no §8.5 `type`** to carry the outcome —
and §15.2 requires every warning to have durable state. The transaction must either reject
(breaking §14.6) or write a row violating its own CHECK constraint.

<a name="a-8"></a>
#### A-8 · Reversing documents are missing the fields their own contexts require — **CRITICAL**
**[DA][DE]**

Five independent defects cluster on `SaleReturn`, and they are all one symptom: the return
touches Cash, Credit, Stock and Tax, and was modelled as an appendix to `Sale`, so it inherited
none of their required fields.

| Missing | Consequence |
|:--|:--|
| **no `shiftId`** | A cash refund is **not in §12.5's expected-cash formula at all**, and `CashMovement.type` has no `REFUND`. A shift taking one 8 000 ֏ cash refund closes 8 000 ֏ short — «Տարբերություն −8 000 ֏» on the one screen §6.6 says exists to catch theft. *This is the same class of bug §12.5 congratulates itself for having fixed*: the sweep that found the repayment double-count never asked what was missing. |
| **no `taxRateBp` / `lineTax`** | The document that reverses tax does not record the tax it reversed, contradicting §10.8's own snapshot principle. Worse under a tax-exclusive basis, where `SaleReturn` also carries no `priceBasis`. |
| **one `refundMethod` on the header** vs many `Payment` rows per sale | A 30 000 cash + 20 000 nisya sale partially returned for 25 000: how much leaves the drawer? The header field **forecloses the pro-rata answer**. Both are v1 acceptance criteria (§27.2, §27.6). |
| **no sale-level discount apportionment** | A 100 000 ֏ basket with a 10% sale discount, one 20 000 ֏ line returned → refund 20 000 or 18 000? The first is a slow, deniable, per-transaction leak: buy discounted, return the expensive line. §10.1 was carefully corrected to admit sale-level discounts; §12.4 was never re-swept. |
| **no `reversesId` on the return itself** | A return keyed against the wrong line has no correction path — and the per-line quantity check then *blocks* the correct return. |

Plus the case §12.4's justification gets factually wrong: **a return against a settled nisya
sale.** *"Never money out of the drawer for goods that were never paid for"* — but he paid last
week. The charge's remaining balance is zero, so `DebtAllocation.amount ≤ remaining balance`
forbids the credit. Cash out, or an unallocated credit that no screen lists and no report ages?
Unstated, and it is money either way.

**Recommended resolution [DA]:** rather than splitting returns into their own context, make
**"reversing document" a Published Language** with a mandatory field checklist every reversing
document must satisfy — period *and* drawer, price basis, snapshotted tax rate, tender
breakdown, `reversesId`. The five defects then collapse into one review gate, and §6.14's
promise that sale returns and purchase returns share screen grammar gets a structural backing.

<a name="a-9"></a>
#### A-9 · Immutability without a restatement mechanism — **CRITICAL**
**[DA][DE]**

§10.5 makes the cost snapshot immutable and states it as a virtue: *"restocking at a new price
never rewrites last month's numbers."* Correct. But **immutability requires a restatement
mechanism, and the PRD treats immutability as sufficient on its own.**

`STOCK` types a delivery at 14 000 ֏/m instead of 1 400. The average moves. Two weeks of sales
snapshot it. The margin report says the shop is losing money on cable. Reversing and re-entering
the receipt fixes `avgCostMdram` **going forward**; every `SaleLine.unitCostMdram` written
meanwhile keeps the wrong figure **forever**.

There is no `CostCorrection` entity, no restatement movement, no acceptance criterion, and
§8.2's recovery table has a row for *"wrong price on a receipt"* and **none for "wrong cost"**.
The related real-world case **[DE]**: the supplier's price on the invoice differs from the price
agreed on the phone, argued about later, credit note next month — after the average moved twice.

<a name="a-10"></a>
#### A-10 · The HTTP layer's failure policy — three holes in one place — **CRITICAL**
**[DEV][DA]**

**(i) A `401` from the outbox drain is a 4xx.** §14.4: retry on network/5xx, *"never on other
4xx — park those and surface them."* So a completed, queued sale whose session expired before it
drained is parked as a permanent error and surfaced as a failure. **The one 4xx that is
transient is treated as permanent**, and §14.2's first guarantee is broken by a policy line.

**(ii) Head-of-line blocking is unspecified.** FIFO + serial + park-non-retryable does not say
whether a parked item *steps aside*. If it does not, one `422` on a debt sale freezes every
subsequent sale on that till — while the till keeps happily selling, because rule 1 says it
must.

**(iii) Ordering across endpoints is unguaranteed.** §14.4's ordering promise covers only the
two kinds of *sale*; §14.3 binds four endpoints. A `sale-return` draining ahead of its own sale
gets `404` — a 4xx — and dies in the needs-attention list for a race the queue could have
prevented. Related: **§14.5's normative offline table omits returns and cash movements
entirely**, though §14.3 names both as queue-drained.

**(iv) The online/offline model is binary, and the worst real failure is neither.** **[DA]** A
shop router at 40% packet loss keeps the till nominally "connected": §8.3's calm strip never
shows, the outbox never engages, and §21's 200 ms scan budget becomes a 30-second timeout on the
hottest path in the system. There is no stated timeout, no fast-fail threshold, no "treat as
offline after N failures". **This is the most likely field failure in the entire list and it has
no design.** Cheap now — one timeout plus a failure-count threshold in the HTTP layer; a
retrofit across every call site later. **[DEV]** `navigator.onLine` cannot detect it; the client
needs an application-level probe against `/health`.

### Tier B — architectural, settle before the code that touches them

**B-1 · Print, drawer kick and fiscal issue are not replay-safe and have no durable job model.**
**[DEV — ranked #1 technical risk]** These are at-most-once side effects hanging off an
at-least-once queue. A replayed sale POST is harmless; a replayed *print-and-kick* opens the
drawer twice, handing §16.1's threat #2 a mechanism. Printing must be a post-commit job keyed on
`saleId` with `PENDING/PRINTED/FAILED` state, not a call from the request handler. §12.1 says
"printing happens after commit" and stops there. The fiscal case is worse: **timeout with
unknown outcome** — the sale is committed, the ՀԴՄ may or may not have printed, retry
double-issues and no-retry under-reports, and a fiscal device is not idempotent unless its
protocol says so.

**B-2 · No actor owns cache reprojection or drift detection.** **[BA][DEV]** `Product.stockQty`
is declared a rebuildable cache and §4.3 promises the owner a drift alert
(«Պահեստը ստուգման կարիք ունի») — but **no command, actor or schedule produces it**. A cache
with no reprojection job is a cache that silently rots, and the promised alert can never fire.
Now doubled by [A-5](#a-5)(iii): `avgCostMdram` needs the same job.

**B-3 · Single-writer contention from the non-selling paths.** **[DEV]** Hourly `VACUUM INTO`
during trading hours, a whole-batch import (a 3 000-row batch in one transaction stops every
till), a customer merge, and the drift job all contend with three tills against SQLite's one
writer, while §21 forbids `SQLITE_BUSY` reaching a user. Recommendation: an in-process write
queue in front of Prisma, turning lock contention into bounded, measurable queue latency.
Related: §19.1's "never applies partially" reads as one transaction per import batch — make the
unit of atomicity the *row* instead and let `ImportRow.naturalKey` carry the idempotency, since
the guarantee users need is "never twice", not "all or nothing".

**B-4 · The outbox can be destroyed silently.** **[DEV]** IndexedDB is evictable on Android
unless `navigator.storage.persist()` is granted — nothing in the PRD requests it — and an
`onupgradeneeded` that recreates the object store instead of migrating it loses queued sales on
a Friday-evening deploy. Both violate §14.2 guarantee 1 without an error. Related: a restore
rewinds `Device.lastSequence`, which §11 line 2027 says *"the server never rewinds"*, and the
tills' outboxes are already empty — those sales drained before the crash, and nothing re-posts
them. **[DA]** The device should retain acknowledged sales for N days and offer "re-send
everything since {time}" in diagnostics: cheap now, impossible later.

**B-5 · Practice mode leaks through the device.** **[DA]** Practice is a second database keyed
on `Session.mode` — clean on the server. But **the outbox belongs to the `Device`, not the
session** (§11 is explicit), so nothing separates practice entries in the queue from real ones,
and a mode switch or logout drains a practice sale under a `LIVE` token into the real ledger.
Also unstated: whether a practice sale burns a real `Device.lastSequence`, and that
`POST /session/mode` being a server call means a device stuck in practice during an outage
cannot get back to selling. **[PO]** independently recommends deferring the whole feature to v2
and shipping a seeded demo database instead.

### Tier C — policy and reports; cheap at any time, but must not be forgotten

- **C-1 · Void is v1's unguarded theft route.** **[DA][BA]** §16.1 ranks *"a worker voiding their
  own sales to cover cash theft"* as threat #2. Void is **absent from §16.3's re-auth list and
  from §8.1's confirm table**, and `AuditLog.reason` is not required for it. The attack needs no
  cleverness: ring the goods, take the cash, park the basket, void it later, pocket the money —
  nothing posted, no stock moved, and the drawer is not over because the money never went in.
  **The detective control that would catch the stock discrepancy is stocktake, which is v2.** Fix
  is policy only: re-auth above a threshold, a voids-by-worker figure beside the existing
  discounts-by-worker report, and a required reason.
- **C-2 · `sale-already-returned` contradicts partial returns.** **[DA][VERIFIED line 1435]** A
  per-*sale* `422` against §12.4's emphatic *"the check is per line, not per sale"*, with user
  guidance ("open the existing return") that assumes one return per sale. §8.5 declares its
  `type` strings **frozen** — a frozen type contradicting a settled rule is a build instruction
  someone will follow. Strike it.
- **C-3 · `STOCK` writes the number that moves the owner's margin and cannot see the result.**
  **[BA]** Structurally unable to notice the mistake, and there is **no cost-variance alert**
  ("this receipt's unit cost is 40% above the last one") anywhere in §6.7, §13.2 or §20.2. A read
  control with no corresponding write control on a derived figure is a half-closed door.
- **C-4 · Resolving a `NEGATIVE_STOCK` flag produces uncoded shrinkage.** **[DA][VERIFIED
  line 2023]** The remedy is an `ADJUSTMENT`, and `reasonCode` is *"required when
  `type = WRITE_OFF`; null for every other type"* — so every negative-stock resolution is
  invisible to §20.2's "write-offs by reason" chart, which is the exact output §13.5 exists to
  produce. And `POST /review-flags/:id/resolve` clears the row **without requiring the stock to
  be non-negative**. The alarm is settled; the response is not.
- **C-5 · Returns are a `WORKER` command that pays cash out, and nothing counts them.** **[BA]**
  Blind returns are correctly admin-gated as *"the classic fraud path"*, but ordinary returns
  against genuine old sales are the same shrinkage route with less friction — and §20.2 has no
  **returns-by-worker** report, though §12.1 gives discounts exactly that countermeasure.
- **C-6 · `NO_SALE` requires an admin PIN, which may violate rule 1.** **[BA]** A lone worker
  cannot open the drawer to give change. Recommendation: allow it on a `WORKER` token with a
  coded reason, and put every `NO_SALE` on the Z-report and the owner's home — detective rather
  than preventive, the same trade §13.6 makes for negative stock. Note the mirror gap **[DA]**:
  `CashMovement.DROP` moves money *out* of the drawer with free text and **no** re-auth, which is
  the cheaper theft route and is unguarded.
- **C-7 · `ReviewFlag` has no severity, assignee, age or value.** **[DA]** Every conflict, failed
  post, negative stock and drift flag lands in one undifferentiated list. In a shop with patchy
  Wi-Fi, month two shows several hundred rows and the list becomes the electronic equivalent of
  the drawer where the paperwork goes.
- **C-8 · `Payment.amount` vs `tenderedAmount` vs `changeGiven`.** **[DA]** §11 says split-tender
  payments sum to **≥** `Sale.total`. If `amount` is what was handed over, §12.5's `cashSales`
  term **includes the change given back** and overstates expected cash on every cash sale — the
  same bug as the repayment double-count, one field to the left. The invariant
  (`amount = tenderedAmount − changeGiven`) is written nowhere.

---

## Missing domain — not defects, but events with no model

**[DE]** These are things Armenian small shops do daily that Simon currently cannot represent.
They are not contradictions; the PRD simply does not know about them.

| Gap | Why it bites |
|:--|:--|
| **Contra-settlement** | The cement supplier is also a tools customer; at month end they net off and **no money moves**. Simon has a customer ledger and a supplier ledger with **no bridge**. The shop will enter a fake cash repayment plus a fake cash supplier payment — destroying *both* cash reconciliations — or stop using the debt book. |
| **Debt written off as uncollectable** | He moved to Russia. No event, no entry type, no report line — so debtor aging grows a permanent 90+ tail the owner learns to ignore, which kills the report. |
| **Bonus goods** | 11 bags delivered, 10 invoiced. Entering 11 at the invoice unit cost overstates the average by 10%; entering 10 makes a bag invisible until stocktake. The right answer needs a **line total**, and the receiving screen asks for a unit cost. |
| **Supplier VAT depends on the shop's tax regime** | A turnover-tax shop cannot recover input VAT, so it belongs **inside** landed cost; a VAT-registered shop costs net. §10.5 says nothing — **get it wrong and every margin is out by 20%**. |
| **Cash-only supplier** | `GoodsReceipt.supplierInvoiceNo` is NOT NULL. Half of a small shop's deliveries arrive with a scribble or nothing. |
| **Offcut waste** | 2 m left on a spool: stock on paper, rubbish on the shelf. No `reasonCode` fits — `DAMAGE` is a lie and `INTERNAL_USE` is worse. |
| **`trackStock` appears once in 3 227 lines** **[DA][VERIFIED]** | Cutting to length, key copying, delivery, tool hire — a hardware store uses this within a week. Does selling one emit a movement? What is its `avgCostMdram`? What does a *return* of one do? It will be implemented by whoever hits it first, differently in three places. |
| **Advance payment / deposit** | A contractor pays 100 000 ֏ up front against a job. A credit balance as a *first-class intent*, not an overpayment artefact — aging and "who owes what" must handle a negative balance. |
| **Who physically took the goods** | The contractor sends his labourer. The debt is Դավիթ's; the person who signed is someone else. Nothing records `takenBy`, and this is the exact dispute §2.5 plans to ask five shops about. |
| **Simon and the ՀԴՄ diverge** | In §17's interim position every sale is rung **twice**. Forgotten entries and different rounding guarantee a gap; **no reconciliation report is specified**; the inspector's first finding gets blamed on the new software. **[PO]** adds the commercial half: double entry makes the till *strictly slower* than notebook + ՀԴՄ, so §21.1's 15-second target measures Simon's half of a 30-second job. **The parallel fortnight must time the combined flow.** |

---

## What is settled — and the four claims that came off that list in Phase 6

The synthesis initially proposed seven PRD decisions as closed. The Devil's Advocate broke four
of them. The corrected position:

| Claim | Status after challenge |
|:--|:--|
| Idempotency key = id + target status (sales only) | ✅ **Settled — the key.** ❌ The queue's **ordering and 4xx policy is open** ([A-10](#a-10)). |
| Append-only ledger, rebuildable caches | ❌ **Two holes.** `avgCostMdram` is never declared a cache and is not in the drift job; `DebtAllocation` is explicitly mutated by §14.5 and omitted from §11's never-updated list. |
| Landed-cost-first WAC | ✅ **Apportionment settled.** ❌ The **WAC state machine is not** ([A-5](#a-5)). |
| Per-line return quantity checks | ❌ **Contradicted by a frozen error type** (`sale-already-returned`, [C-2](#hot-spots)). Strike the type or unsettle the rule. |
| Cost stripped server-side | ✅ **Settled for reads** — say "reads" explicitly, because [A-3](#a-3) is the write-side mirror of the same §16.5 principle and §27.9 tests only one direction. |
| Receipt numbering per device | ❌ **Decided pending Q10.** §12.1 says outright that if a gapless number is required, §14's offline design *"is what has to give"*. Also: a restore rewinds `Device.lastSequence` against line 2027. |
| Negative stock allowed with a flag | ❌ **The alarm is settled; the response is not** ([C-4](#hot-spots)). |

**Genuinely settled and worth defending:** the append-only *discipline* itself; correction as a
linked reversing document rather than an edit; integer drams and milli-drams with one shared
module; `unitCost` snapshotted onto sale lines; aging measured from the charge date, never the
due date; accept-and-flag over reject on sync; `HELD` posting to no ledger; printing strictly
after commit with no I/O inside a transaction.

---

## Scope and sequencing

**[PO]** The Must set, in one sentence:

> *A worker can open a shift, sell scanned and unbarcoded goods for cash, card, credit or any
> mix, put a sale on a named customer's Nisya while seeing what they already owe and for how
> long, take a return against the original sale, and close the shift against a counted drawer; a
> stock keeper can enter a delivery from a paper invoice with its freight so the cost is right;
> the owner can see today's takings, today's profit and today's debtors, drill into any of them,
> export them, and restore the whole thing onto a different machine.*

**Delivery order:** Costing + money arithmetic → Stock ledger + identity/field-stripping →
Catalogue + Selling + Cash&Shift **as one release** → Credit/Nisya → Procurement → Reporting →
the client half of Sync → Fiscal seam.

**Eight disagreements with the §23 roadmap**, strongest first:

1. **The offline queue is scheduled in Phase 5 by its user value, and it is a write-path
   decision.** Client-generated ids, idempotent `POST /sales` on id + target status, and the
   legal-transition check are **the shape of the checkout write path**, not a queue in front of
   it. §23.1 names three unretrofittable items; this is a fourth and it is missing from the list.
   Split the row — the contract in Phase 1, the IndexedDB cache and conflict UX in Phase 5.
2. **Quick-add is scheduled after the phase that depends on it.** Phase 1's exit is a real sale
   in a real shop, which needs products in a real database. Either Phase 1 quietly does
   off-roadmap catalogue work, or the visit runs on 15 typed products and proves nothing about
   A2 — §25's most likely single cause of pilot failure.
3. **Backup at Phase 4 contradicts §23.1's own layer table**, which says it can start early. The
   layer table is right: data becomes irreplaceable at Phase 1's first real sale. Snapshots in
   Phase 1; the restore *drill* can stay in Phase 4.
4. **Phase 1's exit criterion is too weak.** "A real sale completes" — but a sale that completes
   is not a day that closes. Make it: a full day opens on a counted float and closes with an
   explainable variance. Same scope, better gate.
5. **Owner home in Phase 4 tests H1 last**, leaving the paper book open for three phases — and a
   paper book still open at month three never closes. Pull takings + debtor aging + drill-down
   into Phase 2; profit stays in Phase 4 where it is honest.
6. **Write-offs in Phase 4, but stock becomes real in Phase 3** — so pilot-fortnight shrinkage
   gets corrected by reason-less adjustments, exactly what FR-STK-03 exists to prevent.
7. **Denomination counting is a PRD Must; the irreducible Must** is a counted total, an expected
   total, a recorded variance and a prompted note. Downgrade the grid to Should.
8. **Practice mode is real architecture** — a second database, `Session.mode` threading through
   layer 4, an acceptance criterion that exists only because the feature does — for a training
   aid serving one shop. v2; ship a seeded demo database instead. (And see [B-5](#tier-b--architectural-settle-before-the-code-that-touches-them):
   it currently leaks through the device-scoped outbox.)

**On §9's framing:** *"v1 — must ship together to be useful"* is a constraint of products with a
distribution cost. Simon is installed per shop and released as git tags — bundling coach marks
with the stock ledger makes the ledger late for free.

**On regulatory events:** they have low build priority and **the highest decision priority —
build them last, decide them first.** They compete not for build capacity but for someone's
attention in a 45-minute meeting. Three are shape-determining rather than feature-shaped: **Q10**
(gapless numbering) can invalidate the entire offline design, **Q2** (price basis) determines
what every stored price means, and **Q1** (ՀԴՄ obligation) decides whether Simon can be the till
at all. Give them a different sticky colour, or they get prioritised by a user value they do not
have. `ZReportGenerated` is the exception — fiscal in ancestry, genuinely valuable now.

---

## Terminology to fix before it becomes a costing bug

**[DE]**

| Conflict | Why it matters |
|:--|:--|
| **`unitCostMdram` means three things** | WAC on `SaleLine`, *invoice* cost on `GoodsReceiptLine`, *landed* cost on `PurchaseReturnLine`. §13.7's costing turns on which you grabbed. **Rename per role.** |
| **"Takings" / "today's sales" is undefined** | Turnover including debt sales, or cash in the drawer? A debt sale is revenue and not cash; a repayment is cash and not revenue. **This is precisely the unexplainable-number gap §2.3 says ends the relationship**, and the PRD never names the two figures apart. |
| **`Payment.method = DEBT` vs `DebtEntry.CHARGE`** | The same money in two ledgers in one transaction, with nothing saying which is authoritative for revenue versus balance. Any sum across both doubles it. |
| **"Return" points both directions** | `SaleReturn` (customer→shop) and `PurchaseReturn` (shop→supplier) share one English word, and Վերադարձ is defined only for the customer case — against §4.2's one-word-per-concept rule. The supplier side needs its own Armenian noun. |
| **`Shift.expectedCash` stored vs queried** | §12.5 says every term is a query over rows, but the column is stored — and unlike `stockQty` it has **no drift check**. A late-arriving offline sale changes the query and not the column. |
| **`ADJUSTMENT` vs `WRITE_OFF` vs `STOCKTAKE`** | Is a stocktake shortfall a `STOCKTAKE` movement or a `WRITE_OFF` with `reasonCode = THEFT`? Both defensible, and the "write-offs by reason" chart looks completely different depending on the answer. |
| **Nisya vs Պարտք** | The glossary and §6.9 use *Nisya*; §4.1 says the user-facing word is *Պարտք*. Pick one for the UI. |
| **`reorderPoint` stored vs suggested** | Whether the velocity suggestion overwrites the owner's number or sits beside it is unstated — and overwriting a number the owner set is exactly what makes him distrust it. |

---

## Provenance

| Persona | Events | Commands / rules | Hot spots | Distinctive contribution |
|:--|--:|--:|--:|:--|
| Domain Expert | 68 | ~40 rules, 52 edge cases | 11 terminology conflicts | The Armenian small-shop reality the schema does not know about — contra-settlement, bonus goods, pack-size changes, supplier VAT by regime |
| Developer | ~130 | 18 transaction boundaries | 8 technical risks | The event-grammar rule; the replay-safety classes; the device↔host seam |
| Business Analyst | — | 60+ commands, 11 acceptance criteria | 9 findings | Two-colour failure stickies (422 refused vs 200+warnings); the actor→command matrix; the commands that deliberately do not exist |
| Product Owner | — | 12 user stories | 8 roadmap disagreements | MoSCoW, delivery order, "build last, decide first" for regulatory work |
| Devil's Advocate | — | — | 25 hot spots, 16 missing scenarios, 9 contradictions, 8 failure modes | Every Tier A item; and the Phase 6 challenge that overturned the costing model and four "settled" claims |

**Verified during synthesis, not taken on trust:** the §13.7 arithmetic (8 ֏ against a true
12 ֏); §27.22's wording; `CashMovement` having no `REFUND` type; `SaleReturn` having no
`shiftId`; "timezone" occurring zero times; `trackStock` occurring once; `sale-already-returned`
being a `422` at line 1435; and §10.4 declaring only `stockQty` a cached projection.

---

## Next steps

1. **Answer §26 Q1, Q2 and Q10 before layer 5.** Q10 alone can invalidate the offline design.
   These need a 45-minute conversation, not a sprint.
2. **Name the missing entity in [A-1](#a-1)** — an accounting period distinct from a drawer
   session — and add `Shift.deviceId` in the same change. Everything else in the shift model
   waits on this.
3. **Write the four one-paragraph decisions** that are pure money: the cash-refund path into
   §12.5, the settled-nisya return, the split-tender refund, and the sale-level discount
   apportionment.
4. **Make `avgCostMdram` nullable** and bring it into §10.4's drift job. Cheapest fix in the
   document, load-bearing for every margin the owner will ever see.
5. **Reopen §13.7 against the case where stock turned over, and rewrite §27.22 so it can fail.**
6. **Decide whether the server recomputes sale money** ([A-3](#a-3)) — it determines whether the
   discount cap is a control or decoration.
7. **Block `ProductUnit.factorToStockUom` after movements exist**, and snapshot uom + factor onto
   `GoodsReceiptLine`.
8. **Strike `sale-already-returned`** from §8.5 before anything is built on a frozen type that
   contradicts §12.4.
9. **Update the domain skills** — `money`, `ledger`, `offline-sync` — once these decisions land,
   per `CLAUDE.md`'s rule that a convention change updates its skill.
10. **Consider a follow-up storm on Reporting**, which this session treated as read-only
    projections and never explored. "Takings" being undefined suggests that is where the next
    set of findings lives.

---

**Generated by:** the `event-storming` skill (`.claude/event-storm/SKILL.md` v1.0.0),
full-simulation mode, six phases.
**Model:** Claude Opus 5 (1M context)
