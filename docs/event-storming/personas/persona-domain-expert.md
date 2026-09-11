# Event Storming — Phase 1 Chaotic Exploration
## Persona: **[Domain Expert]** (Subject Matter Expert — Armenian hardware/grocery shop)

Domain under storm: the full buy–sell cycle — purchasing / goods receipt / inventory through
selling / payment / debt / returns / shifts.

Grounded in `docs/prd.md` §2, §4, §6, §10–§13, §17, §20 and the CLAUDE.md invariants.

Sticky colours used below:
🟧 **Event** (past tense) · 🟦 **Command** · 🟨 **Actor** · 🟪 **Policy** ("whenever… then…")
🟥 **Hotspot / disagreement** · 🟩 **Read model** · ⬛ **Aggregate candidate** · 🩷 **External system**

Everything on this page is marked **[Domain Expert]** as required.

---

# 1. Domain Events

I have grouped them the way the shop actually experiences them, not the way a schema would.
Count: **68 events**.

## 1.1 Opening & closing the day (⬛ Shift)

🟧 **[Domain Expert] Shift Opened** — Գոռ counted what was already in the drawer and typed one number.
🟧 **[Domain Expert] Opening Float Counted** — separate from the above: the *counting* is the trusted act; the shift open is the consequence.
🟧 **[Domain Expert] Till Registered** — a phone used the first time gets its two-character prefix; it never gets another.
🟧 **[Domain Expert] Worker Signed In** (PIN accepted)
🟧 **[Domain Expert] Worker Locked Out** (PIN wrong too many times, mid-queue)
🟧 **[Domain Expert] Cash Paid Into Drawer** — Արամ dropped 50,000 in for change.
🟧 **[Domain Expert] Cash Paid Out Of Drawer** — Գոռ paid the water delivery man 4,000 from the till.
🟧 **[Domain Expert] Cash Dropped To Safe** — mid-afternoon, too much cash on a phone shop counter.
🟧 **[Domain Expert] Drawer Opened Without A Sale** (`NO_SALE`) — the classic cover for a hand in the till.
🟧 **[Domain Expert] Mid-Shift Totals Read** (X-report) — Արամ rang and asked "how much so far?"
🟧 **[Domain Expert] Shift Close Begun** — expected cash computed and frozen on screen.
🟧 **[Domain Expert] Cash Counted By Denomination** — 5000×30, 1000×32… people count in stacks.
🟧 **[Domain Expert] Cash Variance Recorded** — −400 ֏, with a note, without an accusation.
🟧 **[Domain Expert] Shift Closed** (Z-report issued)
🟧 **[Domain Expert] Shift Close Blocked By An Open Basket** — a parked basket is not a closed period.
🟧 **[Domain Expert] Unsynced Sales Acknowledged At Close** — the Z-report admits to what it does not yet have.
🟧 **[Domain Expert] Shift Close Cancelled** — the phone rang halfway through counting.
🟧 **[Domain Expert] Shift Ran Past Midnight** — the shop shut at 01:20; the day and the shift disagree.

🟪 **[Domain Expert] Policy:** whenever a *cash* repayment is taken → a `REPAYMENT` cash movement is
written, and that row (never the debt entry) is what the drawer counts.
🟪 **[Domain Expert] Policy:** whenever a shift closes → every session bound to it ends.

## 1.2 Selling (⬛ Sale)

🟧 **[Domain Expert] Basket Started** — first line added; nothing exists before that.
🟧 **[Domain Expert] Item Scanned** — beep. The whole product lives or dies on this being under 200 ms.
🟧 **[Domain Expert] Unknown Barcode Encountered** — a sticker Simon has never seen, with a queue behind it.
🟧 **[Domain Expert] Product Quick-Added Mid-Sale** — name, price, done in 15 seconds; cost unknown.
🟧 **[Domain Expert] Item Found By Typed Name** — `malukh` typed on a Latin keyboard found `մալուխ`.
🟧 **[Domain Expert] Item Added From A Quick Tile** — no barcode exists at all (screws, sand, rope).
🟧 **[Domain Expert] Quantity Entered By Weight** — 2.5 kg, read off the scale and typed by hand.
🟧 **[Domain Expert] Quantity Entered In A Sale Unit** — 3 pre-cut 5 m lengths, not 15 m.
🟧 **[Domain Expert] Line Price Overridden** — long-press; the customer is a regular and Արամ said so.
🟧 **[Domain Expert] Line Discount Applied**
🟧 **[Domain Expert] Sale Discount Applied**
🟧 **[Domain Expert] Discount Above Cap Authorised** — admin PIN plus a typed reason.
🟧 **[Domain Expert] Line Removed From Basket** / **Quantity Corrected**
🟧 **[Domain Expert] Basket Parked** (Պահել) — the customer went to the car for money.
🟧 **[Domain Expert] Basket Resumed On Another Till** — and the takings move drawers with it.
🟧 **[Domain Expert] Basket Abandoned** (`VOIDED`) — never automatic; a person decided.
🟧 **[Domain Expert] Cash Tendered And Change Given**
🟧 **[Domain Expert] Cash Rounding Applied** — nobody has 3 ֏ coins; the receipt still has to add up.
🟧 **[Domain Expert] Card Payment Taken** — on the bank's own terminal, beside Simon, not through it.
🟧 **[Domain Expert] Split Tender Taken** — 5,000 cash and the rest on card.
🟧 **[Domain Expert] Sale Completed** — receipt number assigned *on the device*, then printing.
🟧 **[Domain Expert] Sale Sold Below Cost** — a real event, and one nobody currently notices.
🟧 **[Domain Expert] Sale Queued While Offline** — the Wi-Fi went; the customer still walked out with goods.
🟧 **[Domain Expert] Queued Sale Accepted On Reconnect**
🟧 **[Domain Expert] Duplicate Submission Ignored** — the retry that must not double-charge.
🟧 **[Domain Expert] Receipt Reprinted** — printer jammed; the drawer must *not* open this time.
🟧 **[Domain Expert] Sale Rung Through The Fiscal Device** 🩷 — a second, parallel act today (§17 interim position).

