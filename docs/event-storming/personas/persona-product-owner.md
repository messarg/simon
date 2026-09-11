# Event Storming — Phase 1 (Chaotic Exploration)
# Persona report: PRODUCT OWNER

**Domain under storm:** the full buy–sell cycle — purchasing / goods receipt / inventory
through selling / payment / debt / returns / shifts.
**Grounding:** `docs/prd.md` §1, §2, §9, §17, §23, §24, §26, §27; `CLAUDE.md`.
**Date:** 2026-09-10 · **Persona:** Product Owner · every contribution below is marked
**[Product Owner]**.

---

## 0. The lens I am applying

**[Product Owner]** My job in Phase 1 is not to add events. The other personas will produce
several hundred; the wall will not tell you which ones matter, because a sticky note for
`FiscalReceiptIssued` looks exactly like a sticky note for `SaleCompleted`. I am scoring them.

**[Product Owner]** Three scoring rules, all derived from the PRD rather than invented here:

1. **The two failure modes (§2.3) are the scoring function.** Every capability is worth what it
   contributes to *Գոռ does not abandon it* or *Արամ does not stop trusting it*. Nothing else
   is value. A capability that serves neither is overhead however elegant it is.
2. **The incumbent is a notebook (§1), not a competitor product.** So the bar is not feature
   parity with a cloud POS. The bar is: faster than paper at the till, and able to answer the
   four questions in §1's promise at closing time. Features that beat a cloud POS but not the
   notebook are worth zero.
3. **Simon is installed per shop and released as git tags (`CLAUDE.md`).** There is no
   distribution cost to a second release. This matters enormously for scope, and §9 does not
   fully exploit it — see §2.3 below.

---

## 1. Value assessment by capability area

**[Product Owner]** Rated High / Medium / Low, always with *for whom*, because several of these
are High for one persona and literally zero for another, and averaging that is how a roadmap
gets wrong.

| # | Capability | Value | For whom | Why that rating |
|:--|:--|:--|:--|:--|
| 1 | **Checkout & scan** | **High** | Գոռ (direct), Արամ (derived) | The only capability that is used hundreds of times a day. It is also the *sole data-entry engine* for the whole system: no scan, no sale, no ledger, no margin, no debt, no report. Every other number in Simon is a projection of this one act. H2 says speed here decides adoption, so its value is not "selling" — it is *whether the product exists at all in week four*. |
| 2 | **Pricing & discount** | **Medium** (worker) / **High** (owner) | Արամ | Base pricing is table stakes; the *value* is in the discount cap, the admin-PIN override and the typed reason (FR-SELL-08, §16.3). That is not a pricing feature, it is a **theft and leakage control**, and §2.1 lists "a worker will cheat him" as one of Արամ's three named fears. Rated on the control, not on the arithmetic. |
| 3 | **Payment (cash, card, split, change, rounding)** | **High** | Գոռ, Արամ | Change-on-screen as the largest figure (FR-SELL-07, §27.1) is the single most visible speed win over mental arithmetic under a queue. Split tender (FR-SELL-06) is what makes a *part-cash-part-Nisya* sale representable — the real Armenian shop transaction that neither the notebook nor a supermarket POS handles cleanly. |
| 4 | **Nisya debt (§6.3, §6.4, §6.15)** | **Highest strategic value** | Արամ overwhelmingly; Գոռ incidentally | This is the differentiator. §2.2's 11:30 scene — *owes 45,000 ֏, oldest 62 days*, visible to the worker **and to the contractor standing there** — is described in the PRD as "the entire reason this product exists", and H3 stakes the venture on it. A cloud POS does not do this. Excel does not do this. The notebook does it badly. Nothing else in the buy–sell cycle has this profile: high value, high differentiation, low technical risk. |
| 5 | **Returns (§6.5, §12.4)** | **Medium** (frequency) / **High** (integrity) | Արամ | Low volume, high blast radius. A return that does not restock and does not reverse cost at the *original* unit cost (FR-SELL-13, §27.6) silently corrupts both stock and margin — and a corrupted margin is failure mode 2, the unexplainable number. Its value is not "customers can return things"; it is "the other numbers stay true when they do". |
| 6 | **Shifts & cash reconciliation (§6.6, §12.5)** | **High** (owner) / **Low-to-negative** (worker) | Արամ | The daily closing ritual and the direct answer to the cheating fear. Note the asymmetry honestly: for Գոռ this is pure imposed cost, two minutes at the end of a shift with no benefit to him, and §2.2 works hard to make it feel non-accusatory ("records a 400 ֏ shortfall without accusing anyone"). **A shop that cannot close a shift correctly on day one has a broken product** — the drawer is the only number Արամ can verify with his own hands, and it is therefore the trust anchor for everything he cannot verify. |
| 7 | **Purchasing & goods receipt (§6.7, §13.2)** | **High** for receipt-without-PO; **Low** for purchase orders | Արամ, STOCK role | Split this row, because the PRD does. Goods receipt is the **only door through which cost enters the system** — no receipt, no cost, no margin, no §1 promise. Purchase *orders* are a workflow for shops that place orders, and A1 says most deliveries arrive with a paper invoice and no prior order. A shop without supplier POs can still trade; a shop that cannot record what a delivery cost cannot be told what it earned. |
| 8 | **Costing / WAC (§10.5)** | **High, and entirely invisible** | Արամ (unknowingly) | No user will ever ask for weighted average cost. Every user will notice when the profit figure is wrong. This is the archetypal *derived* value: worth nothing on its own, load-bearing for capability 10, and §23.1 lists it as one of three things that cannot be retrofitted. §27.4 — a hand-calculated margin on a twice-restocked product — is really an acceptance criterion for Արամ's trust, wearing arithmetic as a costume. |
| 9 | **Stocktake & write-off (§6.8, §13.4, §13.5)** | Write-off **Medium-High**; stocktake sessions **Medium** | Արամ | Separate these too. **Write-off** with reason codes (FR-STK-03) is how real shrinkage — breakage, theft, a bag of screws that spilled — gets out of the ledger without an unexplained adjustment. In a hardware store this happens weekly, and without it stock drifts from reality and the owner stops believing the stock number. **Stocktake sessions with approval** is a periodic ceremony, correctly v2 (§9), and its exit criterion in §23 ("the owner counts stock without closing the shop") is a convenience, not a need. |
| 10 | **Reporting & owner home (§6.9, §6.10, §20.2)** | **High** (Արամ) / **High** (Սիրան) / **Zero** (Գոռ) | Արամ, Սիրան | This is where all the invisible work becomes visible, and it is the *only* place Արամ meets the product — he is not at the till. H1 rests here: drill-down from a number to the events behind it is what converts data into trust. Սիրան is a separate, easily forgotten stakeholder: §2.1 warns that if the export is not one click, Արամ pays that cost **every month forever** and blames Simon for it. One-click CSV/Excel (FR-DAT-03) is worth more than its size suggests. |
| 11 | **Offline sync (§14)** | **Medium as a feature / High as insurance** | Գոռ (invisibly) | Nobody buys offline sync and nobody thanks you for it. But shop Wi-Fi drops, and the first time the till freezes mid-queue Գոռ reaches for the notebook and never comes back — failure mode 1, triggered by an availability property rather than a feature. Rated on the downside, not the upside. **Its build priority must not be inferred from its user value** — see my disagreement (b) in §3. |

