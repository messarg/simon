# Event Storming — Phase 1 · Devil's Advocate

**Domain:** Simon (Սիմոն), full buy–sell cycle.
**Sources read adversarially:** `docs/prd.md` v3.47 (3,227 lines), `CLAUDE.md`.
**Stance:** the PRD is unusually rigorous. That is exactly why the remaining gaps are dangerous —
they hide behind pages of correct reasoning, and every one of them is in a place the document
sounds most confident.

Line references are to `docs/prd.md` as of commit `4dd4d5a`.

---

## 1. Hot Spots

### HS-1 — A cash refund is missing from the expected-cash formula · **CRITICAL** · [Devil's Advocate]

§12.5 (line 2113):

```
expected = openingFloat
         + cashSales                  Payment.method = CASH, on COMPLETED sales in this shift
         + Σ CashMovement REPAYMENT
         + Σ CashMovement PAY_IN
         − Σ CashMovement PAY_OUT
         − Σ CashMovement DROP
```

There is **no term for a cash sale return.** `SaleReturn.refundMethod` may be `CASH` (line 1873),
§8.1 lists "Return / refund — Money leaves the drawer", and §12.4 never says a return writes a
`CashMovement`. `CashMovement.type` (line 1904) is `PAY_IN · PAY_OUT · DROP · NO_SALE ·
REPAYMENT` — there is no `REFUND`.

**The question nobody has answered:** when a worker refunds 8,000 ֏ in cash, which row makes the
drawer expect 8,000 ֏ less?

Three defensible answers, PRD picks none:
- a new `CashMovement` type `REFUND` (cleanest, and symmetrical with `REPAYMENT`);
- a `PAY_OUT` with a reason (works arithmetically, but §20.2 can then never separate refunds from
  supplier payments, and the shrinkage report loses its most important category);
- a negative term derived from `SaleReturn` rows (needs `SaleReturn.shiftId`, which does not exist).

**Worse, it cannot be derived even if you wanted to.** `SaleReturn` carries
`id, originalSaleId, userId, reason, refundMethod, total, createdAt` — **no `shiftId`** (line 1873).
A return is not attributable to a drawer at all. `DebtEntry` has the same omission but is rescued by
§12.3's explicit `CashMovement REPAYMENT`; returns have no such rescue.

**Consequence, concretely:** a shift that takes one 8,000 ֏ cash refund closes 8,000 ֏ short. §6.6's
screen shows «Տարբերություն −8 000 ֏» on the one screen the PRD says exists to catch theft, with a
neutral tone and a note prompt — and an honest worker gets to write a note explaining the software's
arithmetic every time they take a return.

This is the *same class of bug* the PRD congratulates itself for having caught: "An earlier form of
this formula listed `repayments` and `payIns` as separate terms while §12.3 wrote a cash movement —
which would have overstated expected cash by every repayment taken that day, on the one screen §6.6
says is there to catch theft." The sweep that found the double-count did not ask what was *missing*.

---

### HS-2 — A return against a settled nisya sale has no refund path · **CRITICAL** · [Devil's Advocate]

§12.4 (line 2107): *"Refunding a debt sale reduces the debt rather than paying out cash: a credit
`ADJUSTMENT` (§10.6) allocated against the original charge through `DebtAllocation.creditEntryId`.
Never a negative charge, and never money out of the drawer for goods that were never paid for."*

`DebtAllocation.amount` validation (line 2018): *"> 0, and ≤ the remaining balance of its charge."*

**Scenario:** Դավիթ buys 40,000 ֏ of cable on nisya on 3 March. He pays the 40,000 ֏ on 10 March.
On 12 March he brings back an unused 15 m coil.

The charge's remaining balance is **zero**. The credit `ADJUSTMENT` cannot be allocated to it — the
validation rule forbids it. And §12.4's justification ("goods that were never paid for") is factually
false here: he *did* pay.

**The question:** does Simon hand him 8,000 ֏ from the drawer, or hold an unallocated credit against
a customer who may never come back?

Both are defensible. Cash out is what the shop will actually do. An unallocated credit is what
§10.6's model produces ("Overpayment becomes a credit `ADJUSTMENT`, never a negative charge"), and it
quietly converts a refund obligation into an interest-free loan from the customer that no screen
lists and no report ages. Neither is chosen, and the choice is money.

**Related, and just as unanswered:** the customer has *partly* paid — 20,000 of 40,000 — and returns
goods worth 25,000. Split the credit between debt reduction and cash? At what ratio? Silence.

---

### HS-3 — Split tender in, single tender out · **CRITICAL** · [Devil's Advocate]

`Payment` (line 1872): *"**Multiple per sale** — split tender (§6.2)."*
`SaleReturn` (line 1873): `refundMethod` (CASH/CARD/DEBT_REDUCTION) — **one value, on the header**.

§27.2 makes split payment a v1 acceptance criterion: *"A **split payment** (part cash, part debt)
records correctly against both drawer and customer."* §27.6 makes partial return a v1 acceptance
criterion.

**The question:** a sale paid 30,000 cash + 20,000 nisya is partially returned for 25,000. How much
comes out of the drawer and how much comes off the debt?

Candidate rules, none written:
- pro-rata by tender (15,000 cash / 10,000 debt) — fair, arithmetically fiddly, produces rounding
  that §10.1 has no rule for;
- debt first, then cash — protects the drawer, protects the shop, and is what an accountant would
  want;
- cash first — what the customer will demand;
- worker chooses — which §16.1 should hate, because "refund method" then becomes a shrinkage dial.

§6.5 says *"Simon picks this automatically and says so"* — for a pure debt sale. It has no opinion
about the mixed case, and the data model forecloses the pro-rata answer by putting `refundMethod`
on the header.

---

### HS-4 — A queued sale cannot post to a shift that has closed · **CRITICAL** · [Devil's Advocate]

This is the sharpest self-contradiction in the document. See §3, C-1. Stated here as a hot spot
because it is also an operational question with money attached:

**The question:** the tablet's Wi-Fi dropped at 18:40, the worker kept selling, the shift was closed
at 19:00 with `unsyncedAtClose = 4`, the Z-report was printed and the cash counted. At 19:20 the
tablet reconnects and four completed sales — 31,000 ֏ of cash already in the drawer that was
counted — arrive at the server.

Which of these is true?
- (a) `Shift.expectedCash` and `variance` are **recomputed**, retroactively changing a closed
  period's variance and making the printed Z-report a lie;
- (b) they are **frozen**, so the four sales appear in daily takings but in no shift, and the
  drawer reconciliation permanently disagrees with the sales report by 31,000 ֏;
- (c) the sales are **rejected** — which §14.2 rule 1 forbids absolutely.

The PRD chooses (none). `Shift.unsyncedAtClose` records *how many* — which is honest and useless. A
count is not a reconciliation.

**And note the trap:** whichever way this goes, the cash was *already counted*, because the worker
had it. So (a) produces a variance of zero and a rewritten report; (b) produces a variance of zero
and a report that is 31,000 short of the sales it should contain. The number the owner will
eventually compare is total daily sales against total daily cash, and (b) breaks it silently — the
exact "one unexplainable figure" §25 rates as fatal to trust.

---

### HS-5 — Retroactive cost correction is impossible by design · **CRITICAL** · [Devil's Advocate]