## 1.3 Nisya — selling on credit (⬛ Customer / DebtLedger)

🟧 **[Domain Expert] Customer Looked Up By Part Of A Name** — "Դավ" while he stands there.
🟧 **[Domain Expert] Existing Debt And Its Age Shown To Both Parties** — *the* event this product exists for.
🟧 **[Domain Expert] Debt Sale Recorded** (`CHARGE`)
🟧 **[Domain Expert] Credit Limit Warned About** / 🟧 **Credit Limit Override Authorised With A Reason**
🟧 **[Domain Expert] Blocked Customer Refused Credit**
🟧 **[Domain Expert] Due Date Promised** — "before the 20th" — which is *not* the same as aging.
🟧 **[Domain Expert] Debt Repaid In Full**
🟧 **[Domain Expert] Debt Partially Repaid** — the normal case, not an edge case.
🟧 **[Domain Expert] Payment Allocated Oldest-First** / 🟧 **Allocation Overridden By Hand** — "this one, not that one; that job isn't paid yet."
🟧 **[Domain Expert] Overpayment Turned Into Credit**
🟧 **[Domain Expert] Repayment Receipt Printed** — the paper acknowledgement the relationship runs on.
🟧 **[Domain Expert] Debt Charged To The Wrong Customer, Then Reversed** — admin correction, linked.
🟧 **[Domain Expert] Debt Went Overdue** / 🟧 **Debt Crossed Into 90+ Days**
🟧 **[Domain Expert] Debt Written Off As Uncollectable** — he left the country. **No event or model exists for this today.** 🟥
🟧 **[Domain Expert] Offline Debt Cap Reached** — 20,000 ֏ per customer per outage, then cash only.
🟧 **[Domain Expert] Credit Limit Breach Discovered On Sync** — the goods left the shop an hour ago.

## 1.4 Returns from customers (⬛ SaleReturn)

🟧 **[Domain Expert] Receipt Scanned To Start A Return**
🟧 **[Domain Expert] Goods Returned To Stock** (resellable)
🟧 **[Domain Expert] Goods Returned Damaged And Written Off** — same return document, different line.
🟧 **[Domain Expert] Part Of A Line Returned** — 12 m of the 50 m spool came back.
🟧 **[Domain Expert] Second Partial Return Against The Same Line**
🟧 **[Domain Expert] Refund Paid In Cash** / 🟧 **Refund Applied Against A Debt** (credit `ADJUSTMENT`)
🟧 **[Domain Expert] Blind Return Authorised By Admin** — no receipt; the fraud path, so it is gated.
🟧 **[Domain Expert] Return Refused — Exceeds What Was Sold**
🟧 **[Domain Expert] Exchange Performed** — return + re-sell, two documents, one conversation at the counter.

## 1.5 Buying & receiving (⬛ GoodsReceipt / Supplier)

🟧 **[Domain Expert] Delivery Arrived Unannounced With A Paper Invoice** — the *primary* path, not the exception.
🟧 **[Domain Expert] Goods Received** — `PURCHASE_RECEIPT` movements posted.
🟧 **[Domain Expert] Delivery Charge Entered And Spread Across The Goods** — "Առաքման ծախս", one field.
🟧 **[Domain Expert] Average Cost Moved** — silent, invisible, and the whole basis of "վաստակ".
🟧 **[Domain Expert] Purchase Unit Converted To Stock Unit** — 3 spools became 150 metres.
🟧 **[Domain Expert] Partial Delivery Received** — 8 of the 10 ordered; the rest "next week".
🟧 **[Domain Expert] Over-Delivery Received** — 12 arrived, 10 invoiced.
🟧 **[Domain Expert] Substituted Item Received** — he sent a different brand "because it's the same thing".
🟧 **[Domain Expert] Bonus Goods Received** — 11 bags, invoiced for 10.
🟧 **[Domain Expert] Cost Price Changed On This Delivery** — the supplier raised it and said nothing.
🟧 **[Domain Expert] Receipt Booked Against The Wrong Supplier, Then Reversed**
🟧 **[Domain Expert] Supplier Paid In Cash From The Drawer** — no invoice, no receipt, no tax id.
🟧 **[Domain Expert] Supplier Payment Allocated To Specific Deliveries**
🟧 **[Domain Expert] Supplier Invoice Left Unpaid** (payable aged)
🟧 **[Domain Expert] Goods Returned To Supplier** — `PURCHASE_RETURN` at the **landed** cost.
🟧 **[Domain Expert] Freight On Returned Goods Lost** — the supplier refunds the invoice, never the delivery.
🟧 **[Domain Expert] Supplier Credit Note Received And Allocated**
🟧 **[Domain Expert] Reorder Suggested From Velocity** — "sells 4 a day, he takes 5 days to come".
🟧 **[Domain Expert] Item Ran Out Before The Reorder Fired**