**[Product Owner]** Two cross-cutting items that are not "capabilities" but score High and will
be under-stickied on the wall because no one performs them:

- **Backup & tested restore (§19.2, FR-DAT-01/02, §27.10).** Value: High for Արամ, whose third
  named fear in §2.1 is losing eighteen years of records to a broken machine. This is a **fear
  feature**, and fear features are undervalued in prioritisation because they generate no
  events during happy-path storming.
- **Field-level cost stripping (§16.5, FR-SEC-04, §27.9).** Value: High for Արամ, invisible to
  everyone. Not a feature at all — a property of every read path. It will not appear on the wall
  as an event, and it must still be in Phase 1.

---

## 2. MVP scope — MoSCoW

**[Product Owner]** The test I applied to every row: *can a real shop trade for a full day and
close correctly without this?* If yes, it is not a Must, however much I like it.

### 2.1 The MoSCoW table

| Capability area | M | S | C | W | Ruling — **[Product Owner]** |
|:--|:-:|:-:|:-:|:-:|:--|
| Catalogue: products, multi-barcode, units, internal codes | ✅ | | | | Prerequisite to everything. FR-CAT-01/02. |
| **Quick-add from an unknown barcode, mid-sale** | ✅ | | | | FR-CAT-03. Not a convenience — under A2 this *is* the catalogue-building strategy. Cutting it means the catalogue never exists. |
| Checkout: HID scan, rescan increments, search, quantity keypad | ✅ | | | | FR-SELL-01/02/04. The product. |
| Camera scanning | | ✅ | | | HID is primary (§18) and A8 is confirmed — the shop has a scanner. Camera is the aisle path, valuable but not day-one. Now cheap since TLS ships regardless (§16.6). |
| Quick tiles from sales velocity | | ✅ | | | FR-SELL-03. Value is **contingent on A5** (unbarcoded stock). If A5 holds it is Must; A5 is untested, so it ships Should and gets promoted by pilot evidence, not by opinion. |
| Cash payment, change display, cash rounding line | ✅ | | | | FR-SELL-07/10, §27.1. |
| Split tender across cash / card / debt | ✅ | | | | FR-SELL-06, §27.2. The real transaction shape. |
| Discount within role cap | ✅ | | | | Shops discount. Refusing to represent it means it happens off-book. |
| Discount above cap: admin PIN + typed reason + audit | | ✅ | | | FR-SELL-08. High value, but a shop trades without it on day one by capping tightly. |
| Held / parked sales, resumable, cross-till | | ✅ | | | FR-SELL-05. §27.23 is a genuinely hard criterion (reconciles against the *second* till). One till in the pilot makes cross-till nearly untestable — do not spend Phase 1 on it. |
| **Debt sale with balance + age shown before confirming** | ✅ | | | | FR-DEBT-01, §27.12. The single highest-value screen in the product (H3). |
| Repayment, oldest-first allocation, partial | ✅ | | | | FR-DEBT-03. A debt you cannot pay off is not a ledger. |
| Debtor aging, 0–30/31–60/61–90/90+ | ✅ | | | | FR-DEBT-05, §27.5. The aging *is* the value; a balance without an age is the notebook. |
| Credit limit warn + admin override with reason | | ✅ | | | FR-DEBT-02. Adds control; absence does not stop trade. |
| Overpayment → credit adjustment | | ✅ | | | FR-DEBT-04. Correctness detail, low frequency, but cheap and it prevents a negative charge in the ledger. |
| Customer created mid-sale by a worker | ✅ | | | | FR-DEBT-06. Same argument as quick-add: this is how the customer list gets built. |
| Customer merge | | | ✅ | | FR-DEBT-07, §27.20. Real, but it becomes urgent in month three, not week one. |
| **Returns from the original sale**, partial, cost reversed at original | ✅ | | | | FR-SELL-12/13, §27.6. Integrity, not convenience. |
| Blind returns (no original sale) | | | ✅ | | Admin-only escape hatch. Ship when someone hits the wall. |
| **Shift open on counted float; close with expected-cash, variance, note** | ✅ | | | | FR-SHF-01/02, §27.7. The non-negotiable one. |
| Denomination counter at close | | ✅ | | | **I downgrade this from the PRD's Must** — see disagreement (g). |
| Z-report at close | ✅ | | | | The owner's daily artefact. |
| X-report mid-shift | | | ✅ | | Useful for a shift handover the pilot store may not have. |
| **Goods receipt without a prior order** | ✅ | | | | FR-BUY-01, §27.3. The cost door. |
| **Landed cost apportioned by value** | ✅ | | | | FR-BUY-02. §2.2's 16:20 scene. Retrofitting it means every historical cost is wrong. |
| **Moving weighted average; unitCost snapshotted onto sale lines** | ✅ | | | | FR-BUY-03/04, §27.4. Cannot be retrofitted (§23.1). |
| Supplier payables with allocation | | ✅ | | | FR-BUY-05. Mirrors customer debt, so it is cheap once debt exists — but the shop's *own* debts to suppliers are a smaller pain than customers' debts to it. |
| Purchase returns (§13.7, §27.22) | | ✅ | | | Low frequency. But note it is the only thing that can un-move an average cost, so its *absence* is a trap: without it, a returned delivery gets "fixed" by an adjustment that leaves the WAC wrong forever. |
| **Append-only StockMovement ledger; stockQty as rebuildable cache** | ✅ | | | | FR-STK-01. Architecture, not feature. Cannot be retrofitted. |
| Write-offs with reason codes | | ✅ | | | FR-STK-03. Promote to Must if the pilot store's first fortnight shows any shrinkage at all — which it will. |
| Negative-stock flag + strict mode setting | | ✅ | | | FR-STK-02. Allowing negative stock is the Must (a queue must never be blocked by a data error); the *setting* is a Should. |
| One needs-attention list (ReviewFlag) | | ✅ | | | FR-STK-05. Good design. Not day one. |
| Ledger-vs-cache drift surfaced | | ✅ | | | FR-STK-04. |
| **Roles + server-side cost/margin stripping** | ✅ | | | | FR-SEC-03/04, §27.9. Hiding in the UI is not access control (`CLAUDE.md`). |
| PIN login, sessions ending at shift close | ✅ | | | | FR-SEC-01/02. |
| Audit log for the seven listed actions | ✅ | | | | FR-SEC-05. Without it, every override control above is decoration. |
| Remote session revocation | | | ✅ | | FR-SEC-06. Needed the first time a phone is lost; not before. |
| **Owner home: takings, profit, who owes what and how old, low stock** | ✅ | | | | §27.14. This is where Արամ meets the product. |
| **Drill-down from any number to its events** | ✅ | | | | H1. Cutting this leaves a dashboard nobody believes. |
| Velocity-based low-stock suggestions | | | ✅ | | §13.3. §9 puts it in v1; it is a nice-to-have that is genuinely hard to tune with two weeks of sales history. |
| **One-click CSV/Excel export** | ✅ | | | | FR-DAT-03. Սիրան is a recurring monthly cost of ownership if this is missing. |
| **Backup, hourly + at close, local + USB** | ✅ | | | | FR-DAT-01. Must exist before the first *real* sale, not before launch. |
| **Restore drill, by the owner, onto another machine** | ✅ | | | | FR-DAT-02, §27.10. An untested backup is a rumour. |
| Health endpoint + owner-readable diagnostics | | ✅ | | | FR-DAT-04. Load-bearing given Q8's answer (support is one maintainer on a phone). |
| **Offline: basket buildable offline, outbox, idempotent submit** | ✅ | | | | FR-SYN-01/02/03, §27.8. See disagreement (b) — the *idempotency contract* is a Must in Phase 1 even if the queue UI is not. |
| Offline debt cap + sync flagging | | ✅ | | | FR-SYN-04. |
| Conflicts accepted and flagged, never discarded | | ✅ | | | FR-SYN-05. |
| **Armenian UI in resource files** | ✅ | | | | §20.3. Non-negotiable and non-retrofittable in practice. |
| Latin-typed Armenian search | | ✅ | | | FR-CAT-08. Real ergonomic win; the till still works without it. |
| Setup wizard (five questions, skippable) | | ✅ | | | FR-LRN-01. One shop, installed by us. The wizard's value scales with shop count, and shop count is one. |
| CSV/Excel import incl. opening debts with original dates | | ✅ | | | FR-CAT-04/05, §27.5. Should, not Must — **but only because quick-add is a Must**. If quick-add slipped, import would be a Must. Exactly one of the two must be day-one. |
| Practice mode in a separate database | | | | ❌ | **I move this to v2** — see disagreement (h). |
| Contextual help, coach marks, teaching empty states | | | ✅ | | FR-LRN-03. |
| Undo for routine actions | | ✅ | | | FR-LRN-04, §8.1. Cheap trust; §27.16 pairs it with "no routine action is confirmed", which is the half that costs nothing. |
| Receipt printing (backend-owned, ESC/POS) | ✅ | | | | §18. A shop that cannot hand over a receipt is not a till. |
| Cash-drawer kick as a separate command | ✅ | | | | §18. Tiny, and the PRD found a real security defect here. Do it once, correctly. |
| **Purchase orders** | | | | ❌ | v2. A shop without POs can still trade. |
| **Stocktake sessions with approval** | | | | ❌ | v2 (§9). Data model exists in v1 — correct call. |
| **ՀԴՄ / fiscal integration** | | | | ❌ | v2, and blocked on Q1 regardless. Adapter *seam* only. |
| Label printing | | | | ❌ | v2. Couples to internal barcodes; painful but survivable with handwritten labels. |
| Multi-location | | | | ❌ | v2. Nullable `locationId` in v1 schema — already correctly settled (Q7). |
| Tauri packaging | | | | ❌ | v2. |
| Batch/expiry, serials, scale integration, multi-currency, customer display | | | | ❌ | §9 Later/conditional. Agreed. |