§10.5: *"**Snapshot on sale.** The current average is written onto the sale line as `unitCost`.
Historical profit then becomes immutable: restocking at a new price never rewrites last month's
numbers."*

§10.7: corrections are linked reversing documents, never edits.

**Scenario, which will happen in month one:** `STOCK` types a delivery of 200 m of cable at
**14 000** ֏/m instead of 1 400 ֏/m. The average moves to ~13 000. Two weeks of sales snapshot that
cost. The margin report says the shop is losing money on cable. Someone notices.

The only correction available is: reverse the receipt (§13.7 formula), re-enter it correctly. That
fixes `Product.avgCostMdram` **going forward**. Every `SaleLine.unitCostMdram` written in the
meantime keeps the wrong figure **forever**, by the rule §10.5 states as a virtue.

**The question:** who owns restating two weeks of reported margin, and with what document?

There is no `CostCorrection` entity, no restatement movement, no acceptance criterion, no warning.
§20.2's margin report will show the wrong two weeks for the ten-year retention period, and §8.2's
recovery table (line 1375) has a row for "Wrong price on a receipt" but **none for "wrong cost on a
receipt"**.

The immutability rule is right. What is missing is that immutability *requires* a restatement
mechanism, and the PRD treats immutability as sufficient on its own.

---

### HS-6 — `avgCostMdram = 0` means both "free" and "unknown" · **CRITICAL** · [Devil's Advocate]

`Product.avgCostMdram` (line 1861) is **NOT NULL** — the `?` convention (line 1989) marks nullables
and it has none. Meanwhile §6.12's default screen is the "needs detail" list showing
«⚠ ինքնարժեքը լրացված չէ» — *cost not filled in* — for quick-add products (§7.4).

So the PRD's own primary screen displays a state the schema cannot represent.

**The question:** what is `avgCostMdram` for a product created by quick-add at the till and sold
five minutes later?

If it is 0, then:
- `SaleLine.unitCostMdram` snapshots 0 (§10.5), permanently;
- the margin report shows **100% margin** on those lines, forever, unfixable per HS-5;
- §10.5's WAC formula, on the first real receipt, computes
  `(stockQty × 0 + receivedQty × cost) ÷ (stockQty + receivedQty)` — which *dilutes* the true cost by
  the quantity that was sold at a fictional zero, understating cost for as long as that stock lasts;
- §20.2's dead-stock and valuation reports value that shelf at nothing.