## 1.6 Stock in the shop (⬛ Product / StockLedger)

🟧 **[Domain Expert] Opening Stock Imported** — day 1, from a spreadsheet or nothing at all.
🟧 **[Domain Expert] Stock Went Negative** — the item is physically leaving; refusing the record does not stop it.
🟧 **[Domain Expert] Item Flagged For Recount**
🟧 **[Domain Expert] Breakage Written Off** (`DAMAGE`) — a bag of cement split on the floor.
🟧 **[Domain Expert] Expiry Written Off** (`EXPIRY`)
🟧 **[Domain Expert] Theft Written Off** (`THEFT`) — recorded after the fact, usually at stocktake.
🟧 **[Domain Expert] Goods Taken For Internal Use** (`INTERNAL_USE`) — Արամ took paint for his own kitchen.
🟧 **[Domain Expert] Sample Given Away** (`SAMPLE`)
🟧 **[Domain Expert] Offcut Wasted** — 2 m left on the spool, unsellable. **No reason code covers this.** 🟥
🟧 **[Domain Expert] Stock Adjusted By Hand** (`ADJUSTMENT`) with a typed reason.
🟧 **[Domain Expert] Stocktake Started** (snapshot taken; the shop keeps trading)
🟧 **[Domain Expert] Shelf Counted** / 🟧 **Discrepancy Reviewed** / 🟧 **Stocktake Approved** (adjustments posted, shrinkage valued in drams)
🟧 **[Domain Expert] Stocktake Abandoned** — it took too long and the shop got busy.
🟧 **[Domain Expert] Cached Stock Drifted From The Ledger** — surfaced, never silently corrected.

## 1.7 Catalogue & prices (⬛ Product)

🟧 **[Domain Expert] Sell Price Changed** — and everyone wants to know who, and when.
🟧 **[Domain Expert] Price Changed In The Middle Of The Day** — with a parked basket priced the old way.
🟧 **[Domain Expert] Internal Barcode Generated And Labelled** — for the half of a hardware catalogue that has none.
🟧 **[Domain Expert] Second Barcode Added To A Product** — a new supplier's carton for the same screw.
🟧 **[Domain Expert] Barcode Retired** — but the old sticker on the shelf still has to scan.
🟧 **[Domain Expert] Duplicate Barcode Rejected** — never a silent reassign.
🟧 **[Domain Expert] Product Deactivated** — and a queued offline sale of it arrives ten minutes later.
🟧 **[Domain Expert] Product Pinned To The Quick Grid** — a stored decision, not a guess.
🟧 **[Domain Expert] Purchase Pack Size Changed By The Supplier** — the box holds 20 now, not 24. 🟥

## 1.8 The owner's view & the outside world

🟧 **[Domain Expert] Day's Earnings Read From The Doorway**
🟧 **[Domain Expert] Profit Figure Drilled Into Its Sales**
🟧 **[Domain Expert] Owner Disbelieved A Number** — the failure mode §2.3 names; treat it as a first-class event.
🟧 **[Domain Expert] Debtor Aging Reviewed** (0–30 / 31–60 / 61–90 / 90+)
🟧 **[Domain Expert] Dead Stock Surfaced**
🟧 **[Domain Expert] Books Exported For The Bookkeeper** — Սիրան, monthly, one click or she asks forever.
🟧 **[Domain Expert] Backup Taken** / 🟧 **Backup Failed Silently For A Week** 🟥
🟧 **[Domain Expert] Tax Regime Changed** — turnover threshold crossed mid-year.
🟧 **[Domain Expert] Fiscal Receipt Issued By The ՀԴՄ** 🩷 — today a parallel universe to Simon's own receipt.

---

# 2. Business Rules

## 2.1 Money and quantity (the non-negotiables)

- **[Domain Expert]** Transaction amounts — line total, sale total, payment, debt entry, cash movement —
  are **whole drams**, `Int`. That is what changes hands.
- **[Domain Expert]** Unit prices and unit costs are **milli-drams (×1000)**. A screw bought at 12 ֏ and
  13 ֏ averages 12.4 ֏; whole drams would make that drift visible in a month.
- **[Domain Expert]** Quantities are **milli-units (×1000)**. 2.5 kg is `2500`. Each product declares
  `decimalPlaces`, which is why the keypad refuses `2.5` pieces.
- **[Domain Expert]** Percentages are **basis points (×10000)**.
- **[Domain Expert]** Rounding is **half-up on the absolute value, exactly once, at the line total**.
  A return of 12.5 must round to the same magnitude as the sale of 12.5, or a partial return
  leaves a one-dram ghost nobody can explain.
- **[Domain Expert]** Only two values round in their own right: the stored weighted average cost and
  the per-line extracted tax. Neither is ever re-rounded downstream.