### 2.2 The Must set, stated as one sentence

**[Product Owner]** *A worker can open a shift, sell scanned and unbarcoded goods for cash,
card, credit or any mix, put a sale on a named customer's Nisya while seeing what they already
owe and for how long, take a return against the original sale, and close the shift against a
counted drawer; a stock keeper can enter a delivery from a paper invoice with its freight so
the cost is right; the owner can see today's takings, today's profit and today's debtors, drill
into any of them, export them, and restore the whole thing onto a different machine.*

**[Product Owner]** That sentence is v1. Everything not in it is a later tag.

### 2.3 A framing disagreement with §9

**[Product Owner]** §9 is headed **"v1 — must ship together to be useful"** and then lists
fifteen items including the setup wizard, velocity-based low-stock suggestions, practice mode
and import. I accept §9 as the authority on release content and I still think the *framing* is
wrong: "must ship together" is a constraint that belongs to products with a distribution cost.
Simon is installed per shop and released as git tags (`CLAUDE.md`, §23) — **there is no staging,
no app store, no upgrade fleet, and therefore no reason a second tag two weeks later is
expensive.** Bundling coach marks with the stock ledger under one release gate makes the ledger
late for no benefit. My §2.2 sentence is the set that genuinely must ship together because each
member breaks the others' meaning; the rest is v1.1, v1.2, and shipping it that way costs a
`git tag`.