`Product.sellPriceMdram` explicitly permits zero with a reason (line 2006: *"Zero is legal — a free
sample still moves stock"*). Nobody asked the same question of cost, where zero is almost never a
fact and almost always an absence.

**This is the single cheapest thing to fix in the whole document:** make `avgCostMdram` nullable,
teach the WAC formula to treat null as "seed from this receipt" (it already has that branch for the
negative-denominator case), and refuse to report a margin on a line whose cost was unknown.

---

### HS-7 — §13.7's purchase-return formula produces a false average whenever stock has turned over · **CRITICAL** · [Devil's Advocate]

§13.7 (line 2202):

```
newAvgCost = (stockQty × currentAvgCost − returnQty × receiptLandedUnitCost)
             ÷ (stockQty − returnQty)
```

Guards: round half-up on store; if `stockQty − returnQty ≤ 0`, do not evaluate.

The PRD's worked example has **no sales between the receipt and the return**. Add sales — which is
what happens in a real shop, because you discover the goods are wrong *by selling one* — and the
formula misvalues the shelf, silently:

| Step | Qty | Avg | Value |
|:--|--:|--:|--:|
| Opening | 10 | 12 | 120 |
| Receipt 10 @ 14 | 20 | 13 | 260 |
| **Sell 8** | 12 | 13 | 156 |
| Return the delivery, 10 @ landed 14 | 2 | **8** | 16 |

`(156 − 140) ÷ (12 − 10) = 8`.

The two units physically left are from the 12 ֏ batch. Their true cost is 12. Simon now says 8 —
**below any price the shop has ever paid for this product**, understated by a third, and every margin
reported on those units is overstated by the same. The denominator guard does not fire; the
numerator is positive; nothing flags.

The PRD warns about precisely this failure in the paragraph above the formula: *"Getting this
backwards does not fail loudly; it quietly misvalues every unit still on the shelf and every margin
reported after it."* It is not backwards. It is right for the clean case and wrong for the ordinary
one.

**And §27.22 is written so that it can only pass in the lab** (line 3217): *"Returning a delivery to
a supplier restores the weighted average to what it was before that delivery arrived."* Under the
table above, "before that delivery arrived" is 12 and the system produces 8. The acceptance test as
worded will be implemented as a test with no intervening sale, will pass, and will certify a
formula that is wrong in production.

Needed guards nobody has specified: clamp when the result falls outside
`[min, max]` of any landed cost ever paid; or cap `returnQty × receiptLandedUnitCost` at
`stockQty × currentAvgCost`; or refuse and flag when `returnQty > stockQty − (qty received since)`.
Pick one, but pick.

---

### HS-8 — The client is the authority on price and discount · **CRITICAL** · [Devil's Advocate]

`POST /api/sales` (line 2392) carries "lines". `SaleLine` (line 1871) carries `unitPriceMdram`,
`discountAmount`, `lineTotal`, `priceOverridden`. §14.4 says the catalogue is cached in IndexedDB
and *"Cached stock and prices are last-known"*.

Nowhere does the PRD say the server **recomputes or validates** the money on an incoming sale.

**The question:** does the server trust `lineTotal`, or recompute it from catalogue price × qty
less an authorised discount?

If it trusts the client:
- §12.1's discount cap ("gated by role and capped by a configurable maximum … Above the cap: admin
  PIN plus a reason") is a **client-side control**. Anyone with the LAN, the API and a `curl` gets
  100% discounts. §16.6 says in bold that *"CORS is not a security control"* — and then leaves the
  actual money field unguarded;
- an offline till sells at whatever price it cached, days stale, with **no warning type**. §14.6's
  conflict table has exactly three: `insufficient-stock`, `credit-limit-exceeded-on-sync`,
  `product-deactivated-on-sync`. There is no `price-changed-on-sync`. §6.12's "Changing a price while
  a held sale carries that line — No effect" is the *right* answer for a basket built minutes ago and
  a very wrong one for a basket built from a five-day-old cache;
- `priceOverridden` is a boolean the client sets about itself.

If it recomputes: §14.5's whole offline design breaks, because the price the customer was quoted and
the price the server computes will differ and the receipt in their hand is already printed.

This is the mirror image of the failure §16.5 spends a page on. §16.5 is about *reading* what you
should not see. This is about *writing* what you should not set, and it is the more expensive one.
§16.5 says "Hiding cost in the UI is not a control." Capping discount in the UI is not a control
either, and §27 has no criterion that tests it — §27.9 tests read-side stripping only.

---

### HS-9 — Offline repayment allocation mutates a posted ledger, and can overspend a charge · **MAJOR→CRITICAL** · [Devil's Advocate]

§14.5 (line 2289): *"Repayment | ✅ | Additive; allocation recomputed on sync."*

Two problems in five words.

1. **"Recomputed" contradicts §10.7.** `DebtAllocation` rows are ledger artifacts. §11's Lifecycles
   section states: *"`GoodsReceipt`, `SaleReturn`, `DebtEntry`, `StockMovement` and `CashMovement`
   have no lifecycle at all: written once, inside one transaction, never updated."* `DebtAllocation`
   is conspicuously absent from that list — the one financial table the PRD permits itself to
   rewrite, and the permission is granted in a table cell in a different section.

2. **Two tills, one debtor, both offline.** Դավիթ owes three charges. Till A takes 20,000 ֏, till B
   takes 30,000 ֏, both allocate oldest-first offline against the same 25,000 ֏ charge. On sync, the
   allocations against that charge sum to 45,000 — violating the validation rule
   *"`DebtAllocation.amount` > 0, and ≤ the remaining balance of its charge"* (line 2018).

   §14.6's rule is *"Accept and flag; never reject"* — but there is **no warning type** for this, no
   `ReviewFlag` type for it (`NEGATIVE_STOCK / CREDIT_LIMIT_ON_SYNC / PRODUCT_DEACTIVATED_ON_SYNC /
   LEDGER_CACHE_DRIFT`, line 1899), and no `type` in §8.5's frozen catalogue. §15.2 says *"Every
   warning must correspond to durable state"* and *"a warning with no durable trace is a bug"* — here
   there is neither warning nor trace. The transaction must either reject (breaking §14.6) or write a
   row that violates its own CHECK constraint.

The honest answer is probably "reallocate on sync and post the excess as a credit `ADJUSTMENT`, per
§10.6's overpayment rule" — but that is a decision that changes aging retroactively, and §10.6 is
emphatic that aging must be stable and reproducible.

---

### HS-10 — Whose clock writes `createdAt`, and what orders the ledger? · **CRITICAL** · [Devil's Advocate]

`Sale.createdAt` / `completedAt` (line 1870). The id is a client-generated UUIDv7 whose sort order
*is* a client timestamp (§11 opening line, §14.3). §11's index is
`StockMovement(productId, createdAt)`. §11's convention: *"Timestamps — `*At` — `TEXT`, RFC 3339
UTC."* Nothing says whether the client's or the server's clock supplies them, and nothing validates
skew.

**The questions, each with money attached:**
- A tablet whose clock is 6 hours slow completes a sale. Which shift does it land in? Which day's
  Z-report? `Sale.shiftId` says the shift explicitly — good — but §20's daily reports are by date,
  and the date now disagrees with the shift.
- `DebtEntry.createdAt` on a skewed device sets the **aging bucket**. §10.6: *"Aging is measured from
  the **charge** date."* A device a month fast puts a fresh charge straight into the 30-day bucket;
  §27.5's "aging matches the paper book" fails for reasons nobody will find.
- `StockMovement.balanceAfter` is a **stored** column (line 1898). Under sync it is assigned at *post*
  time, so a ledger read in `createdAt` order — which the index invites — shows `balanceAfter` values
  that jump backwards. §10.4 promises the ledger answers *"why does it say 14 when the shelf has 11?"*;
  a column that only makes sense in insertion order, read through an index in event order, cannot.
- **§10.4's drift job replays the ledger and asserts `cache == replay`.** In which order? If replay is
  by `createdAt`, every late-syncing sale produces a spurious `LEDGER_CACHE_DRIFT` flag — and §19.5
  makes that one of only three alerts that reach the owner. An alert that fires on ordinary Wi-Fi
  drops is an alert the owner mutes in week two, and then the real drift arrives silently.

**Note also:** `CLAUDE.md` and `vitest.config.ts` pin `TZ=Asia/Yerevan` for *tests*. Nothing pins it
for the **host**. §6.11's settings table has no timezone row; "timezone" appears **zero times** in the
PRD. A host PC left on UTC puts the shop-local day boundary four hours off, and every daily report
and shift-boundary query is wrong in a way that looks like fraud. (Armenia has no DST, so the risk is
a one-time misconfiguration rather than a twice-yearly bug — which makes it *less* likely to be
noticed, not more.)

---

### HS-11 — Voiding a held basket is a v1 theft route with no v1 detective control · **CRITICAL** · [Devil's Advocate]

§16.1 ranks *"a worker voiding or discounting their own sales to cover cash theft"* as threat #2.

Now look at what guards a void:
- §16.3's re-auth list: *"discount above threshold, blind return (no original sale), price change,
  stock adjustment, and opening the drawer outside a sale."* **Void is not on it.**
- §8.1's undo/confirm table has rows for remove-a-line, change-quantity, complete-a-sale,
  discount-over-threshold, return, close-shift, delete-a-product, stocktake-approval. **Void is not
  on it** — no confirm, no undo, no treatment at all.
- §10.7 does audit it (*"basket void"* is in the `AuditLog` list) — a detective record, not a control.

**The attack, which requires no cleverness:** scan the goods, tell the customer the total, take the
cash, hand over the goods, park the basket, void it at a quiet moment, pocket the cash. Nothing was
posted, so no stock moved, no sale exists, and the drawer is **not over** because the money never
went in. The only trace is one voided basket among the dozens §6.1 says are normal, and a stock
discrepancy.

**And the control that catches a stock discrepancy is stocktake, which is v2** (§13.4, §6.8, §9).

So for the whole of v1, the PRD's #2 named threat has: no preventive control, no confirmation, no
re-auth, and no detective control. Negative stock (§13.6) eventually catches it, but only for
products the system believes it has few of — in a hardware store with 1,800 SKUs and an imported
opening count, that is years.

**Minimum viable fixes:** put void on §16.3's re-auth list once a basket exceeds a threshold; add a
"voids by worker" figure beside §12.1's discount-by-worker report (which exists precisely for the
sibling attack); and make `AuditLog.reason` required for a void, as it already is for every other
justified action.

---

### HS-12 — Resolving a `NEGATIVE_STOCK` flag produces uncoded shrinkage · **MAJOR** · [Devil's Advocate]

§13.6: negative stock writes a `ReviewFlag` and *"that row **is** the recount list"*.
§13.5: write-off reasons are a coded field precisely so *"stock disappears" becomes §20.2's chart*;
`reasonCode` is *"required when `type = WRITE_OFF`; null for every other type"* (line 2023).

**The question:** what does a person actually *do* to clear a negative-stock flag?

They recount, find 3 on the shelf where the system says −2, and post an `ADJUSTMENT` of +5.
`ADJUSTMENT` **may not carry a `reasonCode`** — the validation rule forbids it. So the correction is
uncoded, invisible to §20.2's "write-offs by reason" chart, and the 5 units of discrepancy that were
the whole reason to look are recorded as a shrug.

`ReviewFlag` has `resolvedAt`/`resolvedBy` but **no severity, no assignee, and no value**. §14.6's
needs-attention list is in the owner app; the recount is a `STOCK`/`WORKER` job on the shop floor.
Nobody owns the moment stock goes negative — the PRD creates a row and calls it a list.

Also unresolved: `POST /review-flags/:id/resolve` (line 2420) can be called while the stock is *still*
negative. Nothing couples resolution to the condition. The flag is a to-do item that can be ticked
without doing anything.

---

### HS-13 — Two shifts, one drawer · **MAJOR** · [Devil's Advocate]

`Shift` (line 1902) has `userId`. It has **no `deviceId`**. The open guard is *"No other `OPEN` shift
for this user."*

But the cash drawer is physical, it opens via the receipt printer's kick-out port (§18), and §18 says
**the backend owns printing** — one host, one printer, one drawer, in the ordinary small-shop setup.