- **[Domain Expert]** The receipt identity must hold and must be **printed in full**, because a receipt
  whose arithmetic is invisible cannot be checked by the person holding it:
  `subtotal = Σ lineTotal`; inclusive → `total = subtotal − discountTotal + roundingAdjustment`;
  exclusive → `+ taxTotal` as a term.
- **[Domain Expert]** Cash rounding is a **separate, visible line**, never folded into a price.

## 2.2 Costing

- **[Domain Expert]** Cost is **moving weighted average**, recalculated on every receipt, rounded
  half-up to a whole milli-dram on store.
- **[Domain Expert]** **Landed cost first.** Delivery and duty are apportioned across lines **by value**
  *before* the average moves. Skipping this systematically overstates margin — and Արամ's whole
  trust in the product rests on the margin figure.
- **[Domain Expert]** The current average is **snapshotted onto the sale line** as `unitCost`.
  Restocking at a new price must never rewrite last month's profit.
- **[Domain Expert]** If `stockQty + receivedQty ≤ 0` the formula is undefined — **do not evaluate it**.
  Set the average to the receipt cost, post, and flag.
- **[Domain Expert]** A purchase return reverses at the **landed cost of the receipt it came in on**,
  not the current average. 10 @ 12 then 10 @ 14 = 20 @ 13; returning the delivery must leave
  10 @ 12, which only the landed-cost formula gives.
- **[Domain Expert]** The freight on returned goods is a **real loss**, recorded as `landedCostLost`,
  not silently absorbed into the average.
- **[Domain Expert]** Negative stock uses the last known average and flags the movement.

## 2.3 Stock

- **[Domain Expert]** Every quantity change is an **append-only movement** with a type, a signed
  quantity, a unit cost, an actor and a source document. `stockQty` is a rebuildable cache.
- **[Domain Expert]** A movement with no source is a bug — except `ADJUSTMENT` and `WRITE_OFF`,
  which are their own source.
- **[Domain Expert]** `reasonCode` is **required** on a write-off and null on everything else. Free
  text cannot be charted, and "write-offs by reason" is the entire point.
- **[Domain Expert]** Negative stock is **allowed with a warning by default** — the goods are
  physically leaving the shop. Strict mode is the owner's choice, not the software's.
- **[Domain Expert]** A stocktake variance is computed against the **snapshot**, not a moving target,
  so counting can happen while trading.
- **[Domain Expert]** Cache-vs-ledger drift is **surfaced, never silently corrected**.

## 2.4 Selling

- **[Domain Expert]** Finalising commits **one transaction**: sale → lines → payments → movements →
  debt charge → audit row. Printing happens **after** commit. A partial write is the failure
  that corrupts a till beyond repair.
- **[Domain Expert]** Sale ids are **client-generated and the submission is idempotent** on them.
  A retried request cannot double-charge.
- **[Domain Expert]** The receipt number is `{device prefix}-{device sequence}`, assigned **on the
  device**, because a till must complete a sale with the server unreachable.
- **[Domain Expert]** A basket belongs to the shift that **completes** it, not the one that started it,
  and the reassignment is only legal while it is still DRAFT/HELD.
- **[Domain Expert]** A completed sale is **never voided and never deleted** — only reversed by a
  linked return. Only an uncompleted basket can be voided.
- **[Domain Expert]** Discounts are role-gated and capped; above the cap needs an admin PIN **and a
  typed reason**. Uncapped discounting is a standard shrinkage route.
- **[Domain Expert]** Split tender: payments sum to ≥ the total; each payment > 0.

## 2.5 Credit (Nisya)

- **[Domain Expert]** Debt entries are **always positive**; the type carries the direction. Mixed
  signs make every aggregate a bug farm.
- **[Domain Expert]** Payments are **allocated to specific charges**, oldest-first by default,
  manually overridable. `Σ allocations + credit == payment`.
- **[Domain Expert]** **Aging runs from the charge date**, never from the last payment and never from
  the due date. A due date moves only the *overdue* marker.
- **[Domain Expert]** Overpayment becomes a **credit adjustment**, never a negative charge.
- **[Domain Expert]** Over the credit limit → **warn and allow with an admin reason**, not a hard
  block, unless the owner chose strict.
- **[Domain Expert]** Refunding a debt sale **reduces the debt**; never cash out of the drawer for
  goods that were never paid for.
- **[Domain Expert]** Offline, the limit cannot be checked, so credit is capped per customer per
  outage and flagged on sync.

## 2.6 Cash and the shift

- **[Domain Expert]** `expected = opening float + cash sales + cash repayments + pay-ins − pay-outs − drops`.
  Every term is a **query over rows**, so the drawer is recomputable at any moment.
- **[Domain Expert]** A repayment is counted **exactly once**, as a cash movement — not also as a
  pay-in. Counting it twice would overstate expected cash on the one screen that catches theft.
- **[Domain Expert]** `NO_SALE` carries amount 0 and cannot move the figure — it records only that
  the drawer was opened outside a sale, and it re-authenticates.
- **[Domain Expert]** Variance is **always recorded**, never silently absorbed, and the tone is neutral.
- **[Domain Expert]** A shift cannot close with its own open baskets; another till's basket never
  blocks it.
- **[Domain Expert]** Closing with unsynced sales requires an explicit acknowledgement, and the
  Z-report states the number.