---

## 3. Priority ranking — bounded contexts and delivery order

### 3.1 The contexts I expect this domain to split into

**[Product Owner]** Stated as a prediction for Phase 2 to confirm or break, not as a decision.
Eleven candidates; I expect the wall to merge two or three of them.

| # | Candidate context | Core concern | Why it is its own context |
|:--|:--|:--|:--|
| C1 | **Catalogue & Product Identity** | What a thing *is*: product, barcodes, units, decimalPlaces, internal codes | Different lifecycle and different actors from selling; changes are rare and audited, and its invariants (FR-CAT-07) outlive every sale |
| C2 | **Selling / Checkout** | Basket → tender → committed sale | The high-frequency, latency-budgeted core (§21) |
| C3 | **Cash & Shift** | Drawer, shift lifecycle, expected vs counted, Z-report | Owns cash truth; the till *reports into* it rather than containing it |
| C4 | **Credit / Nisya** | Customer debt ledger, allocation, aging, limits | Its own ledger, its own time model (age), its own actors. Would be a separate product in another company |
| C5 | **Inventory / Stock Ledger** | Append-only movements, adjustments, write-offs, the rebuildable cache | Every other context *posts into* it; it owns no workflow of its own |
| C6 | **Procurement / Receiving** | Suppliers, goods receipt, landed cost, payables, purchase returns | Different actor (STOCK), different tempo, paper-invoice-shaped |
| C7 | **Costing & Valuation** | Moving weighted average, cost snapshots | I deliberately name this separately from C5. It is pure arithmetic with no workflow, it is the thing §23.1 says cannot be retrofitted, and burying it inside Inventory is how it gets built as a side effect of a receipt handler |
| C8 | **Identity, Roles & Audit** | PIN, sessions, devices, roles, field stripping, audit trail | Cross-cutting, but with its own aggregates. Field stripping must live in one place (§23.1) |
| C9 | **Sync & Device** | Outbox, idempotency keys, conflict flags, device registry, receipt numbering | A genuinely separate concern that touches C2 and C4 hardest |
| C10 | **Reporting & Insight** | Read models, drill-down, exports | Query-side only. Should own no writes at all |
| C11 | **Fiscal & Compliance** | Fiscal adapter, tax basis, receipt numbering rules, retention, erasure | v2 as a feature; a **seam** in v1. See §4 |

### 3.2 My delivery order

**[Product Owner]** Ordered by *user value × unblocking power ÷ risk of being wrong*, with the
constraint that anything §23.1 calls unretrofittable comes first regardless of its value.