**The question:** Գոռ and Անի are both on the floor on a Saturday, each with a phone, both open a
shift, both sell for cash into the same drawer. At close, each computes an `expectedCash` from their
own sales plus their own `openingFloat` — and both counted the same physical float, or neither did.
Two Z-reports, one drawer, and the arithmetic is unreconcilable.

Conversely: one user, two devices. §16.3 binds sessions to a shift; `Device.outboxDepth` and
`parkedDepth` are per-device; `Shift.unsyncedAtClose` is **one number**. Which device's queue does it
count when a shift spans two tills?

§21 (line 2785) budgets for *"3 tills selling simultaneously"*, so multi-till is a designed-for case,
not an edge. The shift model is single-till and the performance target is three.

---

### HS-14 — Returns are missing from §14.5's offline table · **MAJOR** · [Devil's Advocate]

§14.5's table (lines 2284–2291) lists: scan/build/take cash · complete cash-or-card sale · debt sale ·
park a basket · repayment · receiving/stocktake/price-change · reports.

**Sale returns are absent.** Yet §15.3 lists `POST /api/sale-returns` as one of the four
queue-drained, idempotent endpoints — which only matters if it can be queued, and §14.3 says so
explicitly: *"Applies to every queue-drained endpoint: sales, returns, repayments, cash movements."*

So: can a worker take a return with the server unreachable, or not? §14.5 is the normative table and
it does not say.