## 2.7 Tax

- **[Domain Expert]** Shelf prices are **tax-inclusive by default**; tax is *extracted*, not added.
- **[Domain Expert]** The rate is **snapshotted onto the line**. A rate change in March must not
  rewrite February's receipts.
- **[Domain Expert]** Round once per line, then sum. Extracting from the sale total gives a figure
  that does not equal the sum of its lines.
- **[Domain Expert]** Non-VAT regimes are **rate zero, not a second code path**.
- **[Domain Expert]** Returns extract at the **original** rate, from the original line.
- **[Domain Expert]** The price basis in force is snapshotted onto the sale, because a reprint must
  *reproduce* the sale rather than recompute it.

## 2.8 Trust, correction and access

- **[Domain Expert]** Correction, never deletion. Every correction is a **linked** reversing document.
- **[Domain Expert]** Every override a person had to justify carries the **reason they typed** into the
  audit log — price override, credit-limit override, discount above cap, blind return, stock
  adjustment, basket void, held-basket transfer.
- **[Domain Expert]** Cost prices are stripped **server-side** for non-admin roles. `STOCK` types
  invoice costs in but never sees the resulting average, the margin, or supplier terms.
  Hiding a number in the UI is not access control.
- **[Domain Expert]** Every figure the owner sees must **drill down to the events that produced it**.
  One unexplainable number ends the relationship.

---

# 3. Edge Cases

These are the ones that break a naive model. I have marked the sharpest 🟥.

## 3.1 Nisya realities

1. 🟥 **[Domain Expert] The contractor's man collects the goods.** Դավիթ sends his labourer with a
   phone call. The debt belongs to Դավիթ; the person who signed is someone else. **Nothing in
   the model records who physically took the goods** — no `takenBy` on the sale or the charge.
   When the dispute comes ("I never took that cable"), Simon has no answer, and this is the exact
   dispute question §2.5 plans to ask five shops.
2. 🟥 **[Domain Expert] Contra-settlement.** The man who delivers cement is also a customer who buys
   tools. At month end they settle the difference and no money moves. Simon has a customer ledger
   and a supplier ledger with **no bridge between them** — the shop will either enter a fake cash
   repayment and a fake cash supplier payment (destroying both cash reconciliations) or stop
   using the debt book.
3. **[Domain Expert] Repaid in goods or in labour.** "I'll wire your back room instead." Same
   problem, no cash event.
4. **[Domain Expert] Refund on a debt sale whose charge is already settled.** The PRD's rule
   ("reduce the debt, never cash out for goods never paid for") assumes the charge is still open.
   If he paid last week, he *has* paid — the credit adjustment sits on an account with no open
   charge, and the customer standing there wants his money. Cash out, or a credit balance he must
   come back to spend? **Unstated.**
5. **[Domain Expert] Advance payment / deposit.** A contractor pays 100,000 ֏ up front against a
   job's materials. That is a credit balance as a *first-class intent*, not an overpayment
   artefact. Aging, and "who owes what", both have to handle a negative balance.
6. **[Domain Expert] Debt written off as uncollectable.** He moved to Russia. There is no event,
   no entry type and no report line for it, so the debtor aging report grows a permanent tail of
   90+ that the owner learns to ignore — which kills the report.
7. **[Domain Expert] Two customers, one name.** Two Դավիթs, one phone between them. `phone` is the
   duplicate check and it will collide. Merge exists; the *decision* to merge does not have an event.
8. **[Domain Expert] Family accounts.** Wife buys, husband pays, both are "the same customer" to
   the shop and two rows to Simon.
9. **[Domain Expert] Debt taken while offline on two tills at once** — both under the 20,000 cap
   individually, over it together.

## 3.2 Goods, units and barcodes

10. 🟥 **[Domain Expert] The supplier changed the pack size.** The box held 24 last year and holds 20
    now. `factorToStockUom` lives on the product's purchase unit, so changing it **retroactively
    misreads every past receipt** — 3 boxes received last March become 60 metres instead of 72,
    and replaying the ledger no longer reproduces the shelf. The factor needs to be snapshotted
    onto the receipt line the way `unitCost` is snapshotted onto the sale line, or versioned.
    (Note: `SaleLine` *does* carry `factorToStockUom`; `GoodsReceiptLine` **does not**.)
11. **[Domain Expert] Buy by box, sell by piece, and sell by box too.** A builder buys the whole
    carton. Three units in play on one product, with the sale unit chosen at the line.
12. **[Domain Expert] Weight-embedded EAN-13.** In Armenia the in-store scale label commonly encodes
    the **price**, not the weight. Reverse-computing quantity from price ÷ shelf price is lossy
    and puts a wrong quantity into the stock ledger and a wrong COGS onto the line. Which the
    label carries must be a setting, and the quantity must be derivable exactly.
13. **[Domain Expert] Sold by eye.** "Give me a handful of these screws." The worker types an
    approximate count. Stock is fiction at the unit level and honest only at stocktake.
14. **[Domain Expert] Cut-to-length offcut.** A 50 m spool sold as 4×12 m leaves 2 m that is stock on
    paper and rubbish on the shelf. No write-off reason code fits; `DAMAGE` is a lie and
    `INTERNAL_USE` is worse.