| Order | Context(s) | Rationale — user value · dependency · risk |
|:--|:--|:--|
| **1** | **C7 Costing** + the money/quantity/UoM arithmetic | **Value:** zero directly, total indirectly. **Dependency:** everything downstream reads it. **Risk:** the highest in the build. Integer money and WAC are unretrofittable; a float that reaches the database is a data migration over records whose true values are already lost (§23.1). It is also *cheap to test with no HTTP and no database*, so getting it wrong here is the only mistake that is free to find. Matches §23 Phase 0 |
| **2** | **C5 Inventory ledger** + **C8 Identity/roles/field-stripping** | **Value:** zero directly. **Dependency:** the ledger is the spine every context posts into; field stripping must be in the response shaping from the *first* endpoint (§23.1) or it will be missed on exactly one route, and that one is the leak. **Risk:** both are the other two unretrofittable items. Doing them second is not conservatism, it is the only order that is not a migration |
| **3** | **C1 Catalogue** + **C2 Selling** + **C3 Cash & Shift** — as one release | **Value:** the highest in the product, and the first thing anyone can see. **Dependency:** needs 1 and 2. **Risk:** H2 is tested here and nowhere else. **These three ship together or not at all** — a till that cannot close a shift is not a till, it is a calculator that keeps a log |
| **4** | **C4 Credit / Nisya** | **Value:** the highest strategic value in the product (H3, §2.2's 11:30 scene). **Dependency:** needs a customer and a sale, so it cannot precede 3. **Risk:** low technically, high commercially — if the aged-debt line does not change behaviour, H3 is false and the venture's central claim is wrong. Test it early, which means *immediately* after selling |
| **5** | **C6 Procurement / Receiving** | **Value:** high but indirect — it is what makes the profit number real. **Dependency:** needs C7 and C5. **Risk:** A1 is untested; if deliveries arrive with POs after all, this flow is shaped wrong and the PO work moves into v1 |
| **6** | **C10 Reporting & Insight** | **Value:** high, and it is where all the invisible work of 1, 2, 5 and 7 finally becomes visible to Արամ. **Dependency:** needs real sales *and* real costs, so it genuinely cannot come earlier in full. **Risk:** H1 is tested here — but see disagreement (d), because a *slice* of it can and should come at step 4 |
| **7** | **C9 Sync & Device** — the *client* half | **Value:** invisible. **Dependency:** the server-side idempotency contract must already exist from step 3; only the IndexedDB cache, the queue UI and the connection-state UX belong here. **Risk:** low if the contract came early, catastrophic if it did not |
| **8** | **C11 Fiscal & Compliance** | **Value:** none to any user. **Dependency:** a reserved seam only. **Risk:** blocks *launch*, not *work* (§23.1). See §4 |

### 3.3 Reconciliation with §23's roadmap

**[Product Owner]** Broadly, §23 and I agree, and I want to say that clearly before listing
where we do not: Foundations → Sell → Trust → Buy is the right spine, the layer table in §23.1
is unusually good, and the three unretrofittable items are correctly identified. My
disagreements are about **four items scheduled by their user value when they should have been
scheduled by their retrofit cost**, plus three scope calls.

#### (a) Phase 1's exit criterion is too weak — **[Product Owner]**

§23 Phase 1's exit is *"a real sale completes end-to-end on a phone in the shop."* The contents
of Phase 1 correctly include shifts, so this is a criticism of the gate, not the scope. **A sale
that completes is not a day that closes.** Proposed exit: *a full trading day opens on a counted
float, sells, and closes with an expected-cash figure the owner can reconcile against the drawer
in his hand, and the variance is explainable.* That is the criterion that catches the arithmetic
errors §27.7 exists for, and it costs nothing extra because the features are already in the
phase.

#### (b) The offline queue is scheduled last, and it is a write-path decision — **[Product Owner]** *(my strongest disagreement)*

§23 puts "offline queue" in **Phase 5 — Adopt**, alongside coach marks and PWA polish. That
schedules it by its user value, which is genuinely low, and ignores that FR-SYN-03 makes the
idempotency key — *client-generated UUIDv7 **plus the target status*** — a property of every
sale mutation. The client generating the id, the server treating `POST /sales` as idempotent on
it, and the legal-transition check that returns `200` on replay and `422` on an illegal
transition are **the shape of the checkout write path**, not a queue in front of it.

Building checkout in Phase 1 with server-generated ids and adding the outbox in Phase 5 means
rewriting the path §21's latency budget was measured on, in the phase that is supposed to be
polish. §23.1 lists three things that cannot be retrofitted; I claim this is a fourth, and it is
missing from that list.

**Split the row.** *Phase 1:* client-generated UUIDv7 ids, idempotent `POST /sales` on
id + target status, one serial FIFO outbox in the client even when it always drains instantly.
*Phase 5:* the IndexedDB catalogue cache, the connection-state UX, conflict flagging (FR-SYN-05)
and the offline debt cap (FR-SYN-04). The second half is genuinely adoption work. The first half
is architecture wearing an adoption label.

#### (c) Quick-add is scheduled after the phase that depends on it — **[Product Owner]**

§23 puts CSV import **and quick-add** in Phase 5. But Phase 1's exit criterion is a real sale in
a real shop, which requires products in a real database. So one of two things is true: either
Phase 1 quietly does catalogue-entry work that is not on its list, or the shop visit runs on
fifteen hand-typed products and proves nothing about A2 — *the assumption §25 names as the most
likely single cause of pilot failure.*

Quick-add is FR-CAT-03 and §27.13, it is specified as happening **without leaving the sale**, and
under A2 it is not an onboarding aid, it *is* the catalogue-building strategy. **Move quick-add
to Phase 1.** Import can stay in Phase 5 — it is a one-off operation someone can run for the shop.

#### (d) H1 gets tested last — **[Product Owner]**

The owner home is in Phase 4. The dependency argument is sound for *profit*: margin needs cost,
cost needs Phase 3. But H1 — explainability creates trust — is the hypothesis the venture rests
on, and under §23 Արամ has no reason to open the app until Phase 4. During Phases 1–3 the paper
book stays open next to Simon, and a paper book that is still open at month three never closes.

**Pull a minimal owner home into Phase 2**, where debt already gives it something worth looking
at: today's takings, debtors by age bucket, and drill-down from either number to the sales
behind it. No profit, no margin, no cost — those stay in Phase 4 where they are honest. This is
a small read-model slice and it buys the earliest possible read on H1 and on §27.14.

#### (e) Write-offs are scheduled after the stock they are meant to correct — **[Product Owner]**

§23 puts write-offs in Phase 4 — Control. Stock becomes real in Phase 3 when receiving starts.
Between those, shrinkage in a hardware store (breakage, a spilled bag of fixings, theft) has no
representation, so the only way to correct stock is an adjustment with no reason code — which is
precisely what FR-STK-03 exists to prevent, and it will happen during the pilot fortnight where
it does the most damage to trust. **Move write-offs into Phase 3** with receiving; keep velocity
low-stock suggestions in Phase 4, where they belong.

#### (f) Backup is scheduled at Phase 4, and §23.1 contradicts §23 on this — **[Product Owner]**

§23 places "backup/restore drill" in Phase 4. §23.1's layer table says layer 6's backup "needs
nothing but the schema and can start early." The roadmap and the layer table disagree, and the
layer table is right. **The pilot store's data becomes irreplaceable at Phase 1's first real
sale in a real shop.** Hourly snapshots (`VACUUM INTO`) must exist before that sale; the
*restore drill by the owner onto another machine* (§27.10) can stay in Phase 4, because it is a
rehearsal, not a safeguard. Splitting the row costs nothing and closes a window in which real
trade data is being created with no backup behind it.

#### (g) Denomination counting is a Must in the PRD and a Should for me — **[Product Owner]**

FR-SHF-01 makes the denomination counter a v1 requirement. The **irreducible** requirement is: a
counted total, an expected total, a recorded variance, and a prompted note (FR-SHF-02, §27.7). A
denomination grid produces a *better-quality count* of the same truth. I would ship a single
counted figure on day one and add the grid in the same phase if it is cheap. If it turns out to
cost a week of Phase 1, it displaces something that changes whether Գոռ is still using the app
in week four, and that trade is bad.

#### (h) Practice mode should be v2 — **[Product Owner]** *(my most contentious call)*

FR-LRN-02 and §27.19 require practice mode to run against a **second database file**, with
`Session.mode` threading through layer 4 (§23.1), and two audit rows proving entry and exit. That
is a real architectural commitment — a second connection, a mode-aware session, and an
acceptance criterion (§27.19) that exists *only because the feature exists*, for a training aid
serving one shop with one or two workers whose actual training is §21.1's ten-minute unaided
sale (§27.11).

**Cheaper alternative for v1:** ship the product with a seeded demo database and a documented
"reset to demo" step used during installation, which is when training happens anyway.
Reintroduce true practice mode in v2 when there are enough shops that we are not present at
setup. I expect pushback on this one, and I would rather have the argument in Phase 1 of the
storm than after `Session.mode` is in the schema.

#### (i) Where I agree with §23 against my own instinct — **[Product Owner]**

- **Purchase orders in v2.** Correct. A shop without POs still trades. But **A1 is untested**,
  and the PRD's own contingency says a wrong A1 moves the PO flow into v1. That contingency only
  fires if someone actually counts *receipts with a PO vs. without* during the parallel
  fortnight. Name that person before the pilot starts, or the assumption goes unfalsified and
  hardens — exactly what §24 says this section exists to prevent.
- **Stocktake specified in v1, shipped in v2.** Correct, and for the right reason: the data model
  has to exist in v1 or the ledger needs migrating later.
- **Nullable `locationId` from Phase 0.** Correct. Cheap now, a migration over a year of
  movements later.
- **Trust (debt) before Buy.** Correct, and against the instinct that says costs should come
  before profit. Debt is the differentiator and the lower-risk build; it belongs first.

---

## 4. Regulatory-only events, and what that does to their priority

**[Product Owner]** These events exist because of an obligation, not because a user wants them.
On the wall in Phase 2 I want them on a **different colour sticky**, because otherwise someone
will prioritise them by user value, and they do not have any.

| Event (candidate) | Driven by | Direct user value | My priority ruling |
|:--|:--|:--|:--|
| `FiscalReceiptIssued` / `FiscalReceiptFailed` / `FiscalDeviceUnreachable` | Q1, §17, A10 | **None.** Pure obligation | v2 build. **But the seam is v1** — §17 says retrofitting fiscalisation into a checkout path that never anticipated it means rewriting the path. `Sale.fiscalReceiptId` reserved, and a post-commit hook point that does nothing |
| `ReceiptNumberAllocated` *with a gapless guarantee* | Q10, A11 | **None** — the customer does not care about the number's continuity | **Low build priority, highest decision priority.** If Simon must issue a gapless number, §14's guarantee that selling continues through a LAN drop is what has to give (§26 Q10). This one regulatory answer can invalidate the entire offline design. Decide before layer 5 |
| `TaxExtractedFromPrice` / `TaxAddedToPrice` / `PriceBasisChanged` | Q2, Q11, A3, A13 | **None to the shopkeeper**; he thinks in shelf prices | v1, because §10.8 made it a setting rather than a design. Cheap now — but §27.18 exists purely to prove a regulatory behaviour, and it is one of the more expensive acceptance criteria in the list |
| `TaxInvoiceExported` / `WaybillExported` | Q12, A14 | **None** — B2B paperwork | v2 at the earliest, and only if Q12 says Simon must *produce* rather than *export*. If it must produce, that is a new v2 feature, not a change to an existing one |
| `CustomerAnonymised` / `PersonalDataErased` | Q14, A16, §19.6 | **Negative.** Արամ wants records *kept*; erasure destroys his ledger's names | v1 minimal (FR-DAT-05: name and phone cleared, amounts and dates kept). It is a constraint on layers 1 and 2 — which fields exist, which go null — not a feature anyone schedules |
| `ConsentRecordedForDebtLedger` | Q14, A16 | **Negative.** A consent step in §6.3 is friction in the highest-value screen in the product | Do not build until Q14 says it is required. If it is, it lands in the exact screen H2 says must be fastest — a genuine product cost, not a checkbox |
| `RetentionPeriodElapsed` / `BackupRotated` | Q13, A15 | **None** | v1, but as a *setting* on the existing rotation. One number |
| `ZReportGenerated` | Fiscal ritual in origin | **High** | The exception that proves the rule. Regulatory in ancestry, genuinely valuable now — it is Արամ's daily closing artefact. Keep it, and do not let its fiscal parentage argue it into v2 |

### 4.1 How the regulatory origin changes priority — the rule

**[Product Owner]** **Regulatory events get low build priority and high decision priority.
Build them last; decide them first.** They do not compete for build capacity — they compete for
*someone's attention in a 45-minute meeting* (§26.1), and that is a different budget entirely.

**[Product Owner]** Three of them are shape-determining rather than feature-shaped, and those
must not be deferred as a group with the others:

1. **Q10 (gapless numbering)** can invalidate offline selling — the thing §14 is built to
   guarantee and §27.8 is built to prove.
2. **Q2 (price basis)** determines what every price in the database *means*. §10.8 defused it by
   supporting both bases, which was excellent work, but a wrong setting still misprices
   everything in the shop from day one.
3. **Q1 (ՀԴՄ obligation)** determines whether Simon can be the till at all.

### 4.2 The product problem hiding inside §17's interim position — **[Product Owner]**

§17's interim position is that Simon runs *beside* whatever certified ՀԴՄ the shop already has,
and that this must be stated to every pilot store in writing. As a legal stance that is correct
and honest. **As a product stance it is a live threat to H2**, and I do not think the PRD prices
it: if Գոռ has to ring every sale into Simon *and* punch it into a fiscal device, the till is now
strictly slower than the notebook-plus-ՀԴՄ he uses today. §2.3's first failure mode is triggered
not by our latency budget but by an integration we deliberately deferred, and no amount of
optimising scan-to-line fixes it.

**[Product Owner]** So I want two things from the storm. First, Phase 2 must model the
double-entry reality explicitly — a `SaleAlsoEnteredOnFiscalDevice` step exists in the pilot
whether we sticky it or not, and an unmodelled step is an unmeasured one. Second, the parallel
fortnight must time the *combined* flow, not Simon's flow, because the combined flow is what
Գոռ actually experiences and what he will judge us by. §21.1's timings measured on Simon alone
will look fine and mean nothing.

**[Product Owner]** And a scheduling consequence: **Q1 is the only open question that can make a
finished v1 commercially unusable.** Everything else on the risk list costs a setting, a mode or
a repositioning. That asymmetry justifies pulling §26.1's 45-minute conversation forward to the
front of the build, ahead of work whose value depends on its answer — which is what §26 already
says, and which is the kind of thing that slips because nobody's phase is blocked on it.

---

## 5. The ten highest-value user stories

**[Product Owner]** Ordered by value, each with the events I expect Phase 2 to discover behind
it. Event names are candidates for the wall, not decisions.

---

**US-1 — Scan an item onto the sale** · *Must* · **[Product Owner]**
> **As** Գոռ the worker, **I want to** scan a barcode and see the line appear instantly,
> **so that** I never look slow in front of a queue.

Events: `ItemScanned` → `ProductIdentified` → `SaleLineAdded` *or* `SaleLineQuantityIncremented`
(rescan increments, FR-SELL-01) → `BasketTotalRecalculated`.
Value: this is H2's test surface and the < 200 ms budget (§21, §27.1) lives here. Every other
story depends on it.

---

**US-2 — Take cash and give change** · *Must* · **[Product Owner]**
> **As** Գոռ, **I want** Simon to tell me the change before I open the drawer, **so that** I do
> not do arithmetic in front of a customer.

Events: `TenderOffered` → `ChangeComputed` → `CashRoundingApplied` → `SaleCommitted`
→ `StockMovementPosted(SALE)` → `DrawerExpectedAmountChanged` → `ReceiptPrinted`
→ `CashDrawerKickRequested`.
Value: §2.2's 09:15 scene, eleven seconds, no typing. Note the ordering constraint the PRD is
firm about — the sale commits in one transaction and **printing happens after commit**
(FR-SELL-11, §13.1); the drawer kick is a separate command, not a side effect of printing (§18).

---

**US-3 — Sell on Nisya with the debt visible** · *Must* · **[Product Owner]**
> **As** Գոռ, **I want to** see what this customer already owes and how old the oldest charge is
> *before* I confirm, **so that** the decision is made in front of the customer, by both of us.

Events: `CustomerSearched` → `CustomerSelected` → `CustomerBalanceDisclosed(balance, oldestAge)`
→ `CreditLimitChecked` → [`CreditLimitBreached` → `CreditLimitOverridden(reason, adminPin)`]
→ `DebtChargePosted` → `SaleCommitted`.
Value: **the highest-value story in the product.** §2.2's 11:30 scene is described as "the
entire reason this product exists"; H3 stakes the venture on it; §27.12 proves it. The
disclosure event is the value — not the charge.

---

**US-4 — Close the shift against a counted drawer** · *Must* · **[Product Owner]**
> **As** Գոռ, **I want to** count the drawer and have Simon record the difference without
> accusing me, **so that** I can go home and the owner has no reason to doubt me.

Events: `ShiftCloseRequested` → `ExpectedCashComputed` → `CashCounted` →
`CashVarianceRecorded` → `VarianceNoteCaptured` → `ShiftClosed` → `ZReportGenerated`
→ `SessionEnded` (FR-SEC-02).
Value: the day's closing ritual, the trust anchor, and §27.7. **A shop that cannot do this on
day one has a broken product**, which is why this is fourth despite generating no revenue.

---

**US-5 — Open the shift on a counted float** · *Must* · **[Product Owner]**
> **As** Գոռ, **I want to** start selling in two taps and a number, **so that** the system is not
> a morning obstacle.

Events: `ShiftOpenRequested` → `OpeningFloatCounted` → `ShiftOpened` → `SessionStarted`.
Value: small, and inseparable from US-4 — an uncounted float makes every variance meaningless.
The design constraint is that it must cost under ten seconds (§2.2's 08:40).

---

**US-6 — Receive a delivery from a paper invoice, with its freight** · *Must* · **[Product Owner]**
> **As** Արամ (or the STOCK role), **I want to** enter what arrived and what it cost including
> the delivery charge, **so that** my margin later is the truth and not an estimate.

Events: `GoodsReceiptStarted` → `ReceiptLineEntered` (qty, unit cost, purchase UoM)
→ `LandedCostApportionedByValue` → `AverageCostRecalculated` → `StockMovementPosted(RECEIPT)`
→ `SupplierPayableRaised` → `GoodsReceiptCommitted`.
Value: the only door cost enters through. §2.2's 16:20 scene, §27.3, and FR-BUY-01's insistence
that **receiving without a prior order is the primary path** — which is A1, and which is the
whole reason POs are v2.

---

**US-7 — Take back a wrong item against the original sale** · *Must* · **[Product Owner]**
> **As** Գոռ, **I want to** find yesterday's sale by scanning the receipt and reverse one line,
> **so that** the stock and the drawer both end up right.

Events: `OriginalSaleLocated` → `ReturnLineSelected` → `ReturnQuantityChosen` (partial allowed)
→ `StockMovementPosted(RETURN)` *or* `WriteOffPosted` (restock-or-scrap decision)
→ `CostReversedAtOriginalUnitCost` → `RefundTendered` → `ReturnCommitted` → `AuditEntryWritten`.
Value: §2.2's 14:00 scene and §27.6. The cost-reversal-at-*original*-cost event is the one that
protects historical margin; getting it wrong is silent and permanent.

---

**US-8 — Record a repayment against the oldest debt** · *Must* · **[Product Owner]**
> **As** Գոռ, **I want to** take 20,000 off a customer's Nisya and have it land on the oldest
> charges first, **so that** the aging in the book stays honest.

Events: `RepaymentReceived` → `RepaymentAllocatedOldestFirst` (overridable, FR-DEBT-03)
→ `DebtChargeSettled` / `DebtChargePartiallySettled` → [`OverpaymentCreditPosted` — never a
negative charge, FR-DEBT-04] → `CustomerBalanceProjected`.
Value: without repayment the debt ledger only grows, and §27.5's reconciliation against the paper
Nisya book — the criterion that decides whether Արամ closes the book — is unreachable.

---

**US-9 — Answer "what did I earn today, and from what?"** · *Must* · **[Product Owner]**
> **As** Արամ, **I want to** open the dashboard at home and tap the profit figure to see the
> items that produced it, **so that** the number is explainable and I therefore believe it.

Events (read side): `DayTakingsProjected`, `DayMarginProjected` (from snapshotted `unitCost`),
`DebtorAgingProjected`, `LowStockProjected`, `MarginDrilledDown`.
Value: §2.2's 20:30 scene, H1, §27.14 — *without being shown how*. Nothing here writes anything,
and that is the point: every event above already produced this; reporting only has to not lose
it. This is the story I want partially delivered early (disagreement (d)).

---

**US-10 — Sell something that has no barcode in the system** · *Must* · **[Product Owner]**
> **As** Գոռ, **I want to** add an unknown item and sell it without leaving the sale, **so that**
> the queue never stops and the catalogue builds itself.

Events: `UnknownBarcodeScanned` → `QuickAddInvoked` → `ProductCreatedProvisionally`
→ `BarcodeLinkedToProduct` → `SaleLineAdded` → [`ProductCompletedLater` by an admin].
Value: FR-CAT-03, §27.13 — under 30 seconds, without leaving the sale. Under A2 this is not a
convenience feature, it is **the catalogue strategy**, and A2's failure is §25's most likely
single cause of pilot failure.

---

### 5.1 Two runners-up I refuse to leave off the wall — **[Product Owner]**

**US-11 — Keep selling through a Wi-Fi drop.**
> **As** Գոռ, **I want** the till to keep working when the Wi-Fi drops, **so that** I never reach
> for the notebook.

Events: `ConnectionLost` → `SaleQueuedToOutbox` → `ConnectionRestored` →
`OutboxDrainedSerially` → `SaleAcknowledged` / `DuplicateSubmissionIgnored` →
[`SyncConflictFlagged`].
Not top-ten by user value; **top-three by consequence of absence** (§27.8), and the reason for
disagreement (b).

**US-12 — Write off what broke.**
> **As** Արամ, **I want to** remove a broken item from stock with a reason, **so that** the stock
> figure stays believable and I know what breakage is costing me.

Events: `WriteOffRequested` → `WriteOffReasonSelected` → `StockMovementPosted(WRITE_OFF)` →
`AuditEntryWritten`. The reason for disagreement (e).

---

## 6. What I want Phase 2 to settle — **[Product Owner]**

1. Whether **Costing** is a context of its own or a subdomain of Inventory. I have argued for
   its own; I will lose gracefully if the wall says otherwise, provided it does not end up as a
   side effect of a receipt handler.
2. Whether **Cash & Shift** owns drawer truth, or Selling does. I say Shift owns it and Selling
   posts into it — the same relationship Selling has with the stock ledger.
3. Whether the **regulatory stickies get their own colour**. If they do not, they will be
   prioritised by user value they do not have, and Q10's ability to invalidate the offline design
   will be discovered by an engineer in layer 5 rather than by us on the wall.
4. Whether anyone can defend **practice mode** as v1 against the alternative in disagreement (h).
5. A name against **A1's measurement** in the parallel fortnight, or the PO contingency never
   fires.