**If yes**, three things break:
- HS-1's cash movement (which does not exist) is also offline;
- the return's `originalSaleId` may point at a sale that is itself still in the outbox. §14.4's
  ordering guarantee is stated only for the two kinds of *sale* ("a basket parked before a sale was
  completed must not overtake it"). If a return drains before its sale, the server returns `404
  not-found` — a **4xx**, and §14.4 says *"never retry on other 4xx — park those and surface them"*.
  The return is dead in the needs-attention list, forever, for a race the queue could have prevented;
- §6.5 requires the return to start from the original sale, which the client can only do if that sale
  is in the local cache. `GET /catalogue/snapshot` (line 2427) syncs *catalogue* rows only — products,
  barcodes, units, categories, customers. Sales are not cached. So an offline return can only reference
  a sale made on *this device*, which is not what a customer walking in with a receipt from Tuesday
  needs.

**If no**, then §15.3's idempotency machinery for returns is dead weight, and §8.5's error catalogue
needs `offline-not-available` wired to the returns screen — which it is not.

**Same silence covers `POST /api/cash-movements`**: a `PAY_OUT` recorded offline arrives after its
shift has closed. See C-1.

---

### HS-15 — Re-authentication does not exist offline · **MAJOR** · [Devil's Advocate]

§16.2: PINs are *"Verified **server-side** against a slow hash … Never compared in the client."*
Correct, and non-negotiable.

§16.3 requires admin re-auth for: discount above threshold, blind return, price change, stock
adjustment, opening the drawer outside a sale.

**Therefore, with the LAN down, none of those five actions is possible.** The PRD never says so.
§14.5's table does not list them. §8.5 has `offline-not-available` but nothing maps these to it.

Three of the five (price change, stock adjustment, blind return) are already server-dependent, so the
loss is invisible. But **discount above the cap is not** — it happens in the middle of a cash sale,
at the counter, with a customer waiting, and §14.5 promises *"Complete a cash/card sale ✅"* without
qualification. A contractor buying 200,000 ֏ of material and negotiating 8% off cannot be served
during a Wi-Fi drop, and the PRD's own rule 1 ("never block the sale") is exactly what the design
cannot honour here.

The choices are: cache an admin PIN verifier on the device (weakens §16.2 materially, and on a phone
that may be stolen), raise the cap offline, or accept the block and *say so* in §14.5 and §8.5. The
PRD does not know it has a choice to make.

---

### HS-16 — Practice mode and the outbox · **MAJOR** · [Devil's Advocate]

§19.4: practice is *"A second database file, not an `isPractice` column"*, and the server routes on
`Session.mode`. Line 2032: *"`PRACTICE` sessions may not write to the real database at all."*

Clean on the server. The client is another matter:
- The **outbox lives in IndexedDB on the device** (§14.4) and belongs to the `Device`, not the
  session (§11 is explicit: *"a queue belongs to the till and not to whoever is signed in on it"*).
  `Session.mode` is per-session. **What separates practice entries in the queue from real ones?**
  Nothing stated. A practice sale queued during a training session, followed by a mode switch or a
  logout, drains under a `LIVE` token into the real ledger.
- `Device.lastSequence` is on the device and is the receipt number (§12.1). **Does a practice sale
  burn a sequence number?** If yes, real receipt numbers gain gaps — which is exactly the property
  §26 Q10 may turn out to forbid. If no, a practice receipt and a real receipt eventually carry the
  same number, and §27.19's audit is not enough to tell them apart on paper.
- `POST /session/mode` is a server call, so **practice cannot be entered or left offline** — meaning
  a device stuck in practice mode during an outage cannot get back to selling. Not stated anywhere.

---

### HS-17 — `trackStock` appears exactly once in 3,227 lines · **MAJOR** · [Devil's Advocate]

`Product.trackStock` (line 1861). One occurrence in the entire PRD, in a field list, with no note.

**The questions:** does selling a `trackStock = false` product emit a `StockMovement`? If not,
§11's rule *"`StockMovement.sourceId` — Required — a movement with no source is a bug"* is fine, but
§10.4's replay-vs-cache check must skip it, and §20.2's COGS must decide whether a non-stocked line
has a cost at all. What is `avgCostMdram` for a cutting charge or a delivery fee? What does a
**return** of one do? What does §13.6's negative-stock rule mean for it?

A hardware store will use this within a week — cutting to length, key copying, delivery, hire of a
tool. It is the field most likely to be implemented by whoever happens to hit it first, differently
in three places.

---

### HS-18 — `Payment.amount` vs `tenderedAmount` vs `changeGiven` · **MAJOR** · [Devil's Advocate]

Line 2016: *"`Payment.amount` — > 0; a split tender's payments sum to **≥** `Sale.total`."*

**Why `≥` and not `=`?** If `amount` is the applied amount, the sum is exactly `total` and the `≥`
is wrong. If `amount` is what was handed over, then §12.5's `cashSales` term — *"`Payment.method =
CASH`, on COMPLETED sales in this shift"* — **includes the change that was given back**, and expected
cash is overstated by the change on every cash sale of the day. That is the same bug as the
repayment double-count §12.5 boasts of having fixed, one field to the left.

`tenderedAmount?` and `changeGiven?` are nullable and their relationship to `amount` is never
written down. The invariant the shop needs — `Σ amount − Σ changeGiven == total`, or
`amount = tenderedAmount − changeGiven` — appears nowhere, and §12.5 sums `amount` without saying
which reading it assumes.

---

### HS-19 — Sale-level discount and cash rounding are not reversible per line · **CRITICAL** · [Devil's Advocate]

§10.1's identity: `total = subtotal − discountTotal + roundingAdjustment` (tax-inclusive).
`Sale.discountTotal` is a **sale-level** figure. §12.1 offers sale-level discounts explicitly.
`SaleReturnLine.refundAmount` (line 1874) is per line, and nothing apportions.

**The question:** a 100,000 ֏ basket gets a 10% sale-level discount and pays 90,000. One line worth
20,000 gross comes back. What is `refundAmount`?

- 20,000 — the shop refunds more than it received on those goods, on **every discounted sale that is
  partially returned**. A worker who understands this has a slow, deniable, per-transaction leak: buy
  a discounted basket, return the expensive line.
- 18,000 — correct, but requires an apportionment rule the PRD never states, and rounding rules
  §10.1 never covers (it names exactly two carve-outs: the stored WAC and the per-line extracted tax
  — a per-line share of a sale-level discount would be a third).

Same problem, smaller, with `roundingAdjustment`: a −3 ֏ cash rounding on a five-line sale, one line
returned. Nothing says what happens to the 3 ֏.

§10.1 goes to great lengths to correct an earlier identity that assumed no sale-level discount
existed. §12.4 was not re-swept afterwards.

---

### HS-20 — Backup restore rewinds a counter the PRD says never rewinds · **MAJOR** · [Devil's Advocate]

§19.2: hourly snapshots during trading. §27.10: restore onto a different machine, by the owner.
Line 2027: *"`Device.lastSequence` — Monotonic, never reset. The device may be ahead of the server
row; **the server never rewinds it**."*

A restore rewinds it, along with every sale since the snapshot.

**The questions:**
- After a restore, the tills' outboxes are **empty** — those sales drained successfully before the
  crash. Nothing re-posts them. §14.2 guarantee 1, *"A completed sale is never lost,"* is false at
  the system level, and the client-side design that makes it true (retain-until-acked) stops exactly
  one hop too early. Nothing in §14.4 says a device keeps a copy of *acknowledged* sales, and there is
  no re-drain or reconcile endpoint.
- Up to an hour of stock movements, debt charges and cash movements vanish while the **cash is still
  in the drawer** and the **goods are gone from the shelf**. There is no reconciliation procedure in
  §19.2 for the gap between the snapshot and the crash — only a restore drill (§27.10) that proves
  the file opens.
- Receipt numbers issued after the snapshot are gone from the server but printed on paper in
  customers' hands. Because the device counter is authoritative, no duplicates are issued — good —
  but the server's record has a hole, which is §26 Q10's problem arriving through the back door.

**Minimum fix:** the device keeps acknowledged sales for N days and offers "re-send everything since
{time}" as an owner action in §19.5's diagnostics. It is cheap now and impossible later.

---

### HS-21 — Fiscal double-entry is an adoption risk, not just a compliance one · **MAJOR** · [Devil's Advocate]

§17's interim position: *"Simon operates as an internal management and stock system alongside
whatever fiscal device the shop already uses."* §25 rates fiscal non-compliance **Likely / Fatal**
and mitigates it by resolving §17.

**What §25 does not rate:** every cash sale in the pilot store must be rung up **twice** — once into
the ՀԴՄ and once into Simon — by a worker under queue pressure whom §21 gives 15 seconds. Some
percentage will be rung into one and not the other. §27.1's 15-second target measures Simon's half
of a 30-second job.

The consequences land on the exact figure §25 says destroys trust: *"Owner stops trusting the
numbers — one unexplainable figure is enough."* Simon's daily takings will not equal the ՀԴՄ's
Z-total, and the discrepancy will be attributed to Simon.

`Sale.fiscalReceiptId` exists in the schema (line 1870) but **no screen captures it** — §6.2's
payment screen has no field for it, and there is no acceptance criterion touching it. The seam is
reserved and unused, which is right for v2 and leaves v1 with no way to tie a Simon sale to its
fiscal receipt even manually.

**The concrete question for the pilot:** which device does the worker ring first, and what does the
till do when the ՀԴՄ is out of paper, offline, or refuses the sale?

---

### HS-22 — `GoodsReceiptLine` cannot reprint the invoice it came from · **MAJOR** · [Devil's Advocate]

`SaleLine` (line 1871) snapshots `uom` **and** `factorToStockUom`.
`GoodsReceiptLine` (line 1883): `id, receiptId, productId, qty, unitCostMdram, apportionedLandedCost`
— **no `uom`, no `factorToStockUom`**, and a blank Notes cell.

§27.3 makes "3 spools × 50 m adds 150 m" an acceptance criterion. After the commit, the receipt says
`150` and cannot say `3 spools`. The paper invoice in the owner's hand says 3 spools at a spool
price. Reconciling a delivery against the supplier's invoice — the actual daily job — requires
dividing by a factor stored on a mutable `ProductUnit` row.

And `ProductUnit.factorToStockUom` **is** mutable: its only validation is *"> 0"* (line 2008).
§6.12 blocks changing `decimalPlaces` and `stockUom` after movements exist, with a good reason. It
says nothing about the packaging factor. Change a spool from 50 m to 100 m and every historical
goods receipt silently re-reads as double what it was, and §13.7's purchase return against an old
receipt line reverses the wrong quantity.

The asymmetry is the tell: the selling side snapshotted the factor because someone thought about
reprints. The buying side did not.

---

### HS-23 — A `SaleReturn` does not record the tax it reversed · **MAJOR** · [Devil's Advocate]

§10.8: *"**Returns extract at the original rate**, from the original line, for the same reason cost
is reversed at the original average."* And, one paragraph earlier: *"The rate is snapshotted onto the
line as `taxRateBp`, exactly as `unitCostMdram` is."*

`SaleReturnLine` (line 1874) snapshots `unitCostMdram` — and **not** `taxRateBp` and **not**
`lineTax`. It carries `refundAmount` only.

So the document that reverses tax does not record the tax it reversed. Any period VAT figure must
join back through `saleLineId` into a sale that may be years old, and §10.8's stated principle — a
setting or rate that changes arithmetic is snapshotted onto the document it changed — is applied on
one side of the transaction and not the other. Under a **tax-exclusive** basis this is worse, because
`refundAmount` is then ambiguous about whether it includes tax at all, and `SaleReturn` does not
carry `priceBasis` either.

---

### HS-24 — Held baskets, and the till that never comes back · **MAJOR** · [Devil's Advocate]

§14.5: *"Park a basket ✅ — but **no other till can resume it until this one syncs**, because until
then the basket exists only on this device."*

Shift close guard (§11, Lifecycles): closing requires every `DRAFT`/`HELD` sale *"whose `shiftId` is
this shift"* to be completed, voided, **or resumed on another till**.

**The server cannot see an unsynced held basket.** So the guard passes, the shift closes, the
Z-report prints — and later the basket arrives as `status: HELD` naming a `CLOSED` shift, which the
validation rule at line 2029 forbids (*"Names an `OPEN` shift at every write"*).

If the phone is stolen, dropped in a bucket, or simply never reconnects, the basket is gone with no
record it ever existed — and the goods may be sitting behind the counter in a bag with the customer's
name on it.

`Device.parkedDepth` is client-reported on a heartbeat (§16.3), so the server *may* know a count.
Nothing uses it as a close guard, and §19.5's alerts deliberately **exclude** parked baskets
(*"parked baskets are excluded, since one may sit there all afternoon by design"*). So the one
number that could warn about this is explicitly suppressed.

---

### HS-25 — Undo, the outbox, and 5 seconds · **MINOR→MAJOR** · [Devil's Advocate]

§8.1 gives "Remove a basket line" and "Change a quantity" a 5-second undo, and "Complete a sale" **no
confirmation at all** — deliberately, and rightly, because it is the goal.

But completion writes the sale into the outbox immediately (§14.4) and prints (§12.1). A worker who
completes on the wrong customer, or completes twice because the printer was slow, has **no undo** and
must use a return — which §8.1 hard-confirms and which, per HS-1, breaks the drawer arithmetic.

§8.2's row *"Wrong customer on a debt sale — Change before payment; after, an admin correction"* is
honest about this. It just means the most common till mistake costs an admin, a reversal, and a
`DebtEntry.reversesId` chain — several times a week, in a shop whose admin is the owner who is not
always there.

---

## 2. Missing Scenarios

**[Devil's Advocate]** Every one of these is either absent from the PRD or mentioned in a way that
does not survive contact with a shop.

### MS-1 — Two tills sell the last unit, one of them offline
Partly handled: §13.6 allows negative stock, §14.6 flags it on sync. **What is missing** is the
`balanceAfter` ordering problem (HS-10) and the fact that the *second* sale is the one flagged even
though it may have been *first* in wall-clock time. The recount list names the product, not the sale,
so the owner cannot tell which till was wrong — and in a collusion investigation that is the only
question that matters.

### MS-2 — A sale synced after the shift it belonged to was closed and reported
HS-4 / C-1. The 1% case that will happen weekly in a shop with patchy Wi-Fi.

### MS-3 — A supplier delivers goods with no price
Not "goods that were never ordered" — §6.7 makes unordered delivery the *primary* path, and that is
handled well. The real case is the delivery whose invoice follows by a week, or whose price is
"we'll agree it later" — completely normal in Armenian small trade. §13.2 requires unit costs at
receipt and the WAC moves on commit. The worker types 0 or a guess, and per HS-5 and HS-6 that number
is now permanent in every sale line it touches. **There is no "cost pending" receipt state and no
cost-amendment document.**

### MS-4 — A customer pays a debt in dollars, or in goods
Multi-currency is a v1 non-goal (line 1500), which disposes of the *feature* and not the *event*.
The drawer will contain dollars; §6.6's `countedBreakdown` counts dram denominations and has no
concept of a second currency; the worker will convert at a rate nobody records; and the variance
lands on the theft-detection screen. **Paying with goods** is worse: it is a return against a
*different* sale than the one that created the debt, which §6.5's "always starts from the original
sale" structurally forbids, so it will be entered as a blind return (admin-only) or as a fictional
`PAY_IN`.

### MS-5 — A product's unit of measure changes after stock exists
§6.12 blocks `stockUom` and `decimalPlaces`. **`ProductUnit.factorToStockUom` is not blocked** (HS-22)
— the supplier changes their spool from 50 m to 100 m, someone edits the number, and every historical
receipt and every open purchase return silently re-reads.

### MS-6 — An admin edits a cost price after margins were reported
HS-5. There is no edit path at all (§10.7), which sounds like safety and is actually the absence of a
restatement mechanism.

### MS-7 — A customer is merged while one of their sales is in an outbox
`POST /customers/:id/merge` *"re-points every `DebtEntry`"* (line 2410). A queued debt sale naming the
absorbed customer arrives afterwards. `mergedIntoId` is a forwarding address — does the sync follow
it, or write a `CHARGE` against a customer whose `isActive` is false and whose row is *"read-only"*
(line 2036)? §14.6 has a `product-deactivated-on-sync` warning and **no customer equivalent**.

### MS-8 — A product is deleted from the catalogue cache but sits in a held basket
§14.4 caches the catalogue; §6.12 deactivates products. `product-deactivated-on-sync` handles a
*completed* sale. A **held** basket resumed on another till after the product was deactivated is not
covered — §11 permits the resume, and the basket may be days old.

### MS-9 — The last admin is locked out with a lost recovery code
§16.2 gives three routes out: another admin, 15-minute expiry, recovery code. If the shop has **one**
admin (the design assumption: an owner and two workers, §2.1) whose lockout has not yet expired and
whose recovery code is in a drawer at home, the shop cannot change a price, approve a discount, take
a blind return or open the drawer for 15 minutes. Survivable. **What is not covered** is the code
being lost permanently — there is no offline break-glass on the host, and §24.1 says there is no
remote access. The runbook has nothing to say.

### MS-10 — The host PC sleeps
§14.1 opens by mocking the previous draft for exactly this — *"if that PC sleeps, an 'offline-first'
app stops selling"* — and then never specifies that the host must be configured never to sleep. It is
a Windows machine in a back room. It will sleep. Nothing in §19.5's `/health`, §22's runbook or
§27's criteria checks power settings, and the failure presents as "the Wi-Fi is bad."

### MS-11 — A return of a return
`SaleReturn` has no `reversesId`. A return keyed against the wrong sale line, or with `restock`
answered wrongly (goods marked damaged that were actually fine), has no correction path — and
§12.4's per-line quantity check would then block the correct return, because the quantity was
already consumed by the wrong one.

### MS-12 — Two admins change the same price in the same minute
Explicitly addressed and dismissed (§15.2: last write wins, both survive in `PriceHistory`). Fine.
**What is not addressed** is `Setting` under the same rule: two admins, one flips the price basis and
one flips cash rounding. `Setting` has no `updatedAt`, no audit requirement in §10.7's list, and
§10.8 hangs an entire arithmetic identity off it.

### MS-13 — A worker's session expires mid-payment
§16.3 promises a re-auth prompt *"never discards a basket"* and §8.5's `session-expired` says the
basket is preserved. But a `401` arrives from the **outbox drain**, not from the basket — the sale is
already complete and queued. §14.4 says retry on network/5xx and never on other 4xx. A `401` is a
4xx. **So a completed, queued sale whose session expired before it drained is parked and surfaced as
an error, not retried after re-login.** The one 4xx that is transient is treated as permanent.

### MS-14 — Opening stock is imported wrong, and discovered in month two
§19.1 imports opening stock and opening debts idempotently, with `naturalKey`. It says nothing about
*undoing* a batch. `ImportBatch` has no reversal, and opening stock lands as `OPENING_BALANCE`
movements which are append-only. The fix is hundreds of adjustments, uncoded (HS-12), or a restore
that loses everything since.

### MS-15 — A cash drop, and the money that is not in the drawer
`CashMovement.DROP` reduces expected cash. Nothing tracks where it went — there is no safe, no
banking record, no destination field beyond free-text `reason`. §16.1's threat #2 is a worker
covering cash theft; a `DROP` with a plausible reason is the cheapest way to do it, and it has **no
re-auth requirement** while `NO_SALE` (which moves zero money) does.

### MS-16 — The receipt printer is offline when the sale completes
§12.1: *"Printing happens **after** commit."* Correct. But there is no print queue, no reprint
prompt persisted, and §8.2's remedy (*"Sale is already saved; offer reprint"*) assumes the app is
still on screen. A power cut between commit and print leaves a sale with no receipt and a customer
with no proof — and under a fiscal regime, no fiscal receipt either.

---

## 3. Contradictions

### C-1 — A completed sale that survives an outage cannot be posted · **CRITICAL** · [Devil's Advocate]

> **§11, field conventions, line 2029:**
> `Sale.shiftId` — "Names an **`OPEN`** shift at every write, and must not change once
> `status = COMPLETED`."

> **§6.6, line 953:**
> "Closing with unsynced sales requires explicit acknowledgement — the Z-report would otherwise be
> incomplete."

> **§11, `Shift`, line 1902:**
> "`unsyncedAtClose` records how many sales were still queued when the shift closed."

> **§14.2, guarantee 1:**
> "A completed sale is never lost. It represents goods that physically left the shop."

The PRD explicitly designs for, counts, and prints the case of a shift closing with sales still in an
outbox — and its own validation rule makes those sales unpostable when they arrive, because the shift
they name is now `CLOSED`.

Every exit is blocked:
- **Reject** → violates §14.2 rule 1, and the rejection is a `422`, which §14.4 says is never retried
  ("park those and surface them"). The sale dies in the needs-attention list with no remedy, because
  `Sale.shiftId` is frozen at `COMPLETED` and cannot be re-pointed at an open shift.
- **Accept against the closed shift** → violates line 2029, and retroactively changes a closed
  period whose Z-report is printed and whose cash is counted.
- **Re-point to the currently open shift** → violates *"must not change once `status = COMPLETED`"*,
  and puts yesterday's takings in today's drawer.

**This is not a wording problem.** It is a missing entity: there is no concept of a sale that belongs
to a *reporting period* independently of a *drawer*. The two are conflated in `Sale.shiftId`, and the
offline design guarantees they can diverge.

**Applies identically to `POST /api/cash-movements`** (`shiftId` in the body, line 2395), and to the
`CashMovement REPAYMENT` written by an offline repayment (§12.3, §14.5).

**Also note** the same rule collides with §11's own held-basket transfer design: *"`shiftId` is set
when the basket is created, rewritten to the completing shift if the sale is resumed on another
till."* A basket created under a shift that has since closed, then resumed — the write names a
`CLOSED` shift at the moment of creation-in-the-database. See HS-24.

---

### C-2 — `sale-already-returned` contradicts partial returns · **MAJOR** · [Devil's Advocate]

> **§8.5, line 1435:**
> `sale-already-returned` | `422` | «Այս վաճառքն արդեն վերադարձվել է» | "Open the existing return"

> **§12.4:**
> "Each `SaleReturnLine` names the `saleLineId` it reverses and **cannot exceed that line's quantity
> sold, less what has already been returned against it** — the check is per line, not per sale, or two
> half-returns pass a whole-sale test."

§12.4 goes out of its way to say the check is **per line and not per sale**, and §8.5 then defines a
**per-sale** blocking error whose user guidance ("open the existing return") assumes one return per
sale. §6.5 says *"Partial quantities allowed"* and §27.6 makes partial return an acceptance criterion.

Either `sale-already-returned` fires only when *every* line is fully returned — in which case
`return-exceeds-sold` already covers it and the type is redundant — or it fires on the existence of
any prior return, in which case §12.4's per-line rule is unreachable and a customer cannot bring back
a second item on Thursday.

The `type` strings are declared **frozen** in §8.5. This one should be struck before anything is
built on it.

---

### C-3 — §27.22 certifies a formula that is wrong in production · **CRITICAL** · [Devil's Advocate]

> **§27.22, line 3217:**
> "Returning a delivery to a supplier **restores the weighted average to what it was before that
> delivery arrived**, and credits the invoice amount while recording the unrefunded freight
> separately (§13.7)."

> **§13.7, line 2202:**
> `newAvgCost = (stockQty × currentAvgCost − returnQty × receiptLandedUnitCost) ÷ (stockQty − returnQty)`

The criterion is only satisfiable when nothing was sold between the receipt and the return. See
HS-7's worked table: with 8 units sold in between, the formula yields **8 ֏** against a true cost of
**12 ֏** and a pre-delivery average of **12 ֏**. The acceptance test will be written the way the
criterion is worded — no intervening sale — pass, and bless the wrong behaviour.

`FR-BUY-06` (line 1552) points at §27.22 as its only verification.

---

### C-4 — "Allocation recomputed on sync" contradicts append-only · **MAJOR** · [Devil's Advocate]

> **§14.5, line 2289:** "Repayment | ✅ | Additive; **allocation recomputed on sync**."

> **§11, Lifecycles:** "`GoodsReceipt`, `SaleReturn`, `DebtEntry`, `StockMovement` and `CashMovement`
> have no lifecycle at all: **written once, inside one transaction, never updated** (§10.7)."

> **§10.7:** "Correction, never deletion."

> **CLAUDE.md:** "Stock is an append-only `StockMovement` ledger … Debt works the same way."

`DebtAllocation` is the one financial table that is neither in the never-updated list nor given a
correction document — and §14.5 grants permission to rewrite it in a table cell. §10.6 separately
insists aging must be stable and reproducible, which recomputation defeats.

Compounded by HS-9's two-tills-one-debtor case, where recomputation is not merely permitted but
*required*, and produces allocations that violate their own CHECK constraint with no warning type to
carry the outcome.

---

### C-5 — The client sets the money; §16.5's principle is applied in one direction only · **CRITICAL** · [Devil's Advocate]

> **§16.5:** "**Hiding cost in the UI is not a control.** §27 tests this explicitly."

> **§12.1:** "**Discounts** are line-level or sale-level, percentage or fixed, gated by role and
> capped by a configurable maximum. Above the cap: admin PIN plus a reason."

> **§15.1:** "Ids are client-generated … A `POST` carries the id of the thing being created."
> **§15.3:** `POST /api/sales` — "Body carries `id`, `status`, `shiftId`, **lines**, payments."

> **§16.6:** "**CORS is not a security control.** It restricts browsers; `curl` ignores it entirely."

The document is admirably clear that a UI control is not a control — for *reading* cost. It never
states the same rule for *writing* price, discount and line total, and the API contract hands all
three to the client with no recomputation clause. §27.9 tests the read side. Nothing tests the write
side.

---

### C-6 — `Device.lastSequence` "never rewinds" · **MAJOR** · [Devil's Advocate]

> **§11, line 2027:** "`Device.lastSequence` — Monotonic, never reset. The device may be ahead of
> the server row; **the server never rewinds it**."

> **§19.2:** "Hourly [snapshots] during trading hours" · **§27.10:** "The database is restored from
> backup **onto a different machine, by the owner**."

A restore rewinds it by up to an hour of sales. Not fatal — the device counter is authoritative, so
no duplicate numbers are issued — but the invariant as written is false, and the reconciliation
between the restored server and the ahead-of-it devices is nowhere in the runbook.

---

### C-7 — §14.5 omits returns; §14.3 and §15.3 assume them · **MAJOR** · [Devil's Advocate]

> **§14.3:** "Applies to every queue-drained endpoint: **sales, returns, repayments, cash
> movements**."

> **§14.5's table** (lines 2284–2291) lists neither returns nor cash movements.

§14.5 is the normative statement of what may happen offline. Two of the four queue-drained endpoints
are missing from it. See HS-14.

---

### C-8 — §10.8's snapshot principle is not applied to `SaleReturn` · **MAJOR** · [Devil's Advocate]

> **§10.8:** "**A setting that changes arithmetic is snapshotted onto the document it changed.**"
> and "The rate is snapshotted onto the line as `taxRateBp`, exactly as `unitCostMdram` is."

> **§11, line 1874:** `SaleReturnLine` — `id, returnId, saleLineId, productId, qty, unitCostMdram,
> refundAmount, restock`.

Cost is snapshotted. Rate, tax and price basis are not, on a document that §10.8 explicitly says
performs a tax extraction. See HS-23.

The §10.8 sweep note reads: *"Swept against §6.11 (2026-09-10): the price basis is the only setting
with this property."* The sweep covered settings. It did not cover documents.

---

### C-9 — `AuditLog.reason` is required for a void, but void needs no justification step · **MINOR** · [Devil's Advocate]

> **§11, `AuditLog`, line 1908:** "`reason` is the text a person typed to justify an override — price
> override, credit-limit override, discount above the cap, **blind return**, stock adjustment. It is
> required for those actions and null elsewhere."

> **§10.7:** the audited action list includes "**basket void**".

Void is audited but is not in the reason-required list, and §16.3 does not re-auth it and §8.1 does
not confirm it. Whether that is deliberate or an omission decides HS-11. Given §16.1 ranks voiding as
threat #2, "deliberate" is hard to defend.

---

## 4. Failure Modes

**[Devil's Advocate]** What actually goes wrong on a Tuesday.

### FM-1 — Power cut between commit and print
§12.1 commits then prints. WAL protects the database. The customer has no receipt, the worker is not
sure the sale landed, and the till reboots with the basket gone (§12.1 guarantees only that **held**
sales survive a restart — a live `DRAFT` basket has no stated persistence, and §15.3's `POST /sales`
accepts only `HELD` and `COMPLETED`, so a `DRAFT` may never exist server-side at all).

**The likely human response is to ring it again.** Idempotency does not protect against a *human*
duplicate — a re-rung sale is a new client id, a new UUIDv7, a genuinely new document. §14.2
guarantee 2 protects against dropped responses, not against uncertain workers. There is no
"was my last sale saved?" affordance anywhere in §6.1 or §8.2, and §8.2's row for this case
("Printer jams — Sale is already saved; offer reprint") assumes the app survived.

### FM-2 — Tablet dies with a full outbox
The queue is in IndexedDB on that device. `Device.outboxDepth` tells the owner *how many* are lost;
nothing tells him *what*. `outboxOldestAt` tells him how far back. §19.5 alerts on a sale older than
an hour — good — but once the device is dead the alert stops updating and the row goes stale at
whatever it last reported. **There is no server-side record of a sale that never arrived**, by
construction, and no reconciliation procedure (count the stock, count the cash, work backwards).
The goods are gone and the cash is in a drawer that will now show a surplus, which the worker may
keep.

### FM-3 — SQLite corruption
§19.2 covers restore. What is not covered: **detecting** corruption. `/health` reports database size,
WAL checkpoint age and last backup — not `PRAGMA integrity_check`. A corrupt page in a rarely-read
table can sit for weeks while hourly backups faithfully copy it, rotating the last good copy out of
grandfather-father-son. §19.2's *"An untested backup is not a backup"* is right and stops one step
short: an unverified *database* is what gets backed up.

### FM-4 — The fiscal device is offline or out of paper
Not modelled at all. §17's interim position (Simon beside the ՀԴՄ) means the shop's legal obligation
runs on a device Simon knows nothing about. When it fails, the worker either stops selling — which
rule 1 forbids and Simon cannot enforce — or sells into Simon only, and the shop is out of compliance
with a perfect internal record of it. Simon becomes the **evidence** of the violation. That deserves
a written line in §17's "must be stated to every pilot store in writing."

### FM-5 — Clock skew between till and server
See HS-10. Concretely, the three places money moves:
- a debt charge dated a month early lands in the wrong aging bucket and the owner chases the wrong
  debtor (§27.5 fails and nobody knows why);
- a sale dated after midnight lands in tomorrow's daily report while its `shiftId` says yesterday's
  shift, so the two reports the owner compares disagree by that sale;
- `StockMovement.createdAt` ordering vs `balanceAfter` insertion ordering makes §10.4's replay check
  either spuriously noisy or silently blind, depending on which order the job picks.

**No clock validation, no skew warning, no server-authoritative timestamp rule, no timezone setting.**
"timezone" occurs zero times in 3,227 lines.

### FM-6 — Staff colluding to hide cash
The controls that exist: per-user PINs, audit log, discount-by-worker report, variance at close,
re-auth on five privileged actions, `NO_SALE` recorded.

The gaps: **void** is unguarded (HS-11); **`DROP`** moves money out of the drawer with free text and
no re-auth (MS-15); **cash refunds** break the drawer arithmetic in the thief's favour by making a
shortfall look like a software bug (HS-1); and the detective control that would catch the resulting
stock discrepancy — **stocktake — is v2** (§13.4).

Two people on the same shift compound it further, because §12.5 reconciles a shift and HS-13 shows
two shifts can share one drawer with no model of that fact.

### FM-7 — Wi-Fi that is not down, but bad
The whole offline design is binary: connected or not. A shop router at 40% packet loss produces
requests that time out at 30 seconds while the till is nominally "connected", so §8.3's calm strip
never appears, the outbox never engages, and §21's 200 ms scan budget becomes 30 seconds per
barcode lookup on the hottest path in the system. There is no stated timeout, no fast-fail threshold,
no "treat as offline after N failures" rule. This is the single most likely field failure and it has
no design.

### FM-8 — The needs-attention list nobody attends
Every conflict, every failed post, every negative stock, every drift flag lands in `ReviewFlag`
(§14.6, §13.6, §10.4, §19.5). There is no severity, no age-based escalation, no cap, no digest, and
`POST /review-flags/:id/resolve` clears a row without requiring the condition to be fixed (HS-12).
In a shop with patchy Wi-Fi, month two shows several hundred rows, and the list becomes the
electronic equivalent of the drawer where the paperwork goes.

---

## 5. What I would settle before a line of code

Ranked by cost of being wrong, not by difficulty:

1. **C-1 / HS-4** — invent the missing concept: a sale belongs to a *drawer* and to a *period*, and
   the offline design guarantees they diverge. Everything else in the shift model waits on this.
2. **HS-1** — add `CashMovement.REFUND` and `SaleReturn.shiftId`, or say in one sentence how a cash
   refund reaches §12.5's formula. This is a two-field fix now and a reconciliation nightmare later.
3. **HS-8 / C-5** — decide whether the server recomputes sale money. It determines whether the
   discount cap is a control or decoration.
4. **HS-7 / C-3** — reopen §13.7's formula against the case where stock turned over, and rewrite
   §27.22 so it can fail.
5. **HS-6** — make `avgCostMdram` nullable. Cheapest fix in the document, and it is load-bearing for
   every margin figure the owner will ever see.
6. **HS-2 / HS-3 / HS-19** — write the return rules for settled debt, split tender, and sale-level
   discount. Three paragraphs; each is money on every occurrence.
7. **HS-5** — decide what a cost correction *is*, given that §10.5 forbids editing history.
8. **HS-11** — put void behind re-auth and on the shrinkage report, since stocktake is v2.
9. **HS-10 / FM-5** — name the authoritative clock and the ledger's ordering key; add a timezone
   setting.
10. **HS-9 / C-4** — decide whether `DebtAllocation` is append-only or not, and give the offline
    double-allocation case a warning type.

The PRD's own discipline is the reason these are findable: it states its invariants precisely enough
to be caught contradicting them. That is a compliment with a bill attached.