15. **[Domain Expert] Bulk goods that lose weight.** Sand and cement absorb and shed moisture; a
    tonne received is never a tonne sold. Permanent, structural variance.
16. **[Domain Expert] Kitting.** Cable + two connectors assembled and sold as one thing. Three
    products leave stock, one line sells. Simon has no assembly event.
17. **[Domain Expert] Unbarcoded goods are the majority of a hardware catalogue.** "Scan to sell"
    is unusable without generated internal codes and a label printer — which is v2. The v1 shop
    lives on quick tiles and typed search.
18. **[Domain Expert] The old sticker.** A code retired three years ago must still resolve to the
    right product, and must never be reassigned to a different one.
19. **[Domain Expert] Two products, one manufacturer barcode.** It happens with cheap imports.
    The unique constraint is right; the shop still needs a way through.

## 3.3 Buying

20. 🟥 **[Domain Expert] Bonus goods.** 11 bags delivered, 10 invoiced. If the receipt is entered as
    11 units at the invoice unit cost, the average is overstated by 10%; if as 10 units, a bag
    is invisible until stocktake. The right answer — 11 units, invoice total spread over 11 —
    requires entering a **line total**, not a unit cost, and the receiving screen asks for the
    unit cost.
21. **[Domain Expert] Cash-only supplier, no paperwork.** `GoodsReceipt.supplierInvoiceNo` is
    NOT NULL in the model. Half of a small shop's deliveries arrive with a scribble or nothing.
22. **[Domain Expert] One-off supplier.** Bought from a man at the market once. Creating a supplier
    record is friction the worker will refuse; leaving it out breaks the payable.
23. **[Domain Expert] Supplier VAT and the shop's regime.** If the shop is on turnover tax, the
    supplier's VAT is **not recoverable** and belongs *inside* the cost. If the shop is
    VAT-registered, cost is net of VAT. **The costing basis therefore depends on the tax regime**,
    and §10.5 says nothing about it — get this wrong and every margin in the system is out by 20%.
24. **[Domain Expert] Damage discovered a week later**, after the average has moved twice and half
    the delivery is sold. The purchase return still has to reverse at that receipt's landed cost.
25. **[Domain Expert] The same visit brings goods in and takes goods back.** One conversation, two
    documents, and the driver wants one signature.
26. **[Domain Expert] Delivery charge on a delivery that is partly a return.** Freight apportioned
    to goods that immediately went back.
27. **[Domain Expert] Price on the invoice differs from the price agreed on the phone.** Received
    at the invoice price, argued about later, credit note next month — after the average moved.
28. **[Domain Expert] Goods received against a shift that has since closed.** Receiving is
    online-only and not shift-bound, but the cash paid for them came out of a drawer that is.

## 3.4 Selling, prices and returns

29. 🟥 **[Domain Expert] Price changed mid-day with a basket parked.** The morning basket has a line
    at the old price. Is `SaleLine.unitPriceMdram` captured when the line was added or when the
    sale completes? **The PRD does not say**, and the two answers are a different receipt and a
    different argument with the customer. (My view: captured at line-add, visibly, with the
    change surfaced on resume.)
30. **[Domain Expert] Sold below cost.** Clearing old stock, or a price typo. Nothing warns, and
    the margin report shows a negative line the owner will read as a bug in Simon rather than a
    fact about his shop.
31. **[Domain Expert] Price override plus a discount plus a sale-level discount** on the same line.
    Three reductions, one line total, and the receipt has to show why.
32. **[Domain Expert] Return of a weighed good.** Bought 2.5 kg, returns 1.2 kg — legitimate, and
    the per-line residual check has to work in milli-units.
33. **[Domain Expert] Return of an item whose price has since risen.** Refund at the sold price,
    always; the customer will argue for today's.
34. **[Domain Expert] Return into a shift other than the one that sold it** — cash leaves a drawer
    that never took it. That is a variance with an honest explanation, and the Z-report should
    say so the way it says a transferred sale.
35. **[Domain Expert] Exchange for a more expensive item.** Return + sell, and the customer pays
    the difference — two documents where the customer experienced one transaction.
36. **[Domain Expert] Blind return as a theft route.** Admin-only is right; the shop with one admin
    who is also the owner will hand out the admin PIN by week three. 🟥

## 3.5 Cash, shifts and people

37. 🟥 **[Domain Expert] Two workers, one drawer.** A shift is per user with no other OPEN shift for
    that user — but the shop has **one physical cash box** and two phones. Two open shifts against
    one drawer makes `expectedCash` meaningless for both, and the variance lands on whoever
    closes last. This is the most likely real deployment and the model does not describe it.
38. **[Domain Expert] Worker pays the water man from the till and forgets the pay-out.** The
    reconciliation is arithmetically fine and the story is wrong; the variance accuses him.
39. **[Domain Expert] Shift crosses midnight.** "Today's sales" (shop-local calendar day) and "this
    shift" are different periods, and the owner's dashboard and the Z-report will disagree.
40. **[Domain Expert] Owner takes cash out for himself.** A pay-out with a reason, and it must not
    read as shrinkage.
41. **[Domain Expert] Phone dies mid-shift** with the outbox non-empty. The sales exist only on that
    device; the shift cannot honestly close and the parked baskets cannot be resumed elsewhere.
42. **[Domain Expert] Worker leaves without closing the shift.** Next morning someone else needs
    the drawer.
43. **[Domain Expert] Practice mode and the receipt sequence.** A practice sale must not burn a real
    device sequence number or print a real receipt number. **Unstated.** 🟥

## 3.6 Fiscal, tax and the outside world

44. 🟥 **[Domain Expert] Simon and the ՀԴՄ disagree.** In the v1 interim position the shop rings every
    sale twice — once in Simon, once on the fiscal register. They *will* diverge: forgotten
    entries, different rounding, a sale voided on one and not the other. Nobody has specified the
    reconciliation report, and the first time the tax inspector finds a gap, the shop blames the
    new software. This is the single largest adoption risk in the domain.
45. **[Domain Expert] Regime change mid-year.** The shop crosses the turnover threshold in August.
    Rate goes 0 → 2000 bp, snapshotted per line, so history is safe — but the *reporting* period
    now spans two regimes and the bookkeeper needs both halves.
46. **[Domain Expert] B2B sale to a contractor** who needs a tax invoice and pays by bank transfer
    later. That is a sale, a payable-side document, and a debt, all at once. `TRANSFER` exists in
    the enum and is not offered in v1.
47. **[Domain Expert] Waybill for goods in transit** — if required, receiving needs a document
    number Simon does not currently hold.
48. **[Domain Expert] Personal data in the Nisya book.** Names, phones and debts are personal data.
    An erasure request must null the name and keep the ledger — which means a receipt reprint for
    an anonymised customer has to still be legible and still add up.
49. **[Domain Expert] Retention.** The paper book goes back eighteen years. Whatever retention rule
    applies sets the backup policy, and the owner's expectation is "forever".

## 3.7 Trust and adoption

50. **[Domain Expert] The number does not match his head.** Simon says 240,000, Արամ believes
    260,000. The gap is usually a debt sale counted as revenue but not as cash, or vice versa.
    **"Takings" is ambiguous and this is where the product dies** (see terminology below).
51. **[Domain Expert] The worker goes back to the notebook** for one busy hour and writes the sales
    up later — or never. Simon shows a quiet day; stock disagrees at the next count.
52. **[Domain Expert] Backup failed silently for a week** and nobody looked. The question is asked
    exactly once, on the worst day of the shop's life.

---

# 4. Terminology

## 4.1 The shop's own words (the ones the user sees)

| Term | Armenian | Definition |
|:--|:--|:--|
| **Nisya** | Նիսյա | The credit book: goods taken now, paid later, recorded by name. The practice the product is named for |
| **Debt** | Պարտք | What a named customer owes the shop. The user-facing word |
| **Repayment** | Մարում | Money taken against an existing debt, not against a sale |
| **Shift** | Հերթափոխ | One person, one drawer, one open-to-close period |
| **Receiving** | Ընդունում | Goods arriving, usually with a paper invoice and no prior order |
| **Delivery charge** | Առաքման ծախս | The freight the owner types once and Simon spreads by value |
| **Stock** | Պահեստ | What is on the shelf |
| **Stocktake** | Հաշվառում | Counting the shelf against the book |
| **Return** | Վերադարձ | Goods coming back — *from* a customer |
| **Earnings** | Վաստակ | What the owner earned: revenue less snapshotted cost. Never "gross margin analysis" |
| **Sell / Sale** | Վաճառել / Վաճառք | Verb on the button, noun on the heading |
| **Credit limit** | Սահմանաչափ | The most this customer may owe before an override is needed |
| **Difference** | Տարբերություն | The cash variance at close. Never "shortage", never "missing" |
| **Hold / park** | Պահել | Put a basket aside without completing it |

## 4.2 Trade terms (the reader's, never the user's)

| Term | Definition |
|:--|:--|
| **ՀԴՄ** | Հսկիչ դրամարկղային մեքենա — the fiscal cash register registered with ՊԵԿ |
| **ՊԵԿ** | State Revenue Committee — registers ՀԴՄ devices |
| **ԱԱՀ** | VAT, standard rate 20% |
| **Turnover tax** | The regime below VAT; tax on gross receipts, no input credit |
| **Micro-business regime** | The regime below turnover tax |
| **Dram / ֏** | Armenian currency. Whole drams for transactions |
| **Milli-dram** | A dram ×1000, for unit prices and costs |
| **Milli-unit** | A quantity ×1000; 2.5 kg = `2500` |
| **Basis point** | 1/100 of a percent; 20% = `2000` |
| **WAC** | Moving weighted average cost, recalculated on every receipt |
| **Landed cost** | True cost including freight and duty, spread by value |
| **COGS** | The snapshotted unit costs of what was sold |
| **Aging** | How old an unpaid charge is, measured from the charge date |
| **Allocation** | Which specific charges a payment paid off |
| **Blind return** | A return with no original sale. The classic fraud path |
| **X-report / Z-report** | Mid-shift totals that do not reset / end-of-shift totals that close the period |
| **Shrinkage** | Stock that left without a sale |
| **Dead stock** | Stock that has not sold in a long time |
| **Offcut** | The unsellable remainder of a cut length |
| **Contra-settlement** | Netting a customer debt against a supplier payable with the same person |

## 4.3 🟥 Terminology conflicts and ambiguities I found in the PRD

**[Domain Expert] These are the ones I would put on the wall as red hotspots.**

1. 🟥 **`unitCostMdram` means three different things in three tables.**
   - `SaleLine.unitCostMdram` — the **weighted average** at the moment of sale.
   - `GoodsReceiptLine.unitCostMdram` — the **invoice** cost (landed cost is the separate
     `apportionedLandedCost`).
   - `PurchaseReturnLine.unitCostMdram` — §11 says explicitly this is the **landed** cost.
   Three meanings, one name, and §13.7's whole worked example turns on which one you grabbed.
   This is a naming bug waiting to become a costing bug. **Rename per role.**

2. 🟥 **`taxTotal` is a memo under one basis and an addend under the other.** The PRD flags this
   itself as "the most likely way to build this wrong" — which is an admission that the name is
   wrong, not a mitigation. From the shop's side: it is the difference between a receipt that
   adds up and one that does not.

3. 🟥 **"Takings" / "today's sales" is undefined.** §2.2's 20:30 scene has Արամ reading "today's
   takings". Is that turnover including debt sales, or cash that entered the drawer? A debt sale
   is revenue and not cash; a repayment is cash and not revenue. **This is precisely the gap that
   produces the unexplainable number §2.3 says ends the relationship**, and the PRD never names
   the two figures separately.

4. 🟥 **`Payment.method = DEBT` versus `DebtEntry` type `CHARGE`.** The same money is recorded
   twice, in two ledgers, in one transaction. Which one is authoritative for revenue, for the
   Z-report, and for the debtor balance? If both are summed anywhere, the figure doubles.

5. 🟥 **"Return" points both directions.** `SaleReturn` (customer → shop) and `PurchaseReturn`
   (shop → supplier) are the same English word, and the UI word Վերադարձ is defined only for the
   customer case. §4.2 demands one word per concept; here one word covers two concepts that move
   money in opposite directions. **The supplier side needs its own Armenian noun.**

6. **`Shift.expectedCash` is stored, but §12.5 says every term is a query over rows.** So is the
   column a snapshot taken at CLOSING, or a cache? Unlike `stockQty` it has no drift check. If it
   is a snapshot, a late-arriving offline sale changes the query and not the column, and the
   Z-report and the dashboard will disagree about the same shift.

7. **`ADJUSTMENT` versus `WRITE_OFF` versus `STOCKTAKE`.** A stocktake shortfall is shrinkage —
   is it a `STOCKTAKE` movement, or a `WRITE_OFF` with `reasonCode = THEFT`? Both are defensible
   and the "write-offs by reason" chart looks completely different depending on the answer.

8. **`reorderPoint`: stored threshold or computed suggestion?** §11 has it as a Product field,
   §13.3 has Simon suggesting a value from velocity, §6.11 has an "auto from velocity" setting.
   Whether the suggestion overwrites the owner's number or sits beside it is unstated — and
   overwriting a number the owner set is exactly the kind of thing that makes him distrust it.

9. **Aging versus overdue on one screen.** §6.3 shows "oldest 62 days" *and* an overdue marker
   driven by an unrelated due date. The PRD is careful that these are different questions; the
   screen puts them side by side and the worker will conflate them out loud to the customer.

10. **"Nisya" versus "Պարտք".** The glossary and §6.9 use *Nisya*; §4.1 says the user-facing word
    is *Պարտք*. §4.2's own rule is one word per concept everywhere. Pick one for the UI and keep
    Nisya for the reader.

11. **"Cost" to a `STOCK` user versus to an `ADMIN`.** A stock-taker types an invoice cost and is
    forbidden to see the average cost. Two things called "cost" on adjacent screens, with an
    authorization boundary between them, and no vocabulary distinguishing them.

---

# 5. Aggregate and Policy candidates spotted along the way

⬛ **[Domain Expert] Aggregates:** `Sale` (with its lines and payments — one transaction boundary),
`Shift` (with its cash movements), `Customer`/`DebtLedger` (charges, payments, allocations),
`GoodsReceipt` (lines + landed cost + the average it moved), `PurchaseReturn`, `SaleReturn`,
`Product` (with barcodes, units, and its stock ledger projection), `Stocktake` session,
`Supplier` (payables + allocations), `Device` (the numbering authority).

🟪 **[Domain Expert] Policies worth naming now:**
- Whenever a goods receipt is committed → the weighted average moves, landed cost first.
- Whenever a sale line is added → the current average is snapshotted onto it.
- Whenever a cash repayment is taken → a `REPAYMENT` cash movement is written, and only that row
  counts toward the drawer.
- Whenever stock would go negative → post anyway, flag for recount, use the last known average.
- Whenever a queued sale posts over a credit limit → accept and put it on the owner's
  needs-attention list; never reject a sale whose goods have already left.
- Whenever a shift closes → its sessions end, and its Z-report states its unsynced count.
- Whenever anything is corrected → a linked reversing document, never an edit.
- Whenever an override is authorised → the typed reason lands in the audit log.

🩷 **[Domain Expert] External systems:** the ՀԴՄ fiscal device, the bank card terminal, the thermal
printer and its drawer kick, the label printer (v2), the scale, and Սիրան's spreadsheet.
