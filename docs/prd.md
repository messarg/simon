# Product Requirements Document — Simon

**Product:** Simon (Սիմոն) — trade management for small retail
**Document version:** 3.49 — see the revision history below
**Primary market:** Small & medium retail and hardware stores in Armenia
**UI language:** Armenian. Code, schema, API, comments, commits: English.
**Currency:** Armenian Dram (AMD, ֏)
**Type:** Full PRD
**Document owner:** messarg
**Last updated:** 2026-09-12
**Status:** §17 (fiscal) and §26 (open questions) need local professional advice before launch.

### Revision history

| Version | Date | Change |
|:--|:--|:--|
| **3.49** | 2026-09-12 | **The findings of three quality analyses, and a check so they stop recurring.** §4.1 names **Վաճառք** and **Կանխիկ** apart — sales and cash were one word, and the gap between them is the unexplainable figure §2.3 says ends the relationship. Goods going back to a supplier are **ետ ուղարկում**, never *վերադարձ*: one English word covered two documents that move money in opposite directions. §4.2 fixes *պարտք* as the only user-facing word for debt, since this document had used it interchangeably with *nisya* for versions. §5.4 adds the three core journeys as numbered flows with their branch points — §2.2 told the day as a story and §6 described screens, and neither was a flow an implementer could follow. §23.1's unretrofittable list gains idempotent submission and server-owned sale arithmetic, and loses its count. §24.4 collects every success measure in one place and states plainly why there is no commercial KPI at n = 1. §13.7's interim costing rule and §26's Q15–Q17 defaults are dated and owned, so a default stays visibly a default. §2.5's discovery plan gets a name and a gate — the one finding no edit can close. **`npm run check:prd`** now asserts that every §27 criterion has both a requirement and a build layer; it found §27.23 orphaned since 3.47 on its first run |
| **3.48** | 2026-09-12 | **The ten Tier A findings of the buy–sell event storm** (`docs/event-storming/`). A sale now carries a `businessDate` as well as a `shiftId`, because the offline design guaranteed the period and the drawer would diverge and the frozen-`shiftId` rule then made those sales unpostable. `avgCostMdram` is nullable — unknown was being stored as zero and reported as 100% margin, permanently. Both it and `stockQty` are now declared caches and both are drift-checked; the ledger's replay order is `seq`, not the device's clock. §15.3 states what the server recomputes, which decides whether §12.1's discount cap is a control or decoration. `CashMovement` gains `REFUND` and §12.5 gains the term for it — a cash refund was invisible to the drawer. `SaleReturn` gains the whole reversing-document checklist §10.7 now states once; refunds split by tender and carry their share of a sale-level discount. `DebtAllocation` becomes a derived projection over stored intent, which makes §14.5's "recomputed on sync" legal. `CostCorrection` gives immutability the restatement mechanism it always implied. §27.22 rewritten so it can fail; eleven criteria added; `sale-already-returned` struck. Q15–Q17 opened for the three money decisions that are not the engineer's to make. **§6.11 gains an offline discount ceiling** — re-auth is server-side, so a LAN drop made «discount above the cap» impossible at the counter with a customer waiting, and rule 1 had no answer; it is bounded and flagged on sync, in the same shape as the offline debt cap. `shop.timezone` becomes a real setting in §6.11 as well as §11. Eleven FR rows added so every new acceptance criterion is reachable from the requirement index, and each assigned to a build layer in §23.1 — where layer 1's model count is now dropped rather than corrected, since §23.1's own prose warns that a claim with a count in it rots quietly, and this one had |
| **3.47** | 2026-09-10 | §27.23 assigned to a layer, and §23.1's coverage claim stripped of the count that had been wrong since 3.34 |
| **3.46** | 2026-09-10 | §25's Wi-Fi mitigation cited the accepted-risk escape hatch 3.45 removed; it now names TLS, which is both true and stronger |
| **3.45** | 2026-09-10 | §16.6 stops offering the plain-HTTP deployment its own decision removed; §9's sixth question gains the method that makes it work |
| **3.44** | 2026-09-10 | Swept every mention of the tax basis — the heading, the requirement, the assumption and §26's intro all still stated the single-mode rule 3.41 replaced |
| **3.43** | 2026-09-10 | `Sale.priceBasis` snapshotted — a setting that changes arithmetic must be recorded on the document it changed, or switching it rewrites history |
| **3.42** | 2026-09-10 | §10.1's identity stated for both price bases — 3.41 added the second mode and left the arithmetic written for the first |
| **3.41** | 2026-09-10 | The design now absorbs every answer to Q1, Q2 and Q10 instead of committing to one — none of them blocks the build any more |
| **3.40** | 2026-09-10 | Two sentences still called Q7 blocking; `locationId` is a plain column until v2 has a table for it to reference |
| **3.39** | 2026-09-10 | Q5, Q7, Q8 and Q9 answered by the project owner. `StockMovement.locationId` exists from Phase 0, which is now unblocked; A8 and A12 confirmed, A9 partly |
| **3.38** | 2026-09-10 | `parkedDepth` gains a writer and a reader; §9's checklist gains the breadth question that three runs of findings earned |
| **3.37** | 2026-09-10 | One queue, two counts — a parked basket is no longer reported as an unsent sale, and §14.5 says what parking does offline |
| **3.36** | 2026-09-10 | The transition rule scoped to sales, the only queue-drained document with a lifecycle; offline parking defined as the same outbox rather than a second mechanism |
| **3.35** | 2026-09-10 | Idempotency keys on the id **and the transition** — as written, completing a parked basket looked like a retry and the money was never taken |
| **3.34** | 2026-09-10 | §9 gains the five-category propagation checklist, and cross-till resumption is walked through all five: audit, Z-report, requirement, acceptance and the till screen |
| **3.33** | 2026-09-10 | Shift close scoped to its own baskets — with baskets now able to move between tills, an unscoped guard meant nobody could close while anyone had one open |
| **3.32** | 2026-09-10 | `Sale.shiftId` follows the sale to the till that completes it — the obligation 3.31's cross-till resumption created |
| **3.31** | 2026-09-10 | Lifecycle guards audited: a held basket is resumable from any till, and a closing shift blocks on open baskets rather than silently voiding them |
| **3.30** | 2026-09-10 | Four features that had a model and a rule but no requirement — receipt numbering, session revocation, the needs-attention list, anonymisation — reached the FR index |
| **3.29** | 2026-09-10 | Layer 6's dependency corrected — diagnostics need an API and a screen, not just a schema |
| **3.28** | 2026-09-10 | §23.1's layer map completed against §9's v1 list — import, reports, the wizard, practice mode, reorder and barcode input had no build position |
| **3.27** | 2026-09-10 | §23.1's layers now own the acceptance criteria that actually prove them — five had been parked on the client |
| **3.26** | 2026-09-10 | §26 Q11–Q14 restored — folding the brief in had kept its assumptions and lost the questions that falsify them |
| **3.25** | 2026-09-10 | `docs/fiscal-brief.md` folded into §26.1 and deleted. One document is the source of truth |
| **3.24** | 2026-09-10 | The seven fiscal working assumptions joined §24.2's register as A10–A16, where every other bet in this document lives |
| **3.23** | 2026-09-10 | §23.1 build order and dependencies; a map of §6's screens by audience; §0 points implementers at the build order |
| **3.22** | 2026-09-10 | Audited §3's ten rules, §4's vocabulary and §18's hardware against the specs for the first time: barcodes and sessions now retire rather than delete, a hidden word left the report catalogue, and the cash drawer stopped opening on a reprint |
| **3.21** | 2026-09-10 | Multi-location restored to Phase 6, and the v1 schema decision hiding inside it gated on §26 Q7 at Phase 0 |
| **3.20** | 2026-09-10 | A separate fiscal brief was written, then folded back in at 3.25 |
| **3.19** | 2026-09-10 | The Phase 5 gate now counts §21.2 correctly: one capturable baseline, eight KPI values to measure |
| **3.18** | 2026-09-10 | Re-armed the Phase 5 gate against measured figures rather than against the absence of blanks — 3.17 had made it satisfiable by editing the table |
| **3.17** | 2026-09-10 | Practice sales excluded from the owner's queue figure; every adoption KPI now carries a baseline, a capture point, or a reason it cannot have one |
| **3.16** | 2026-09-10 | The outbox moved from `Session` to `Device`, and deactivating a device now revokes its sessions |
| **3.15** | 2026-09-10 | `Device` — the till as a durable row, so §12.1's receipt number has a prefix and a counter that outlive a session |
| **3.14** | 2026-09-10 | Receipt numbering specified and its fiscal conflict raised as §26 Q10; the `StockAdjustment` wrapper dropped in favour of self-sourced movements |
| **3.13** | 2026-09-10 | Closed a cost leak the new audit-log endpoint opened: an opaque record snapshot is gated by route, because field-level stripping cannot see inside one |
| **3.12** | 2026-09-10 | Swept the whole document for the shapes previous audits found once and fixed once: `StockAdjustment` as the source document adjustments and write-offs required, sale read endpoints, and endpoints for review flags, imports, settings, users, categories and the audit log |
| **3.11** | 2026-09-10 | §13.7 purchase-return costing — a v1 scope item that had a model, an endpoint and a movement type but no rules — plus `PurchaseReturnLine`, the worker's other two screens (§6.15, §6.16) and the admin endpoints §16 required |
| **3.10** | 2026-09-10 | §10 audited against §11 for the first time: `Product.stockQty` restored to the model, one identity for the sale total instead of two, plus `GoodsReceipt.reversesId`, `Customer.discountBp` and one name for the purchase factor |
| **3.9** | 2026-09-10 | `ProductStats` for the four screens that need sales velocity, and a throttle so the `Session` row does not cost a database write per barcode scan |
| **3.8** | 2026-09-10 | Third model audit — §7, §8, §19, §20 against §11: `ImportBatch`/`ImportRow` give §19.1's idempotency a mechanism, plus `Customer.nameSearch`, `BackupRun`, drift flags and debt reversal links — and three prose commitments that earlier edits had quietly falsified |
| **3.7** | 2026-09-10 | Second model audit — §6 and §14–§16 against §11: a `Session` entity, `AuditLog.reason`, customer deactivation and merge, `updatedAt` for incremental sync, and seven smaller fields |
| **3.6** | 2026-09-10 | Domain-model audit: `SaleReturnLine`, `ReviewFlag`, `SupplierAllocation`, `Stocktake`; a shift formula that counts repayments once; write-off reason codes; and seven smaller fields §12/§13 required but §11 never had |
| **3.5** | 2026-09-10 | The five journeys (§6), the discovery plan (§2.5), named warning types for sync conflicts (§8.5, §14.6), and a pilot that must return numbers as well as software (§23) |
| **3.4** | 2026-09-10 | Competitive landscape and "why now" (§1), evidence status (§2.4), glossary (§4.4), error catalogue (§8.5), personal-data lifecycle (§19.6), adoption KPIs (§21.2); measurable NFRs, risk likelihoods, and one normative home for the import rule (§19.1) |
| **3.3** | 2026-09-10 | §15 API contracts; §11 lifecycles and field validation; §19.5 diagnostics; §9 requirement index; real numbers for lockout, session timeout and the offline debt cap |
| **3.2** | 2026-09-09 | §10.8 tax extraction; §19.4 practice-mode isolation; §24 assumptions and constraints; §6.12–6.14 owner screens |
| **3.1** | 2026-09-09 | Resolved internal conflicts: `STOCK` cost access, `VOIDED`, WAC rounding, the allocation invariant, the durability guarantee, and a single release authority |
| **3.0** | see git | Added the experience layer (Part A) and usability acceptance criteria |
| **2.0** | see git | The correctness core: integer money, append-only ledgers, weighted average, idempotent sync. Tagged at `18f4b18` |

---

## 0. How to read this document

The document is in four parts. Read the part you need; they are written to stand alone.
**If you are about to write code, start at §23.1** — it orders the sections by what has to exist
before what, which is not the order they appear in.

| Part | Sections | For |
|:--|:--|:--|
| **A — The people and the experience** | §1–§9 | Anyone. Who this is for, how it must feel, what each screen does |
| **B — The rules** | §10–§15 | Engineers. Data, money, ledgers, flows, the wire contract. The correctness core |
| **C — The environment** | §16–§20 | Engineers and ops. Security, compliance, hardware, data, reporting |
| **D — Delivery** | §21–§27 | Everyone. Assumptions, budgets, architecture, roadmap, risks, acceptance |

**What changed from v2.** v2 established the correctness core — integer money, append-only
ledgers, weighted-average costing, idempotent sync. All of that is unchanged and is now
Part B. What v2 lacked was any account of how a person with limited computer experience
learns to use it. Part A is new: personas, a mental model, an information architecture, full
screen specifications, a learnability plan, and an error-recovery catalogue. Part D adds
usability acceptance criteria alongside functional ones, because a POS that is correct and
unlearnable has failed.

**What changed in 3.1.** No new scope. 3.1 closes the contradictions that appeared where 3.0's
experience layer met v2's rules: the `STOCK` role's exact cost access (§16.5), the meaning of
`VOIDED` (§10.7), rounding and the zero-or-negative denominator in the weighted average
(§10.5), the allocation invariant under overpayment (§10.6), what the durability guarantee
actually promises (§21), and a single authority for release content (§9 decides, §23 orders).

**What changed in 3.2.** Four gaps that blocked implementation, now filled: **§10.8** settles
tax as extraction from a tax-inclusive price rather than addition to it; **§19.4** gives
practice mode a real isolation mechanism instead of a promise; **§24** separates the
assumptions we are betting on from the constraints we are designing around; and **§6.12–6.14**
specify the three owner screens that §5.1 had been pointing at since 3.0. Acceptance criteria
went from 17 to 21.

**What changed in 3.3.** The engineering contract, which was implied everywhere and written
nowhere. **§15** states the API: conventions, RFC 7807 error mapping, the four idempotent
queue-drained endpoints, and the rest of the surface. **§11** gains state machines for the four
entities that have one, and the field conventions and validation rules that make a Prisma
schema and a Zod contract derivable rather than guessable. **§19.5** says how a box with no
remote access gets diagnosed. **§9** gains a requirement index — 58 numbered requirements, each
with where it is specified and which acceptance criterion proves it. §16.2 and §16.3 now carry
real numbers instead of "N failures" and "a short timeout", and §14.5's offline debt cap has a
value and a setting. Sections 15–26 shifted by one; §27 is the acceptance criteria.

**What changed in 3.4.** The document's honesty and its edges. **§1** names the alternatives it
is actually competing against, starting with the notebook. **§2.4** says what Part A rests on,
which is inference rather than research, and where each claim gets confirmed. **§4.4** is a
glossary. **§8.5** turns the error table into a catalogue of frozen `type` values with
indicative Armenian, so the wire contract can be built while the copy is still being reviewed.
**§19.6** gives personal data a lifecycle. **§21** makes "no lock contention" and "readable in
poor light" measurable, names WCAG 2.2 AA, and adds paper baselines plus **§21.2**'s adoption
KPIs. **§25** gains a likelihood column and is reordered by it. Three remaining enums are
enumerated, `NO_SALE` is modelled, and held sales are given a home. **§1** closes with why this
is worth building now, including the one cost of delay that cannot be bought back later: the
paper baseline can only be measured once, during the parallel fortnight. The import guarantee,
previously stated in both §7.3 and §19.1, is now normative in §19.1 alone.

**What changed in 3.6.** §12 and §13 were read line by line against §11 for the first time, and
the model could not represent what the logic asked of it. **`SaleReturn` had no lines**, so the
partial return §6.5 promises and §27.6 tests was unbuildable; it has them now, with `restock`
and the snapshotted original cost per line. **§12.5's shift formula counted repayments twice** —
once as `repayments`, once as the cash movement §12.3 writes — which would have overstated
expected cash by every repayment of the day, on the screen §6.6 exists to make trustworthy; the
formula is now a query over typed rows and `CashMovement` has a `REPAYMENT` type. **`ReviewFlag`
gives §15.2's warnings the durable state that section demands**, and serves §13.6's recount list
and §14.6's needs-attention list from one table. Write-off reasons became a coded field, supplier
allocation became a table like `DebtAllocation`, `Product` gained the supplier §13.3's formula
needs, and the stocktake session §11 had already given a state machine finally has a model.

**What changed in 3.7.** The same audit, run against §6 and §14–§16. **There was no `Session`** —
§16.3 specifies a revocable, per-device, shift-bound token, §19.4 puts practice mode on it and
§21.2 reads a session log, and the entity did not exist; it does now, holding the token's hash
rather than the token, plus the outbox depth each client reports so §19.5's `/health` can answer
a question about queues that live on phones. **`AuditLog` could not store a reason** — six places
demand an override "with a reason" and the table had only `before`/`after`, which is the less
useful half in any shrinkage investigation. `Customer` gained deactivation and a forwarding
address for merges; catalogue rows gained `updatedAt`, without which `?since=` had nothing to
compare; and the strict credit-limit setting that §6.3 and §12.2 both assume now exists in
§6.11.

**What changed in 3.8.** The audit reached §7, §8, §19 and §20. **§19.1 was the only section
labelled normative and its one guarantee had no mechanism** — "idempotent, re-runnable" with
nothing to be idempotent *about*. `ImportBatch` and `ImportRow` supply it, and a second run of
the opening-debts file can no longer double every balance in the shop. **Customers had no
`nameSearch`**, so §20.3's Latin-typed search worked for products but not for the debtor screen
the product exists for. `BackupRun` and a `LEDGER_CACHE_DRIFT` flag give §19.5's `/health` real
tables to read; `DebtEntry.reversesId` makes §8.2's wrong-customer correction the linked
reversal §10.7 demands; and erasure gained an explicit `anonymisedAt` instead of a rule that
contradicted §11's own validation.

Three findings were **prose commitments falsified by earlier edits**: §19.4 still said "§11 is
unchanged" after `Session.mode` was added to it, §7.1 said "Nothing else" while §16.2 expected
the wizard to issue a recovery code, and §19.6 said "nothing else about a customer is stored"
after two passes had added fields to that row. None was reachable by checking that references
resolve — a section can declare itself closed and be made wrong from somewhere else entirely.

**What changed in 3.9.** Both entries here are obligations that models added in 3.7 and 3.8
created against sections written much earlier. `Session` was right for §16.3, §19.4 and §19.5,
and nobody asked what it costs §13.1 — as specified it wrote a row on **every request**,
including every barcode lookup, against a single-writer database and §21's concurrency budget;
session writes are now throttled to once a minute and kept out of document transactions. And
sales velocity had four consumers — quick tiles, the low-stock alert, the reorder formula, dead
stock — with no table behind it and a §22 job whose output had nowhere to go; `ProductStats` is
that table, a rebuildable cache of the same standing as `Product.stockQty` and deliberately
outside §10.4's drift check, because alerting on an approximate figure only teaches an owner to
ignore alerts.

**What changed in 3.10.** §10 and §11 had never been read against each other — adjacent
sections that appear to say the same things, which is exactly why nobody checked. Two things
were wrong in the arithmetic the product is judged by. **`Product.stockQty` was absent from
§11** although §10.4 is entirely about it and eight other places name it. And **§10.1 and §10.8
gave different formulas for `total`**: `sum(lines) + roundingAdjustment == total` is true only
when no sale-level discount was given, and §12.1 offers them, so a discounted receipt did not
add up. There is now one identity, printed on the receipt, with `taxTotal` explicitly not a term
in it. Alongside: `GoodsReceipt` gained the `reversesId` §6.14 assumed, `Customer.discountPercent`
became `discountBp` so its scale is not a guess, §10.3 stopped naming the purchase factor
differently from §11, and `TRANSFER` is marked as the one movement type v1 never emits.

**What changed in 3.11.** Three seams that do not involve §11 at all. **Purchase returns were
v1 scope with no specification** — a model, an endpoint, a movement type, a roadmap phase, and
not one sentence saying what returning goods does to the weighted average. §13.7 says it:
reverse at the receipt's **landed** cost rather than the current average, or the units still on
the shelf end up valued at a blend that includes goods no longer held. The freight is not
refunded and is recorded as a loss rather than absorbed. **Two of the worker's four destinations
had no screen** — §5.1 defines the whole worker app as four tabs and §6 specified two of them;
§6.15 and §6.16 are the other two. And §16 required session revocation, lockout clearing,
recovery-code redemption and practice-mode switching, none of which §15.4 had an endpoint for.

**What changed in 3.12.** Rather than fix another instance, this pass swept for the *shapes*
earlier audits had each found once. Two mattered. **`POST /adjustments` and `POST /write-offs`
had no source document** — §11 requires every movement to name one and calls a movement without
one a bug, so both endpoints could only ever write an invalid row; `StockAdjustment` is that
document, one table serving the two movement types. And **§15 could create sales but never read
them back** — returns start from the original sale, a jammed printer reprints from the record,
held baskets are listed by time, and shift close must find every open one, all with no endpoint
to do it. Endpoints were also missing for review flags, imports, settings, users, categories and
the audit log; a trail nobody can read protects nobody, so it is a report in §20.2 now as well.
`Payment.method = TRANSFER` joins `TRANSFER` in the movement enum as a value marked reserved
rather than left looking implementable.

**What changed in 3.13.** The audit-log endpoint added in 3.12 was a cost leak. §16.5 strips
cost **field by field**, and `AuditLog.before`/`after` are whole-record JSON snapshots — a price
change carries `avgCostMdram` inside a value no field filter inspects, and §27.9 says a `WORKER`
obtains no cost field from *any* endpoint. It is now gated as a route, with the general rule
stated so the next snapshot-shaped feature inherits it rather than repeating the mistake. Also:
`reasonCode` had ended up on two models and is back to one, and §15.1's "JSON" now admits the
one multipart exception it always had.

**What changed in 3.14.** **`Sale.number` had no generation rule** in 2,771 lines, though §6.5
scans it and §15.4 looks sales up by it — and the question hides a real architectural conflict:
a gapless sequence needs one authority, and §14.2 promises the till completes sales with that
authority unreachable. §12.1 now specifies device-prefixed numbering assigned at completion, and
says plainly that a gapless number, where a regime demands one, comes from the ՀԴՄ through the
`fiscalReceiptId` seam rather than from Simon. **§26 Q10** asks the accountant to confirm it,
because if Simon must issue the gapless number then §14's offline design is what changes, not a
field.

`StockAdjustment` — added one version earlier to give two movement types a source — was itself
both shapes that pass had swept for: a header with no lines, holding nothing the movement did
not already carry. It is gone, and `ADJUSTMENT` and `WRITE_OFF` are now self-sourced as a stated
exception. Several items written off together are several movements, because §20.2 aggregates
movements and not documents.

**What changed in 3.15.** 3.14's numbering rule named a `devicePrefix` and a per-device
sequence that existed nowhere. `Device` holds both. It had to be its own row rather than a
field on `Session`, because a session is revoked at every logout and a receipt number printed
on paper outlives it by years — and because the device's copy of the counter has to be
authoritative, or a till that loses Wi-Fi cannot number the sale in the customer's hand.

**What changed in 3.16.** Two consequences of adding `Device` a version earlier. The outbox
counters were left on `Session`, where §19.5 summed them across every session row a phone had
ever had — a queue belongs to the till, not to whoever is signed in on it, so they moved. And
`Device.isActive` claimed to stop a lost phone while its live session carried on selling;
deactivating a device now revokes its sessions in the same transaction.

**What changed in 3.17.** Moving the outbox to `Device` left one question open: practice mode is
per-session, so did a practice sale count against the till's queue? It does not — it is
discarded rather than sent, and counting it would give the owner a figure that never reaches
zero and an alert that never clears. §21.2's baseline column also had four blanks; they are now
explicit *n/a* entries, because "still using it at month 3" has no prior value to measure
against and a blank cannot say that.

**What changed in 3.18.** 3.17 filled §21.2's blank baselines, and two other places were keying
their meaning off those blanks: §23 said Phase 5 could not exit "until §21.2's baseline column
has no blanks left in it". Removing the blanks satisfied the gate without anyone measuring
anything — the exit criterion had become passable from a desk. The gate now tests for **figures
taken in the shop**, names which three baselines can carry one, and requires an *n/a* to be
confirmed unmeasurable rather than merely unmeasured. §21.2's own opening sentence, which still
claimed every baseline came from the parallel fortnight, now describes the table beneath it.

**What changed in 3.19.** The gate re-armed in 3.18 named "§21.2's three measurable baselines"
and listed three things, two of which are not baselines: the share-of-sales row already has one
(`0% at go-live`) and the write-off row already has one (`0 discoverable`) — what the pilot
takes for those is the *measurement*, not the baseline. §21.2 has exactly one baseline the shop
can lose, the 90-day debt share on migration day, and eight KPI values to measure. The gate now
says that.

**What changed in 3.5.** The last gaps that editing could reach. **§6** opens with five numbered
journeys — the four a worker is trained on plus receiving — so the paths that cross screens are
specified, not left to be inferred from fourteen separate screen specs. **§2.5** turns §2.4's
admission of missing evidence into an instrument: five shops, nine questions, and a Phase 1 exit
condition, because the honest thing to do about an evidence gap is to schedule closing it.
**§14.6**'s three sync conflicts get named warning types (§8.5), so a flag exists somewhere a
person can see rather than only in the server's head. And **§23** now says what the parallel
fortnight has to bring back: §21.2's baselines can be measured exactly once, and a pilot that
ships software without them has half failed.

---

# Part A — The people and the experience

## 1. Vision & positioning

Simon is a **digital employee**: a tireless clerk and bookkeeper for a traditional Armenian
store owner. It replaces two paper notebooks — the stock book and the *Nisya* (Նիսյա) debt
book — with a phone the worker already carries and a dashboard the owner already trusts.

The promise is not "software". It is:

> *At closing time you know exactly what you sold, what you earned on it, what is left on
> the shelf, who owes you money, and whether the cash in the drawer matches.*

**100% self-hosted.** Everything runs on the store's own computer and its own Wi-Fi. No
vendor cloud, no subscription dependency, no data leaving the premises. This answers a real
preference among local owners for keeping records on their own hard drive, and it is a
competitive advantage against cloud POS vendors — not a limitation to apologise for.

### What Simon is not

Naming the non-goals early prevents the product from drifting into an ERP nobody can use.

- Not an accounting system. It feeds an accountant; it does not replace one.
- Not a CRM. It remembers who owes money, not who likes what.
- Not an e-commerce platform.
- Not a multi-store chain system in v1.
- Not a tool that requires anyone to understand inventory theory.

### The alternatives

Simon is not really competing against other software. It is competing against a notebook that
works.

| Alternative | What it does well | Where it loses |
|:--|:--|:--|
| **The paper notebook** — the real incumbent | Instant, always available, never crashes, never asks for a password, costs nothing, and everyone in the shop already knows it | Cannot total a month, cannot age a debt, cannot tell him his margin, cannot survive a fire, and cannot be in two places at once |
| **Excel or Google Sheets** | Free, familiar to the bookkeeper, exports trivially | It is not a till. No barcode, no shift, no ledger discipline — and every hand-written formula is a chance to be silently wrong |
| **Cloud POS**, regional and international | Polished, supported, nothing to run yourself | A monthly fee in a currency the shop does not earn; useless the moment the internet drops; data on someone else's machine, which this market actively dislikes; and built around a supermarket's workflow, not a hardware store's |
| **1C and its ecosystem** | Dominant in the post-Soviet accounting world, and accountants already know it | Priced and shaped for a bookkeeper rather than a shopkeeper. It is precisely the ERP §1 refuses to become |
| **The ՀԴՄ fiscal device on its own** | Legally sufficient, and already sitting in many shops | Records the sale and nothing else: no stock, no debt, no margin, and no history anyone can interrogate |

**Where Simon wins:** it is the only option that keeps the notebook's speed and locality while
answering all four questions in §1's promise. **Where it is weakest:** no vendor support desk,
no cloud backup unless someone sets one up, and exactly one machine to lose (§25).

⚠️ The vendor-specific claims in this table — pricing, feature sets, local market share — are
**inferred, not researched** (§2.4). They must be checked against what is actually being sold
in Yerevan before anyone repeats them in a sales conversation (§26).

### Why now

Nothing in §1 is a new idea. Shopkeepers have wanted to know their margin for as long as there
have been shops. What has changed is that the pieces finally cost nothing.

- **The device is already in his pocket.** Simon's whole premise — the till is the worker's own
  phone — was not buildable for this price five years ago, and it is the reason the hardware
  bill is a scanner and a printer rather than a POS terminal (§18).
- **The peripherals are commodity.** An HID scanner is 15–25k ֏ and needs no driver (§18). The
  thing that used to make a POS a capital purchase is now an accessory.
- **Local-first is practical again.** SQLite, a PWA and one cheap PC are genuinely enough for a
  shop this size (§19.3). Self-hosting stopped being the compromise and became the feature (§1).
- **Record-keeping is moving toward electronic fiscal reporting**, and the shop will have to
  change something regardless. The open question is whether it adopts a system it chose or one
  imposed on it — which is exactly why §17 is the highest-priority unknown in this document.

**The cost of delay is specific, not rhetorical.** Two things expire. First, a shop that adopts
a cloud POS is far harder to win back than one still on paper, and the alternatives in the table
above are not standing still. Second — and this one cannot be recovered at any price — **the
paper baseline can only be measured once.** §21.2's KPIs and §24.2's assumptions are all
calibrated against how the notebook actually performs, and the parallel fortnight (§23) is the
only window in which anyone can watch both systems run side by side. After the shop switches,
that measurement is gone, and every claim in Part A stays a bet forever.

⚠️ The first and fourth bullets are inference about the local market, not research (§2.4).

---

## 2. The people who use Simon

### 2.1 Personas

**Արամ — the owner.** 50s. Owns a hardware store he has run for eighteen years. Knows his
stock by sight and his regulars by name. Uses a smartphone for calls, WhatsApp, and
YouTube. Has tried one POS before and abandoned it in a week — "it was for a supermarket,
not for me." Numerate and sharp about money; slow and suspicious with software.

- **Wants:** to know his real profit, to stop losing money to forgotten debts, to leave the
  shop for a day without losing control.
- **Fears:** that the computer will show a number he cannot explain; that a worker will
  cheat him; that he will lose eighteen years of records to a broken machine.
- **Judges the product by:** whether its numbers match what he already knows in his head.
  If Simon says he sold 240,000 ֏ today and he believes it was 260,000, he will stop
  trusting it entirely — and he will be right to.

**Գոռ — the worker.** 20s. Serves customers, carries stock, knows the shelves. Fast on a
phone for messaging; has never used business software. Paid modestly; not personally
invested in the shop's accounting.

- **Wants:** to not look slow or stupid in front of a queue.
- **Fears:** breaking something expensive, being blamed for a mistake, being watched.
- **Judges the product by:** whether it makes his shift easier or harder. If it is slower
  than the paper notebook, he will quietly go back to the notebook and the data will rot.

**Սիրան — the bookkeeper.** Visits monthly or quarterly. Wants clean exports in a familiar
shape. Not a Simon user; a Simon *consumer*. If she cannot get what she needs in one click,
she will ask Արամ for it every month forever, and he will resent the product for it.

### 2.2 A day in the life

Making the target concrete. This narrative is the acceptance test for the whole design.

> **08:40** Գոռ arrives, opens Simon on his phone, taps **Բացել հերթափոխ** (open shift), and
> enters the cash already in the drawer: 20,000. Two taps and a number. He is now selling.
>
> **09:15** A customer buys three items. Գոռ scans each — beep, beep, beep — the total is on
> screen. Customer pays 5,000 cash for a 4,300 total. Simon shows the change: **700**. Գոռ
> taps **Կանխիկ**, hands over the change, done. Eleven seconds, no typing.
>
> **11:30** A regular contractor takes 40 metres of cable and says "write it down." Գոռ taps
> **Պարտք**, types "Դավ" and the customer appears — with a quiet line underneath: *owes
> 45,000 ֏, oldest 62 days.* Գոռ can see it. So can the contractor, standing there. That one
> line is the entire reason this product exists.
>
> **14:00** A customer returns a wrong-size fitting bought yesterday. Գոռ finds the sale by
> scanning the receipt, taps the line, confirms the return. Stock goes back up; the cash
> comes out of the drawer; the record shows what happened and who did it.
>
> **16:20** A delivery arrives with a paper invoice and no prior order. Գոռ scans the items,
> types the quantities and costs from the invoice, and adds the 3,000 ֏ delivery charge.
> Simon spreads that charge across the goods so the true cost is right.
>
> **19:50** Գոռ taps **Փակել հերթափոխ**. Simon says it expects 187,400 ֏ in the drawer. He
> counts: 187,000. He enters it. Simon records a 400 ֏ shortfall without accusing anyone,
> and asks for a note. Shift closed.
>
> **20:30** At home, Արամ opens the dashboard: today's takings, today's *profit*, who owes
> him what and for how long, and three items running low. He taps the profit figure and
> sees the items that produced it. The number is explainable, so he believes it.

### 2.3 The two failure modes we are designing against

1. **Գոռ abandons it.** Under a queue, anything slower than paper loses. Mitigated by the
   speed budgets (§21) and the one-screen till (§6.1).
2. **Արամ stops trusting it.** One unexplainable number is enough. Mitigated by making every
   figure drill down to the events that produced it (§3, rule 3).

Everything in Part A exists to prevent one of these two.

---

### 2.4 What this is based on

Part A reads with confidence. That confidence is a drafting style, not a claim of research, and
the difference matters enough to write down.

| Claim | Currently rests on | Would be confirmed by |
|:--|:--|:--|
| The personas in §2.1 | Composites. Not interview subjects; no quotation in them is a real quotation | Three to five shop visits before build completes |
| The day in §2.2 | Inference from how the trade visibly works, not from observation | One full day observed in the pilot store |
| "A worker abandons anything slower than paper" (§2.3) | A strongly held belief. The entire speed budget rests on it | H2 (§24.3), in the pilot |
| Owners keep a paper *Nisya* book | Reported practice, common enough that the product is named for it | The pilot store's own book, at migration (§27.5) |
| "Nobody will type in 3 000 products" (§7.3) | Inference from how rollouts fail in other markets | A2 (§24.2), days 1–14 of the pilot |
| Competitor shape and pricing (§1) | Inferred, not researched | §26, before any sales conversation |
| The "why now" timing argument (§1) | Inference about the local market and its direction of travel | Shop visits, plus §17's fiscal answer |

**None of this blocks the build.** Every row is already tracked as an assumption (§24.2) or a
hypothesis (§24.3), and the pilot (§23) is the instrument for all of them. What it does block is
presenting this document to anyone outside the team as evidence-based. It is a well-reasoned
bet, and it should be described as one.

### 2.5 Closing the gap — the discovery plan

Writing cannot fix §2.4; visiting shops can. The plan is small enough that there is no excuse
for skipping it, and it is a **Phase 1 exit condition** (§23) so that it cannot be skipped
quietly.

**Owner: the document owner. Due: before Phase 1's exit review.** §2.4 is the one finding in
this document that no amount of editing can close — it is a gap in evidence, not in prose, and
rewriting Part A more confidently would only make it worse. Naming a person and a gate is
therefore the whole of the fix available here; the rest is done with a notebook, in a shop.

**Five shops, one hour each, before Phase 1 ends.** Hardware and general retail, owner present,
no demo and no laptop — the point is to listen, not to sell. Ask the same nine questions each
time and write the answers down verbatim:

1. Show me how you record a sale today. *(Tests the whole of §2.2.)*
2. Show me your debt book. Who owes the most, and how do you know how old it is? *(§6.3, H3.)*
3. What happened the last time a customer disputed what they owed?
4. How many items do you sell that have no barcode? *(A5.)*
5. Where does your product list live — anywhere, in any form? *(A2, and it decides §19.1.)*
6. When a delivery arrives, what paperwork comes with it? *(A1.)*
7. How do you know what you earned last month? Who tells you? *(H1.)*
8. What software have you tried, and what made you stop? *(§1's alternatives table.)*
9. Do you use an ՀԴՄ, and who set it up? *(§26 Q1 — the highest-priority unknown.)*

**What "done" looks like:** §2.1's personas rewritten with at least one real quotation each;
§2.4's rows changed from *inference* to *observed* or *contradicted*; §1's alternatives table
corrected against products people have actually used; and A1, A2 and A5 (§24.2) either confirmed
or re-planned. **A contradicted assumption is the most valuable outcome here** — it is far
cheaper to find out in a kitchen than in Phase 3.

---

## 3. Design philosophy — ten rules

These are decision rules. When a design question comes up, the answer is here.

**1. The queue never stops.** No error, sync failure, missing barcode, or unknown product
may block a sale. Degrade, warn, reconcile later — never block. A customer is standing
there with money in their hand.

**2. Paper is the benchmark.** A notebook is instant, always available, never asks for a
password, and never crashes. Beat it or lose to it.

**3. Every number is explainable.** Any total drills down to the individual events that
produced it. A figure the owner cannot verify is a figure he will not trust.

**4. Nothing financial is ever deleted.** Mistakes are corrected by reversing entries that
leave a trail. This protects the honest worker as much as it catches the dishonest one.

**5. Thumbs, not styluses.** One hand, bad light, dusty or gloved fingers, a cheap phone
with a scratched screen.

**6. Undo beats confirm.** A confirmation dialog on a routine action trains people to tap
"yes" without reading, which makes the dialog worthless exactly when it matters. Prefer a
few seconds of undo. Reserve hard confirmation for the genuinely irreversible (§8.1).

**7. Prevent, don't scold.** If an action is impossible, do not offer it. If input can be
malformed, make malformed input unrepresentable. An error message is a design failure that
has already happened.

**8. Teach nothing that can be inferred.** The product should be learnable by using it. Any
concept that needs explaining is a concept to remove or rename (§4).

**9. Defaults do the work.** Most sales are cash, one item, whole units, no discount, no
customer. The default path should need the fewest taps; everything else is one tap off it.

**10. Speed is a feature of trust.** Fast software feels reliable. A spinner during
checkout does more damage than a missing report.

---

## 4. The mental model

### 4.1 Simon is two notebooks and a shelf

Արամ already has a working mental model — his notebooks. Simon adopts it rather than
replacing it with a database model.

| The user thinks | Simon calls it | Internally it is |
|:--|:--|:--|
| The day's sales book | **Օրվա վաճառք** (today's sales) — everything sold, nisya included | `Sale` + `SaleLine`, grouped by `businessDate` |
| The money that came in | **Օրվա կանխիկ** (today's cash) — what physically entered the drawer | §12.5's expected-cash terms: cash payments + cash repayments + pay-ins − refunds − pay-outs − drops |
| The debt notebook | **Պարտքեր** (debts) | `DebtEntry` + `DebtAllocation` |
| What's on the shelf | **Պահեստ** (stock) | `StockMovement` ledger + cached `stockQty` |
| Goods coming in | **Ընդունում** (receiving) | `GoodsReceipt` + movements |
| The cash drawer | **Հերթափոխ** (shift) | `Shift` + `CashMovement` |
| What I earned | **Վաստակ** (earnings) | revenue − COGS from snapshotted unit costs |
| Goods going back to a supplier | **Ետ ուղարկում** (sending back) | `PurchaseReturn` — deliberately *not* Վերադարձ |

**Վաճառք and Կանխիկ are never the same number, and the difference is the product.** A nisya
sale is *sales* and not *cash*; a repayment is *cash* and not *sales*; a card sale is neither in
the drawer nor absent from the day. An owner who reads one figure and believes it is the other
will find a gap he cannot explain, and §2.3 says one unexplainable figure is enough to end the
relationship. So the two are **named apart everywhere** — on §6.9's home, on the Z-report, in
every export — and neither is ever labelled simply «today's takings», which is the word that
hides the distinction. Where a screen shows both, it shows them adjacent with the bridge between
them (debt sold, debt repaid) spelled out, because that bridge *is* the answer to "why don't
these match?".

**The user is never shown the right-hand column.** Not in a label, not in an error, not in
an export header. If a screen needs the word "ledger", "movement", "allocation",
"idempotent", or "reconciliation", that screen is wrong.

### 4.2 Vocabulary rules

- **Use the shopkeeper's word, not the accountant's.** "Ի՞նչ եմ վաստակել" (what did I earn),
  not "Gross margin analysis".
- **One word per concept, everywhere.** If a debt is *պարտք* on the till, it is *պարտք* in
  the report, on the receipt, and in the export. Synonyms are how a UI stops feeling like
  one product.
- **Պարտք in the product; Nisya in this document only.** The practice is called *nisya* and the
  product is named for it, which makes *Nisya* the right word for §4.4's reader and the wrong one
  for the screen. Every user-facing string says **պարտք**; no screen, receipt, report or export
  says *nisya*. This rule exists because the two were used interchangeably here for several
  versions, and a vocabulary rule that its own document breaks will not survive contact with an
  implementer.
- **A return has a direction, and the directions have different words.** Goods coming back from a
  customer are **վերադարձ**; goods going back to a supplier are **ետ ուղարկում** (§4.1). One
  English word covers both and one Armenian word must not: they move money in opposite
  directions, they are different documents (§11), and §6.14's promise that they share screen
  *grammar* is precisely a reason to keep their *names* apart.
- **Verbs on buttons, nouns on headings.** *Վաճառել* (sell) is a button; *Վաճառք* (sale) is
  a heading.
- **Numbers before words.** A worker scanning a screen sees quantities and totals first.
- **No English, no transliterated English, no abbreviations** the shop does not already use.

⚠️ **All Armenian copy in this document is indicative and must be reviewed by a native
speaker before implementation.** Terminology consistency matters more than elegance.

### 4.3 Concepts we deliberately hide

Real complexity that must never surface to the user:

| Internal concept | What the user sees instead |
|:--|:--|
| Weighted average cost | Nothing. It silently produces "վաստակ". |
| Landed cost apportionment | "Առաքման ծախս" — one field on receiving |
| Idempotency key / outbox | "Չուղարկված վաճառքներ: 3" (3 sales not yet sent) |
| Stock movement types | A plain history list: *what changed, when, who* |
| Payment allocation | The debt list shows oldest first; the maths is invisible |
| Reprojection / cache drift | An owner alert: "Պահեստը ստուգման կարիք ունի" |
| Basis points, milli-drams | Ordinary numbers in ordinary units |

---

### 4.4 Glossary

Terms this document uses without explaining. The Armenian words the *user* sees are in §4.1;
these are the trade and engineering terms the *reader* meets.

| Term | Meaning |
|:--|:--|
| **Nisya** (Նիսյա) | The shop's credit book: goods taken now, paid later, recorded by name. The practice this product is built around (§6.3) |
| **ՀԴՄ** | *Հսկիչ դրամարկղային մեքենա* — the fiscal cash register required for recording retail sales in Armenia (§17) |
| **ՊԵԿ** | *Պետական եկամուտների կոմիտե* — the State Revenue Committee, which registers ՀԴՄ devices (§17) |
| **ԱԱՀ** | *Ավելացված արժեքի հարկ* — value-added tax; standard rate 20% (§10.8, §17) |
| **Dram, ֏ (AMD)** | Armenian currency. Transaction amounts are whole drams (§10.1) |
| **Milli-dram** | A dram ×1000. Used for unit prices and costs so averages do not drift (§10.1) |
| **Unit cost, by role** | Three different numbers, deliberately named apart in §11 after one name meant all three. `SaleLine.unitCostMdram` is the **weighted average at the moment of sale**; `GoodsReceiptLine.invoiceUnitCostMdram` is what the supplier billed, before freight; `GoodsReceiptLine.landedUnitCostMdram` and `PurchaseReturnLine.landedUnitCostMdram` include the apportioned freight. §13.7's costing rule turns on which one is read, which is why the selling side keeps the short name and the buying side does not (§10.5) |
| **Milli-unit** | A quantity ×1000, so 2.5 kg is stored as `2500` (§10.2) |
| **Basis point (bp)** | One hundredth of one percent. 20% is `2000` (§10.1) |
| **WAC** — weighted average cost | The running average unit cost, recalculated on every receipt (§10.5) |
| **Landed cost** | The true cost of goods including delivery and duty, spread across lines by value (§10.5) |
| **COGS** | Cost of goods sold — the snapshotted unit costs of what was sold, which is what makes a margin report immutable (§10.5) |
| **Ledger / movement** | An append-only record of change: never edited, only added to (§10.4, §10.6) |
| **Allocation** | Which specific charges a payment paid off. Without it there is no aging (§10.6) |
| **Aging** | How old an unpaid debt is, measured from the charge date (§10.6) |
| **X-report / Z-report** | Mid-shift totals that do not reset, and end-of-shift totals that close the period (§6.6) |
| **Idempotency** | Sending the same request twice has the same effect as sending it once (§14.3) |
| **Outbox** | The client-side queue of completed sales waiting to reach the server (§14.4) |
| **HID wedge** | A barcode scanner that pretends to be a keyboard: it types the code and presses Enter (§18) |
| **WAL** | SQLite's write-ahead logging mode, which lets readers work while a writer commits (§13.1) |
| **UUIDv7** | A time-sortable unique id that can be generated on the client (§11, §14.3) |
| **RPO / RTO** | How much data a failure may lose, and how long recovery may take (§21) |

**Not one of these words appears in the UI.** §4.1 and §4.3 are the rule; this table is for the
people reading the schema.

---

## 5. Information architecture

### 5.1 Two apps in one

Role determines what exists, not just what is enabled. A worker never sees a greyed-out
button for something he cannot do — the concept is simply absent from his world.

*Naming, for the whole document:* **owner** means a user holding the `ADMIN` role, and
**worker** means `WORKER` or `STOCK` (§16.4). Where the difference matters, the role name is
used instead.

**Worker (phone/tablet).** Four destinations. That is the whole app.

```
Վաճառել  (Sell)      ← default, ~90% of use, opens on launch
Պարտքեր  (Debts)     ← look up a customer, take a repayment
Պահեստ   (Stock)     ← look up an item, receive goods (if permitted)
Հերթափոխ (Shift)     ← open, close, cash in/out
```

**Stock worker (`STOCK`).** The same four destinations — no extra tab. Receiving (§6.7),
stocktake (§6.8) and write-offs live *inside* **Պահեստ**, because that is where a person
already goes to think about stock. The role adds capability, not navigation.

**Owner (desktop, back room or home).** Everything the worker sees, plus:

```
Գլխավոր       (Home)         ← today at a glance                (§6.9)
Հաշվետվություն (Reports)     ← tiered, see §5.3                  (§6.10)
Ապրանքներ     (Products)     ← catalogue, prices, costs          (§6.12)
Հաճախորդներ   (Customers)    ← debts, limits                     (§6.13)
Մատակարարներ  (Suppliers)    ← orders, what I owe                (§6.14)
Կարգավորումներ (Settings)     ← few, defaulted, explained         (§6.11)
```

### 5.2 Navigation rules

- **The till is the home screen** for a worker. Launching the app means being ready to sell.
- **Never more than two taps** from selling to any worker destination, and one tap back.
- **No nested menus** in the worker app. No hamburger. No drawer inside a drawer.
- **Navigation is bottom-anchored** on phones — thumb reach, not a top bar.
- **A sale in progress survives navigation.** Checking a customer's debt mid-sale must not
  lose the basket.

### 5.3 Progressive disclosure for the owner

Reporting is where small-business software usually drowns its user. Simon tiers it:

| Tier | What it answers | Where |
|:--|:--|:--|
| **1. Glance** | "How did today go?" | Home. Four numbers, no interaction needed. |
| **2. Explain** | "Why is that number what it is?" | Tap any figure → the events behind it |
| **3. Explore** | "Show me last month by product" | Reports, with date and grouping |
| **4. Export** | "Give it to my accountant" | One button, CSV/Excel |

Nobody must pass through tier 3 to get value. Most owners will live in tiers 1 and 2
forever, and that is a success, not an under-use.

---

### 5.4 The core journeys, step by step

§2.2 tells the day as a story and §6 describes the screens one at a time. Neither is a flow, and
an implementer needs one: the order of the steps, the branch points, and what happens at each
branch. These three are the journeys every other screen exists to support. **Numbered because
they are sequences** — the order carries information, and a step taken early is a different
product.

**J1 — A cash sale.** The path §21 budgets at four taps and fifteen seconds.

1. Scan an item. → line appears at the top of the basket, under 200 ms (§21).
   - *Barcode unknown?* → quick-add sheet, two fields, back into the sale (§7.4). **Never a dead end.**
   - *Same item scanned again?* → the existing line increments. Never a second line.
   - *No barcode at all?* → typed search (Latin-typed Armenian works, §20.3) or a quick tile.
   - *Sold by weight?* → keypad; it refuses decimals on a piece-counted product (§10.2).
2. Repeat for each item.
3. Tap **ՎՃԱՐԵԼ**. → payment screen.
4. Tap **ԿԱՆԽԻԿ**, take the money.
   - *Tendered less than the total?* → the completing button stays inactive and the shortfall is
     shown. **Prevented, not rejected** (rule 7) — this is not an error path.
   - *Part cash, part card or nisya?* → split tender (§6.2); payments must sum to the total.
   - *Discount above the cap?* → admin PIN and a typed reason (§12.1); offline, up to the offline
     discount ceiling (§6.11), then refused.
5. Sale commits — one transaction (§12.1). Change shown as the largest figure on the screen.
6. Receipt prints, **after** the commit; the drawer opens on a separate command (§18).
   - *Printer jammed?* → the sale is already saved; offer a reprint (§8.2). Never a rollback.
   - *Offline?* → the sale completed locally at step 5 and sits in the outbox (§14.4). The worker
     sees a calm strip, not a modal, and carries on.

**J2 — A sale on nisya.** J1 to step 3, then the screen the product exists for (§6.3).

1. Tap **ՎՃԱՐԵԼ** → **ՊԱՐՏՔ**.
2. Type the first letters of the customer's name.
   - *Not found?* → create them inline, name and phone, without leaving the sale (§6.13). A
     duplicate phone is caught as it is typed.
3. **Read the four figures**, which are the screen and not a dialog over it: owed now, age of the
   oldest charge, credit limit, balance after this sale. The customer can read them too, and that
   is the point (§12.2).
4. Confirm.
   - *Over the limit?* → `422` carrying the numbers as fields (§8.5). Reduce the sale, or an admin
     PIN plus a reason. In strict mode there is no override.
   - *Customer blocked?* → refused; only an admin unblocks.
   - *Offline?* → the limit cannot be checked. Allowed up to the offline debt cap (§6.11), then
     cash only; a breach discovered on sync is accepted and flagged, never reversed (§14.6).
5. Commits as one transaction: sale, lines, movements, and a `CHARGE` (§12.2).

**J3 — Receiving a delivery.** The buy cycle, which usually starts with a driver and a paper
invoice and no prior order at all (§13.2).

1. Open **Պահեստ → Ընդունում**.
   - *Offline?* → **blocked, clearly.** The one place rule 1 yields, because nobody is selling on
     this screen and the stock must be authoritative (§14.5).
2. Pick the supplier; type the invoice number.
3. Per invoice line: scan or search the item, then enter quantity and unit cost **from the paper**.
   - *Item not in the catalogue?* → create it here, where the cost is actually known — unlike
     quick-add at the till, which cannot know it (§10.5).
   - *Cost far from last time?* → confirm or correct, and confirming raises a flag (§13.2).
   - *Bought by the box, stocked by the metre?* → the purchase unit converts itself, and the
     receipt records which unit it used (§11).
4. Enter the delivery charge, if any. → apportioned across the lines **by value**, before the
   average moves (§10.5).
5. Submit. One transaction: receipt, movements, recalculated average, supplier payable, audit row.
   - *Goods wrong or damaged?* → a purchase return naming **receipt lines**, reversed at the
     landed cost those lines came in at (§13.7).

## 6. Screens

Each screen below specifies: **purpose · layout · states · interactions · what can go wrong ·
why it is learnable**. Where a rule from §3 drives a decision, it is cited.

**The sixteen screens, by who opens them.** They are numbered in the order they were specified,
which is not the order anyone meets them. This is the map; §5.1 is the navigation.

| Who | Screens |
|:--|:--|
| **Worker — the four destinations of §5.1** | Till **§6.1** · Debts **§6.15** · Stock **§6.16** · Shift **§6.6** |
| Reached from the till, inside a sale | Payment **§6.2** · Debt sale **§6.3** · Repayment **§6.4** · Returns **§6.5** |
| Reached from Stock, `STOCK` role only | Receiving **§6.7** · Stocktake **§6.8** *(v2)* |
| **Owner** | Home **§6.9** · Reports **§6.10** · Products **§6.12** · Customers **§6.13** · Suppliers **§6.14** · Settings **§6.11** |

### The five journeys

Screens are specified one at a time below; a shift is not lived that way. These are the paths
that cross them — the four a worker is trained on (§7.6) plus the one that belongs to `STOCK`.
Numbered steps follow the user's path; where the system's part matters — a commit, or a screen
answering back — it is named rather than assumed. Branches are specified where they happen, not
collected at the end.

**J1 — Open the shift.** *Once per shift, ~15 seconds.*
1. Launch → the till (§6.1). Not signed in → PIN pad.
2. Enter PIN → `POST /auth/login` (§15.4). *Wrong → `pin-incorrect`, attempts remaining shown.
   Five wrong → `account-locked`, and §16.2's three ways out.*
3. No open shift → **Բացել հերթափոխ**.
4. Count the drawer, type one number — the opening float — then tap to open. Two taps in all
   (§6.6); the number is typed between them.
5. Simon: `POST /shifts` → shift `OPEN` (§11). The till is ready to sell.

**J2 — Cash sale.** *~90% of all use. Target under 15 seconds for three items (§21).*
1. Scan → line appears at the top of the basket, under 200 ms (§6.1).
   *Unknown code → quick-add sheet (§7.4): name, price, unit, **ՊԱՀԵԼ ԵՎ ՎԱՃԱՌԵԼ**, back in the
   basket. Never a dead end (rule 1).*
   *Same item rescanned → the existing line increments.*
2. Repeat per item. *Wrong quantity → tap the line, retype on the keypad. Wrong item → swipe,
   with 5 seconds of undo (§8.1).*
3. **ՎՃԱՐԵԼ** → payment (§6.2).
4. **ԿԱՆԽԻԿ**, then one tendered shortcut — exact, or the next round 500/1000/5000 (§6.2).
   Change is already the largest number on screen.
   **That tap completes the sale.** The payment button *is* the action, not a confirmation of
   it, and nothing opens on top of it (§8.1, rule 6). Four taps for one item — scan, pay, cash,
   done — which is §21.1's budget exactly, and it is why there is no room for a dialog.
   *Payment short of the total → the button is simply inactive, with the shortfall shown
   (§6.2, rule 7). That is prevention, not a confirmation step.*
5. Simon: `POST /api/sales` (§15.3), committed in one transaction, printed after commit
   (§12.1, §13.1).
   *Offline → written to the outbox and completed locally; the queue drains later, exactly once
   (§14.3, §14.4).*
   *Stock short → `insufficient-stock` warning; the sale completes anyway (§13.6).*

**J3 — Debt sale.** *The reason the product exists (§6.3).*
1. Build the basket exactly as J2.
2. **ՎՃԱՐԵԼ** → **ՊԱՐՏՔ**.
3. Type the first letters of the name; recent customers first.
   *Not there → create with name and phone, without leaving the sale (§6.13). A duplicate phone
   is caught here (§6.13).*
4. **Read the four lines**: what they owe, the age of the oldest charge, their limit, and the
   balance after this sale. The customer is standing there and can read them too.
5. The completing tap. **The four lines above are the screen, not a dialog laid over it** —
   §12.2 makes that summary a functional requirement precisely so it is read in passing rather
   than tapped through, which is what §8.1 means by preferring undo to confirm.
   *Over the limit → `credit-limit-exceeded`: admin PIN and a reason, or reduce the sale
   (§12.2) — a genuine hard confirm, because money is being lent. Offline → allowed to §6.11's
   offline cap, then flagged on sync (§14.5).*
6. Simon: `POST /api/sales` with a `DEBT` payment → sale, lines, stock movements and a `CHARGE`,
   all in one transaction (§12.1).

**J4 — Close the shift.** *Once a day, the screen most likely to feel accusatory (§6.6).*
1. **Փակել հերթափոխ**. *This shift's held baskets → `shift-has-open-baskets`, listed by time and
   first item; complete or void each, or let another till take one (§11, Lifecycles).*
   *Unsynced sales → explicit acknowledgement, because the Z-report would be incomplete.*
2. Simon shows expected cash (§12.5). Shift → `CLOSING`.
3. Count in stacks: 5000 × n, 1000 × n, and so on. The counter totals as you go.
4. Simon shows the difference, neutrally. *Large variance → a note is asked for, not demanded as
   an explanation.*
5. **Hard confirm** — one of the few §8.1 asks for, because closing ends a period and is hard
   to unwind. Shift → `CLOSED`, Z-report issued, session ends (§16.3).

**J5 — Receive a delivery.** *`STOCK` or `ADMIN` only (§16.4). A paper invoice in one hand.*
1. **Պահեստ** → **Ընդունում** (§6.7). *Offline → blocked clearly; receiving needs authoritative
   stock (§14.5).*
2. Pick the supplier, type the invoice number.
3. Per line: scan or search, then quantity and unit cost from the invoice. Packaging converts
   itself — 3 spools of 50 m posts 150 m (§10.3).
4. Enter **Առաքման ծախս** if there is one. Simon spreads it across the lines by value (§10.5).
5. Submit → `POST /goods-receipts`: `PURCHASE_RECEIPT` movements, the weighted average moves,
   the payable is created — one transaction (§13.2).

*Throughout J5: the new average cost is never shown to `STOCK` — only the invoice costs they
typed themselves (§16.5).*

---

### 6.1 Till — Վաճառել

**The single most important screen in the product.** ~90% of all interaction. Everything a
worker does routinely happens here without navigating anywhere.

**Layout (phone, portrait).**

```
┌──────────────────────────────┐
│ Հերթափոխ բաց · Գոռ      ⚡   │  status strip: shift, user, connection
├──────────────────────────────┤
│  Մալուխ 3x2.5                │
│  2 մ × 1 200          2 400  │  basket: newest at TOP (just-scanned
│                              │  item is the one being checked)
│  Պտուտակ 4x40                │
│  10 հատ × 50            500  │
├──────────────────────────────┤
│  ԸՆԴԱՄԵՆԸ          2 900 ֏  │  large, always visible, never scrolls away
├──────────────────────────────┤
│ [ Սկան ] [ Փնտրել ] [ Արագ ] │  three ways in
├──────────────────────────────┤
│      ՎՃԱՐԵԼ  2 900 ֏         │  primary action, full width, bottom
└──────────────────────────────┘
```

**Four ways to add an item, all first-class:**

1. **HID scanner** — a cheap USB/Bluetooth laser scanner types the code and presses Enter.
   Fastest, needs no driver, works with no focused input. *The primary path for a fixed till.*
2. **Camera** — for a worker selling from the aisle. (Constrained by §18.)
3. **Quick tiles (Արագ)** — a grid of the most-sold unbarcoded goods: sand, cable, cement,
   rebar. **Auto-populated from actual sales velocity**, manually pinnable. Essential for a
   hardware store, where much of the stock has no barcode at all.
4. **Search (Փնտրել)** — Armenian or Latin-typed (§20.3).

**States.**

| State | Presentation |
|:--|:--|
| Empty basket | The three input buttons, large. Quick tiles visible immediately — a new worker sees something tappable, not a blank screen |
| Item added | Line animates in at top; short beep; total updates |
| Same item rescanned | **Increments the existing line** — never creates a duplicate |
| Unknown barcode | Quick-add sheet (§7.4), never a dead end (rule 1) |
| Offline | Calm strip: "Աշխատում է առանց կապի" — not an error |
| Sale in progress + navigated away | Basket preserved; returning restores it exactly |

**Interactions.**

- **Tap a line** → quantity keypad for that line.
- **Swipe a line** → remove, with a 5-second **Հետարկել** (undo) toast (rule 6).
- **Long-press a line** → price override, if permitted; requires a reason.
- **Hold sale (Պահել)** → park the basket, serve the next customer, resume later — **on this till or any other**, because the basket lives on the server (§12.1). Multiple
  held sales are listed by time and first item.

**Quantity entry.** A large keypad, not a spinner and not a native `type="number"`. Decimals
allowed only where the unit allows them: a piece count refuses `2.5`; cable by the metre
accepts it. The line total updates as the worker types, because that is the number they are
checking against the customer's expectation.

**Why it is learnable.** One screen, three ways in, one way out. Nothing is hidden behind a
gesture. A worker who can scan and tap **ՎՃԱՐԵԼ** is already productive; every other feature
is discovered later without being needed first (rule 8).

---

### 6.2 Payment — Վճարել

**Purpose.** Take money in the fewest possible taps, while making split payment and debt as
easy as cash.

```
┌──────────────────────────────┐
│  Ընդամենը           2 900 ֏  │
├──────────────────────────────┤
│  [ ԿԱՆԽԻԿ ]   [ ՔԱՐՏ ]      │  ← cash is first and largest (rule 9)
│  [ ՊԱՐՏՔ  ]   [ ԲԱԺԱՆԵԼ ]   │
├──────────────────────────────┤
│  Ստացված:  [  3 000  ]       │  cash only
│  Մնացորդ:      100 ֏         │  change, very large
└──────────────────────────────┘
```

- **Cash is the default and the largest target.** It is most of the volume (rule 9).
- **Tendered-amount shortcuts:** exact, next round 500/1000/5000 above the total. Three taps
  become one for the common cases.
- **Change is the biggest number on the screen.** It is the thing the worker must act on,
  and getting it wrong costs real money.
- **Split (Բաժանել)** — part cash, part debt, part card, in any combination. v2's model
  could not express this and it is entirely normal in practice: "2,000 now, rest on the book."
- The sale commits in one transaction (§13.1) and prints **after** commit — a printer jam
  must never roll back a paid sale.

**Errors.** A payment that does not cover the total cannot be confirmed — the button is
simply not active, with the shortfall shown (rule 7). Overpayment in cash is change;
overpayment on debt becomes a credit.

---

### 6.3 Debt sale — Պարտք

**Purpose.** Record credit safely, and make the risk visible at the moment of decision.

```
┌──────────────────────────────┐
│ Ո՞ւմ                          │
│ [ Դավ...              🔍 ]   │
├──────────────────────────────┤
│  Դավիթ Ս.                    │
│  Ունի պարտք  45 000 ֏        │  ← existing debt
│  Ամենահինը   62 օր           │  ← age of the oldest unpaid charge
│  Սահմանաչափ  50 000 ֏        │  ← credit limit
├──────────────────────────────┤
│  Այս վաճառքից հետո  47 900 ֏ │  ← after this sale
└──────────────────────────────┘
```

**This screen is the product's core value.** A paper notebook can tell you a number; it
cannot tell you that the number is 62 days old while the customer is standing in front of
you. The worker sees it, and so does the customer.

- Recent customers first, then search by name or phone. Never a plain unsorted list.
- A charge whose **due date** has passed is marked overdue here and on the owner's home
  (§6.9). This is separate from age (§10.6): *how old is this money* and *did they miss a
  promise* are different questions and must not share one number.
- **Over the credit limit → warn and require an admin override with a reason**, not a hard
  block (rule 1) — unless the owner has set the limit to strict in settings.
- **Never shame the customer.** The copy is factual. This screen is often visible to them.

---

### 6.4 Repayment — Մարում

**Purpose.** Take money against a debt and make the arithmetic obvious.

- Select customer → their unpaid charges, **oldest first, with ages**.
- Enter an amount → Simon allocates oldest-first automatically, and **shows which charges it
  cleared**. The worker can override.
- Partial payments fully supported — this is the normal case, not an edge case.
- Prints a receipt. In a cash-and-trust economy the paper acknowledgement matters to the
  customer, and refusing to produce one damages the relationship the debt depends on.

The user never encounters the word "allocation". They see charges being crossed off, oldest
first, exactly like a paper book.

---

### 6.5 Returns — Վերադարձ

**Purpose.** Undo a completed sale correctly, without letting returns become a theft route.

- **Always starts from the original sale** — scan the receipt number, or find it in recent
  sales. Blind returns (no original) are admin-only, because they are the classic fraud path.
- Partial quantities allowed; never more than was sold and not already returned.
- **Two outcomes, asked in plain language:** *"Ապրանքը վերադարձվե՞ց պահեստ"* (did the goods
  come back to stock?) — yes → back on the shelf; no → written off as damaged. The user is
  never asked to choose between `SALE_RETURN` and `WRITE_OFF`.
- Refunding a debt sale reduces the debt rather than paying out cash. Simon picks this
  automatically and says so.
- **Void vs. return:** a basket that was never completed (`DRAFT` or `HELD`) is *voided* —
  it posted nothing, so there is nothing to reverse. A **completed sale is never voided and
  never deleted**; it is reversed by a linked return, in full or in part (rule 4, §10.7).
  "Void this sale" is not an action the product offers after payment.

---

### 6.6 Shift — Հերթափոխ

**Purpose.** Know whether the cash matches, without turning the worker into a suspect.

**Open.** One number: the cash already in the drawer. Two taps.

**Close.** The screen that catches theft — and the one most likely to feel accusatory if
designed carelessly.

```
┌──────────────────────────────┐
│  Պետք է լինի      187 400 ֏  │
│                              │
│  Հաշվի՛ր կանխիկը             │
│  5000 × [ 30 ]     150 000   │  ← denomination counter, not one
│  1000 × [ 32 ]      32 000   │     free-text box: fewer errors,
│   500 × [  9 ]       4 500   │     and it matches how people
│   100 × [  5 ]         500   │     actually count money
│                    ────────  │
│  Ընդամենը         187 000 ֏  │
│  Տարբերություն       −400 ֏  │
└──────────────────────────────┘
```

- The **denomination counter** is a deliberate usability decision: people count cash in
  stacks, not as a single total, and a free-text total invites both typos and rounding.
- **Variance is recorded, never silently absorbed.** A large variance asks for a note.
- **Tone is neutral.** "Տարբերություն: −400 ֏" — never "Missing", never "Shortage", never a
  red alarm. The worker sees this screen every single day; most variances are honest
  mistakes, and treating each one as an accusation destroys goodwill fast.
- Produces the **X-report** (mid-shift, non-resetting) and **Z-report** (at close) that any
  accountant will ask for.
- Closing with unsynced sales requires explicit acknowledgement — the Z-report would
  otherwise be incomplete.

---

### 6.7 Receiving — Ընդունում

**Purpose.** Get goods and their true cost into the system from a paper invoice, fast.

- **Receiving without a prior order is the primary path**, not an exception. Most small-shop
  deliveries arrive with just a paper invoice. *(Assumption A1 — §24.2.)*
- Scan or search each item, enter quantity and unit cost from the invoice.
- **"Առաքման ծախս" (delivery charge)** — one field. Simon spreads it across the goods by
  value so the real cost is right. The user is never told the word "apportionment"; they
  just see each item's cost land slightly higher than the invoice line.
- Unit conversion is invisible and automatic: receiving 3 spools of 50 m adds 150 m of
  stock, because the product knows its own packaging (§10.3).
- Cost fields are **absent entirely for `WORKER`** — not greyed out, not empty: absent.
  `STOCK` types invoice costs here, because that is the job. What `STOCK` never sees is the
  resulting `avgCostMdram`, the margin, or the supplier's terms (§16.5).

---

### 6.8 Stocktake — Հաշվառում

> **v2** (§9). Specified now because the `STOCKTAKE` movement type and the session snapshot
> must exist in the v1 schema — retrofitting them means migrating a live ledger.

**Purpose.** Reconcile what the system thinks with what is on the shelf, without closing the
shop.

- A counting **session**: snapshot expected quantities, count by category or aisle, review
  the differences, approve.
- **Counting may happen while the shop trades** — variance is computed against the snapshot,
  not against a moving target.
- The review screen shows only items that differ, sorted by value of the discrepancy. Nobody
  wants to scroll past 900 correct items to find the 6 wrong ones.
- Approval posts the adjustments and values the shrinkage in drams, which is what makes it
  actionable.

---

### 6.9 Owner home — Գլխավոր

**Purpose.** Answer "how did today go?" in five seconds, from the doorway.

```
┌────────────────────────────────────────────┐
│  ԱՅՍՕՐ                                     │
│  Վաճառք  247 500 ֏      Վաստակ  61 200 ֏  │  ← takings and profit
│  42 վաճառք              Միջին  5 890 ֏    │
├────────────────────────────────────────────┤
│  Ինձ պարտք են        445 000 ֏  (12 հոգի) │
│    որից 90+ օր        88 000 ֏  ⚠         │  ← the number that matters
├────────────────────────────────────────────┤
│  Ես պարտք եմ         120 000 ֏            │
├────────────────────────────────────────────┤
│  Քիչ է մնացել  7 ապրանք   Չի վաճառվում 23 │
└────────────────────────────────────────────┘
```

- **Every figure is tappable and drills to the events behind it** (rule 3). Tapping
  "Վաստակ" shows the items that produced it. This is what converts a suspicious owner into
  a trusting one.
- **Both directions of debt** are shown. v2 had only receivables; an owner needs "what do I
  owe" just as much.
- **Dead stock sits beside low stock.** Capital tied up in unsellable goods is the opposite
  problem and equally expensive — and no paper notebook has ever told him about it.

---

### 6.10 Reports — Հաշվետվություն

Tiered per §5.3. **The report catalogue is listed once, in §20.2** — one list, so the two
cannot drift apart. This section specifies only how those reports are presented.

**Presentation rules:**
- Default period is **today**; changing it is one tap (rule 9).
- Every report exports to CSV/Excel in one tap — this is Սիրան's entire relationship with
  the product.
- A report with no data says what would put data in it, not "No results".
- Money columns right-aligned, thousands-separated, one format everywhere.

---

### 6.11 Settings — Կարգավորումներ

**Purpose.** Configure the few things that genuinely differ between shops, and nothing else.

Every setting must justify its existence; each one is a question the owner has to answer and
a branch the code has to carry.

| Setting | Default | Why it exists |
|:--|:--|:--|
| Shop name, address | — | Receipts |
| Tax regime | Ask at setup | Which of VAT / turnover / micro (§17) |
| Price basis | Tax-inclusive | Whether shelf prices include tax or exclude it — §10.8 supports both, and this is the switch |
| Tax rate | 20% if VAT | Basis points (§10.1); zero under turnover and micro |
| Cash rounding | None | Some shops round to 10 ֏ |
| Negative stock | Warn (not block) | Rule 1; strict shops may differ |
| Credit limit | Warn (not block) | Rule 1. Strict shops block the sale outright (§6.3, §12.2) |
| Debt book (Nisya) | On | Wizard Q4 (§7.1). A shop that sells only for cash never sees §6.3 or §6.4 at all — the concept is absent, not disabled (§5.1) |
| Max discount without admin | 5% | Shrinkage control |
| Credit limit default | 50,000 ֏ | Starting point per customer |
| Offline debt cap | 20,000 ֏ | Bounds a queued debt sale while the limit is uncheckable (§14.5) |
| Offline discount ceiling | 10% | Bounds a discount taken while **admin re-auth is impossible**, for the same reason and in the same shape as the offline debt cap above. PINs are verified server-side and never in the client (§16.2), so a LAN drop makes the admin PIN unreachable — and «discount above the cap» happens mid-sale, at the counter, with a customer waiting. Without a ceiling the only options are to block the sale, which rule 1 forbids, or to cache a PIN verifier on a phone that may be stolen, which §16.2 forbids more strongly. Above the ordinary cap and up to this one, an offline discount completes and is **flagged for owner review on sync**; above this one it is refused whatever the connection. Set it to the ordinary cap to disable the allowance entirely |
| Low-stock alert | Auto from velocity | Manual override per product |
| Retention period | 10 years | The longest plausible financial-record period (§19.2, §19.6). Erring long costs disk; erring short is unrecoverable — §26 Q13 shortens it, never lengthens it |
| Debt consent step | Off | §26 Q14. If consent turns out to be the lawful basis, this adds one step to §6.3 rather than a redesign |
| Backup destination | Local + USB | §19.2 |
| Shop timezone | `Asia/Yerevan` | What every shop-local boundary resolves against — the calendar day in §20's reports, the shift day, and §10.6's aging buckets. A stored setting rather than the host's locale, because a host PC left on UTC would put the day boundary four hours out and make every daily report wrong in a way that looks like fraud. Armenia observes no DST, so a misconfiguration is a one-time silent error rather than a twice-yearly visible one — *less* likely to be noticed, which is why the wizard asks rather than assumes (§11 `Setting`) |
| Text size | Normal | Older owners; a real accessibility need |

Anything not on this list is a decision Simon should make itself.

---

### 6.12 Products — Ապրանքներ

**Purpose.** Keep the catalogue true, and finish what the till started.

**The default view is not the catalogue.** It is the **"needs detail"** list from §7.3 —
products created by quick-add that still have no cost, category or reorder point. The owner's
job here is completing stubs, not browsing three thousand rows, and opening on a full
alphabetical list would bury the twelve items that actually want him.

```
┌────────────────────────────────────────────┐
│  ԱՆԱՎԱՐՏ  12          Բոլորը  1 847       │
├────────────────────────────────────────────┤
│  Մալուխ 3x2.5                              │
│  Գին 1 200 ֏ · ⚠ ինքնարժեքը լրացված չէ    │
├────────────────────────────────────────────┤
│  Պտուտակ 4x40                              │
│  Գին 50 ֏ · ⚠ ինքնարժեքը լրացված չէ       │
└────────────────────────────────────────────┘
```

- Filters: incomplete · low stock · dead stock · inactive · by category. Search is §20.3's.
- **Cost and margin columns exist only for `ADMIN`** (§16.5). For `STOCK` the column is absent,
  not empty.
- A price change writes `PriceHistory` and an `AuditLog` row and needs admin re-auth (§16.3).
  The previous price stays visible — *"was 1 100 ֏ until 12 March"* — because rule 3 applies to
  prices as much as to totals.
- **Barcodes are a list, not a field** (§11 `ProductBarcode`): add, **retire**, mark one
  primary. Retiring stops a code being printed on new labels; it never stops the code scanning,
  because the labels already on the shelves do not know they were retired.
- **Products are deactivated, never deleted** (rule 4, §8.1). A deactivated product keeps
  appearing in history and reports; it stops being sellable and stops being suggested.

**What can go wrong.**

| Situation | Behaviour |
|:--|:--|
| Barcode already on another product | Rejected, naming the other product, with a link to it. Never a silent reassign |
| Changing `decimalPlaces` after movements exist | **Blocked.** It reinterprets every historical quantity — `2500` means 2.5 kg or 2 500 pieces depending on a field the past does not share |
| Changing `stockUom` after movements exist | **Blocked**, same reason (§10.3). Add a `ProductUnit` instead |
| Changing a price while a held sale carries that line | No effect — the line snapshotted its price (§11) |
| Deactivating a product with stock on hand | Allowed, showing the remaining value at cost. It is usually a write-off decision (§13.5) |

**Why it is learnable.** It is the quick-add sheet (§7.4) with the optional fields filled in,
and it opens on exactly the things that are unfinished.

---

### 6.13 Customers — Հաճախորդներ

**Purpose.** One page per person, exactly like the Nisya book — plus the two controls that
stop debt growing without anyone having decided to let it.

Sorted by debt outstanding, descending, with the age of the oldest charge beside it. Never
alphabetical: the owner opens this screen to work out who to telephone.

```
┌────────────────────────────────────────────┐
│  Դավիթ Ս.      45 000 ֏    62 օր   ⚠      │
│  Սահմանաչափ    50 000 ֏                    │
├────────────────────────────────────────────┤
│  Արմեն Կ.      12 400 ֏     8 օր           │
├────────────────────────────────────────────┤
│  Անի Մ.         3 000 ֏     2 օր           │
└────────────────────────────────────────────┘
```

- **A worker can create a customer** — name and phone, nothing else — from the debt sale screen
  without leaving the sale (§6.3, rule 1). The credit limit takes its default from §6.11. This
  is the only write a `WORKER` makes on this screen.
- **Only `ADMIN` sets or raises a credit limit, or blocks a customer.** Those two fields are the
  only things bounding debt (§11 `Customer`), so they are not a worker's to move.
- Tap a customer → their ledger: charges and payments oldest first, each payment showing the
  charges it crossed off (§6.4), each charge drilling through to its sale (rule 3).
- **Print or export a statement** for one debtor. In a cash-and-trust economy this is how a
  disagreement gets settled without it becoming an argument.

**What can go wrong.**

| Situation | Behaviour |
|:--|:--|
| The same person entered twice — the classic | Duplicate detection on phone at create; then a **merge** that re-points every `DebtEntry` and writes an audit row. Never a delete, and never re-typing a balance by hand |
| Deleting a customer who owes money | **Not offered.** Deactivate — the debt history is financial record and survives (§10.7) |
| Deleting a customer at their request (§17, item 5 — personal data) | Name and phone are cleared; the ledger rows and their amounts remain against an anonymised record. The retention obligation must be confirmed before launch (§17) |
| Raising a limit to cover the sale in progress | Allowed with admin re-auth and a reason; both audited (§6.3, §16.3) |
| A repayment recorded against the wrong customer | Reversed by a linked correction, never edited (§10.7) |

**Why it is learnable.** It is the debt notebook: one name, one page, oldest at the top.

---

### 6.14 Suppliers — Մատակարարներ

**Purpose.** The mirror of §6.13 — what **I** owe, to whom, and how long they are willing to
wait.

- Sorted by outstanding payable, descending, with `paymentTerms` and `leadTimeDays` visible:
  the two fields that feed reorder maths (§13.3).
- Tap a supplier → receipts, purchase returns and payments, each payment showing the receipts
  it settled. The same allocation shape as customer debt (§10.6), deliberately the same screen
  grammar, so learning one teaches the other.
- Recording a payment creates a `SupplierPayment` with allocations, and a cash movement against
  the open shift if it came out of the drawer (§12.5).
- **Supplier terms are `ADMIN`-only** (§16.5). `STOCK` sees only the invoice costs it types
  during receiving.

**What can go wrong.**

| Situation | Behaviour |
|:--|:--|
| Paying the same invoice twice | A fully-allocated receipt shows as settled and cannot be selected for another payment |
| Paying more than is owed | Becomes a credit against the supplier, never a negative payable — §10.6's rule, mirrored |
| A receipt entered against the wrong supplier | Reversed by a linked correction, never edited (§10.7) |

**Why it is learnable.** It is §6.13 with the arrow pointing the other way, and it uses the
same words for the same things (§4.2).

---

### 6.15 Debts — Պարտքեր

**Purpose.** The worker's door into the debt book: find who owes, and take money against it.
§5.1 makes this one of four destinations; it is not §6.13 with fewer buttons, it is a different
job.

Opens on the debtor list, **sorted by amount outstanding with the age of the oldest charge**
beside it — the same ordering as §6.13, because one product should not sort the same list two
ways. Never alphabetical.

- **What a `WORKER` sees:** name, amount, age, overdue marker (§6.3). **What is absent:** the
  credit limit control, the block switch, the customer's discount, and any figure derived from
  cost. Absent, not disabled (§5.1, §16.5).
- Search by name — Latin-typed (§20.3), so `Dav` finds `Դավիթ` — or by phone.
- Tap a customer → their charges oldest first → **Մարում** takes a repayment (§6.4).
- **Create a customer here too**, name and phone, the same sheet §6.3 opens. A debtor who walks
  in to pay before they have ever bought on credit is rare but not impossible.

**What can go wrong.**

| Situation | Behaviour |
|:--|:--|
| Customer not in the list | Create inline; duplicate phone is caught at the point of typing (§6.13) |
| Repayment against the wrong customer | Change before confirming; afterwards an admin correction reverses it as a linked entry (§8.2, §11 `DebtEntry.reversesId`) |
| Offline | Balances show as **last known** and are labelled so (§14.4); a repayment still records and queues (§14.5) |

**Why it is learnable.** It is the Nisya book with the shop's controls left in the office.

---

### 6.16 Stock — Պահեստ

**Purpose.** Answer *"do we have it, and how many?"* without walking to the office — and, for
`STOCK`, the way in to receiving.

- Scan or search → the item, its **quantity on hand**, its selling price. For a `WORKER` there
  is no cost column at all (§16.5); for `STOCK`, none either — only the invoice costs they type
  during receiving.
- **Movement history per item**, as a plain list: what changed, when, and who. Never the words
  "movement" or "ledger" (§4.3).
- Offline, quantities are **last known and labelled as such** (§14.4). A number that might be
  stale and does not say so is worse than no number.
- **For `STOCK` only**, this is where **Ընդունում** (§6.7), stocktake (§6.8, v2) and write-offs
  (§13.5) live. No extra tab — the capability appears inside the place a person already goes to
  think about stock (§5.1).

**What can go wrong.**

| Situation | Behaviour |
|:--|:--|
| It says 0 and the item is in hand | Sell it anyway (rule 1); the movement raises a `NEGATIVE_STOCK` flag and the product joins the recount list (§13.6) |
| Offline and asked to receive | Blocked clearly — receiving needs authoritative stock (§14.5) |
| Two products look identical in the list | Barcode and unit are shown beside the name; the internal code disambiguates unbarcoded goods (§18) |

**Why it is learnable.** It is the shelf, written down.

---

## 7. Making it easy to learn

The single largest risk to this product is not a bug. It is a shop that installs Simon,
finds it too much work to start, and goes back to paper in week two.

### 7.1 The first hour, day, and week

**First hour — setup wizard.** Five questions, no jargon, skippable and resumable — each
answer is written to `Setting` under `setup.*` (§11) as it is given, so closing the laptop
halfway costs nothing:

1. Shop name?
2. Who will use it? (names + PINs — the owner sets them)
3. Do you sell by weight or length, or only by piece?
4. Do you keep a debt book? (turns Nisya on)
5. Do you have a product list to import, or shall we build it as you sell?

Nothing else is asked. Everything else has a working default.

The wizard **ends by showing the owner's recovery code once** (§16.2) and waiting while he
writes it down. That is not a sixth question — it is the one thing he leaves the wizard
holding, and the only route back in if he is ever the locked-out admin. At the end of the
wizard the shop can make a real sale.

**First day — sell with the catalogue empty.** Simon must be useful before it is complete.
An unknown barcode opens a 15-second add sheet (§7.4), so the catalogue fills through normal
trading. Day one is productive even if nothing was imported.

**First week — the numbers arrive.** By day 3 there is enough history for low-stock
suggestions — the first `ProductStats` refresh (§11) needs roughly that much trading behind it —
and by day 7, velocity-based quick tiles and a first weekly report. Value should
visibly compound, so the owner feels the investment paying back while the effort is still
fresh.

### 7.2 Practice mode — Փորձնական

A toggle that makes Simon behave **exactly** as normal, but writes nothing to the real
ledgers. A visible persistent banner makes the state unmistakable, and leaving practice mode
discards everything.

This solves a specific, real fear: Գոռ will not experiment with a system that handles his
employer's money, so he learns only the one path he was shown, and stays slow and anxious.
Practice mode makes exploration free. It also makes training possible without polluting
data, and gives support a way to reproduce a problem safely.

How the isolation is actually achieved — a separate database file rather than a flag on every
row — is §19.4, along with the rules that keep a practice sale out of the outbox, the drawer
and the fiscal adapter.

### 7.3 Progressive catalogue building

Nobody will type in 3,000 products. This is the most common reason small-retail software
pilots fail, and it must be designed against directly *(assumption A2 — §24.2; the claim is
inferred, not researched, §2.4)*:

- **CSV/Excel import** with preview, validation, duplicate-barcode detection, and per-row
  errors. The guarantee that makes it safe to press the button twice — idempotent, re-runnable,
  never partially applied — is stated once, in §19.1.
- **Opening debts import**, with their **original dates**, so aging is correct from day one.
  Importing them as "today" would make every debt look fresh and destroy the feature's value in
  its first week. How they are posted is §19.1's rule.
- **Quick-add at checkout** — the 15-second sheet: name, price, unit. Cost and category can
  come later; the sale must not wait.
- **A "needs detail" list** for the owner to complete later at his own pace.

**Decision (2026-09-10): build as though the shop has nothing digital.** Quick-add is the
onboarding story and import is a bonus, because that ordering is correct whatever §26 Q4 turns up
— a shop with a spreadsheet gets a faster start, and a shop with a paper ledger is not stranded.
The one thing import must carry regardless is **opening debts with their original dates**
(§19.1), because that data has no other way in and aging is wrong from day one without it.

### 7.4 Quick-add sheet

The highest-leverage screen in onboarding. Opens automatically on an unknown barcode.

```
┌──────────────────────────────┐
│  Նոր ապրանք                  │
│  Շտրիխ:  4820024700016       │  ← already filled from the scan
│  Անուն:  [                ]  │  ← the only required field
│  Գին:    [                ]  │  ← the only other required field
│  Չափ:    [ հատ ▾ ]           │  ← defaults to pieces
│         [ ՊԱՀԵԼ ԵՎ ՎԱՃԱՌԵԼ ] │
└──────────────────────────────┘
```

Two fields and a tap, then straight back into the sale with the item in the basket. Cost,
category, supplier, and reorder point are all optional and can be filled in later.

### 7.5 Help that is present, not filed away

- **Contextual, not a manual.** A `?` on each screen explains *this screen*, in Armenian, in
  two sentences.
- **First-run coach marks**, once per screen, dismissible, never again.
- **Empty states teach.** An empty debt list says "Այստեղ կհայտնվեն պարտքերը" and shows how
  to create one — it does not say "No records found".
- **No modal tutorial before first use.** Nobody reads it, and it delays the first success,
  which is the only thing that actually teaches.

### 7.6 Training the worker

A worker should be productive in **under 15 minutes**, covering exactly four things: open
shift, scan and take cash, record a debt sale, close shift. Everything else is learned later
or never needed.

Ship a **one-page laminated card** in Armenian for beside the till. This is not a
documentation afterthought — for this audience it is a genuine part of the product, and it
will be used more than any in-app help.

---

## 8. Error prevention & recovery

### 8.1 Undo over confirm

| Action | Treatment | Why |
|:--|:--|:--|
| Remove a basket line | **Undo**, 5s | Frequent, cheap to reverse |
| Change a quantity | **Undo**, 5s | Frequent |
| Complete a sale | No confirm | It is the goal; reverse via return |
| Discount over threshold | **Hard confirm** + admin PIN + reason | Money leaves; shrinkage vector |
| Return / refund | **Hard confirm** | Money leaves the drawer |
| Close a shift | **Hard confirm** | Ends a period; hard to unwind |
| Delete a product | **Not offered** | Deactivate only (rule 4) |
| Stocktake approval | **Hard confirm**, shows total value impact | Adjusts real stock in bulk |

Routine confirmations are removed deliberately. A dialog that appears twenty times a shift
is not read the twenty-first time, and its presence makes the genuinely dangerous dialog
look identical to the harmless ones.

### 8.2 What actually goes wrong, and what the user sees

| Situation | What the user sees | Recovery |
|:--|:--|:--|
| Unknown barcode | Quick-add sheet | Add in 15s, sale continues |
| Wrong quantity entered | Tap the line, retype | Immediate |
| Wrong item scanned | Swipe to remove + undo | Immediate |
| Wrong customer on a debt sale | Change before payment; after, an admin correction | Reversal, logged |
| Stock says 0, item is in hand | Warning, sale proceeds, item flagged for recount | Never blocks (rule 1) |
| Customer over credit limit | Warning + admin override with reason | Owner decides, not the software |
| Wi-Fi drops mid-sale | Calm strip; sale completes and queues | Automatic on reconnect |
| Printer jams | Sale is **already saved**; offer reprint | Reprint from the sale record |
| Two sales sent twice | Nothing — the second is ignored (§14.3) | Automatic |
| Cash doesn't match at close | Neutral variance + note prompt | Recorded, not punished |
| Wrong price on a receipt | Return + re-sell, or admin price correction | Both leave a trail |
| Host PC won't start | *Not recoverable in-app* | Runbook + tested restore (§19.2) |

### 8.3 Offline, in human language

Never the word "offline", never a status code, never a stack trace.

**The exact wording lives in §8.5**, once. This table is about where it appears and how loud it
is.

| State | Where it appears | What it says |
|:--|:--|:--|
| Connected | Nowhere — no chrome at all | Nothing |
| Working offline | A calm strip below the status bar | That work is being saved, in the same tone as any other status |
| Pending | The same strip, tappable → the outbox list | How many sales are still waiting |
| Sync problem | The same strip, tappable → the needs-attention list | How many failed, and what to do about it |

A calm banner, never a blocking modal (rule 1). The till keeps selling.

### 8.4 Empty states

Every empty state does three things: says what belongs here, says why it is empty, and
offers the action that fills it. "Ոչինչ չի գտնվել" alone is a dead end and a missed
teaching moment.

---

### 8.5 The error catalogue

§8.2 says what goes wrong; this says what the API returns and what the user reads. **The `type`
is the contract and is frozen; the Armenian is indicative and is not** — §4.2's review by a
native speaker applies to every string in the right-hand column, and none of them should ship
unreviewed.

The client maps `type` to a resource key; the server never sends user-facing prose (§15.2).

| `type` (frozen) | Status | Armenian (indicative) | What the user can do |
|:--|:--|:--|:--|
| `unknown-barcode` | — *(client-side)* | «Նոր ապրանք» | The quick-add sheet opens; the sale continues (§7.4) |
| `credit-limit-exceeded` | `422` | «Սահմանաչափը գերազանցված է։ Ունի 45 000 ֏, սահմանաչափը՝ 50 000 ֏» | Admin override with a reason, or reduce the sale (§6.3) |
| `customer-blocked` | `422` | «Այս հաճախորդին պարտքով վաճառք չի թույլատրվում» | Take payment another way; only an admin unblocks |
| `insufficient-stock` | **warning on `200`** | «Պահեստում նշված է 0։ Վաճառքը կշարունակվի» | Nothing. The sale completes and the item joins the recount list — the default, and rule 1 (§13.6) |
| `insufficient-stock-strict` | `422` | «Պահեստում չկա բավարար քանակ» | Only in strict mode (§6.11): reduce the quantity, or an admin adjusts stock first |
| `credit-limit-exceeded-on-sync` | **warning on `200`** | «Պարտքը գերազանցել է սահմանաչափը» | Nothing at the till. The sale posts and goes to the owner's needs-attention list (§14.6) |
| `product-deactivated-on-sync` | **warning on `200`** | «Ապրանքն այլևս ակտիվ չէ» | Nothing at the till. The sale posts; the owner reviews the product (§14.6) |
| `return-exceeds-sold` | `422` | «Վերադարձը գերազանցում է վաճառվածը» | Reduce the quantity; the original sale's remaining amount is shown |
| ~~`sale-already-returned`~~ | **struck** | — | **Removed 2026-09-12.** It was a per-*sale* block, and §12.4 is emphatic that the check is *"per line, not per sale, or two half-returns pass a whole-sale test"* — so a customer could not bring a second item back on Thursday. Its guidance ("open the existing return") assumed one return per sale, which §6.5 and §27.6 both contradict. `return-exceeds-sold` already covers the only case it could legitimately fire on. A frozen `type` that contradicts a settled rule is a build instruction someone will follow, which is why it is struck here rather than left to be noticed |
| `price-changed-on-sync` | **warning on `200`** | «Գինը փոխվել է այս վաճառքից հետո» | Nothing at the till. The sale stands at the price the customer was quoted; the owner reviews it (§14.6, §15.3) |
| `device-clock-skew` | **warning on `200`** | «Սարքի ժամացույցը սխալ է» | Nothing at the till. The device resyncs its clock and the owner sees it in the needs-attention list (§11) |
| `cost-variance` | — *(server-side flag)* | «Ինքնարժեքը սովորականից տարբերվում է» | Confirm or correct at the moment of receiving (§13.2); confirming raises a flag for the owner |
| `discount-above-cap` | `422` | «Զեղչը գերազանցում է թույլատրվածը» | Admin PIN plus a reason (§12.1) |
| `shift-not-open` | `422` | «Հերթափոխը բաց չէ» | Open a shift; the basket survives (§6.6) |
| `shift-has-open-baskets` | `422` | «Կան չավարտված վաճառքներ» | Complete or void each one, listed by time and first item. Only **this shift's** baskets are listed — one another till has picked up is no longer here |
| `duplicate-barcode` | `422` | «Այս շտրիխկոդն արդեն կա՝ {ապրանք}» | Open the other product; never a silent reassign (§6.12) |
| `immutable-after-movements` | `422` | «Չափման միավորը այլևս չի փոխվում» | Add a `ProductUnit` instead (§6.12) |
| `pin-incorrect` | `401` | «Սխալ PIN» | Retry; the remaining attempts are shown |
| `account-locked` | `423` | «Կողպված է։ Փորձե՛ք {n} րոպեից» | Wait, or any admin unlocks it in one action (§16.2) |
| `too-many-attempts` | `429` | «Չափից շատ փորձեր։ Սպասե՛ք {n} վայրկյան» | Wait out the rate limit — a different thing from being locked (§16.2) |
| `not-permitted` | `403` | «Ձեր իրավունքները չեն բավարարում» | Ask an admin; the screen says which role is needed |
| `session-expired` | `401` | «Մուտքագրե՛ք PIN-ը» | Re-enter the PIN; the basket is preserved (§16.3) |
| `offline-working` | — *(client-side)* | «Աշխատում է առանձին։ Վաճառքները կպահվեն։» | Nothing — the till keeps selling (§8.3) |
| `offline-pending` | — *(client-side)* | «{n} վաճառք դեռ չի ուղարկվել» | Counts **sales** only, never parked baskets (§14.4). Tappable; opens the outbox list |
| `offline-not-available` | — *(client-side)* | «Կապ չկա։ Այս գործողությունը հասանելի չէ» | Retry when connected; §14.5 lists what needs the server |
| `offline-debt-cap` | — *(client-side)* | «Առանց կապի պարտքի սահմանը լրացել է» | Take cash, or wait for the connection (§14.5) |
| `sync-failed` | `5xx` | «Չհաջողվեց ուղարկել {n} վաճառք» | Tappable; opens the needs-attention list (§14.6) |
| `not-found` | `404` | «Չի գտնվել» | The record never existed. A deactivated or `VOIDED` one still opens (§10.7) |
| `malformed-request` | `400` | *not shown — this is a bug* | Parked in the outbox and listed for the owner; never retried (§14.4, §15.2) |
| `illegal-transition` | `422` | «Այս վաճառքն արդեն փակված է» | The sale has moved on since this device last saw it — reload and look at where it is now (§11, *Lifecycles*) |
| `internal-error` | `5xx` | «Սխալ։ Վաճառքը պահպանված է» | The sale is safe; the diagnostics screen has the detail (§19.5) |

**Every message names a number or a next step.** A message that only reports a state is a
design failure that already happened (rule 7), and «Սխալ» on its own is the worst of them.

---

## 9. Scope

### v1 — must ship together to be useful
Catalogue & units · barcode and non-barcode selling · till, split payment, held sales ·
debt (Nisya) with aging and limits · suppliers, receiving with landed cost · stock ledger ·
returns both directions · shifts with denomination counting · roles and field-level
permissions · owner home with drill-down · velocity-based low-stock suggestions (§13.3) ·
backup & tested restore · Armenian UI · setup wizard, import, quick-add, practice mode.

### v2 — next
Fiscal/ՀԴՄ integration (§17) · label printing · stocktake sessions with approval (§6.8) ·
purchase orders, including turning a reorder suggestion into an actual order (§13.3) ·
multi-location · Tauri desktop packaging.

**This section is the authority on release content.** Several v2 items are specified in full
in Parts A and B — stocktake, purchase orders — because their data model has to exist in v1 or
the ledger needs migrating later. *Specified* is not *shipped*; §23 maps each build phase to
its release.

**One v2 item carries a v1 decision inside it.** Multi-location ships in v2, but *whether stock
is keyed by location* is a schema question that has to be settled before Phase 0 writes
`StockMovement` — adding a location key to a ledger with a year of movements in it is a
migration, not a field. §26 Q7 asked the owner whether a second shop was likely within a year;
**the answer, on 2026-09-10, was to carry the field regardless** — v1's schema has a nullable
`locationId` it does not yet use (§11). Cheap now, expensive later, and the cheapness would have
expired at Phase 0.

---

*Three dimensions had never been audited: §3's ten design rules against the specifications that
must honour them, §4's vocabulary contract against the screens and reports, and §18's hardware
against the flows. Doing so in 3.22 found four defects — two of them endpoints I had written
myself, using `DELETE` in a document whose fourth rule is that nothing is deleted. The most
useful was not an inconsistency at all: §18 opens the cash drawer through the printer's kick-out
port, so the reprint offered after a paper jam would have opened it for anyone, and §16.3's
re-authentication would have been a control enforced in software and bypassed in hardware.*

### Later / conditional
Batch & expiry · serial numbers · barcode-scale integration · supplier price lists ·
multi-currency · customer-facing display.

### Non-goals (v1)
The **permanent** non-goals are stated once, in §1 ("What Simon is not"): accounting system,
CRM, e-commerce, multi-store chain. In addition, v1 does not do: cloud sync or multi-store
consolidation · payroll · full double-entry general ledger · manufacturing or
bill-of-materials.

---

### Functional requirement index

Every v1 requirement, with where it is specified and which acceptance criterion (§27) proves
it. The table exists so that *"is this built?"* and *"is this tested?"* each have exactly one
answer, and so a requirement cannot quietly lose its acceptance criterion during a revision.

| id | Requirement | Specified | Verified |
|:--|:--|:--|:--|
| **FR-CAT-01** | A product carries many barcodes, one marked primary | §11 | — |
| **FR-CAT-02** | Stock, purchase and sale units with integer conversion factors | §10.3 | §27.3 |
| **FR-CAT-03** | Quick-add from an unknown barcode without leaving the sale | §6.1, §7.4 | §27.13 |
| **FR-CAT-04** | CSV/Excel import: idempotent, per-row errors, never partially applied | §7.3, §19.1 | §27.5 |
| **FR-CAT-05** | Opening debts imported with their original dates | §7.3, §19.1 | §27.5 |
| **FR-CAT-06** | Products are deactivated, never deleted | §6.12, §10.7 | — |
| **FR-CAT-07** | `decimalPlaces` and `stockUom` immutable once movements exist | §6.12, §11 | §27.21 |
| **FR-CAT-08** | Search tolerates Latin-typed Armenian | §20.3 | — |
| **FR-CAT-09** | A unit's conversion factor is immutable once the product has movements; receipts snapshot the unit and factor they used | §11, §6.12 | §27.31 |
| **FR-SELL-01** | Scan → line in < 200 ms; a rescan increments the existing line | §6.1, §21 | §27.1 |
| **FR-SELL-02** | Four first-class input paths: HID, camera, quick tiles, search | §6.1 | §27.1 |
| **FR-SELL-03** | Quick tiles auto-populated from sales velocity | §6.1 | — |
| **FR-SELL-04** | Quantity keypad honours the product's `decimalPlaces` | §6.1, §10.2 | — |
| **FR-SELL-05** | Held sales survive an app restart and are resumable from any till, moving to the shift that completes them | §12.1, §11 `Sale.shiftId` | §27.23 |
| **FR-SELL-06** | Split tender across cash, card and debt in any combination | §6.2, §11 | §27.2 |
| **FR-SELL-07** | Change computed and shown as the largest figure on screen | §6.2 | §27.1 |
| **FR-SELL-08** | Discounts capped by role; admin PIN plus a reason above the cap | §12.1, §16.3 | §27.16 |
| **FR-SELL-09** | Tax extracted from the price or added to it, per the price basis — which is snapshotted onto the sale | §10.8, §11 `Sale.priceBasis` | §27.18 |
| **FR-SELL-10** | Cash rounding appears as its own visible line | §10.1 | — |
| **FR-SELL-11** | A sale commits in one transaction; printing happens after commit | §12.1, §13.1 | §27.2 |
| **FR-SELL-12** | Returns start from the original sale; blind returns are admin-only | §6.5, §12.4 | §27.6 |
| **FR-SELL-13** | Partial return, restock or write-off, cost reversed at the original average | §12.4 | §27.6 |
| **FR-SELL-15** | A refund is split across the tenders the sale was paid with, pro-rata | §12.4, §11 `SaleReturnTender` | §27.26 |
| **FR-SELL-16** | A returned line refunds its share of any sale-level discount, never the gross | §12.4, §10.1 | §27.27 |
| **FR-SELL-14** | Receipt numbers assigned on the device, prefixed per till, gap-tolerant by design | §12.1, §11 `Device` | — |
| **FR-DEBT-01** | Debt sale shows balance, age of the oldest charge, and limit before confirming | §6.3 | §27.12 |
| **FR-DEBT-02** | Credit limit warns and allows admin override with a reason | §12.2 | §27.12 |
| **FR-DEBT-03** | Repayment allocated oldest-first, overridable, partial supported | §10.6, §12.3 | §27.5 |
| **FR-DEBT-04** | Overpayment becomes a credit adjustment, never a negative charge | §10.6 | — |
| **FR-DEBT-05** | Aging runs from the charge date; buckets 0–30/31–60/61–90/90+ | §10.6, §20.2 | §27.5 |
| **FR-DEBT-06** | A worker creates a customer mid-sale; limits stay admin-only | §6.13 | §27.12 |
| **FR-DEBT-07** | Duplicate customers are merged, never deleted or re-keyed by hand | §6.13 | §27.20 |
| **FR-DEBT-08** | Allocation is a derived projection over stored intent, so concurrent offline repayments reconcile without breaking a charge's balance | §10.6, §11 `AllocationOverride` | §27.32 |
| **FR-BUY-01** | Receiving without a prior order is the primary path | §6.7, §13.2 | §27.3 |
| **FR-BUY-02** | Landed cost apportioned by value before the average moves | §10.5, §13.2 | §27.3 |
| **FR-BUY-03** | Moving weighted average: rounded once, guarded at zero or negative stock | §10.5 | §27.4 |
| **FR-BUY-04** | Unit cost snapshotted onto every sale line | §10.5, §11 | §27.4 |
| **FR-BUY-05** | Supplier payables with allocation, mirroring customer debt | §6.14, §11 | — |
| **FR-BUY-06** | Purchase returns reverse stock at the receipt's landed cost and credit the invoice only, and never leave an average outside the range of costs actually paid | §13.7 | §27.22 |
| **FR-BUY-07** | Unknown cost is null, not zero: the first receipt seeds the average, and no margin is reported for a line whose cost was unknown | §10.5, §20.2 | §27.29 |
| **FR-BUY-08** | A corrected cost restates reported margin through a linked document, leaving every sale line untouched | §10.5, §11 `CostCorrection` | §27.33 |
| **FR-STK-01** | Append-only movement ledger; `stockQty` is a rebuildable cache | §10.4 | §27.3 |
| **FR-STK-02** | Negative stock allowed with a flag; strict mode is a setting | §6.11, §13.6 | — |
| **FR-STK-03** | Write-offs carry explicit reason codes | §13.5 | — |
| **FR-STK-04** | Ledger-vs-cache drift is surfaced, never silently corrected | §10.4, §19.5 | — |
| **FR-STK-05** | One needs-attention list carries every flag: negative stock, sync conflicts, cache drift | §11 `ReviewFlag`, §13.6, §14.6, §19.5 | — |
| **FR-STK-06** | Replaying the ledger in `seq` order reproduces both `stockQty` and `avgCostMdram`, and a late-arriving sale does not register as drift | §10.4, §11 `StockMovement` | §27.30 |
| **FR-SHF-01** | Open on a counted float; close with a denomination counter | §6.6 | §27.7 |
| **FR-SHF-02** | Expected-cash formula; variance always recorded, note prompted | §12.5 | §27.7 |
| **FR-SHF-04** | A cash refund reduces expected cash by exactly what left the drawer | §12.4, §12.5, §11 `CashMovement` | §27.25 |
| **FR-SHF-05** | A sale belongs to a drawer and to a period; one arriving after its shift closed posts, reports on the right day, and is stated on the Z-report without rewriting a printed variance | §11 `Sale`, `ShiftLateArrival`, §12.5 | §27.24 |
| **FR-SHF-03** | X-report mid-shift, Z-report at close | §6.6, §12.5 | §27.7 |
| **FR-SYN-01** | Catalogue cached in IndexedDB; a basket is buildable offline | §14.4 | §27.8 |
| **FR-SYN-02** | One outbox carries parked and completed sales, draining FIFO and serially so neither overtakes the other; the UI never awaits the network | §14.4, §15.3 | §27.8 |
| **FR-SYN-03** | Client-generated id **plus the target status** is the idempotency key: a replay returns `200`, a new legal transition is honoured, an illegal one is `422` | §14.3, §15.3, §11 | §27.8 |
| **FR-SYN-04** | Offline debt sales bounded by the offline cap and flagged on sync | §6.11, §14.5 | — |
| **FR-SYN-05** | Conflicts are accepted and flagged, never discarded | §14.6 | §27.8 |
| **FR-SYN-06** | The queue distinguishes transient 4xx from permanent: an expired session and a not-yet-drained dependency are retried, never parked, and a parked item never blocks the queue behind it | §14.4 | §27.34 |
| **FR-SEC-01** | PIN verified server-side, rate limited, lockout with a way out | §16.2 | — |
| **FR-SEC-02** | Sessions per-device, ending at shift close, with stated idle timeouts | §16.3 | — |
| **FR-SEC-03** | Three roles; role determines what exists, not what is enabled | §5.1, §16.4 | — |
| **FR-SEC-04** | Cost, margin and supplier terms stripped server-side for non-admins | §16.5 | §27.9 |
| **FR-SEC-05** | Audit log for catalogue price change, **line price override**, stock adjustment, discount above cap, **credit-limit override**, basket void, sale return, permissions — with the reason the person typed | §10.7 | — |
| **FR-SEC-06** | An admin revokes another device's session in one action; deactivating a device revokes its sessions with it | §16.3, §15.4, §11 `Device` | — |
| **FR-SEC-07** | The server owns sale arithmetic and enforces the discount cap; a client cannot set a line total, and a price override is capped as the discount it is | §15.3, §12.1, §16.5 | §27.28 |
| **FR-DAT-01** | Consistent snapshots hourly and at close; local plus USB; encrypted | §19.2 | §27.10 |
| **FR-DAT-02** | One-click restore, with a documented and rehearsed drill | §19.2 | §27.10 |
| **FR-DAT-03** | Every report exports to CSV/Excel in one tap | §6.10, §20.2 | — |
| **FR-DAT-04** | Health endpoint and an owner-readable diagnostics screen | §19.5 | — |
| **FR-DAT-05** | Erasure anonymises a customer — name and phone cleared, ledger amounts and dates kept | §19.6, §6.13 | — |
| **FR-LRN-01** | Setup wizard: five questions, skippable, resumable | §7.1 | §27.11 |
| **FR-LRN-02** | Practice mode isolated in a separate database, audited on entry and exit | §7.2, §19.4 | §27.19 |
| **FR-LRN-03** | Contextual help, first-run coach marks, teaching empty states | §7.5, §8.4 | §27.14 |
| **FR-LRN-04** | Undo for routine actions; hard confirm only for the irreversible | §8.1 | §27.16 |

**Adding a feature means adding a row here** — and a row here is one of five places every change
has to land.

### Keeping this document true when it changes

A change never lands in one place. It fans out in five directions, and the last one is what gets
missed: those sections do not *describe* a feature, they *watch* it, so nothing in the writing of
a rule reminds you they exist.

| | Where a change lands | The question |
|:--|:--|:--|
| **1. The model** | §11 — fields, enums, lifecycles, validation | Can the schema represent it? |
| **2. The rules** | §10, §12–§14, §16, §19 — whichever section specifies it | Is the behaviour written once, where it will be read? |
| **3. The interfaces** | §15 the endpoint · §16.5 what it strips | Can a client reach it, and does it leak cost? |
| **4. The surfaces** | §6 the screen and the journey · §8.5 the error type | Can a person do it, and see it fail? |
| **5. The observers** | §10.7 audit · §20.2 report · §9 this index · §27 acceptance · §23.1 layer · §24.2 assumption · §21 budget | **Who watches it, and will the trail explain itself in six months?** |

**Category 5 is where this document has repeatedly gone wrong.** Letting a held basket move
between tills (3.31) needed edits in eleven places, and the last four found were all observers —
the audit trail, the Z-report, the requirement row and the acceptance criterion. Each surfaced in
a separate review, one per pass, because a rule tells you what it does and never tells you who is
watching it.

**Walk all five when you change something.** It is faster than four reviews, and it is the only
part of this process that does not depend on someone remembering.

**Then one more question, which the five do not ask.** Re-read every rule that *mentions* the
thing you changed — not to check its references resolve, but to check it still names the thing
correctly. Widening the outbox to carry two kinds left three rules describing one kind; splitting
its counter left the heartbeat reporting one of two. Both were true before the change and false
after it, and neither is a broken reference, so nothing automatic catches them.
**Ask: does every rule that mentions this still name it right?**

**And ask it mechanically, not by memory: grep the words the old rule used**, across the whole
file, not the sections you expect to be affected. Changing tax from one basis to two left the
phrase "never added" in a requirement, "extracted, not added" in a section heading, and "no safe
middle" in §26 — four rings out from the edit, found in one command and not in three reviews.

**A requirement without an acceptance criterion is a deliberate choice, not an oversight.**
Those rows are covered either by the domain unit and property tests (§21, *Correctness*) or are
too small to justify a trip to the shop. Gaining an acceptance criterion is cheap; losing one
without noticing is not, which is why this column exists at all.

**Two acceptance criteria have no requirement, also deliberately.** §27.15 (no internal term
reaches a worker's screen) is enforced by §4.1's vocabulary rule rather than by any one feature,
and §27.17 (one-handed, ≥ 48 px) is a non-functional requirement (§21) that every screen inherits.
Both are cross-cutting, and pinning either to a single FR would make it look optional everywhere
else.

<!-- prd-check: criteria-without-requirement = 27.15, 27.17 -->

That exemption is machine-readable, in the comment directly above, because `npm run check:prd`
enforces the rest of this column and an exception a tool cannot see is an exception somebody
deletes. Adding a criterion here is a deliberate act; the comment is where it is declared.

---

# Part B — The rules

Everything in Part A rests on this. These are correctness requirements: each is expensive or
impossible to retrofit once real money is in the database, and none of them is a preference.

## 10. Foundational data decisions

### 10.1 Money is integers

**Binary floats cannot represent decimal money exactly.** The error is invisible per
operation and compounds across totals, tax, and debt until the books stop reconciling —
which is precisely the failure Արամ will never forgive (§2.3).

| Concept | Unit | Type | Example |
|:--|:--|:--|:--|
| Line total, sale total, payment, debt | whole dram | `Int` | `12500` = 12,500 ֏ |
| Unit price, unit cost, average cost | **milli-dram** (×1000) | `Int` | `12500000` |
| Quantity | **milli-unit** (×1000) | `Int` | `2500` = 2.5 kg |
| Percentage (discount, VAT) | basis points (×10000) | `Int` | `2000` = 20% |

**Why two scales for money.** Transaction amounts are whole drams because that is what
changes hands. Unit costs need finer resolution: the weighted average of a screw bought at
12 ֏ and 13 ֏ is 12.4 ֏, and rounding that to a whole dram on every delivery makes the error
compound into visible cost drift. Three extra decimal places absorbs it.

**Rounding.** Half-up, applied to the absolute value, **exactly once, at the line total**.
Never round a unit price, a factor, or an intermediate product. Exactly two values round in
their own right rather than as intermediates: the stored weighted average cost (§10.5) and the
per-line extracted tax (§10.8). Both land in `Int` columns, and neither is ever re-rounded
downstream. Sum already-rounded line totals to get the **subtotal** — the sale total is that,
less any sale-level discount, plus any cash rounding (§10.8).

Half-up on the absolute value (rather than banker's rounding)
means a return of 12.5 rounds to the same magnitude as the sale of 12.5 — otherwise a
partial return leaves a one-dram ghost balance that nobody can explain.

**Cash rounding is a separate, visible line.** Whether or not the shop rounds, one identity
must hold on every sale, because it is what makes a receipt checkable by the person holding it:

```
subtotal = Σ lineTotal                          already-rounded line totals

tax-inclusive   total = subtotal − discountTotal + roundingAdjustment
tax-exclusive   total = subtotal − discountTotal + taxTotal + roundingAdjustment
```

**Which line applies is the price basis (§6.11, §10.8), and it changes what `taxTotal` is.**
Inclusive, it is a memo of tax already inside `total` and never a term. Exclusive, it *is* a
term, and a receipt that omits it does not add up. One module owns both forms (§10.1) and the
receipt prints whichever identity is in force — this is the one place where the two modes are
visibly different, and pretending otherwise would put a wrong sum in a customer's hand.

An earlier form of this rule read `sum(lines) + roundingAdjustment == total`, which is only true
when no sale-level discount was given — and §12.1 offers them. Every term above is printed,
because a receipt whose arithmetic is invisible is a receipt the customer cannot check, and an
unexplainable total is the failure §2.3 says ends the relationship.

One module owns every conversion, rounding, and formatting operation. No arithmetic on money
anywhere else.

### 10.2 Quantity is integers

`Int` scaled ×1000. Each product declares `decimalPlaces` (0 for pieces, 2–3 for kg/m),
which drives both input validation and display — and is why the till keypad refuses `2.5`
pieces (§6.1).

### 10.3 Units of measure

Three roles, related by integer conversion factors on the product:

- **Stock UoM** — the canonical unit inventory is held in (metre).
- **Purchase UoM** — how the supplier sells it (a 50 m spool): its own `ProductUnit` row with
  `role = PURCHASE` and `factorToStockUom = 50` (§11).
- **Sale UoM(s)** — how customers buy it (metre, or a pre-cut 5 m length).

Receiving 3 spools posts +150 metres. A single flat unit string cannot express this and
breaks on day one in a hardware store.

### 10.4 Stock is a ledger, not a number

`StockMovement` is **append-only**. Every quantity change is a row with a type, a signed
quantity, a unit cost, a reason, an actor, and a link to its source document.

```
SALE · SALE_RETURN · PURCHASE_RECEIPT · PURCHASE_RETURN
ADJUSTMENT · WRITE_OFF · STOCKTAKE · TRANSFER · OPENING_BALANCE

`TRANSFER` is reserved for multi-location (v2, §9) and nothing in v1 emits it — it is in the
enum from the start so that adding a second shop does not migrate a live ledger.
```

**`Product.stockQty` and `Product.avgCostMdram` are both cached projections**, recomputed
inside the same transaction that writes the movement, and rebuildable from scratch by replaying
the ledger. Every movement carries `qtyDelta` *and* `unitCostMdram`, so the quantity and the
average are equally replayable — and both are therefore equally checkable.

An earlier form of this section named only `stockQty`. That was not a scoping decision, it was
an omission: it left the one number the owner's entire profit figure rests on as the only
derived value in the system that nothing verified. §13.7's reversal can drive an average below
any price the shop has ever paid (§26 Q17), and under the old wording nothing would ever have
noticed.

A mutable counter cannot answer *"why does it say 14 when the shelf has 11?"* — which is
rule 3 applied to inventory. It also silently loses concurrent writes. A scheduled job
asserts cache == replay for **both columns** and **surfaces drift rather than silently
correcting it**, because a mismatch means a bug worth finding.

**The replay is ordered by `(productId, seq)`, never by `createdAt`.** `seq` is the server's
monotonic insertion order (§11), and it is the order in which `balanceAfter` was computed — so a
replay reproduces the arithmetic that actually happened. Ordering by `createdAt` would reorder
every sale that arrived late from an offline till, and the drift job would then report drift on
ordinary Wi-Fi drops rather than on bugs. An alert that fires on a normal Tuesday is an alert the
owner mutes by week two (§19.5), and the real drift arrives silently behind it.

### 10.5 Costing — moving weighted average

Chosen over FIFO: materially simpler, adequate at this scale, and it needs no lot tracking.

```
newAvgCost = (stockQty × currentAvgCost + receivedQty × receiptUnitCost)
             ÷ (stockQty + receivedQty)
```

- **Rounded once, on store.** `newAvgCost` is rounded **half-up to a whole milli-dram** as it
  is written. This is one of §10.1's two named carve-outs from "never round an intermediate":
  the average is not an intermediate, it is a stored `Int`, and the division almost never lands
  on one.
- **Cost may be unknown, and unknown is not zero.** `avgCostMdram` is **nullable**, and null
  means *no cost basis has ever been established for this product* — a quick-added product
  (§7.4) sold before it was ever received. Null is not a number and never participates in
  arithmetic: the first receipt **seeds** the average (`avgCostMdram = receiptUnitCost`) rather
  than averaging against a fictional zero, and a sale line whose cost was unknown snapshots
  null, prints no margin, and is excluded from every margin figure rather than reported as 100%.
  §6.12's needs-detail list — «ինքնարժեքը լրացված չէ» — is exactly this state, and before this
  rule the schema could not represent the thing the PRD's own default screen displayed.
  **Zero is a legal cost and means free**, exactly as `sellPriceMdram = 0` means free; the two
  fields now agree about what zero is.
- **The denominator can be zero or negative.** §13.6 permits negative stock, so
  `stockQty + receivedQty ≤ 0` is reachable and the formula is then undefined — do not
  evaluate it. Set `avgCostMdram = receiptUnitCost`, post the receipt, and flag the movement.
  A prior average that describes goods the system does not believe it holds is not evidence
  about anything.
- **Landed cost first.** Delivery, duty, and other receipt-level charges are apportioned
  across lines **by value** before the average moves. Ignoring this systematically overstates
  margin — the most common costing error in small-retail systems, and the reason §6.7 has a
  delivery-charge field.
- **Snapshot on sale.** The current average is written onto the sale line as `unitCost`.
  Historical profit then becomes immutable: restocking at a new price never rewrites last
  month's numbers. Without this, every margin report silently changes under the owner and
  rule 3 is violated.
- **Immutability requires a restatement mechanism, and does not replace one.** A cost typed
  wrongly on a receipt is snapshotted onto every sale line that follows it, permanently, by the
  rule immediately above. Reversing and re-entering the receipt (§10.7) corrects the average
  *going forward* and cannot touch what was already booked. The correction is therefore a
  **`CostCorrection` document** (§11) that records the wrong figure, the right one, and the
  period affected; §20.2's margin report then shows *as booked* and *restated* side by side and
  can say why they differ. Sale lines are still never edited. Treating immutability as
  sufficient on its own is how a two-week margin error becomes permanent and unexplainable —
  and §8.2's recovery table had a row for a wrong *price* and none for a wrong *cost*.
- Negative stock uses the last known average and flags the movement.

### 10.6 Debt is a ledger with allocation

`DebtEntry` is append-only: `CHARGE`, `PAYMENT`, or `ADJUSTMENT`. **Amounts are always
positive; the type carries direction** — mixed signs make every aggregate a source of bugs.

Payments are **allocated to specific charges**, oldest first by default, manually
overridable. Allocations for one payment must sum exactly to the payment **less any excess**:
where a payment exceeds the outstanding balance the remainder is posted as a credit
`ADJUSTMENT`, so the invariant is `sum(allocations) + credit == payment`.

**`DebtAllocation` is a derived projection, not a ledger row** — the same standing as
`Product.stockQty` (§10.4), and the only member of the debt model that is not append-only. What
is *stored* is the intent: the charges, the payments, and any `AllocationOverride` (§11) a person
entered by hand. What is *derived* is the allocation set:

```
allocations = allocate(charges, payments, overrides)      a pure function
```

Three things follow, and each fixes a defect the previous wording carried.

**§14.5's "allocation recomputed on sync" becomes legal.** Under an append-only reading it
contradicted §10.7 and `CLAUDE.md` outright; under this one, recomputation is what a projection
*is*, and nothing is rewritten that was ever authoritative.

**Two offline tills can no longer produce rows that break their own constraint.** Till A takes
20 000 ֏ and till B takes 30 000 ֏ against the same 25 000 ֏ charge, both allocating oldest-first
while unable to see each other. Posting both as facts would sum to 45 000 against a 25 000 charge
— a row violating its own `CHECK`, with no warning type able to carry the outcome. As inputs to a
projection they simply both arrive, the function allocates 25 000 and posts the remaining 25 000
as a credit `ADJUSTMENT` per the overpayment rule above, and §14.6's *accept and flag, never
reject* holds without a special case.

**Aging stays reproducible**, which §10.6 requires: the same stored inputs always produce the
same allocation set, so a report run twice gives the same answer. Re-deriving is not a
correction and writes no audit row; a person changing their mind writes a new
`AllocationOverride`, which is stored, append-only, and audited like any other decision.

The projection is drift-checked on the same schedule as §10.4's, for the same reason.

Without allocation there is no aging, and without aging "owes 45,000" is not actionable
while "45,000, of which 30,000 is over 90 days" is. Aging is measured from the **charge**
date, not the last payment. Overpayment becomes a credit `ADJUSTMENT`, never a negative
charge.

`DebtEntry.dueDate` is optional and **never affects aging**. When set it drives only the
*overdue* marker in §6.3 and §6.9. Letting a due date move a charge between aging buckets
would make the buckets unstable and the report unreproducible.

### 10.7 Correction, never deletion

Finalised sales, receipts, and payments are never updated or deleted. Corrections create a
linked reversing document (`reversesId`). A `DRAFT` or `HELD` sale that never completed is
marked `VOIDED` rather than deleted — nothing was posted, so there is nothing to reverse, but
an abandoned basket is worth being able to see. `VOIDED` is **unreachable from `COMPLETED`**:
once money has changed hands the only correction is a return (§6.5).

**Every reversing document carries the same five things.** A reversal is not a lesser document
than the thing it reverses — it moves the same money through the same contexts, and it must be
able to answer the same questions years later. Whatever the direction, a document that reverses
another records:

| | Requirement | Because |
|:--|:--|:--|
| 1 | **the period *and* the drawer** — `businessDate` and `shiftId` (§11) | a refund takes cash out of a specific till on a specific day, and §12.5 cannot reconcile a drawer against money it cannot see leave |
| 2 | **the price basis in force** — `priceBasis` | §10.8's two identities differ, and a reversal computed under the wrong one does not add up |
| 3 | **the snapshotted tax rate** — `taxRateBp` and `lineTax` per line | §10.8 requires returns to extract at the *original* rate; a document that reverses tax and does not record the tax it reversed cannot be audited without joining back into a sale that may be years old |
| 4 | **the tender it reverses**, per method | `Payment` is many-per-sale (§6.2) and a single `refundMethod` on a header cannot express a part-cash, part-nisya sale coming partly back |
| 5 | **a link to what it reverses** — `reversesId` | §10.7's whole discipline, applied to reversals themselves: a return keyed against the wrong line must be correctable, and without this the per-line quantity check blocks the *correct* return afterwards |

This is stated once, here, because `SaleReturn` was originally modelled as an appendix to `Sale`
and inherited none of them — five separate defects with one cause. `PurchaseReturn` and every
future reversing document satisfy the same checklist, which is also what §6.14's promise that
both directions share screen grammar rests on.

`AuditLog` records every catalogue price change, **line price override** (§6.1), stock
adjustment, discount above threshold, **credit-limit override** (§6.3), basket void, sale
return, **held-basket transfer between shifts** (§12.1 — it moves takings from one drawer to
another, and §16.1's second threat is a worker muddying exactly that), and permission change: actor, timestamp, before/after — and, for anything a person had
to justify, the `reason` they typed. This is what makes rule 4 real, and it
protects the honest worker as much as it catches the dishonest one.

---

### 10.8 Tax and the price basis

Armenian shelf prices are quoted the way the customer pays them. Simon therefore treats
`sellPriceMdram` as **tax-inclusive by default** and *extracts* tax rather than adding it — the
shape of consumer retail almost everywhere. Under a tax-exclusive basis it adds instead; the
basis is a setting (§6.11) and the sale records which one it used (§11 `Sale.priceBasis`).

```
lineTax  = round_half_up(lineTotal × rateBp ÷ (10000 + rateBp))
taxTotal = Σ lineTax        — summed from already-rounded line values, per §10.1
```

- **Whether `taxTotal` is a memo or an addend is the price basis** (§6.11). Inclusive, it is a
  memo — `total = subtotal − discountTotal + roundingAdjustment`, tax already inside. Exclusive,
  it is a term and the total is that plus `taxTotal` (§10.1). **Reading §11's `Sale` field list
  without checking the basis is the most likely way to build this wrong** — the same field is a
  memo in one mode and an addend in the other, and nothing in the field name says which.
- **The rate is snapshotted onto the line** as `taxRateBp`, exactly as `unitCostMdram` is
  (§10.5). A rate change in March must not rewrite February's receipts.
- **Round once per line, then sum.** Extracting from the sale total instead yields a figure
  that does not equal the sum of its lines, and rule 3 breaks at the first drill-down.
- **Non-VAT regimes are rate zero, not a second code path.** Turnover and micro-business shops
  get `rateBp = 0`, `taxTotal = 0`, and no tax line on the receipt (§17). `taxCategory` is
  still recorded on every product and line, so changing regime is a settings change and a
  reprojection — never a migration.
- **Returns extract at the original rate**, from the original line, for the same reason cost is
  reversed at the original average (§12.4).

**A setting that changes arithmetic is snapshotted onto the document it changed.** `Sale.priceBasis`
records which of §10.1's two identities was in force, exactly as `unitCostMdram` and `taxRateBp`
record the cost and the rate (§10.5). Without it, switching the setting silently rewrites every
past receipt — the failure §10.5 exists to prevent, arriving through a different door.

*Swept against §6.11 (2026-09-10): the price basis is the only setting with this property.* Cash
rounding also changes a total, but `Sale.roundingAdjustment` already stores the outcome rather
than the rule, so a reprint reproduces it. Every other setting governs what is *allowed* — limits,
caps, thresholds — and changing one cannot alter a sale already made.

**Both bases are supported, and which one applies is a setting** (§6.11). Tax-inclusive
extraction is the default and the arithmetic above; tax-exclusive addition is the same formula
run the other way — `lineTax = round_half_up(lineTotal × rateBp ÷ 10000)`, added to reach the
total rather than found inside it. One module owns both (§10.1), one setting picks between them,
and **no screen or report changes shape**. The **receipt does**: inclusive prints a total with
tax noted beneath it, exclusive prints subtotal, tax and then total, because those are different
sums and §10.1's identity differs with them. That is the one visible difference, and it is a
layout the receipt template already has to hold either way.

That is deliberate: it turns §26 Q2 from a decision that blocks layer 2 into a switch thrown at
setup, at the cost of one receipt layout that has to exist in two forms. The accountant's answer still matters, and getting it wrong still misprices everything —
but being wrong is now a settings correction rather than a rewrite.

Which regime the shop is in, and whether the tax-inclusive default (A3) holds, is §26 Q2
and should be settled before the pilot. The arithmetic above does not change with the
answer — only the rate, and whether the receipt shows a tax line.

---

## 11. Domain model

All ids are UUIDv7 — time-sortable, so they cluster in index order, and client-generatable
(§14.3). Money and quantity per §10.1–10.2.

### Catalogue
| Model | Key fields | Notes |
|:--|:--|:--|
| **Product** | `id`, `sku`, `name`, `nameSearch`, `categoryId`, `stockUom`, `stockQty`, `decimalPlaces`, `avgCostMdram?`, `sellPriceMdram`, `taxCategory`, `defaultSupplierId?`, `reorderPoint`, `reorderQty`, `tilePinnedAt?`, `trackStock`, `isActive` | `defaultSupplierId` feeds §13.3's lead time and is nullable — quick-add (§7.4) does not set it. `stockQty` is the cached projection §10.4 governs — recomputed inside the transaction that writes each movement, rebuildable by replaying the ledger, and never the source of truth. `tilePinnedAt` non-null means the owner pinned this to the quick grid (§6.1); pinned tiles sort first by pin time and sales velocity fills the rest, so a pin is a stored decision rather than a guess the algorithm might overturn. Never deleted — deactivated; sale lines reference it. `nameSearch` holds the normalised/transliterated form (§20.3) |
| **ProductBarcode** | `id`, `productId`, `barcode` (unique), `isPrimary`, `retiredAt?` | **One-to-many.** A retired code **still resolves** — an old sticker on a shelf has to scan to the right product years later, which is §18's reason for saying retired codes are never reused. What retirement prevents is *reassignment*: the code can never point at a different product, and rule 4's "nothing is deleted" applies to the catalogue as much as to the ledger. A product legitimately has a manufacturer EAN, an internal code, and a second supplier's code |
| **ProductUnit** | `id`, `productId`, `uom`, `factorToStockUom`, `role` (STOCK/PURCHASE/SALE), `barcode?` | Drives §10.3 |
| **Category** | `id`, `name`, `parentId` | Shallow tree |
| **PriceHistory** | `id`, `productId`, `sellPriceMdram`, `effectiveFrom`, `changedBy` | "When did this get more expensive, and who did it?" |

### Selling
| Model | Key fields | Notes |
|:--|:--|:--|
| **Sale** | `id` (client-generated), `number`, `shiftId`, `userId`, `customerId?`, `status` (DRAFT/HELD/COMPLETED/VOIDED), `subtotal`, `discountTotal`, `discountReason?`, `taxTotal`, `priceBasis` (INCLUSIVE/EXCLUSIVE), `roundingAdjustment`, `total`, `businessDate`, `createdAt`, `completedAt`, `reversesId?`, `fiscalReceiptId?` | `id` is the idempotency key. `number` is the human-readable reference, device-prefixed and assigned on completion (§12.1) — not a fiscal receipt number, which is `fiscalReceiptId` (§17). `createdAt` is what §6.1 lists held baskets by — derivable from a UUIDv7, but a displayed timestamp should not depend on decoding a primary key. **`shiftId` is set when the basket is created, rewritten to the completing shift if the sale is resumed on another till (§12.1), and frozen at `COMPLETED`** — the rewrite happens only while the sale is still `DRAFT`/`HELD`, so §10.7's rule that a finalised document is never updated holds, and §12.5 reconciles the drawer that took the money rather than the one that started the basket. **`businessDate` is the accounting period; `shiftId` is the drawer — and offline guarantees
they diverge.** `shiftId` answers *which till took this money*; `businessDate` answers *which
trading day this belongs to*. They were one field, and the design collided with itself: §6.6
plans for a shift closing with sales still queued, §11 counts them in `unsyncedAtClose`, §14.2
promises a completed sale is never lost — and the frozen-`shiftId` rule made those sales
unpostable when they arrived. There was no exit: rejecting breaks §14.2, accepting rewrites a
printed Z-report, re-pointing puts yesterday's takings in today's drawer. Two fields, because
they were always two questions. `businessDate` is **server-stamped at commit in shop-local time**
(§20.3) and is what §20's daily reports group by, so a shift running past midnight no longer
makes the daily report and the Z-report disagree. A sale arriving after its shift closed posts
normally, keeps naming the closed shift, and writes a `ShiftLateArrival` (§11) — the Z-report
states it as a linked line rather than having its variance silently rewritten. `HELD` supports §6.1 parked sales. `VOIDED` is reachable **only from `DRAFT`/`HELD`** (§10.7) — a completed sale is reversed, never voided. `taxTotal` is tax **inside** `total` under a tax-inclusive basis and **added to it** under an exclusive one — §10.1 gives both identities, §6.11 holds the switch, and **`priceBasis` records which one this sale used**, because a reprint must reproduce the sale rather than recompute it (§10.8) |
| **SaleLine** | `id`, `saleId`, `productId`, `productName`, `qty`, `uom`, `factorToStockUom`, `unitPriceMdram`, `unitCostMdram`, `taxRateBp`, `lineTax`, `discountAmount`, `discountReason?`, `priceOverridden`, `lineTotal` | **Price, cost and tax rate all snapshotted** (§10.5, §10.8). Name denormalised for reprints. `discountReason` is customer-facing and prints on the receipt; `priceOverridden` only flags that §6.1's long-press was used, because the *justification* belongs in `AuditLog.reason` where every other override's does |
| **Payment** | `id`, `saleId`, `method` (CASH/CARD/DEBT/TRANSFER), `amount`, `tenderedAmount?`, `changeGiven?` | **Multiple per sale** — split tender (§6.2). `TRANSFER` is reserved for bank settlement of a B2B sale (§17, item 3) and is **not offered on §6.2's payment screen in v1** — it is in the enum from the start so that invoicing a contractor later does not migrate paid sales |
| **SaleReturn** | `id`, `originalSaleId`, `shiftId`, `businessDate`, `userId`, `reason`, `priceBasis`, `total`, `reversesId?`, `createdAt` | Header only; partial returns live in the lines. Carries §10.7's full reversing-document checklist. **`shiftId` and `businessDate`** because a cash refund leaves a specific drawer on a specific day and §12.5 cannot reconcile money it cannot see leave — the original model had neither, so a refund was not attributable to a drawer at all. **`priceBasis`** for the same reason `Sale` carries it (§10.8). **`reversesId`** because a return keyed against the wrong line has to be correctable, and without it the per-line check in §12.4 would block the correct return afterwards. **`refundMethod` has moved to the lines** — see `SaleReturnTender` |
| **SaleReturnTender** | `id`, `returnId`, `method` (CASH/CARD/DEBT_REDUCTION), `amount` | **Multiple per return**, mirroring `Payment` (§6.2). A sale paid 30 000 cash and 20 000 on nisya, partly returned, has to say how much comes out of the drawer and how much comes off the debt; a single `refundMethod` on the header could not express it and silently foreclosed the pro-rata answer. §27.2 makes split tender a v1 criterion and §27.6 makes partial return one — this is where those two meet. Σ `amount` = `SaleReturn.total` |
| **SaleReturnLine** | `id`, `returnId`, `saleLineId`, `productId`, `qty`, `unitCostMdram`, `taxRateBp`, `lineTax`, `discountShare`, `refundAmount`, `restock` | **The original `SaleLine.unitCostMdram`, copied**, so COGS reverses at the cost that was booked (§12.4). `restock` is per line: one item comes back to the shelf, another is damaged, and §6.5 asks the question once with a per-line override. **`taxRateBp` and `lineTax` are copied from the original line too** — §10.8 requires a return to extract at the original rate, and the document that reverses tax must record the tax it reversed rather than making every period VAT figure join back into a sale that may be years old. **`discountShare` is this line's apportioned share of the sale-level discount** (§10.1), without which a 10%-discounted basket refunds gross on a partial return — a slow, deniable, per-transaction leak: buy discounted, return the expensive line |

### Buying
| Model | Key fields | Notes |
|:--|:--|:--|
| **Supplier** | `id`, `name`, `taxId`, `phone`, `paymentTerms`, `leadTimeDays`, `isActive` | `leadTimeDays` feeds reorder maths |
| **PurchaseOrder** | `id`, `number`, `supplierId`, `status` (DRAFT/OPEN/PARTIAL/RECEIVED/CANCELLED), `expectedAt`, `total` | Optional — most deliveries arrive unordered. **The PO flow is v2 (§9);** the table exists in v1 so a receipt can gain a `poId` without a migration |
| **PurchaseOrderLine** | `id`, `poId`, `productId`, `qtyOrdered`, `qtyReceived`, `unitCostMdram` | Partial receipt is normal |
| **GoodsReceipt** | `id`, `number`, `supplierId`, `poId?`, `receivedAt`, `userId`, `supplierInvoiceNo`, `landedCostTotal`, `total`, `reversesId?` | Moves stock **and** updates the average. `reversesId` because §6.14 reverses a receipt booked against the wrong supplier rather than editing it, and §10.7 requires that reversal to be linked |
| **GoodsReceiptLine** | `id`, `receiptId`, `productId`, `qty`, `uom`, `factorToStockUom`, `invoiceUnitCostMdram`, `landedUnitCostMdram` | **`uom` and `factorToStockUom` are snapshotted, exactly as `SaleLine` snapshots them.** The selling side did this because someone thought about reprints; the buying side did not, and the asymmetry was the bug. After commit the receipt said `150` and could no longer say *3 spools* — while reconciling a delivery against the supplier's paper invoice is the actual daily job (§27.3), and it would have meant dividing by a factor stored on a row that can change. **The cost fields are renamed by role**: `unitCostMdram` meant the *invoice* cost here and the *landed* cost on `PurchaseReturnLine`, one name for invoice-only in one row and invoice-plus-freight in the next, in the same document family — and §13.7's entire costing rule turns on which one you grabbed |
| **CostCorrection** | `id`, `goodsReceiptLineId`, `wrongUnitCostMdram`, `correctUnitCostMdram`, `affectedFrom`, `affectedTo`, `reason`, `userId`, `createdAt` | **What §10.5's immutability rule implies and did not provide.** A cost typed as 14 000 ֏/m instead of 1 400 is snapshotted onto every sale line that follows it, permanently — reversing the receipt fixes the average going forward and can never touch what was booked. This document records the wrong figure, the right one and the window affected, so §20.2 can report *as booked* beside *restated* and say why they differ. **No sale line is edited**; the correction is a fact pointing at facts, like every other correction (§10.7). `affectedFrom`/`affectedTo` bound the restatement to the period between the bad receipt and its correction |
| **SupplierPayment** | `id`, `supplierId`, `amount`, `method`, `paidAt`, `userId` | Payables — the mirror of Nisya (§6.9) |
| **SupplierAllocation** | `id`, `supplierPaymentId`, `goodsReceiptId`, `amount` | Deliberately the same shape as `DebtAllocation`, because §6.14 promises the same screen grammar. An inline array would not have been |
| **PurchaseReturn** | `id`, `supplierId`, `receiptId?`, `reason`, `total`, `landedCostLost`, `userId`, `createdAt` | Header only; the lines are authoritative (§13.7). `landedCostLost` is the delivery charge apportioned to goods now going back — the supplier refunds the invoice, never the freight |
| **PurchaseReturnLine** | `id`, `returnId`, `receiptLineId`, `productId`, `qty`, `landedUnitCostMdram`, `creditAmount` | `landedUnitCostMdram` is the landed cost copied from the receipt line — the figure that moved the average when it arrived, and therefore the only one that can move it back (§13.7). `creditAmount` is the invoice cost alone, because that is what the supplier owes |

### Money, stock & people
| Model | Key fields | Notes |
|:--|:--|:--|
| **StockMovement** | `id`, `productId`, `seq`, `type`, `qtyDelta` (signed), `unitCostMdram`, `balanceAfter`, `sourceType`, `sourceId`, `userId`, `locationId?`, `reasonCode?` (DAMAGE/EXPIRY/THEFT/INTERNAL_USE/SAMPLE), `note`, `createdAt` | §10.4. **`seq` is the server's monotonic insertion order and the ledger's replay key** — `balanceAfter` was computed in that order, so only that order reproduces it. `createdAt` cannot serve: it comes from the device, and a sale that spent an hour in an outbox carries an earlier timestamp than rows already posted. Replaying by `createdAt` would reorder every late arrival and make §10.4's drift job report drift on ordinary Wi-Fi drops. **`locationId` is null throughout v1** and exists only so a second shop is a feature rather than a migration (§26 Q7, A12). Until v2 adds a `Location` model it is a **plain nullable column, not a foreign key** — §11's `ON DELETE RESTRICT` convention has nothing to point at yet, and writing the constraint early buys a failing migration and no safety; when it is used, `Product.stockQty` becomes a per-location projection rather than one number. Every movement names its source document — **with one deliberate exception**:
`ADJUSTMENT` and `WRITE_OFF` are their own source (`sourceType = 'StockMovement'`,
`sourceId = id`). A wrapper document holding nothing but the same product, quantity, note and
actor the movement already carries would be a value stored twice, and several items written off
together are simply several movements: §20.2 aggregates movements, not documents. A movement of
any **other** type with no source is a bug. `reasonCode` is required when `type = WRITE_OFF` and null otherwise — free text cannot be charted, and §20.2's "write-offs by reason" is the whole point of §13.5 |
| **ReviewFlag** | `id`, `type` (NEGATIVE_STOCK/CREDIT_LIMIT_ON_SYNC/PRODUCT_DEACTIVATED_ON_SYNC/LEDGER_CACHE_DRIFT/PRICE_CHANGED_ON_SYNC/DEVICE_CLOCK_SKEW/COST_VARIANCE), `sourceType`, `sourceId`, `productId?`, `customerId?`, `note`, `createdAt`, `resolvedAt?`, `resolvedBy?` | **The durable state behind every warning.** §15.2 requires a warning to be read back from what the transaction wrote rather than re-derived; this is that row. One model serves §13.6's recount list, §14.6's needs-attention list, §19.5's owner alerts and §8.5's warning types, whose names it mirrors. `LEDGER_CACHE_DRIFT` is what §10.4 means by "surfaces drift rather than silently correcting it" — a discovered mismatch has to land somewhere a person will see it, and it now covers `avgCostMdram` as well as `stockQty`. `PRICE_CHANGED_ON_SYNC` carries §15.3's price-drift outcome: an offline till quotes from a cache that may be days old, and the sale is accepted at the quoted price and flagged rather than refused after the goods have gone. `DEVICE_CLOCK_SKEW` is raised when a device's `createdAt` differs from the server's `receivedAt` beyond a threshold — unmodelled, skew corrupts aging buckets, shift attribution and daily reports at once, and does it silently. `COST_VARIANCE` fires when a receipt's unit cost is far from the last one for that product (§13.2): the `STOCK` role types the number that moves the owner's margin and is structurally unable to see the result, so the check has to live where the typing happens |
| **Customer** | `id`, `fullName`, `nameSearch`, `phone`, `discountBp`, `creditLimit`, `isBlocked`, `isActive`, `mergedIntoId?`, `anonymisedAt?`, `notes` | `nameSearch` is the same normalised/transliterated form `Product` carries (§20.3) — a worker types `Dav` to find `Դավիթ` on §6.3, which is the screen the product exists for, and Latin-typed search cannot be product-only. `anonymisedAt` marks an erasure (§19.6): name and phone go null and the ledger stays. Limit + block are the controls; nothing else stops unbounded debt. `isActive` because §6.13 does not offer deletion, and `mergedIntoId` because a merged record must leave a forwarding address — an old receipt naming the absorbed customer still has to resolve |
| **DebtEntry** | `id`, `customerId`, `type`, `amount`, `saleId?`, `dueDate?`, `reversesId?`, `createdAt`, `userId` | §10.6. `reversesId` because §8.2's fix for a debt sale on the wrong customer is an admin correction, and §10.7 requires a correction to be a **linked** reversing document rather than two rows that happen to cancel out |
| **DebtAllocation** | `id`, `creditEntryId`, `chargeEntryId`, `amount` | Enables aging. `creditEntryId` points at either a `PAYMENT` or a credit `ADJUSTMENT` — a refund onto a debt is the latter (§12.4), and naming the field after payments alone would have made that look irregular. **This is a derived projection, not a ledger row** (§10.6) — the same standing as `Product.stockQty`, and the only member of the debt model that is not append-only. It is recomputed from charges, payments and overrides, never hand-edited, and drift-checked like §10.4's caches. That is what makes §14.5's *"allocation recomputed on sync"* legal instead of a contradiction, and it is why two offline tills allocating against one charge can no longer produce a row that breaks its own `CHECK` |
| **AllocationOverride** | `id`, `creditEntryId`, `chargeEntryId`, `amount`, `userId`, `createdAt` | **The stored intent behind a hand-made allocation** — *"this one, not that one; that job isn't paid yet."* Append-only and audited, because it is a decision a person made; the `DebtAllocation` rows it steers are derived from it. Without it, a manual override would have to be expressed by editing the projection, which is the thing a projection may never be |
| **Shift** | `id`, `userId`, `openedAt`, `closedAt?`, `openingFloat`, `expectedCash`, `countedCash`, `countedBreakdown`, `variance`, `status` (OPEN/CLOSING/CLOSED), `unsyncedAtClose`, `notes` | `countedBreakdown` stores the denomination counts from §6.6. `unsyncedAtClose` records how many sales were still queued when the shift closed, so the Z-report can state it — a Z-report that silently omits sales is worse than one that admits to them (§6.6) |
| **CashMovement** | `id`, `shiftId`, `type` (PAY_IN/PAY_OUT/DROP/NO_SALE/REPAYMENT/REFUND), `amount`, `reason`, `userId` | Cash leaves the drawer for non-sale reasons constantly; unmodelled, it destroys every reconciliation. **`NO_SALE` carries `amount = 0`** — it records only that the drawer was opened outside a sale, which is the classic cover for taking cash and the reason §16.3 re-authenticates it. **`REFUND` is cash leaving the drawer for a sale return** (§12.4), and it exists because §12.5's formula had no term for one: a shift taking a single 8 000 ֏ cash refund closed 8 000 ֏ short, and «Տարբերություն −8 000 ֏» appeared on the one screen §6.6 says exists to catch theft. It is its own type rather than a `PAY_OUT` with a reason, because §20.2 must be able to separate refunds from supplier payments — folding them together would cost the shrinkage report its most important category |
| **ShiftLateArrival** | `id`, `shiftId`, `sourceType`, `sourceId`, `amount`, `arrivedAt` | **A sale, repayment or cash movement that reached the server after its shift had closed.** It posts normally and keeps naming the closed shift — what this row adds is that the Z-report can *say so* as a linked line («+31 000 ֏ ստացվել է փակումից հետո») rather than a closed period's variance being silently rewritten or the money going missing from the sales report. `Shift.unsyncedAtClose` records how many were outstanding; this records what actually arrived, which is the difference between a count and a reconciliation. `amount` is signed, because a late `REFUND` reduces the drawer |
| **User** | `id`, `name`, `pinHash`, `recoveryCodeHash?`, `role`, `isActive`, `failedAttempts`, `lockedUntil`, `coachMarksSeen` | §16.2, §16.4. `recoveryCodeHash` exists only on `ADMIN` rows: generated at setup (§7.1), shown once, hashed like a PIN, single-use and regenerated after use. It is the third way out of a lockout when the locked-out person is the only admin. `coachMarksSeen` lists the screens this person has already been shown (§7.5) — per user, not per device, because Գոռ should not be taught the till again just because he picked up the other phone |
| **Device** | `id`, `prefix` (unique), `label`, `registeredAt`, `lastSequence`, `blockStart?`, `blockEnd?`, `outboxDepth`, `outboxOldestAt?`, `parkedDepth`, `isActive` | The till as a durable thing, which `Session` is not: a session is revoked at every logout and a receipt number printed on paper outlives it by years. `prefix` is two characters, unique across the shop, assigned once and never reused — it is the left half of every `Sale.number` this device issues (§12.1). `lastSequence` is the right half. **The device's own copy of the counter is authoritative**; the server row records the highest sequence it has received, because a till that is offline still has to number the sale in the customer's hand (§14.2, rule 1). `blockStart`/`blockEnd` are null unless §26 Q10 turns out to require Simon to issue a gapless sequence, in which case they hold the range this till has been allocated (§12.1) — the field exists now so that answer costs a setting rather than a redesign. `outboxDepth` and `outboxOldestAt` count **sales awaiting delivery only** — a parked basket sits in the same FIFO queue (§14.4) but is not money in transit, and `parkedDepth` counts those separately. They live here rather than on `Session`, because a queue belongs to the till and not to whoever is signed in on it — summing them across sessions would count one phone once per login it has ever had (§19.5). A device registers on its first successful login (§16.2), and **deactivating it revokes its sessions in the same transaction** (§16.3): a lost phone that stops issuing receipt numbers but carries on selling has not been stopped |
| **Session** | `id`, `userId`, `deviceId` → `Device` (§11), `tokenHash`, `mode` (LIVE/PRACTICE), `shiftId?`, `createdAt`, `lastSeenAt`, `expiresAt`, `revokedAt?` | **§16.3's token is a row, because everything §16 asks of it needs storage.** `tokenHash`, never the token — a bearer credential at rest is a stolen credential. `revokedAt` makes revocation real; `shiftId` is what lets a session end at shift close; `mode` is how practice stays per-device (§19.4) rather than shop-wide; `lastSeenAt` drives the idle timeouts and §21.2's dashboard-use figure. **Writes to this row and to `Device` are throttled and never sit inside another transaction** (§16.3): SQLite has one writer (§13.1), and a row written on every barcode lookup would spend §21's concurrency budget on bookkeeping |
| **AuditLog** | `id`, `userId`, `action`, `entityType`, `entityId`, `before?`, `after?`, `reason?`, `createdAt` | §10.7. **`reason` is the text a person typed to justify an override** — price override, credit-limit override, discount above the cap, blind return, stock adjustment. It is required for those actions and null elsewhere. `before`/`after` record what changed; `reason` records why, and in a shrinkage investigation it is the more useful of the two. `before`/`after` are **nullable**: entering or leaving practice mode (§19.4) and opening the drawer outside a sale are events that happened, not fields that changed, and §27.19 counts exactly those rows |
| **Stocktake** *(v2, §9)* | `id`, `status` (COUNTING/REVIEW/APPROVED/ABANDONED), `startedAt`, `startedBy`, `approvedAt?`, `approvedBy?`, `note` | The session §11's *Lifecycles* gives a state machine to, and §13.4 approves |
| **StocktakeLine** *(v2, §9)* | `id`, `stocktakeId`, `productId`, `expectedQty`, `countedQty?`, `varianceValue` | `expectedQty` is the snapshot taken at `COUNTING`, which is why the shop can keep trading (§6.8) |
| **ProductStats** | `productId` (primary key), `avgDailyQty30d`, `lastSoldAt?`, `daysSinceLastSale?`, `computedAt` | **A rebuildable cache, never a source of truth** — the same standing as `Product.stockQty` (§10.4). Four screens need sales velocity and none of them can afford to derive it live: quick tiles (§6.1) sit on the till's 200 ms path, the low-stock alert (§6.11) and reorder suggestion (§13.3) run per product, and dead stock (§6.9) needs `daysSinceLastSale`. Refreshed by §22's reorder-stats job, nightly and on demand, **outside any document transaction** (§13.1). Unlike `stockQty` it is **not** part of §10.4's drift check — an approximate figure that is a few hours stale is doing its job, and alerting on it would only teach the owner to ignore alerts |
| **BackupRun** | `id`, `startedAt`, `completedAt?`, `destination` (LOCAL/USB), `sizeBytes?`, `outcome` (OK/FAILED), `error?` | §19.2. `/health` reports the last `OK` row and §19.5's first alert fires when there is none inside 24 hours. "Was the backup taken?" is the question asked on the worst day of the shop's life, and it needs an answer that is not a directory listing |
| **Setting** | `key`, `value` | §6.11. Also holds the setup wizard's progress under `setup.*`, which is what makes §7.1 resumable. **`shop.timezone` defaults to `Asia/Yerevan`** and is what every shop-local boundary resolves against — the calendar day in §20's reports, the shift day, and the aging buckets in §10.6. It is a stored setting rather than the host's locale because a host PC left on UTC would put the day boundary four hours out and make every daily report wrong in a way that looks like fraud; the word "timezone" did not previously appear anywhere in this document, and `TZ` was pinned only in `vitest.config.ts`. Armenia observes no DST, which makes a misconfiguration a one-time silent error rather than a twice-yearly visible one — *less* likely to be noticed, not more, which is why it is a setting the wizard asks for rather than an assumption |

### Import

| Model | Key fields | Notes |
|:--|:--|:--|
| **ImportBatch** | `id` (client-generated), `kind` (PRODUCTS/CUSTOMERS/OPENING_STOCK/OPENING_DEBTS), `fileHash`, `rowCount`, `appliedCount`, `skippedCount`, `failedCount`, `startedAt`, `completedAt?`, `userId` | §19.1's guarantee needs an identity to be idempotent *about*. `fileHash` catches the same spreadsheet uploaded twice by accident; `id` catches the same request retried |
| **ImportRow** | `id`, `batchId`, `rowNumber`, `naturalKey`, `status` (APPLIED/SKIPPED/FAILED), `entityId?`, `error?` | One row per line of the file, so "reports per-row errors" is a query rather than a log scrape, and a re-run can tell what it already did |

`ImportRow.naturalKey` is what makes a re-run safe, and it differs per `kind`: **products** key on
`sku`, falling back to the primary barcode; **customers** on `phone`, falling back to
`fullName`; **opening stock** on the product's key; **opening debts** on the customer's key plus
the charge's original date and amount. A row whose `naturalKey` was already `APPLIED` — in this
batch or any earlier one — is `SKIPPED`, never applied twice.

That last rule is not fussiness. Opening debts import with their original dates (§19.1), and a
second run without it would double every debtor's balance on day one — the exact number §27.5
checks against the paper book, and the exact kind of unexplainable figure §2.3 says ends the
relationship.

---

**Indexing.** `ProductBarcode.barcode` (unique) · `StockMovement(productId, seq)` — the replay order, §10.4 ·
`Sale(businessDate)` — what §20's daily reports group by ·
`Sale(completedAt)` · `DebtEntry(customerId, createdAt)` · `Product.nameSearch` ·
`Customer.nameSearch` · `ImportRow(naturalKey, status)`. Barcode
lookup is the hottest path in the system.

---

### Lifecycles

Four entities have a state machine. Everything else is written once and thereafter only
referenced.

**Sale** (§6.5, §10.7)

| From | To | Trigger | Guard |
|:--|:--|:--|:--|
| — | `DRAFT` | First line added | A shift is open |
| `DRAFT` | `HELD` | Պահել — park the basket | Basket not empty |
| `HELD` | `DRAFT` | Resumed | **Any open shift** — that is the point of parking it on the server (§12.1). The sale belongs to the shift that *completes* it, which is the one §12.5 reconciles |
| `DRAFT` / `HELD` | `COMPLETED` | Payment covers the total | Σ payments ≥ `total`; commits per §13.1 |
| `DRAFT` / `HELD` | `VOIDED` | Abandoned by the worker | Never automatic: a shift **blocks** on open baskets rather than voiding them (§6.6, §8.5 `shift-has-open-baskets`) |
| `COMPLETED` | — | **Terminal** — corrected only by a linked `SaleReturn` | — |

`COMPLETED` and `VOIDED` are both terminal. There is deliberately no edge out of `COMPLETED`.

**Shift** (§6.6, §12.5)

| From | To | Trigger | Guard |
|:--|:--|:--|:--|
| — | `OPEN` | Worker opens with a counted float | No other `OPEN` shift for this user |
| `OPEN` | `CLOSING` | Close begun; expected cash computed | Unsynced sales acknowledged (§6.6) |
| `CLOSING` | `OPEN` | Cancelled | Nothing counted yet |
| `CLOSING` | `CLOSED` | Counted, variance recorded, Z-report issued | Every `DRAFT`/`HELD` sale **whose `shiftId` is this shift** is completed, voided, **or has been resumed on another till** — which moves it off this shift (§11 `Sale.shiftId`). One till's open basket never blocks another till's close |
| `CLOSED` | — | **Terminal** — sessions bound to it end (§16.3). A document arriving afterwards posts against it and writes a `ShiftLateArrival` (§11); it never reopens the shift, never rewrites the printed Z-report's variance, and is never rejected — §14.2's first guarantee outranks a tidy period | — |

**PurchaseOrder** *(v2, §9)* — `DRAFT` → `OPEN` → `PARTIAL` → `RECEIVED`, with `CANCELLED`
reachable from `DRAFT` and `OPEN` only. `PARTIAL` and `RECEIVED` are derived from receipt
lines, never set by hand.

**Stocktake session** *(v2, §9)* — `COUNTING` → `REVIEW` → `APPROVED`, or `ABANDONED` from
either of the first two. Approval is the only transition that posts movements (§13.4), and it
is irreversible except by a further adjustment.

`GoodsReceipt`, `SaleReturn`, `DebtEntry`, `StockMovement` and `CashMovement` have no
lifecycle at all: written once, inside one transaction, never updated (§10.7).

### Field conventions & validation

The tables above name fields; these are the rules that turn them into a schema and a Zod
contract (§22). Stated once, because a type column repeated twenty times is how two of them end
up disagreeing.

| Convention | Rule |
|:--|:--|
| `id` | `TEXT`, UUIDv7, 36 chars, primary key, client-generated (§14.3) |
| `?` suffix | Nullable. Everything else is `NOT NULL` |
| Money — `*Mdram`, `amount`, `total`, `subtotal`, … | `INTEGER`. Milli-dram where the name says so, whole dram otherwise (§10.1) |
| Quantity — `qty`, `qtyDelta`, `stockQty` | `INTEGER`, milli-units ×1000 (§10.2) |
| Percentage — `*Bp` | `INTEGER`, basis points, 0–10000 |
| Enums — `status`, `type`, `method`, `role` | `TEXT` with a `CHECK` constraint. Never an integer code: reading the database with `sqlite3` should not require a lookup table |
| Timestamps — `*At` | `TEXT`, RFC 3339 UTC. Shop-local only at the edges (§20.3) |
| `updatedAt` | On every row the client caches — `Product`, `ProductBarcode`, `ProductUnit`, `Category`, `Customer` — set on every write. This is what `GET /catalogue/snapshot?since=` compares against (§15.4); without it the cache can only ever be refetched whole, which on a low-end phone over shop Wi-Fi is the difference between a sync and a stall |
| Free text — `name`, `note`, `reason` | `TEXT`, NFC-normalised on write (§20.3) |
| Foreign keys | `ON DELETE RESTRICT` throughout. Nothing financial is ever deleted (§10.7), so a cascade could only ever fire because of a bug |

Zod validates the request at the boundary; the `CHECK` constraint catches whatever a future
endpoint forgets.

| Field | Rule |
|:--|:--|
| `Product.name` | 1–120 chars, trimmed, not blank |
| `Product.decimalPlaces` | 0–3, and **immutable once movements exist** (§6.12) |
| `Product.sellPriceMdram` | ≥ 0. Zero is legal — a free sample still moves stock |
| `Product.avgCostMdram` | Nullable, and **null means unknown, not free** (§10.5). ≥ 0 when set; zero is legal and means free, matching `sellPriceMdram`. Seeded by the first receipt, never by arithmetic against a null |
| `ProductUnit.factorToStockUom` | > 0, and **immutable once movements exist for the product** — the same rule and the same reason as `decimalPlaces`. A supplier changing a spool from 50 m to 100 m must be a *new* `ProductUnit`, never an edit: editing re-reads every historical receipt at the new factor, so replaying the ledger stops reproducing the shelf and §13.7's purchase return against an old receipt line reverses the wrong quantity |
| `Sale.businessDate` | `TEXT`, `YYYY-MM-DD`, **server-stamped at commit** in `shop.timezone` (§11 `Setting`). Never client-supplied and never derived from `createdAt` on the device, because that is the clock this rule exists to distrust |
| `StockMovement.seq` | `INTEGER`, server-assigned, monotonic per shop, never reused. The replay order (§10.4) |
| `SaleReturnTender` | Σ `amount` = `SaleReturn.total`; each `amount` > 0. A `DEBT_REDUCTION` tender may not exceed what the original sale actually put on debt |
| `SaleReturnLine.discountShare` | 0 ≤ *d* ≤ the line's share of `Sale.discountTotal`, apportioned by line value exactly as landed cost is (§10.5). Rounded half-up once, per §10.1 — a third named carve-out, and it is named here rather than left to be discovered |
| `AllocationOverride.amount` | > 0, and ≤ the charge's balance **as the projection sees it at derivation time**, not at entry time |
| `CostCorrection` | `correctUnitCostMdram` ≠ `wrongUnitCostMdram`; `affectedFrom` ≤ `affectedTo`; `reason` required (§10.7) |
| `ProductBarcode.barcode` | 1–48 chars, `[0-9A-Za-z-]`, **globally unique** |
| `ProductUnit.factorToStockUom` | > 0 |
| `Customer.fullName` | 1–120 chars, trimmed, not blank — **unless `anonymisedAt` is set**, when it and `phone` are null (§19.6). The only nullable case, and it is a legal requirement rather than an oversight |
| `Customer.nameSearch` | Derived on write from `fullName`, never entered (§20.3) |
| `ImportRow.naturalKey` | Required; unique per `kind` among `APPLIED` rows — this constraint *is* §19.1's idempotency |
| `Customer.phone` | ≤ 32 chars; unique when present — it is the duplicate check (§6.13) |
| `Customer.creditLimit` | ≥ 0. Zero means cash only, which is not the same as `isBlocked` |
| `SaleLine.qty` | > 0. A negative line is not how a return is expressed (§12.4) |
| `SaleLine.discountAmount` | 0 ≤ *d* ≤ the line total before discount |
| `Payment.amount` | > 0; a split tender's payments sum to ≥ `Sale.total` (§6.2) |
| `DebtEntry.amount` | > 0 always — direction lives in `type` (§10.6) |
| `DebtAllocation.amount` | > 0, and ≤ the remaining balance of its charge |
| `Shift.openingFloat`, `Shift.countedCash` | ≥ 0. `variance` may be either sign |
| `User.pinHash` | argon2id output. The PIN is 4–8 digits and is never stored (§16.2) |
| `StockMovement.sourceId` | Required — a movement with no source is a bug (§10.4) |
| `StockMovement.reasonCode` | Required when `type = WRITE_OFF`; null for every other type (§13.5) |
| `SaleReturnLine.qty` | > 0, and ≤ its sale line's quantity less what has already been returned against that line (§12.4) |
| `SaleReturn.shiftId` | Names an `OPEN` shift at the time of writing, and is frozen thereafter. A return that arrives late posts against the closed shift and writes a `ShiftLateArrival`, exactly as a sale does |
| `SupplierAllocation.amount` | > 0, and ≤ the receipt's unpaid balance — `DebtAllocation`'s rule, mirrored (§10.6) |
| `Product.defaultSupplierId` | Nullable; when set it must reference an active supplier (§13.3) |
| `Device.prefix` | Exactly 2 characters, `[A-Z0-9]`, globally unique, immutable once a sale has used it — a reused prefix makes two receipts share a number |
| `Device.lastSequence` | Monotonic, never reset. The device may be ahead of the server row; the server never rewinds it |
| `Device.outboxDepth`, `Device.parkedDepth` | ≥ 0. Both are **client-reported** and the server displays them without arithmetic, so a device reporting nonsense shows the owner nonsense — bound them on write |
| `Sale.shiftId` | Names an `OPEN` shift at every write, and must not change once `status = COMPLETED` (§11, *Lifecycles*) |
| `Sale.priceBasis` | Set from §6.11 at completion and immutable thereafter. A reprint reads it; it is never recomputed from the current setting |
| `Session.tokenHash` | Never the token itself. Argon2id, as for a PIN (§16.2) |
| `Session.mode` | `PRACTICE` sessions may not write to the real database at all (§19.4) |
| `AuditLog.reason` | Required for every action a person had to justify (§10.7); null otherwise |
| `Customer.mergedIntoId` | Nullable; when set, `isActive` must be false and the row is read-only (§6.13) |

---

## 12. Selling logic

### 12.1 Checkout
Target: **scan → line in under 200 ms**; three-item cash sale in under 15 seconds (§21).

Finalising commits **one transaction**: sale → lines → payments → stock movements → debt
charge (if any) → audit row. Printing happens **after** commit.

**Discounts** are line-level or sale-level, percentage or fixed, gated by role and capped by
a configurable maximum. Above the cap: admin PIN plus a reason. Uncapped discounting is a
standard shrinkage route, and the discount-by-worker report exists because of it.

**A line price override is a discount, and is bound by the same cap.** §6.1's long-press was
gated only by *"if permitted"* and bound to nothing: setting a 1 200 ֏ line to 900 ֏ is a 25%
discount that never touched the discount control, never needed the admin PIN the cap requires,
and never appeared in the discount-by-worker report that exists precisely to catch it — while
§16.1 ranks *"a worker discounting their own sales to cover cash theft"* as threat number two.
The override is therefore measured against the catalogue price, capped by the same configurable
maximum, escalated the same way, and **counted in the same report**. Either the two controls are
one control, or the cap is decoration.

**The server owns the arithmetic.** §16.5 argues at length that hiding cost in the UI is not a
control. The same is true of capping a discount in the UI, and it is the more expensive
direction because it governs a *write*: §16.5 is about reading what you should not see, this is
about writing what you should not set. §15.3 states exactly what the server recomputes and what
it accepts from the client.

**Receipt numbering.** `Sale.number` is assigned at completion, **on the device**, as
`{Device.prefix}-{Device.lastSequence}` (§11) — two characters and a monotonic per-device
counter, both belonging to the till rather than to whoever is signed in on it. It is
unique across the shop, readable aloud over a phone, and scannable to start a return (§6.5).
`GoodsReceipt.number` and `PurchaseOrder.number` are server-assigned and sequential instead,
because receiving is online-only anyway (§14.5).

**It is deliberately not a gapless global sequence.** A gapless number can only be issued by one
authority, and the till has to complete a sale with that authority unreachable (§14.2, rule 1).
Numbering per device is what makes an offline sale a first-class sale rather than a provisional
one waiting for a number.

**And if Simon is ever required to issue the gapless number itself**, the design already
absorbs it without touching §14: the server hands each device a **block of sequential numbers**
while it is online, the device spends them offline, and an abandoned block leaves a gap that is
explainable and auditable rather than a missing sale. `Device.blockStart` and `blockEnd` (§11)
hold the current allocation; the device asks for the next block when it is running low, which is
a thing it can do at any point it has a connection rather than at the moment of a sale.

That is what turns §26 Q10 from a question that could rewrite §14's offline design into one that
picks a numbering mode. Where a fiscal regime requires a gapless sequence, **the ordinary answer
is that the number comes from the ՀԴՄ and not from Simon** — `Sale.fiscalReceiptId` (§11) is
reserved for exactly this, and it is why §17 insists
the adapter seam exists before it is needed. Simon's own number stays the internal reference
either way. Whether the pilot store's regime demands it is **§26 Q10**, and if the answer is yes
it changes §14's offline design rather than a field.

**Held sales** persist across app restarts. A parked basket that vanishes because the phone
locked is a lost sale and a lost user.

**They live on the server when it is reachable** — parking writes the `Sale` in `HELD` status
(§11), so any till can resume it and a dead battery costs nothing. Offline, the basket is held
in IndexedDB and promoted on reconnect (§14.4). A `HELD` sale blocks its shift from closing
until it is completed or voided (§11, *Lifecycles*), because a Z-report with a basket still
open is not a closed period.

### 12.2 Debt sale
Credit-limit check → warn and allow override with reason (rule 1), unless set to strict.
Creates a `CHARGE` with an optional due date. The pre-confirmation summary in §6.3 is a
functional requirement, not decoration.

### 12.3 Repayment
Oldest-first allocation, overridable, partial supported. Creates a `PAYMENT` entry plus
`DebtAllocation` rows. **Taken in cash, it also writes a `CashMovement` of type `REPAYMENT`** —
and that row, not the debt entry, is what §12.5 counts, so the drawer and the ledger cannot
disagree. A card repayment writes no cash movement at all. Prints a receipt.

### 12.4 Returns
From the original sale only (blind returns admin-only). Each `SaleReturnLine` names the
`saleLineId` it reverses and **cannot exceed that line's quantity sold, less what has already
been returned against it** — the check is per line, not per sale, or two half-returns pass a
whole-sale test.

`restock` is decided per line: back on the shelf → `SALE_RETURN` at `unitCostMdram` copied from
the original sale line; damaged → `WRITE_OFF` with a `reasonCode` (§13.5). One return can do
both, which is why the flag is not on the header.

**The refund is split the way the sale was tendered.** `Payment` is many-per-sale and a return
is too: a sale paid 30 000 ֏ cash and 20 000 ֏ on nisya, partly returned for 25 000 ֏, has to
say how much leaves the drawer and how much comes off the debt. Simon apportions **pro-rata by
tender** — 15 000 cash and 10 000 debt here — and says so on screen, as §6.5 promises for the
simple case. Pro-rata beats *debt-first* and *cash-first* because both are positions in an
argument with the customer and the till should not take one; it beats *the worker chooses*
because that turns the refund method into a shrinkage dial. `SaleReturnTender` (§11) records the
split, and rounding follows §10.1 — half-up, once, per tender, any one-dram remainder landing on
the largest.

**A sale-level discount comes back in proportion too.** A 100 000 ֏ basket discounted 10% and
paid at 90 000 has one 20 000 ֏ line returned: the refund is **18 000, not 20 000**. Refunding
the gross means the shop pays back more than it received on those goods on *every discounted
sale that is partly returned* — a slow, deniable, per-transaction leak, and an obvious one to
anyone who notices it: buy a discounted basket, return the expensive line.
`SaleReturnLine.discountShare` (§11) carries the apportionment, computed by line value exactly
as landed cost is (§10.5). §10.1 was carefully corrected to admit sale-level discounts; §12.4
was not re-swept at the time, and this is that sweep. Cash rounding travels the same way: the
sale's `roundingAdjustment` is apportioned across the returned lines rather than quietly kept.

Refunding a debt sale reduces the debt rather than paying out cash: a credit `ADJUSTMENT`
(§10.6) allocated against the original charge through `DebtAllocation.creditEntryId`. Never a
negative charge, and never money out of the drawer for goods that were never paid for.

### 12.5 Shift & cash
```
expected = openingFloat
         + cashSales                  Payment.method = CASH, on COMPLETED sales in this shift
         + Σ CashMovement REPAYMENT   debt repaid in cash (§12.3)
         + Σ CashMovement PAY_IN      anything else put into the drawer
         − Σ CashMovement REFUND      cash paid out on a sale return (§12.4)
         − Σ CashMovement PAY_OUT
         − Σ CashMovement DROP
variance = counted − expected
```

Every term after `openingFloat` is a query over rows rather than a running total, so the
drawer can be recomputed from the ledger at any moment (rule 3). `NO_SALE` carries
`amount = 0` and cannot move the figure.

**Repayments are counted exactly once**, as `REPAYMENT` movements. An earlier form of this
formula listed `repayments` and `payIns` as separate terms while §12.3 wrote a cash movement —
which would have overstated expected cash by every repayment taken that day, on the one screen
§6.6 says is there to catch theft.

**Refunds are counted at all.** An earlier form of this formula had no term for one, and
`CashMovement` had no `REFUND` type: a shift taking a single 8 000 ֏ cash refund closed 8 000 ֏
short, and an honest worker got to write a note explaining the software's arithmetic every time
they took a return. That is the same class of defect as the repayment double-count above, on the
same screen — found by asking what the formula was *missing* rather than what it counted twice,
which is the question the earlier sweep did not ask.

**A late arrival is stated, never absorbed.** A sale, repayment or refund reaching the server
after this shift closed posts against it and writes a `ShiftLateArrival` (§11). The Z-report
prints those as a separate, linked line — «+31 000 ֏ ստացվել է փակումից հետո» — rather than
rewriting a variance that was already counted, printed and signed. The cash was in the drawer
when it was counted, because the worker had it; what was late was the *record*. A reconciliation
that silently changes after the fact is worth less than one that admits what arrived late.

Variance is always recorded. X-report mid-shift, Z-report at close.

**A sale that arrived by transfer is listed separately on the Z-report.** A worker reading it
should be able to see why a sale they never rang up is in their drawer, and the worker who parked
it should be able to see where it went. Both names are on the audit row (§10.7).

---

## 13. Buying & inventory logic

### 13.1 Atomicity
Every document touching stock or money commits in **one transaction**: validate → write
document → write movements → recompute cached balances → write audit row. Partial writes are
the failure mode that corrupts a POS beyond repair.

SQLite runs in **WAL** mode with a `busy_timeout` and `foreign_keys=ON` (off by default in
SQLite). Stock reads that inform a write happen *inside* the transaction — reading, deciding,
then writing in a second transaction is the classic oversell race. **No I/O inside a
transaction:** no printing, no HTTP, no file writes. SQLite has a single writer and a slow
call inside blocks every other till.

### 13.2 Receiving
Receipt (with or without a PO) → costs and landed cost entered → commit posts
`PURCHASE_RECEIPT` movements, recalculates the weighted average, and creates the payable.
Received quantities may differ from ordered; the PO moves to PARTIAL or RECEIVED.

**A unit cost far from the last one for that product is questioned before it commits.** The
`STOCK` role types the number that moves `avgCostMdram`, which moves every margin the owner
sees — and §16.5 forbids that role from seeing the resulting average, so the person entering it
is structurally unable to notice they got it wrong. A read control with no matching write
control on a derived figure is a half-closed door. Above a configurable ratio (default 3×, either
direction) the screen says what it saw — *«անցյալ անգամ 1 400 ֏, հիմա 14 000 ֏»* — and offers
confirm or correct; confirming writes a `COST_VARIANCE` flag (§11) to the owner's
needs-attention list. This is cheap, it catches the misplaced decimal at the one moment it is
still free to fix, and it is the reason §10.5's restatement mechanism should stay rare.

### 13.3 Reorder logic
The static `reorderPoint` threshold is the floor. Simon suggests a better value from v1 — the
owner sees a number and accepts or ignores it, which is what §6.11's "auto from velocity"
setting and §7.1's day-3 promise depend on. **Turning a suggestion into an actual purchase
order is v2** (§9), with the PO flow itself:

```
reorderPoint ≈ (ProductStats.avgDailyQty30d × supplier leadTimeDays) + safety stock
```

Presented to the owner as a plain sentence — *"Սովորաբար վաճառվում է օրական 4, մատակարարը
բերում է 5 օրում"* — not as a formula. Dead stock is surfaced alongside (§6.9).

### 13.4 Stocktake
**v2** (§9); the `STOCKTAKE` movement type exists from v1.
Snapshot → count → review variances → approve. Approval posts `STOCKTAKE` adjustments,
valuing shrinkage at cost. Counting may proceed while trading.

### 13.5 Write-offs
Explicit reasons, stored as `StockMovement.reasonCode` (§11) and never as free text: damage,
expiry, theft, internal use, sample. A coded field is what turns "stock disappears" into
§20.2's chart; a `note` column would only ever produce a list nobody can total.

### 13.6 Negative stock
Default **allow with warning** (rule 1). The goods are physically leaving the shop; refusing
the record does not stop that. The movement writes a `ReviewFlag` of type `NEGATIVE_STOCK`
(§11) — that row *is* the recount list, and it is also the durable state behind §8.5's
`insufficient-stock` warning, which §15.2 requires to survive a replay. COGS uses the last known
average. Owners may switch to strict.

### 13.7 Purchase returns

Goods go back to a supplier: wrong item, damaged in transit, over-delivered. §9 puts this in v1
as "returns both directions", and it is the one v1 document whose costing rule was never
written down.

**A return names receipt lines, not products.** Each `PurchaseReturnLine` points at the
`GoodsReceiptLine` it reverses, because the question that matters — *what did this actually
cost us* — is answerable only against the delivery it came in on. A blind purchase return with
no receipt is admin-only and values the goods at the current average, exactly as §6.5 treats a
blind sale return.

**Reverse at the landed cost, not the current average.**

```
newAvgCost = (stockQty × currentAvgCost − returnQty × receiptLandedUnitCost)
             ÷ (stockQty − returnQty)
```

Removing stock at the current average would leave the remaining units valued at a blend that
includes goods no longer held. Worked through: 10 units at 12 ֏, then a delivery of 10 at 14 ֏
gives 20 at an average of 13. Return that whole delivery and the shop is back to 10 units that
cost 12 — which the formula above gives, and removing at 13 does not. Getting this backwards
does not fail loudly; it quietly misvalues every unit still on the shelf and every margin
reported after it (§10.5).

The same guards as §10.5 apply: round half-up to a whole milli-dram on store, and if
`stockQty − returnQty ≤ 0` do not evaluate the formula — leave the average as it stands and flag
the movement, because an average describing goods the system no longer holds is not evidence
about anything.

**And one more guard, because the worked example above is the easy case.** It has no sales
between the receipt and the return — but a shop usually discovers goods are wrong *by selling
one*. Put eight sales in the middle and the formula misvalues the shelf, silently:

| Step | Qty | Avg | Value |
|:--|--:|--:|--:|
| Opening | 10 | 12 | 120 |
| Receipt 10 @ 14 | 20 | 13 | 260 |
| **Sell 8** | 12 | 13 | 156 |
| Return the delivery, 10 @ landed 14 | 2 | **8** | 16 |

`(156 − 140) ÷ (12 − 10) = 8` — **below any price this shop has ever paid for the product**,
understated by a third, with every margin reported on the remaining units overstated to match.
The denominator guard does not fire, the numerator is positive, and nothing about the result
looks wrong until someone reconciles a shelf against a valuation months later. The paragraph
above warns about exactly this failure — *"it quietly misvalues every unit still on the shelf"* —
and the formula walks into it: right for the clean case, wrong for the ordinary one.

**Interim rule — adopted 2026-09-12, owned by the document owner, and due to be closed with
§26 Q17 in the same conversation as Q2.** It is written here as a rule rather than a placeholder
because the build cannot wait on an accountant, and §24's preamble warns exactly how an
unstamped interim hardens into a decision nobody remembers making. Evaluate the formula; then, if the result falls outside the
band `[0, max(currentAvgCost, receiptLandedUnitCost)]`, **do not store it** — leave the average
as it stands, post the movements, and write a `ReviewFlag`. Also flag, without clamping, whenever
stock has turned over between the receipt and its return, because that is the condition under
which the figure is suspect even when it lands inside the band. The clamp is conservative rather
than correct: it stops the average becoming evidence of something that never happened, and it
makes the case visible to a person instead of silent. **What the *right* answer is — reverse only
the units still attributable to that receipt and treat the rest as a cost-of-sales adjustment
(§11 `CostCorrection`), or accept the distortion as the price of not tracking lots — is §26
Q17**, and it is a costing decision rather than an implementation detail.

**The freight does not come back.** The receipt's landed cost included an apportioned share of
the delivery charge (§10.5); the supplier refunds the invoice line and not the freight. That
difference is a real loss and is recorded as `PurchaseReturn.landedCostLost` rather than
absorbed silently into the average — it belongs beside the write-offs in §20.2, where the owner
can see what returning goods actually costs him.

**What commits, in one transaction** (§13.1): the return document → `PURCHASE_RETURN` movements
with negative `qtyDelta` at the landed cost → the recalculated average → a credit against the
supplier's payable, allocated to the original receipt like any other settlement (§11
`SupplierAllocation`) → the audit row.

---

## 14. Offline & sync

### 14.1 The architecture, stated plainly
v1 of this document called itself "offline-first" while specifying a phone talking to a
server on the shop PC — if that PC sleeps, an "offline-first" app stops selling. Those are
different architectures.

**Decision: LAN-primary with a resilient client.** The host PC is authoritative. The client
is built so a brief interruption never costs a sale.

### 14.2 Two guarantees
1. **A completed sale is never lost.** It represents goods that physically left the shop.
2. **A completed sale is never posted twice.** One dropped response must not double-charge a
   customer and double-deduct stock.

### 14.3 Idempotency — mandatory
The client generates the sale `id` (UUIDv7) **before** submitting; the server treats it as
the idempotency key. A replay returns the original document with `200`, never a duplicate and
never a `409` — the client cannot distinguish "my retry succeeded" from "someone else did
this" and must not have to.

**The key is the id *and the transition it asks for*, not the id alone.** A sale is posted twice
in ordinary life: once to park it (`HELD`) and once to complete it (`COMPLETED`), and §11's
lifecycle permits exactly that. Keying on the row's mere existence would make the second post
look like a retry of the first — the server would return the parked basket, the till would show
a `200` and a document that looks right, and **the money would never be taken.** So: the same id
**with the same target status** is a replay; the same id with a *different* status is the next
transition, validated against §11's *Lifecycles*; an illegal one is `422` (§8.5
`illegal-transition`).

**That refinement is sales-only, because a sale is the only queue-drained document with a
lifecycle.** A return, a repayment and a cash movement are written once and never transition
(§11) — for those three the id alone is the key, exactly as it always was. Applies to every
queue-drained endpoint: sales, returns, repayments, cash movements; only the first of them can
be posted twice on purpose.

### 14.4 Client behaviour
- **Catalogue cache** in IndexedDB — products, barcodes, prices, customer names and balances.
  A worker can scan and build a basket with the server unreachable.
- **Outbox queue** — completed **and parked** sales are written locally first, then drained
  FIFO and serially. The UI never awaits the network to complete a sale.
  **One queue, both kinds**, because ordering matters across them: a basket parked before a sale
  was completed must not overtake it. A parked basket drains as a `status: HELD` post and a
  completed one as `status: COMPLETED` (§15.3); "promoted on reconnect" (§12.1) means nothing
  more than reaching the front of this queue.
  **One queue, two counts.** What the worker and the owner are shown is money in transit, and a
  parked basket is not that — it is counted apart (§11 `Device.parkedDepth`) so that a basket
  left on the counter all afternoon, exactly as §6.1 intends, never reads as an unsent sale.
- Retry with backoff on network/5xx; **never** on other 4xx — park those and surface them.
  **With two exceptions, because two 4xx are transient and treating them as permanent loses a
  real sale.** A **`401`** means the session expired while the item sat in the queue — the sale
  is already complete and the goods already gone, so it is held, not parked, and retried after
  the next successful sign-in. A **`404`** on a document that names another queued document (a
  return whose original sale is still behind it) is an ordering artefact, not a missing record:
  it goes to the back of the queue once, and only parks if it fails again after its dependency
  has drained. Without these, §14.2's first guarantee is broken by a policy line — the one 4xx
  that is temporary treated as if it were final.
- **A parked item steps aside; it never blocks the queue.** FIFO and serial describe the order
  work is *attempted*, not a requirement that a poisoned item stop everything behind it. One
  `422` on a debt sale must not freeze every subsequent sale on that till — especially since the
  till carries on selling, because rule 1 says it must. Parked items move to a separate
  needs-attention list (§14.6) and the queue continues.
- **Ordering is guaranteed within a document's dependency chain, not across the whole queue.**
  §14.4's original promise covered only the two kinds of *sale*; four endpoints are queue-drained
  (§14.3). A return must not overtake the sale it reverses, a repayment must not overtake the
  charge it pays, and a cash movement has no dependency at all. The queue therefore holds back an
  item whose named antecedent is still ahead of it, which is what makes the `404` rule above a
  rare fallback rather than the common path.
- **Connection state is measured, not asked.** `navigator.onLine` reports whether the device is
  *associated* with a network, which on shop Wi-Fi is not the question. The client probes
  `/health` and treats the server as unreachable after a configurable threshold (default: 2
  consecutive failures, or any request exceeding 1.5 s on the scan path). **A router at 40%
  packet loss is the failure this exists for** — the till stays nominally "connected", the calm
  strip in §8.3 never appears, the outbox never engages, and §21's 200 ms budget becomes a
  30-second timeout on the hottest path in the system. Degraded is a state, not a binary, and it
  fails fast into the offline path that already works.
- Cached stock and prices are **last-known and must be labelled as such**.

### 14.5 What may happen offline
| Operation | Offline | Why |
|:--|:--|:--|
| Scan, build a basket, take cash | ✅ | Catalogue cached |
| Complete a cash/card sale | ✅ | Queued, idempotent |
| Debt sale | ⚠️ capped | The limit cannot be checked offline. Allowed up to the **offline debt cap** — default **20 000 ֏** per customer per outage (§6.11) — then flagged for owner review on sync (§14.6) |
| Park a basket | ✅ | Queued like anything else — but **no other till can resume it until this one syncs** (§12.1), because until then the basket exists only on this device |
| Repayment | ✅ | Additive; allocation is a projection and is re-derived on sync (§10.6) |
| Sale return, against a sale made on **this** device | ✅ | Queue-drained and idempotent (§14.3). The original sale is in local state, so §6.5's "start from the original" holds |
| Sale return, against any **other** sale | ❌ | The catalogue cache holds products and customers, not sales (§15.4) — there is nothing to start from. Block clearly rather than offer a blind return, which is admin-only for good reason (§6.5) |
| Cash movement (`PAY_IN`/`PAY_OUT`/`DROP`/`REFUND`) | ✅ | Queue-drained and idempotent. `NO_SALE` needs re-auth and therefore the server (§16.3) |
| Price change, stock adjustment, blind return | ❌ | Each needs admin re-auth, and PINs are verified server-side and never in the client (§16.2) — so re-authentication is impossible offline. All three are server-dependent anyway, so nothing is lost that was not already blocked |
| Discount above the ordinary cap | ⚠️ capped | The one re-auth case that is **not** otherwise server-dependent: it happens mid-sale, at the counter, with a customer waiting. Allowed up to the **offline discount ceiling** — default **10%** (§6.11) — then flagged for owner review on sync; above the ceiling it is refused. Without this the till would have to block the sale, which rule 1 forbids, or cache a PIN verifier on the device, which §16.2 forbids |
| Receiving, stocktake, price change | ❌ | Needs authoritative stock; block clearly |
| Reports | ❌ | Server-computed |

### 14.6 Conflicts
Accept and flag; never reject. Each outcome has a named warning type (§8.5) and writes a
`ReviewFlag` row (§11), returned on the `200` that accepts the sale (§15.2) — a flag that exists
only in the server's own head is a flag nobody acts on.

| Conflict on sync | Warning type | Where it surfaces |
|:--|:--|:--|
| Stock would go negative | `insufficient-stock` | The product joins the recount list (§13.6) |
| Credit limit breached by a queued sale | `credit-limit-exceeded-on-sync` | The owner's needs-attention list |
| Product was deactivated meanwhile | `product-deactivated-on-sync` | The owner's needs-attention list |
| Price changed since the till cached it | `price-changed-on-sync` | The owner's needs-attention list. The sale stands at the price the customer was quoted and the receipt printed — never repriced after the fact (§15.3) |
| Device clock differs from the server's beyond threshold | `device-clock-skew` | The owner's needs-attention list, and the device is asked to resync. Unflagged skew corrupts aging, shift attribution and daily reports at once (§11 `StockMovement.seq`) |

**Never silently discard a recorded sale.** If one genuinely cannot post, it goes to the same
visible needs-attention list with a reason.

---

# Part C — The environment

## 15. API contracts

The client and the server are separate artifacts that ship as one release (§22), so the
contract between them is a rule, not an implementation detail. REST over the shop LAN, JSON,
same origin in production behind Nginx — with a single exception, the import upload (§15.4),
which is multipart because it carries a spreadsheet.

### 15.1 Conventions

- **Base path `/api`, always relative.** Never a hardcoded LAN IP — the app would break the
  moment the router hands out a different lease (§22).
- **Ids are client-generated UUIDv7 and travel in the body** (§11, §14.3). A `POST` carries the
  id of the thing being created; the server does not assign it.
- **Money and quantity are integers on the wire**, exactly as in §10.1 — never a decimal, never
  a string. A JSON number is a double; drams and milli-drams sit far below 2^53.
- **Timestamps are RFC 3339 UTC.** Shop-local conversion happens at the edges only (§20.3).
- **Every list is cursor-paginated** — `?limit=&cursor=`. Offset pagination over an append-only
  ledger silently skips rows as the ledger grows underneath it.
- **The server never returns a raw ORM object** (§16.5). Every response passes through an
  explicit shape, which is what makes the cost-stripping rule enforceable in one place instead
  of at every endpoint.

### 15.2 Errors — RFC 7807

Every failure returns `application/problem+json` with a machine-readable `type`. The client
maps `type` to Armenian; the server never sends user-facing prose, because the language of the
UI is not the API's business (§20.3).

```
{ "type":   "https://simon.local/errors/credit-limit-exceeded",
  "title":  "Credit limit exceeded",
  "status": 422,
  "customerId": "018f…", "limit": 50000, "current": 45000, "wouldBe": 62000 }
```

| Status | When | Client behaviour |
|:--|:--|:--|
| `400` | Malformed — not valid JSON, or the wrong shape | A bug. Park it in the outbox and surface it (§14.4); never retry |
| `401` | No session, or expired | Re-authenticate in place; the basket survives (§16.3). **From the outbox drain it is held and retried after the next sign-in, never parked** — the sale is already complete and the goods already gone (§14.4) |
| `403` | Authenticated but not permitted | Say what is needed; offer admin re-auth where that would help |
| `404` | No such record — `not-found` (§8.5) | Because nothing financial is ever deleted (§10.7), a `404` means *never existed*. A retired record still resolves: a product is deactivated, a basket is `VOIDED`, and both open normally |
| `409` | **Not used.** Never for an idempotent replay (§14.3), and no resource carries a version to conflict on. Listed so it is not reached for by reflex | — |
| `422` | Valid shape, invalid business state: credit limit, strict-mode negative stock, over-return | Actionable; the till keeps selling (rule 1) |
| `423` | The account is locked after repeated PIN failures (§16.2) — a *state*, not a rate | Show the minutes remaining; any admin clears it in one action |
| `429` | Rate limited — too many attempts too fast on the PIN path (§16.2) | Show the wait and count it down |
| `5xx` | Server or database failure | Retry with backoff; never drop the sale (§14.4) |

**Why there is no optimistic concurrency.** A single writer (§13.1), client-generated ids, and
an append-only ledger between them remove most of the need. For the little that remains — two
admins editing one product's price in the same minute — last write wins, and both edits survive
in `PriceHistory` and `AuditLog` (§10.7). For a shop with one or two admins that is a better
answer than a conflict dialog nobody can act on, and it is a decision rather than an omission.

**Not every problem is an error.** A request that succeeds while something is wrong with it —
stock short of what was just sold, a queued sale that breaches a limit it could not check while
offline (§14.6) — returns `200`
with a **`warnings[]`** array of `{ type, … }` objects drawn from the same `type` vocabulary as
§8.5. A warning never blocks; a blocking condition is a `422`. **The same `type` is never both**,
so a client can never mistake one for the other, and rule 1 cannot be broken by a status code
chosen carelessly.

**Every warning must correspond to durable state.** A warning is read back from what the
transaction wrote — the `ReviewFlag` row (§11, §14.6) — never re-evaluated against the
request. This is what makes a replay (§14.3) reproduce the original
response rather than a fresh opinion about state that has since moved. It also gives a rule with
teeth: **a warning with no durable trace is a bug**, because it cannot survive the retry it was
most likely to be lost in. A recount flag that exists only inside a dropped HTTP response is a
recount that never happens.

**`422` is the one that matters.** It carries the numbers the user needs in order to decide, as
fields rather than inside a sentence, so the client can build a screen from them instead of
printing a paragraph.

### 15.3 The queue-drained endpoints

These four are what §14.3's idempotency rule binds. Each takes a client-generated id, each
returns the stored document with `200` on replay, and each is safe to send twice.

| Endpoint | Body carries | Commits in one transaction (§13.1) |
|:--|:--|:--|
| `POST /api/sales` | `id`, `status` (`HELD` or `COMPLETED`), `shiftId`, lines, payments, `customerId?` | **`HELD`** parks the basket and posts to no ledger at all. **`COMPLETED`** commits sale → lines → payments → stock movements → debt charge → audit, in one transaction |
| `POST /api/sale-returns` | `id`, `originalSaleId`, `shiftId`, lines (each `saleLineId`, `qty`, `restock`), tenders (each `method`, `amount`) | return → movements at the **original** unit cost → refund tenders, apportioned per §12.4 → cash movement of type `REFUND` and/or credit `ADJUSTMENT` → audit |
| `POST /api/debt-payments` | `id`, `customerId`, `amount`, `allocations?` | payment entry → allocations → cash movement → audit |
| `POST /api/cash-movements` | `id`, `shiftId`, `type`, `amount`, `reason` | cash movement → audit |

**What the server recomputes, and what it accepts.** §15.1 says the server never returns a raw
ORM object; it must equally never *store* one. On `POST /api/sales`:

| Field | Server behaviour |
|:--|:--|
| `lineTotal`, `taxTotal`, `subtotal`, `total` | **Recomputed** from `qty`, `unitPriceMdram`, the line discount and the snapshotted rate, per §10.1 and §10.8. A client-supplied total is read for comparison and never trusted; a mismatch beyond rounding is a `400`, because it means the two sides disagree about arithmetic that `@simon/shared` owns on both |
| `unitCostMdram` | **Server-supplied.** Snapshotted from the authoritative average at commit; never sent by the client, which would be both a trust hole and a cost leak (§16.5) |
| `discountAmount`, `priceOverridden` | **Validated against the role's cap** (§12.1). Above it without a matching admin re-auth: `422 discount-above-cap`. A price override is measured against the catalogue price and capped identically |
| `unitPriceMdram` | **Accepted as quoted.** An offline till prices from a cache that may be days old, and the receipt is already in the customer's hand — repricing it afterwards would break §14.2's bargain. Divergence from the catalogue raises `price-changed-on-sync` and a `ReviewFlag` (§14.6), never a rejection |
| `businessDate`, `seq`, `number` | `businessDate` and `seq` are **server-stamped** (§11). `number` is the device's, because a till must number a sale with the server unreachable (§12.1) |

That division is the whole answer to *"is the discount cap a control or decoration?"* — the cap
binds on the server, and the price the customer was quoted still wins.

Each responds with the stored document plus `warnings[]` (§15.2). A replay is detected **by
primary key *and target status*, inside the transaction that would otherwise write it** (§14.3) —
a post carrying a different status is a transition, not a retry — — checking first and writing
second is the same race as §13.1's oversell — and it returns both parts as they were, so the
second response is indistinguishable from the first.

### 15.4 Everything else

Read paths are ordinary and cacheable. Write paths outside the four above are not queued: they
need authoritative state, so they fail loudly rather than silently (§14.5).

| Area | Endpoints |
|:--|:--|
| Catalogue | `GET /products`, `GET /products/:id`, `GET /products/by-barcode/:code`, `POST`/`PATCH /products`, `POST /products/:id/barcodes`, `POST /products/:id/barcodes/:code/retire` — **never a delete**: a code on a two-year-old label must still resolve (§18, rule 4) |
| Customers | `GET`/`POST`/`PATCH /customers`, `GET /customers/:id/ledger`, `POST /customers/:id/merge` — re-points every `DebtEntry`, sets the absorbed record's `mergedIntoId` and `isActive = false`, and writes an audit row (§6.13) |
| Suppliers | `GET`/`POST`/`PATCH /suppliers`, `GET /suppliers/:id/ledger`, `POST /supplier-payments` |
| Buying | `POST /goods-receipts`, `POST /purchase-returns`, `GET`/`POST /purchase-orders` *(v2, §9)* |
| Sales *(read)* | `GET /sales?status=&shiftId=&from=&to=`, `GET /sales/:id`, `GET /sales/by-number/:number` — §15.3 creates sales and nothing here read them back. Returns start from the original sale (§6.5), a jammed printer reprints from the sale record (§8.2), held baskets are listed by time (§6.1), and shift close has to find every `DRAFT`/`HELD` one (§11) |
| Stock | `GET /products/:id/movements`, `POST /adjustments`, `POST /write-offs` — each writes a self-sourced movement (§11) — `POST /stocktakes` *(v2)* |
| Review | `GET /review-flags?resolved=false`, `POST /review-flags/:id/resolve` — the needs-attention list (§14.6), the recount list (§13.6), and what §8.5's `sync-failed` and §19.5's alerts open onto |
| Import | `POST /imports` (multipart, returns an `ImportBatch`), `GET /imports/:id` for per-row results (§19.1) |
| Admin *(`ADMIN` only, every route)* | `GET`/`PATCH /settings` (§6.11), `GET`/`POST`/`PATCH /users` (§7.1, §16.4), `GET`/`POST`/`PATCH /categories`, `GET /audit-log?entityType=&entityId=&from=&to=` — an audit trail nobody can read is a trail nobody is protected by (§10.7). The audit log is gated **as a route**, not stripped field by field, for the reason §16.5 gives |
| Shift | `POST /shifts`, `POST /shifts/:id/close`, `GET /shifts/:id/x-report`, `GET /shifts/:id/z-report` |
| Auth | `POST /auth/login`, `POST /auth/logout`, `POST /auth/reauth` (§16.3) |
| Sessions | `GET /sessions` and `POST /sessions/:id/revoke` — **revoke, not delete**: `Session.revokedAt` (§11) is the record of who was signed in, on which device, until when, and it is what an owner needs after a theft. An `ADMIN` sees who is signed in on what and revokes it, which is what §16.3 means by *revocable*; a dismissed worker's till is otherwise still logged in. `POST /session/mode` enters and leaves practice (§19.4) |
| Lockout | `POST /auth/unlock` — any `ADMIN` clears another user's lockout in one call (§16.2). `POST /auth/recover` redeems the owner's single-use recovery code when the locked-out person is the only admin, and reissues it |
| Reports | `GET /reports/:name?from=&to=&groupBy=` — `ADMIN`-gated wherever they carry cost (§16.5) |
| Sync | `GET /catalogue/snapshot?since=` — rows whose `updatedAt` is newer than `since` (§11); feeds the IndexedDB cache (§14.4) |
| Health | `GET /health` — §19.5 |

`GET /products/by-barcode/:code` is the hottest path in the system (§11) and the only endpoint
with a latency budget of its own (§21).

---

## 16. Security & access control

### 16.1 Threat model
Realistic threats, in order: a worker viewing average cost, margin, or supplier terms — §16.5
scopes the one narrow exception, `STOCK` entering invoice costs; a worker voiding or
discounting their own sales to cover cash theft; anyone on the shop Wi-Fi (including
customers) reaching the API; loss or theft of the host PC; a failed disk with no working
backup. **Remote attackers are a distant concern — insiders and hardware failure are the
real ones**, and the controls are aimed at them.

### 16.2 PIN authentication
Workers enter a short PIN on a shared device many times a day; a password would be on a
sticky note beside the till within a week.

- Verified **server-side** against a slow hash (argon2/bcrypt). Never compared in the client,
  never stored in `localStorage`, never logged.
- Because the keyspace is tiny, the numbers are stated here rather than left to whoever writes
  the endpoint: the PIN is **4–8 digits**; **5 consecutive failures** lock the user for
  **15 minutes** (`423`); attempts are limited to **10 per minute per device** (`429`); and the
  hash is argon2id tuned to cost **≥ 250 ms** on the host. The login path is not hot, so a slow
  hash costs nothing anyone will notice.
- **A lockout must never stop the shop** (rule 1). Three ways out, in order of likelihood: any
  `ADMIN` clears it from the till in one action; the lock expires by itself in 15 minutes; and
  if the locked-out person *is* the only admin, the owner's recovery code from setup (§7.1)
  clears it — generated once during the wizard, shown once, stored only as
  `User.recoveryCodeHash` (§11), single-use, and reissued the moment it is spent. A worker locked out in front of a queue with no route back is precisely the
  failure rule 1 forbids — and the reason A9 (§24.2) is an assumption worth testing.
- **PINs are per-user, never shared.** A shared PIN destroys the audit trail, which is the
  entire point of having one.

### 16.3 Sessions
Opaque server-issued token, per-device, revocable — a `Session` row (§11) holding the token's
**hash**, its device, its mode and the shift it belongs to, because every one of those words
needs somewhere to live. **Sessions end at shift close**: a till left logged in overnight is the
most common real breach in retail.

Idle timeout is **15 minutes on the till** and **8 hours on the owner's dashboard** — short
because the till is shared and left on a counter, long because the dashboard is one person's own
machine. **A re-authentication prompt never discards a basket** (§6.1); it sits on top of one.
Re-authentication (admin PIN) is required for: discount above threshold, blind return (no
original sale, §6.5), price change, stock adjustment, and opening the drawer outside a sale.

**The session and device rows are written at most once a minute per device, and never inside a
sale's transaction.** `Session.lastSeenAt` moves only when it is more than 60 seconds stale — a
15-minute timeout does not need second-level accuracy — and the client reports **both**
`Device.outboxDepth` and `Device.parkedDepth` (§11) on a one-minute heartbeat, plus once more when
the queue reaches zero, not on every call. Such a
write on each
barcode scan would put a write on the hottest read path in the system (§11) against a single
writer (§13.1), which is how a till starts returning `SQLITE_BUSY` on the one screen §21 says
must never show it.

### 16.4 Roles
| Role | May |
|:--|:--|
| `WORKER` | Sell, take repayments, open/close own shift |
| `STOCK` | Worker, plus receiving, stocktake, write-offs. Enters invoice unit costs; never sees `avgCostMdram`, margin, or supplier terms |
| `ADMIN` | Everything: cost, margin, prices, users, settings |

### 16.5 Field-level authorization
The gap easiest to leave open and the most commercially damaging.

`avgCostMdram`, margin, and supplier payment terms are **stripped server-side** for every
non-`ADMIN` token — on list, search, detail, report, export, and in any error message that
echoes the record. Never return a raw ORM object.

**One deliberate exception.** A `STOCK` token may read and write `unitCostMdram` on the
purchase documents it creates — `GoodsReceiptLine`, `PurchaseOrderLine` — because those
figures are copied off the paper invoice in the user's hand, and concealing a number someone
is currently typing is theatre, not a control (§6.7). The exception is scoped to those lines
only. It never extends to `Product.avgCostMdram`, to `SaleLine.unitCostMdram`, or to any
margin, COGS, or valuation report. A `WORKER` token gets no cost field anywhere at all.

**Field-level stripping cannot reach inside an opaque snapshot.** `AuditLog.before` and `after`
hold whole records as JSON, so an audited price change or stock adjustment carries
`avgCostMdram` inside a value no field filter inspects. The audit log is therefore **`ADMIN`-only
as a whole route** (§15.4) rather than stripped field by field — the one place in this system
where the control is the endpoint and not the shape. **Anything that stores a record snapshot
inherits that rule**, so a future diff, export or replay feature is gated the same way rather
than trusted to a filter that was never designed to see inside it.

**Hiding cost in the UI is not a control.** §27 tests this explicitly.

**And neither is capping a discount in the UI.** The principle above is about *reading* what you
should not see; it applies with equal force to *writing* what you should not set, and the write
side is the more expensive one. A discount cap, a price override limit and a line total enforced
only in the client are enforced only against the client — and §16.6 says in bold that `curl`
ignores everything a browser respects. §15.3 therefore fixes what the server recomputes and what
it merely accepts, and §27.28 tests it the way §27.9 tests this paragraph. The two criteria are
deliberately mirror images: it took this long to notice that only one of them existed.

### 16.6 Network
The API binds `0.0.0.0` to serve phones, which means every device on that Wi-Fi can reach
it. One mitigation is required and the rest are defence in depth:

1. **TLS with a certificate trusted on staff devices — required, and it ships in v1.** It is also
   what a secure context needs, so it is what makes camera scanning work at all (§18).
2. A separate SSID or VLAN for staff devices. The better first line where a shop has one.
3. WPA2/WPA3 with a password not shared with customers.

**Decision (2026-09-10): TLS ships in v1 regardless of how the shop's Wi-Fi is arranged**, which
is why it heads the list above rather than trailing it. Making it conditional meant §26 Q6's
answer could add work late, and §18's camera path fails *silently* without a secure context — the
worst kind of failure to discover in a shop. Doing it unconditionally removes a dependency, fixes
the camera, and costs one certificate on the host.

**There is no plain-HTTP deployment.** An earlier draft allowed one as a written, accepted risk;
that escape hatch is closed, because a risk a deployment may accept is a risk every rushed
deployment will accept.

**CORS is not a security control.** It restricts browsers; `curl` ignores it entirely.

---

## 17. Regulatory & fiscal compliance (Armenia)

> **This section must be verified with a practising Armenian accountant or tax adviser
> before launch.** The general shape below is stated with confidence; specific thresholds,
> rates, and current-year procedures change and are deliberately **not** asserted here.

For a product recording retail cash sales in Armenia, this is the largest single risk to the
venture — it can make the software unusable regardless of quality.

**What must be established:**

1. **Cash register (ՀԴՄ) obligation.** Retail sales are generally required to be recorded
   through a fiscal cash register registered with the **State Revenue Committee (ՊԵԿ)**,
   issuing a fiscal receipt. Determine: whether the target store size is obliged, which
   certified devices or software are approved, and whether a third-party POS may drive an
   ՀԴՄ or must integrate with a certified fiscal module.
2. **Tax regime.** Armenia operates **VAT (ԱԱՀ)** at a standard rate of 20%, alongside a
   **turnover tax** regime and a **micro-business** regime for smaller taxpayers. Simon must
   know which regime the shop is in, because it determines whether shelf prices are
   VAT-inclusive, whether tax is broken out on the receipt, and which reports the accountant
   needs. Model `taxCategory` from the start even if v1 ships single-rate.
3. **Invoices & waybills.** Confirm obligations around electronic tax invoices for B2B sales
   and goods-movement documentation, and whether Simon must produce or merely export them.
4. **Record retention.** Confirm the required retention period; it sets the backup policy
   in §19.2.
5. **Personal data.** The Nisya ledger holds names, phones, and debts — personal data under
   Armenian law. Confirm consent and retention obligations.

**Product implication.** The architecture assumes a **fiscal adapter** exists —
`Sale.fiscalReceiptId` is reserved for it — even though v1 may run without one. Retrofitting
fiscalisation into a system that never anticipated it means rewriting the checkout path.

**Interim position for v1.** Simon operates as an internal management and stock system
alongside whatever fiscal device the shop already uses, with integration scheduled for v2.
**This must be stated to every pilot store in writing.**

That position is a *bet*, not a finding — **A10** in §24.2, alongside the six other fiscal
assumptions this section's uncertainty forces. §26.1 is how that meeting is run. Nothing in this
section is confirmed until answers come back and land in §24.2.

---

## 18. Hardware & peripherals

| Device | Approach |
|:--|:--|
| **Barcode scanner** | USB/Bluetooth HID keyboard-wedge. No driver, no integration code, ~15–25k ֏. **Support this first** |
| **Phone camera** | `html5-qrcode` / `react-zxing`. ⚠️ Requires a **secure context** — on a plain-HTTP LAN IP, camera access fails *silently* on Android and iOS. **Resolved 2026-09-10:** TLS ships in v1 (§16.6), so the secure context exists and the camera works. HID remains the primary path |
| **Receipt printer** | 58/80 mm thermal, ESC/POS. Browsers cannot drive these — **the backend owns printing** (network printer on TCP 9100, or USB on the host). Design it as a service from the start |
| **Label printer** | Internal barcodes (Code128) for unbarcoded goods. v2 |
| **Cash drawer** | Opens via the printer's kick-out port. **The pulse is a separate ESC/POS command, not a side effect of printing** — the backend owns both (§18, receipt printer) and simply does not emit it on a reprint. Without that separation the reprint offered after a printer jam (§8.2) would open the drawer for anyone, and §16.3's re-authentication for opening it outside a sale would be a control enforced at the API and bypassed at the hardware. A deliberate no-sale open is its own command: re-auth, then a `NO_SALE` movement (§11) |
| **Scale** | Manual entry in v1; weight-embedded EAN-13 (`2x` prefix) later |

**Internal barcodes.** Goods arriving without a barcode get a generated internal code and a
printed label, using a reserved prefix so they are distinguishable. Retired codes are never
reused — historical sale lines reference them. Without this, "scan to sell" is unusable for
much of a hardware store's catalogue.

---

## 19. Data lifecycle & operations

### 19.1 Onboarding & migration
§7.3 has the user-facing design; **this is the normative rule.** CSV/Excel import covers
products, opening stock, customers, and **opening debt balances with their original dates** —
posted as `OPENING_BALANCE` movements and back-dated `CHARGE` entries, so aging is correct on
day one (§10.6).

Import is **idempotent, re-runnable, reports per-row errors, and never applies partially.** A
half-built catalogue is worse than no catalogue, because nobody can tell which half is missing.

The mechanism is `ImportBatch` and `ImportRow` (§11): every row carries a `naturalKey` for its
kind, and a key already `APPLIED` in any batch is skipped rather than applied again. Without
that, a second run of the opening-debts file doubles every balance in the shop — and §27.5
checks those balances against the paper book, where a doubled debt is not a bug the owner
forgives.

### 19.2 Backup & restore
"A daily export at 20:00" loses a day of trade and copies a live SQLite file unsafely.

- **Consistent snapshots** via SQLite's backup API or `VACUUM INTO` — never a raw file copy
  of a database being written to.
- **Hourly** during trading hours, **daily** at close, grandfather-father-son rotation.
- Destinations: local disk **plus** a removable USB drive, matching how these owners already
  think about backups. **Encrypted**, because they contain customer PII.
- **A one-click restore path and a documented restore drill.** An untested backup is not a
  backup — the owner should have restored once, in training, before go-live (§27.10).
- Separately: human-readable CSV/Excel exports for the accountant. A different job from
  disaster recovery; both are needed.

### 19.3 Growth
**The design target is one shop of 500–3,000 products turning over 50–150 sales a day** — which is where a busy shop reaches ~100k sale lines a year *(assumption A7 — §24.2)*. §26 Q3 confirms the pilot sits in that band rather than deciding anything: above it, indexes and query plans want a second look, not a different architecture. SQLite handles this
comfortably. Log rotation
matters — this is someone's C: drive, and it holds the database too.

---

### 19.4 Practice mode data

§7.2 promises that practice writes nothing to the real ledgers. How that promise is kept is an
architectural decision, not a filter.

**A second database file, not an `isPractice` column.** Entering practice mode opens a separate
SQLite file seeded with a copy of the catalogue — products, barcodes, prices, customers,
current stock — and every write goes there. Leaving practice mode deletes the file.

A boolean on every transactional row was considered and rejected. It makes correctness depend
on remembering a `WHERE` clause in every query, report, export and reprojection job, and a
single omission silently poisons the owner's numbers. That is the same class of mistake as
§16.5's cost leak, and it has the same answer: make the wrong state unrepresentable rather
than filtered out (rule 7).

Consequences, all of them requirements:

- **Practice is per-device and per-session, never global.** One worker practising must not put
  the shop into practice mode. `Session.mode` carries it (§11) and the server routes on that
  row, so two people on two phones can be in different modes at the same moment.
- **The outbox is tagged.** A queued practice sale carries the mode and is discarded on exit —
  never drained into the real database (§14.4). This is the sharpest failure risk in the
  feature and deserves its own test (§27.19). It is also **excluded from `Device.outboxDepth`**
  (§11): practice sales are discarded rather than sent, so counting them would give the owner a
  queue figure that can never reach zero and an §19.5 alert that never clears — which is how a
  person learns to ignore alerts.
- **Reports, the fiscal adapter and the cash drawer always act on the real database.** A
  practice sale prints only a receipt watermarked *ՓՈՐՁՆԱԿԱՆ*, never opens the drawer, and
  never issues a fiscal receipt (§17, §18).
- **Entry and exit are audited in the real database** — actor, timestamp, duration — as
  `AuditLog` rows. Without them, "I was in practice mode" becomes an unfalsifiable excuse for a
  real discrepancy, which inverts the purpose of §10.7.
- **Practice cannot be entered with a basket open**, and a real held sale (§6.1) is never
  visible from inside it. Two baskets that look identical and mean different things is exactly
  the confusion rule 7 exists to prevent.
- **No transactional table gains a column for this.** The only row in §11 that knows practice
  exists is `Session.mode`, and deliberately so: it is already per-device and already read on
  every request. No sale, movement, debt entry or shift carries a practice flag, which is the
  entire point of the second file.

---

### 19.5 Diagnosis without remote access

Simon runs on a PC in a back room, with no remote access, by design (§24.1). Everything needed
to work out what is wrong must therefore be readable by the owner, over the phone, by someone
who does not know what a log is.

- **`GET /health`** returns, in one payload: version, uptime, database size, WAL checkpoint age,
  time **and size** of the last successful backup — the newest `OK` row in `BackupRun` (§11);
  a backup suddenly a tenth of the database is a failed backup that reported success — outbox depth
  across all devices — **sales awaiting delivery**, with parked baskets counted beside them rather
  than inside them (§14.4), summed from the `Device` rows each client updates on its heartbeat,
  one row per till so a phone counts once however many times it has been signed into — and the
  count of open `LEDGER_CACHE_DRIFT` flags (§10.4, §11). Every figure is a query over a table,
  because a diagnostic that cannot be recomputed is a rumour. It is the first thing support asks
  for.
- **A Diagnostics screen in Settings** renders exactly that, in Armenian, with a **copy** button
  and a *"save this for support"* that writes a file. Nothing leaves the shop unless the owner
  sends it himself (§1).
- **Structured logs** via `pino` to a rotating file on the host (§22): one line per request —
  method, route, status, duration, user id, and for the four queue-drained endpoints (§15.3) the
  document id. Never a PIN, never a hash, never a customer's name or phone number.
- **Log rotation is a requirement, not hygiene.** This is someone's `C:` drive and the database
  is on it (§19.3).
- **Three alerts reach the owner in-app**, because nothing else can reach him: no successful
  backup in 24 hours; ledger-vs-cache drift detected (§10.4); a **sale** older than an hour in any device's outbox — parked
  baskets are excluded, since one may sit there all afternoon by design (§14.4). Each says what to do, not what happened.
- **The error boundary offers a recovery, not a stack trace.** A crash on the till offers
  "return to the sale" and preserves the basket; the trace goes to the log.
- **The version is on the Settings screen** and every release is a git tag (§22). "Which version
  are you running?" has to be answerable in five seconds by someone who does not know what a
  version is.

---

### 19.6 Personal data

The Nisya ledger holds names, phone numbers and debts. That is personal data under Armenian law
(§17, item 5), and it is the *only* personal data Simon holds — there is no marketing list, no
purchase profile, no analytics (§1).

- **What is held, and why.** `Customer.fullName` and `phone` identify who owes what; `DebtEntry`
  rows are financial record. Everything else on the row is operational — a credit limit, a block
  flag, an activity flag, a merge pointer, a search key (§11) — and there is no marketing list,
  no purchase profile and no behavioural data of any kind. The owner should be told plainly not
  to put anything sensitive in the free-text `notes`.
- **Lawful basis.** Recording a debt is recording a transaction the customer asked for, so the
  basis is very likely the contract rather than consent — **but this must be confirmed** (§17,
  item 5) before the first pilot store, not after it.
- **Retention follows the financial retention period**, not a shorter one. A debt ledger that
  erases itself on a privacy schedule stops being an accounting record. §17 item 4 sets the
  period; §19.2's rotation must not undercut it.
- **Erasure is anonymisation, never deletion** (§6.13). `anonymisedAt` is set, name and phone go
  null, and the ledger rows with their amounts and dates remain against the anonymised customer.
  That answers an erasure request without destroying the shop's books, and it is the only way to
  do both. The row is the one place `fullName` may be null, which §11's validation states
  explicitly rather than leaving to be discovered.
- **Backups contain PII and are therefore encrypted** (§19.2). A USB stick of customer debts
  left in a drawer is the most probable breach in this whole system, and it is absent from
  §16.1 only because it is a data-handling failure rather than an attack.
- **Logs never contain PII** (§19.5): no name, no phone, no PIN, no hash. Customer id only.
- **Export on request** is already built: `GET /customers/:id/ledger` (§15.4) returns everything
  held about one person, and the Diagnostics screen can write it to a file to hand over.

---

## 20. Reporting & language

### 20.1 Owner reporting
Per §5.3 and §6.10. Every figure drills to its source events (rule 3).

### 20.2 Report catalogue
Sales by period/product/category/worker · **margin by product** · COGS and stock valuation
at cost · **debtor aging 0–30/31–60/61–90/90+** · supplier payables · **item history** — what
changed, when and who, per product, and never called a movement anywhere the owner can see it
(§4.3, §6.16) · shift Z-reports with variances · discount by worker · write-offs by reason · stock turnover
and dead stock · **voids and returns by worker**, beside discount by worker and for the same
reason · **the audit trail**, filtered by person, date or record (§10.7). All exportable.

**Margin reports carry two columns wherever a cost has been corrected**: *as booked* — the
`unitCostMdram` snapshotted onto each sale line, which never changes (§10.5) — and *restated*,
recomputed through any `CostCorrection` covering that period (§11), with a footnote naming the
correction. A single figure cannot serve both: the snapshot is what the books say and must stay
reproducible, while the restatement is what the shop actually earned. Showing only the first
leaves a known-wrong number standing for ten years; showing only the second silently rewrites
history, which is the failure §10.5 exists to prevent. **A margin is never reported for a line
whose cost was unknown** (§10.5) — such lines are counted and listed separately, because a
quick-added product sold before it was ever received has no cost basis, and reporting it as 100%
margin is worse than reporting nothing.

### 20.3 Armenian language & search
- Full Armenian UI. **All strings in resource files** — none hardcoded in components. The
  backend returns machine-readable error `type` values; the client maps them to Armenian.
- **Search must tolerate Latin-typed Armenian.** Workers frequently type on a Latin keyboard
  layout; searching `malukh` must find `մալուխ`. Store a normalised `nameSearch` (Armenian
  folded + transliterated) and match against both, in both directions, by substring.
  Overlooking this makes search feel broken to the people using it every day.
- Normalise with NFC first — composed and decomposed forms will not otherwise match. Fold
  homoglyphs from mixed-layout typing, and strip Armenian punctuation marks (՞ ՛ ՟) in the
  normalised form.
- **AMD formatting** — `֏` after the amount, space as thousands separator. Verify
  `Intl.NumberFormat("hy-AM")` output rather than assuming it.
- **Armenian pluralisation** differs from English — a noun after a numeral often stays
  singular. Use `Intl.PluralRules("hy")` with per-category keys, and have a native speaker
  check it. Concatenating `count + " " + word` reads as machine translation.
- **Shift and report boundaries use shop-local time**, not UTC. A Z-report split at midnight
  UTC is wrong for Yerevan (UTC+4).
- **Armenian text runs 10–30% longer than English.** Never fix a width to an English string.
  Verify the chosen font covers the full Armenian block including `֏`; many otherwise good UI
  fonts have incomplete or poorly-hinted Armenian glyphs.

---

# Part D — Delivery

## 21. Non-functional requirements

| Area | Requirement |
|:--|:--|
| Scan latency | Barcode → line rendered **< 200 ms** (p95) |
| Checkout | 3-item cash sale completable in **< 15 s** |
| App start | Interactive **< 3 s** (cold, p95) on the reference device |
| Concurrency | 3 tills selling simultaneously plus the owner's dashboard: **no `SQLITE_BUSY` ever surfaced to a user**, p95 write transaction **< 50 ms**, measured over 10 minutes of continuous three-device selling |
| Availability | Selling continues through a LAN drop (§14) |
| Durability | **A sale acknowledged to the worker is never lost to a client, app, or network failure** (§14.2). Against loss of the host itself the bound is the backup interval, not zero: RPO ≤ 1 hour in trading hours, RTO ≤ 1 hour (§19.2) |
| Devices | Android Chrome (primary), iOS Safari, desktop Chrome/Firefox |
| Accessibility | **WCAG 2.2 AA.** Touch targets ≥ 48 px; contrast ≥ 4.5:1 for text and ≥ 3:1 for UI components and the status strip; the full till flow reachable one-handed; text scalable to 200% with no loss of function or content |
| Correctness | Money, costing, allocation, rounding under unit + property tests; ledger-vs-cache reconciliation in CI; **a lint rule that fails the build on a float literal in money or quantity code** — which is what §23.1's "no float anywhere in the tree" is checked by, and what §25 counts on |

**The reference device** is a mid-range Android phone no newer than three years old, on the
shop's own Wi-Fi, with the catalogue at pilot size. **Every number in this section is measured
there** — a budget measured on a desktop over localhost is always flattering and always wrong.

### 21.1 Learnability targets
Measured with real users during the pilot, not estimated:

| Metric | Paper baseline | Target |
|:--|:--|:--|
| Time for a new worker to complete their first unaided sale | Immediate — a notebook needs no training | **< 10 minutes** |
| Worker training to productive | None | **< 15 minutes** (§7.6) |
| Owner setup to first real sale | None | **< 30 minutes** |
| Taps for a 1-item cash sale | Two written lines | **≤ 4** (scan, pay, cash, done) |
| Worker error rate at end of week 1 | Unknown — the notebook does not record its own mistakes | **< 2%** of sales needing correction |
| Owner able to answer "what did I earn today" unaided | Not at all, or a monthly estimate from the accountant | **week 1** |

Simon starts behind paper on the first three rows and ahead on the last three. That trade is
the whole product, and stating the baseline is what makes it arguable rather than assumed.

On the reference device (§21). A learnability number produced at a desk is not a learnability
number.

### 21.2 Adoption & business KPIs

§21.1 asks whether a person *can* use Simon. These ask whether the shop *does*, and whether it
was worth what it cost. Each baseline is captured at a named moment — go-live, migration day, or
during the pilot's parallel fortnight (§23) when both systems run side by side — and the rows
that have no baseline to capture say so. The fortnight remains the only honest chance to measure
the notebook, and it does not come round again.

| KPI | Baseline | Target | Measured by |
|:--|:--|:--|:--|
| Share of sales rung through Simon rather than paper | 0% at go-live | **> 95% by week 4** | Simon's count against the worker's notebook, daily through the parallel fortnight |
| Worker still using Simon unprompted | **n/a** — the notebook has no equivalent to stop using | **week 4, without being asked** | Observation. The single most informative number here (H2, §24.3) |
| Owner opens the dashboard | **n/a** — there is no dashboard to open today | **≥ 5 days a week by month 2** | Session log (§19.5) |
| Debt over 90 days as a share of total debt | Captured from the paper book on migration day, before the first sync | **falls across three months** | §20.2's aging report (H3, §24.3) |
| Write-offs discovered per month | **0 discoverable** — the notebook cannot answer this question at all | **surfaced at all**, then falling | §13.5 reason codes |
| Time from shift close to knowing the day's profit | Never, or the accountant's monthly visit | **< 1 minute, the same evening** | §6.9 |
| Shop still using Simon at month 3 | **n/a** — retention has no "before" | **yes** | The only retention number that matters at this scale |
| Support calls per shop per month | **n/a** — measured from go-live; month 1 sets the reference | **< 2 by month 3** | Support log (§26 Q8) |

**Every KPI above has a baseline, a capture point, or a stated reason it cannot have one.** The
four marked *n/a* measure behaviour that does not exist before Simon does — there is no prior
value for "still using it" — and the rest are captured at a named moment: go-live, migration
day, or during the parallel fortnight. A blank in this column would mean the KPI was not thought
through; an explicit *n/a* means it was.

---

## 22. Architecture

Constraints retained: **decoupled client–server, local-only, no Next.js, no SSR.**

```
/packages/shared  money, units, shared types — imported as @simon/shared by both sides
/backend    Node.js + Express (REST), Prisma, SQLite (WAL)
            /domain    money, costing, allocation, units — pure, heavily tested
            /services  transactional use cases (sale, receipt, repayment)
            /routes    thin HTTP — validate, authorize, delegate
            /jobs      backup, cache reconciliation, reorder stats
/frontend   React + Vite, SPA (no SSR), Tailwind, vite-plugin-pwa
            IndexedDB catalogue cache + outbox queue
/docs       this PRD — ADRs and the operator runbook are Phase 1 deliverables
```

- **`/docs` holds this PRD, and nothing else yet.** One document is the source of truth; the
  ADRs and the operator runbook are Phase 1 deliverables (§23), and §27.10's restore drill
  cannot be rehearsed until the runbook exists.
- **One repository, npm workspaces.** Frontend, backend, and `packages/shared` ship as a
  single artifact — Docker Compose behind one Nginx, later one Tauri executable. A shop
  installs "Simon 1.4.0", not a frontend and a backend with separate versions.
- **`packages/shared` holds the money module**, imported by both sides as `@simon/shared`.
  This is the load-bearing reason for a monorepo: §10.1's rules must exist exactly once, or
  the till will eventually display a total the server did not compute.
- **Business logic lives in `/backend/domain`**, not in routes or components. The test for
  correct layering: can the rule be unit-tested with no HTTP and no database?
- **Shared types** from one source, not two hand-maintained copies that drift.
- **Deployment:** Docker Compose (Nginx serving the built SPA + Express on one port) for
  phase 1; Tauri packaging for phase 2, so the owner double-clicks an icon instead of
  learning Docker.

**Recommended additions:** Zod (validate every request — a POS takes numeric input from
tired humans), Vitest + Supertest, `pino` structured logging, and a small in-house money
module built on §10.1.

---

## 23. Roadmap

| Phase | Release | Contents | Exit criterion |
|:--|:--|:--|:--|
| **0 — Foundations** | v1 | Monorepo split, Prisma schema, money/quantity/UoM domain modules with tests, auth & roles, audit log | Domain tests green; a movement can be posted and replayed. **§26 Q7 is answered** (2026-09-10): the schema carries a nullable `locationId`, so this phase is no longer gated |
| **1 — Sell** | v1 | Catalogue, barcode (HID + camera), till, split tender, held sales, shifts with denomination counting, receipt printing. **Plus §2.5's five shop visits, the first ADRs, and the operator runbook** | A real sale completes end-to-end on a phone in the shop, **and §2.4's rows read *observed* rather than *inferred*** |
| **2 — Trust** | v1 | Customers, debt ledger, allocation, repayments, aging, credit limits | Owner reconciles the digital ledger against the paper Nisya book |
| **3 — Buy** | v1 | Suppliers, receiving, landed cost, weighted average, payables, purchase returns | Margin report matches a hand-calculated check |
| **4 — Control** | v1 | Owner home with drill-down, reports, write-offs, velocity low-stock suggestions, backup/restore drill | Owner runs a month-end unaided |
| **5 — Adopt** | v1 | Setup wizard, CSV import, quick-add, practice mode, embedded help, PWA polish, offline queue | Pilot store runs a full month with no manual intervention, **and §21.1 and §21.2 hold figures measured in the shop** |
| **6 — Extend** | v2 | Stocktake sessions, purchase orders and automatic reordering, label printing, multi-location, Tauri packaging, fiscal adapter (§17) | Fiscal receipts issue from Simon; the owner counts stock without closing the shop |

Phases 0–5 are v1 exactly as §9 defines it; phase 6 is §9's v2 list. **§9 is the authority on
what ships in a release; this table only orders the building.**

### 23.1 Build order and dependencies

The table above orders **features** — things a shopkeeper can see. This orders **code**, and the
two lists are not the same, because several phases sit on one foundation.

Six layers. Nothing may depend on a layer below it in this table, and §22 gives the test for
whether the layering is right: **can the rule be unit-tested with no HTTP and no database?**

| Layer | What | Specified in | Needs | Done when |
|:--|:--|:--|:--|:--|
| **0 — Arithmetic** | Integer money, quantities, UoM conversion, tax extraction, weighted average, debt allocation. Pure functions in `packages/shared` and `/backend/domain` | §10.1, §10.2, §10.3, §10.5, §10.6, §10.8 | nothing | Property tests green on every rule, no float anywhere in the tree, **§27.4** — the margin on a product restocked twice reproduces by hand — and **§27.29**, which is §27.4's other half: a cost that was never known must seed rather than average against zero |
| **1 — Schema** | Every model in §11, the field conventions, the validation rules, the four lifecycles — and the second database file practice mode writes into | §11, §19.4 | layer 0, for units and scales | A movement can be posted and replayed (Phase 0's exit), and **§27.21** and **§27.31** — neither `decimalPlaces` nor a unit's conversion factor will change once movements exist, because both silently reinterpret every historical quantity |
| **2 — Services** | Transactional use cases: checkout, debt sale, repayment, returns, receiving, purchase returns, write-offs, shift close. Then the non-transactional ones: catalogue and opening-debt import, the reorder-stats job, and every report query | §13.1 **first**, then §12.1–§12.5, §13.2, §13.3, §13.5–§13.7, §10.4, §10.7, §19.1, §20.2 | layer 1 | Each commits in one transaction and is testable with no HTTP: **§27.2, §27.3, §27.5, §27.6, §27.7, §27.18, §27.20, §27.22, §27.23, §27.25, §27.26, §27.27, §27.30, §27.33** — all provable before a screen exists. The five added in 3.48 are the same kind of proof as the nine before them: drawer arithmetic that must account for a refund, a return that splits across tenders and carries its share of a discount, a ledger replay that reproduces both cached columns, and a restatement that leaves history untouched |
| **3 — HTTP** | Routes, Zod validation, RFC 7807 errors, response shaping | §15.1–§15.4, and **§16.5 built into the shaping from the very first endpoint** | layer 2 | **§27.9** — a `WORKER` token gets no cost field from any route — and **§27.28**, its mirror on the write side: the server owns sale arithmetic, so a client cannot set a line total or discount past the cap. The two are one rule about response and request shaping, tested in both directions |
| **4 — Access** | PIN, sessions, devices, roles, re-authentication, audit — and `Session.mode`, which is what keeps practice per-device rather than shop-wide | §16.2–§16.4, §16.6, §10.7, §19.4 | layers 1 and 3 | **§27.9**, **§27.28** and **§27.19** (practice leaves the real database untouched), plus every lockout path in §16.2 |
| **5 — Client** | Outbox, IndexedDB cache, the sixteen screens, the four input paths, the setup wizard and quick-add, Armenian | §14.3–§14.6, §6, §7.1, §7.4, §18, §20.3 | layer 3 | **§27.1**, **§27.8**, **§27.24**, **§27.32** and **§27.34**, plus the whole usability set **§27.11–§27.17** — all of it in a shop, none of it at a desk. The three added in 3.48 are what an outage actually produces: a sale that arrives after its shift closed, two tills that allocated the same charge while unable to see each other, and a queue that must tell a transient failure from a permanent one |
| **6 — Operations** | Backup, the restore drill, diagnostics, packaging | §19.2, §19.5, §22 | layer 1 — **except diagnostics**, which is an endpoint and a screen, so 3 and 5 | **§27.10** — restored onto a different machine, by the owner |

**Every criterion in §27 belongs to at least one layer above**, and most belong below layer 5.
No number appears in that sentence deliberately: it said "twenty-two" for eleven versions after
§27 grew to twenty-three, and a claim with a count in it is a claim that rots quietly. **§27.9 and §27.28 each belong to two on purpose**, and to the same two: the shaping
(layer 3) and the role system (layer 4) are two halves of one test, and passing either needs
both. They are the same rule read in opposite directions — §27.9 that a role cannot *see* a cost,
§27.28 that a client cannot *set* a price — so listing one in two layers and the other in one
would have been the asymmetry §16.5 spent a page arguing against. That is the point of the
column: §27.4's hand-calculated margin and §27.7's shift arithmetic are proofs about layer 0 and
layer 2, and waiting for a screen to run them means finding an error in the costing after
everything is already built on it.

Layer 6 is the one row that bundles unlike work: backup and packaging need nothing but the
schema and can start early, while §19.5's diagnostics are `GET /health` and a screen in Settings
and cannot start until there is an API to ask and somewhere to show the answer. Scheduling them
together is how two thirds of that row stalls.

**Three things sit across the layers rather than in one.** They are not rows because giving them
a row would suggest a phase where you do them:

- **Error handling (§8, §8.5).** Every layer raises them, layer 3 fixes the `type` values, and
  layer 5 renders them. The catalogue is frozen from layer 3 onward — an error type is a contract.
- **Personal data (§19.6).** A constraint on layers 1 and 2: which fields exist, which go null on
  erasure, and what never reaches a log.
- **The budgets (§21).** Measured at layer 5 on a real device, but *earned* at layers 0–3. A scan
  budget missed at layer 5 is almost never a client problem.

**What cannot be retrofitted.** Each costs nothing in layer order and a migration afterwards.
The list carries no count, for the reason the paragraph above gives about counts:

1. **Integer money (§10.1).** A float that reaches the database is not a bug fix, it is a data
   migration over records whose true values are already lost.
2. **Field stripping (§16.5).** It belongs in layer 3's response shaping, in **one** place. Added
   per-endpoint later it will be missed on one of them, and that one is the leak.
3. **The append-only ledger (§10.4).** A mutable `stockQty` written first cannot be made
   rebuildable later, because the movements that would rebuild it were never recorded.
4. **Idempotent submission (§14.3).** The client generating the sale id, the server keying on that
   id *and the transition it asks for*, and the legal-transition check are **the shape of the
   checkout write path** — not a queue bolted in front of it. Build checkout on server-assigned
   ids and the outbox does not extend it later, it rewrites it: the same path §21's latency budget
   was measured on, in the phase that was supposed to be polish. This item was missing from the
   list while §23 scheduled the queue into Phase 5 by its user value, which is genuinely low; its
   *retrofit* cost is not.
5. **Server-owned sale arithmetic (§15.3).** Whether the server recomputes a line total and
   enforces the discount cap is not a hardening pass — it decides whether every sale already in
   the database can be trusted. Added after the fact, the cap binds only sales made after the fix,
   and there is no way to tell which of the earlier ones were honest. It belongs in layer 3's
   response *and request* shaping, beside §16.5, for exactly the reason §16.5 is item 2.

**What is blocked, and by what.** **Nothing, as of 2026-09-10.** Q7 was answered; Q1, Q2 and
Q10 were unblocked by making the design absorb every answer rather than commit to one — a price
basis that is a setting (§10.8), a numbering scheme that supports pre-allocated blocks (§12.1),
and a fiscal adapter seam that has been reserved since v2 was written (§17). Each still *matters*,
and getting one wrong still costs a setting, a mode or a repositioning — but none of them now
stops anyone starting. Q11–Q14
change a setting rather than a design, and the remaining six can be answered while building.

| Question | Blocks | Latest it can be answered |
|:--|:--|:--|
| ~~**Q7**~~ — second shop within a year? | §11's schema: whether `StockMovement` carries a nullable `locationId` | **Answered 2026-09-10** — it does. Phase 0 unblocked |
| **Q2** — tax regime, prices inclusive? | Nothing. §10.8 supports both bases and §6.11 picks between them | Before the pilot — a wrong setting misprices everything |
| **Q10** — gapless receipt number? | Nothing. §12.1 supports device prefixes and pre-allocated blocks | Before the pilot |
| **Q1** — ՀԴՄ obligation? | Nothing in the build — the adapter seam exists either way (§17). It blocks **launch**, not work | Before the pilot store sells anything |

Q1, Q2 and Q10 are one conversation (§26.1). Q7 was answered on 2026-09-10.

---

**Pilot before scale.** One friendly store, running Simon in parallel with paper for two
weeks. Adoption by an actual worker under real queue pressure is the only meaningful
validation; everything before that is a hypothesis.

**The parallel fortnight has a job beyond validation, and it happens once.** It is the only
window in which the paper baseline can be measured, because afterwards there is no paper to
measure. Before it starts, someone must be named as responsible for capturing:

- **the one baseline that disappears if it is not taken** — the 90-day debt share, read off the
  paper book on migration day, before the first sync. Every other row in §21.2 already states
  its baseline or has none to state; this is the only one the shop can lose;
- **every §21.2 KPI's actual value** at the horizon its target names — week 4, month 2, month 3
  — including the four whose baseline is *n/a*, because having no baseline is not a reason to
  go unmeasured;
- the §21.1 timings, on the reference device, with the worker who actually works there;
- and the answers to A1, A2, A5 and A6 (§24.2), which the fortnight either confirms or breaks.

**A pilot that ships working software and no numbers has half failed**, and the half it failed
is the half that cannot be repeated.

Phase 5 does not exit until **§21.1's six timings and all eight §21.2 KPIs hold values measured
in the shop**, and §21.2's single capturable baseline — the 90-day debt share on migration day —
is a number. An *n/a* in the baseline column excuses the baseline, never the measurement.

**"The table has no blanks" is not the test.** A table can be filled in from a desk; an earlier
form of this gate said exactly that and could be satisfied by editing the document instead of
running the pilot.

---

## 24. Assumptions, hypotheses & constraints

The distinction is the point. A **constraint** is fixed and we design around it. An
**assumption** is a belief we are betting on and have not tested — if it is wrong, something
in this document is wrong with it. An **open question** (§26) is a thing we know we do not
know. This section exists to stop the middle category quietly hardening into the first,
which is what happens to an assumption written in the indicative mood.

### 24.1 Constraints — fixed; design around them

| Constraint | Consequence |
|:--|:--|
| 100% self-hosted; no vendor cloud, no subscription dependency | No remote telemetry, no remote support session, no server-side model. Diagnosis happens over the phone (§26 Q8) |
| One shop, one host PC, one SQLite database in v1 | A single writer; §13.1's transaction discipline is not a preference |
| Armenian UI; English code, schema and commits | Every string in a resource file (§20.3), and a native reviewer on the critical path (§26 Q9) |
| The worker's device is a cheap Android phone on shop Wi-Fi | §21's budgets are measured there, never on localhost |
| Money and quantity are integers (§10.1–10.2) | Unfixable once real data exists. This is the reason `packages/shared` exists (§22) |
| Decoupled client–server, no SSR, no Next.js | §22 |
| An ՀԴՄ obligation may exist and is not yet established | §17. The fiscal adapter seam is reserved whether or not it is ever used |

### 24.2 Assumptions — beliefs we are betting on

Each is stated as a bet, with what it would cost to be wrong and where it gets tested. The
pilot (§23) is the harness for all of them. **✓ confirmed · ~ partly settled · no marker still
open** — and a confirmed bet keeps its row, because knowing what was once uncertain is how the
next person judges whether it is still true.

| # | Assumption | If it is wrong | Falsified by |
|:--|:--|:--|:--|
| **A1** | Most deliveries arrive with a paper invoice and no prior order (§6.7) | Receiving is built around the wrong primary path and the PO flow moves into v1 | Pilot: receipts with a PO vs. without, over two weeks |
| **A2** | A worker will not type a catalogue in advance, but will build one at the till (§7.3) | Onboarding stalls in week one — the most likely single cause of pilot failure (§25) | Pilot: products created by quick-add vs. import, days 1–14 |
| **A3** | Shelf prices in the pilot store are tax-inclusive (§10.8) | A setting, and one receipt layout that already exists in both forms. **It was a rewrite until 3.41** — the cheapness was bought, not inherent | §26 Q2, before the pilot |
| **A4** | A short PIN on a shared device is an acceptable audit anchor for the owner (§16.2) | The audit trail is worthless and identity needs to be per-device or biometric | Pilot: whether PINs stay per-user, or get shared within a week |
| **A5** | A hardware store's stock is largely unbarcoded, making quick tiles and internal codes core rather than convenience (§6.1, §18) | Quick tiles are dead weight, and camera scanning plus TLS become urgent (§16.6) | Pilot: share of sale lines added by tile vs. by scan |
| **A6** | Weighted average is accurate enough at this scale that no owner asks for FIFO (§10.5) | Lot tracking becomes necessary — expensive, and it touches every movement | Pilot: whether the owner's hand-check of margin (§27.4) reconciles |
| **A7** | ~100k sale lines a year is the realistic ceiling and SQLite is comfortable there (§19.3) | Query plans and storage need revisiting. Not architectural | §26 Q3, at setup |
| **A8** ✓ | The shop has, or will buy, an HID scanner and a thermal printer (§18) | v1 would be camera-only — survivable now that TLS ships in v1 regardless (§16.6), where once it was a launch blocker | **Confirmed 2026-09-10** (§26 Q5) |
| **A9** ~ | A worker who is locked out (§16.2) or stuck can reach someone who can help within minutes | Rule 1 is violated in exactly the situation it exists for | **Partly settled 2026-09-10** (§26 Q8): the maintainer answers the phone. Whether that is *within minutes* is still the pilot's to prove |
| **A10** | Simon is not and cannot be the fiscal device; it runs beside whatever certified ՀԴՄ the shop has (§17) | The adapter moves from v2 into v1 and checkout gains a device call after commit — or, worse, Simon sits beside the till instead of being it | §26 Q1 |
| **A11** | A gapless receipt number, where one is required, comes from the ՀԴՄ and not from Simon (§12.1) | §14's entire offline design changes: receipts print unnumbered until sync, or the till stops when the server is unreachable | §26 Q10, before layer 5 |
| **A12** ✓ | One shop is the whole of v1 — but the schema carries a nullable `locationId` from the start regardless (§11) | Nothing at all, if we carry the field. A migration over a year of movements, if we skip it | **Confirmed 2026-09-10** (§26 Q7) |
| **A13** | Tax appears on the receipt only where the shop is VAT-registered; the rate is a setting, not a constant (§10.8) | A setting default, not a code change | §26 Q11 |
| **A14** | B2B tax invoices and waybills are **exported, never produced** (§20.2) | A new v2 feature rather than a change to an existing one | §26 Q12, before the pilot |
| **A15** | Retention follows the longest applicable financial-record period, and backup rotation exceeds it (§19.2, §19.6) | One setting in §19.2 | §26 Q13, before the first backup rotation |
| **A16** | The lawful basis for the Nisya ledger is the transaction itself, not consent (§19.6) | A consent step appears the first time a worker records a debt for someone — a change to §6.3 | §26 Q14, before the first pilot store |

**A3 and A10–A16 are the fiscal bets, and they are unlike everything above them.** Every other
assumption in this table is falsified by watching the pilot; these are settled by one
conversation with an adviser, and four of them block the build (§23.1). They sit here because
this is where the document keeps its bets, and §26.1 is how the conversation that settles them
is run. **One document, one truth: the bet is recorded here, the answer strikes it here.**

### 24.3 Hypotheses — the product bets

The claims the venture rests on. None is testable by unit test; all are testable by pilot.

- **H1 — Explainability creates trust.** An owner who can drill any number to the events
  behind it will believe the software (rule 3). *Tested by §27.14, and by whether he stops
  keeping the paper book in parallel after the pilot fortnight.*
- **H2 — Speed decides adoption.** A worker abandons anything slower than paper under a
  queue (§2.3). *Tested by §21's checkout budget on a real device, and by whether Գոռ is
  still using Simon in week four without being asked to.*
- **H3 — The aged-debt line at the moment of decision is the core value** (§6.3). *Tested by
  whether the pilot store's 90-day-plus debt falls over three months.*
- **H4 — Self-hosting is an advantage, not an apology** (§1). *Tested by whether it comes up
  as a reason to buy or a reason to hesitate, across the first ten sales conversations.*

### 24.4 How success is measured, in one place

The measures existed and were scattered — learnability in §21.1, product bets in §24.3, binary
proofs in §27 — which meant no single place answered *"how will we know if this worked?"* This
section is that place. It **adds no new measure**; it names where each lives and what it is for.

| Horizon | Measure | Where | What it tells us |
|:--|:--|:--|:--|
| Per build | The 34 criteria in §27 | §27, assigned to layers in §23.1 | Binary: the thing does what it says. Necessary, and not sufficient — every one can pass on a product nobody uses |
| Pilot fortnight | Learnability targets, against a **paper** baseline | §21.1 | Whether Simon is faster than the notebook it replaces. §21.1 is the only table here with baselines, because paper is the only incumbent worth measuring against |
| Pilot, three months | H1–H4 | §24.3 | Whether the *bets* hold. H1 is falsified by the owner still keeping the paper book; H2 by Գոռ quietly not using it in week four; H3 by 90-day debt not falling; H4 by self-hosting reading as a hesitation in sales conversations |
| Ongoing | §2.4's evidence rows moving from *inference* to *observed* | §2.4, §2.5 | Whether the document is becoming true |

**There is deliberately no commercial KPI — no adoption rate, no retention curve, no revenue
target.** Simon is installed per shop and the pilot is **one shop**: a retention percentage over
n = 1 is theatre, and a target invented to fill the row would be a number nobody could act on.
The honest v1 measure of commercial success is a single binary question — *does the pilot store
still use Simon at three months, without being asked to?* — which is H1 and H2 read together. A
cohort metric becomes meaningful at the point there is a cohort, and that is a v2 concern, not an
oversight to be papered over now.

**What would make this section wrong:** a second and third shop, at which point adoption and
retention become real numbers and this table needs a fifth row.

---

## 25. Risks

Likelihood is judged for the pilot store over its first year: **Certain** · **Likely** ·
**Possible** · **Unlikely**. Ordered by likelihood × impact, so the top row is where attention
goes first.

| Risk | Likelihood | Impact | Mitigation |
|:--|:--|:--|:--|
| **Fiscal/ՀԴՄ non-compliance** | **Likely** while §17 is unresolved | Fatal — product unusable or illegal | Resolve §17 before build completes; the adapter seam is already reserved in the schema |
| **Catalogue never gets populated** | **Likely** — it is how these rollouts usually die | Fatal — the system is unusable | CSV import plus quick-add at checkout (§7.3); tracked as A2 (§24.2) |
| **Host PC dies** | **Likely** across three years | Fatal without a tested backup; survivable with one | Hourly snapshots, USB copies, rehearsed restore, spare-machine runbook (§19.2) |
| **Worker rejects it under queue pressure** | **Possible** | Fatal — no adoption, and the data rots | Sub-15-second checkout as a hard requirement; practice mode; pilot with a real worker (H2, §24.3) |
| **Owner stops trusting the numbers** | **Possible** — one unexplainable figure is enough | Severe — reverts to paper | Every figure drills to its source events (rule 3, H1) |
| Shop Wi-Fi open to customers | **Likely** — it is the normal state of a shop | Moderate — the API is still reachable by strangers, even encrypted | **TLS in v1** (§16.6), plus staff SSID/VLAN and real auth as defence in depth. Impact stays moderate rather than low: TLS protects the transport, not the fact that the door is on the street, and §16.1 ranks insiders above remote attackers anyway |
| Camera scanning needs a secure context | **Closed 2026-09-10** | — | TLS ships in v1 unconditionally (§16.6), which is what a secure context needs. HID remains the primary path (§18) |
| Too many settings | **Possible** | Moderate — misconfigured, or never configured | §6.11 — every setting must justify its existence |
| Money handled as floats | **Unlikely** — designed against from day one | Fatal — the books stop reconciling | §10.1, enforced by a lint rule and property tests (§21) |

---

## 26. Open questions

Q1, Q2 and Q10 are the three that still block the build (§23.1); Q7 was the fourth and is
answered. **Q15–Q17 were opened on 2026-09-12, and each already has an interim rule in force** — §12.4
for Q15, §12.5 and §11 for Q16, §13.7 for Q17 — stamped with that date and owned by the document
owner, so that the default is visibly a default. They ride with Q2's conversation (§26.1), since
all three are costing or cash questions for the same adviser. They were found by the event storm in
`docs/event-storming/buy-sell-cycle-2026-09-10.md`: each is a question this document was
answering *implicitly and inconsistently*, and each carries a recommended default so the build is
not blocked while the conversation is arranged. They are money decisions rather than engineering
ones, which is why they are here rather than settled in §12 and §13. The working assumption standing in for each until it is answered is **A3 and A10–A16**
in §24.2, and §26.1 is how the conversation that settles them is run. Q2 matters more than its position suggests: §10.8's whole
design rests on shelf prices being tax-inclusive. That used to be the one assumption with no
safe middle; since 3.41 both bases are supported and a wrong answer costs a setting, so ask it
carefully rather than anxiously.

1. **Fiscal:** is the pilot store obliged to use an ՀԴՄ, and can Simon drive or integrate
   with one? *(blocks §17 — highest priority)*
2. **Tax regime:** VAT, turnover, or micro? Are shelf prices tax-inclusive?
3. **Scale:** how many products, workers, tills, and daily transactions in the pilot store?
4. **Existing data:** what format is the current product list and debt book in?
5. **Hardware budget:** can the shop buy an HID scanner and a thermal printer, or must v1 be
   camera-only? — **ANSWERED 2026-09-10: both.** A8 confirmed. The HID wedge stays the primary
   path (§18) and camera scanning stays a secondary route for the aisle, so §16.6's TLS work is
   driven by the threat model rather than by the scanner.
6. **Network:** is there staff/guest Wi-Fi separation, and who administers it?
7. **Multi-location:** a second shop within a year? — **ANSWERED 2026-09-10: carry the field
   regardless.** A12 confirmed. v1 is single-shop, and `StockMovement.locationId` exists from
   Phase 0 as a nullable column nobody writes (§11). A second shop then becomes a feature rather
   than a migration over a year of movements. **This unblocks Phase 0** (§23.1).
8. **Support:** who fixes it at 9 p.m. on a Saturday when the host PC will not boot? —
   **ANSWERED 2026-09-10: the maintainer, by phone.** A9 confirmed for the pilot. This is what
   §19.5 was designed for — an owner reading numbers down a phone line — and it makes §22's
   operator runbook load-bearing rather than optional, because the person on the phone cannot
   see the machine. It does not scale past a few shops, and §25 should be re-read when it must.
9. **Language:** who reviews and owns the Armenian copy? — **ANSWERED 2026-09-10: the document
   owner reviews and signs off every string.** §4.2's warning stands — the Armenian in this
   document is still indicative until that review happens — but it now has a name against it
   rather than being nobody's job. Strings live in resource files (§20.3), so review can trail
   implementation without blocking it.
10. **Receipt numbering:** must Simon's own sale number be a gapless sequence, or does the
    gapless number come from the ՀԴՄ? *(§12.1. If Simon must issue it, an offline sale cannot
    have one at the moment it is made, and §14's guarantee that selling continues through a LAN
    drop is what has to give. Ask this in the same conversation as Q1.)*
11. **Tax on the receipt:** is it broken out, and at what rate? *(§10.8. Decides the receipt
    layout and whether a tax line appears at all — falsifies A13.)*
12. **B2B documents:** are electronic tax invoices or goods waybills required, and must Simon
    produce them or merely export the data? *(§17 item 3. Falsifies A14; if Simon must issue
    them, that is a new v2 feature.)*
13. **Record retention:** how long must sales and debt records be kept? *(§17 item 4. Sets
    backup rotation in §19.2 and the erasure rule in §19.6 — falsifies A15.)*
14. **Personal data:** is the lawful basis for the Nisya ledger the transaction itself, or is
    consent required? *(§17 item 5, §19.6. Falsifies A16; if consent is needed, a step appears
    in §6.3.)*

15. **Refund against a settled debt:** a customer bought on nisya, *paid in full*, and now
    returns goods. §12.4's rule — reduce the debt, never pay out for goods that were never paid
    for — has no answer here, because he **did** pay: the charge's balance is zero and a credit
    cannot be allocated to it. Does the drawer pay him, or does he hold a credit balance?
    *(§12.4, §10.6. **Recommended default: pay cash**, because it is what the shop will do at the
    counter anyway, and an unallocated credit is an interest-free loan from the customer that no
    screen lists and no report ages. The alternative is defensible and is what §10.6's model
    produces on its own, which is exactly why the choice has to be made deliberately rather than
    inherited. Partial payment — 20 000 of 40 000 paid, 25 000 returned — splits the same way
    §12.4 now splits a mixed tender.)*
16. **One drawer, two workers:** `Shift` has a `userId` and no `deviceId`, and the open guard is
    only *"no other `OPEN` shift for this user"* — but the drawer is physical, opens through the
    one receipt printer (§18), and §21 budgets for **three tills selling at once**. Two shifts
    against one cash box makes `expectedCash` meaningless for both and lands the whole variance
    on whoever closes last. Is the pilot store one person at a time, or two on a Saturday?
    *(§12.5, §11. **Recommended default: one `OPEN` shift per drawer**, with the drawer modelled
    explicitly and workers signing into the same shift, rather than binding a shift to a device —
    binding to a device does not help when two phones share one cash box. This is the half of the
    period/drawer problem that §11's `businessDate` does not solve, and it wants the shop's
    actual staffing pattern before it is designed.)*
17. **Purchase return after the stock has turned over:** §13.7's reversal formula is correct when
    nothing was sold between the receipt and the return, and produces an average below any price
    ever paid when something was — the case a shop reaches by discovering the goods are wrong
    *by selling one*. §13.7 now clamps and flags as an interim. Should the return reverse only the
    units still attributable to that receipt and book the rest as a cost-of-sales adjustment
    (§11 `CostCorrection`), or is the distortion the accepted price of not tracking lots?
    *(§13.7, §10.5. **Recommended default: the `CostCorrection` route**, since the document now
    exists for §10.5's restatement case and this is the same shape of problem. It is a costing
    judgement, not an implementation detail, and it wants the same accountant who answers Q2.)*

Q11–Q14 came back into this register when `docs/fiscal-brief.md` was folded in (3.25 and 3.26):
they are the questions that falsify A13–A16, and an assumption whose falsification route does
not exist is not a bet, it is an unexamined belief with a serial number.

### 26.1 How these get answered

Q1, Q2 and Q10 are **one conversation**, about 45 minutes, with an accountant or tax adviser who
works with small retail in Armenia. Q7 was never a fiscal question and is already answered
(2026-09-10); Q3, Q4 and Q6 are the ones still waiting on §2.5's shop visits.

**Take in the assumptions, not the blanks.** A3 and A10–A16 (§24.2) are the working position on
every one of these questions, each with its confidence and what it costs to be wrong. An adviser
corrects a proposal in minutes and composes an answer from scratch in an hour.

**Do not ask about** how stock is valued, how debts are aged, how the software is hosted, or how
backups work. All decided, and none of it needs an adviser's time.

**Leave with:**

- a yes or no on **Q1**, and if yes, whether Simon may drive the device;
- a yes or no on **Q10**, and if yes, who issues the number;
- the regime from **Q2**, and whether shelf prices are tax-inclusive;
- the four confirming answers — **Q11** tax on the receipt, **Q12** B2B documents, **Q13**
  retention period, **Q14** lawful basis. Each is a sentence from the adviser and a setting for
  us; none is worth a second meeting;
- ideally, the name of the ՀԴՄ the pilot shop already has, and who installed it.

**Say out loud** what §17 already commits to in writing: until integration exists Simon is an
internal management system standing beside whatever fiscal device the shop has, and is not
discharging a fiscal obligation on anyone's behalf.

**Every answer lands in two places.** The question is struck from §26, and the assumption it
settles is confirmed or corrected in §24.2 — that pair is the record. Anything unresolved stays
here with a named owner and a date, never as a note to revisit.

---

## 27. v1 acceptance criteria

Simon v1 is done when, **in a real store**:

**Correctness**
1. A worker completes a cash sale of three scanned items in under 15 seconds.
2. A **split payment** (part cash, part debt) records correctly against both drawer and
   customer.
3. A receipt of 3 spools × 50 m adds 150 m of stock and updates the weighted average cost
   **including the delivery charge**.
4. The margin report for a product restocked twice at different costs matches a hand
   calculation.
5. Debtor aging matches the owner's paper Nisya book after migration.
6. A partial return restocks the correct quantity and reverses cost at the **original** unit
   cost.
7. Shift close computes expected cash, records the counted variance, and produces a Z-report.
8. Selling continues through a two-minute Wi-Fi outage, and every queued sale syncs **exactly
   once**, with no duplicates.
9. A `WORKER` session obtains no cost field from **any** API endpoint, and a `STOCK` session
   obtains no `avgCostMdram`, margin, or supplier terms from any endpoint — including on a
   re-read of the goods receipt it entered a moment ago (§16.5).
10. The database is restored from backup **onto a different machine, by the owner**,
    following the runbook.

**Usability** — equally binding
11. A worker who has never seen Simon completes an unaided sale within **10 minutes** of
    first opening it.
12. A worker records a debt sale and sees the customer's existing balance **and its age**
    before confirming.
13. An unknown barcode is added and sold **without leaving the sale**, in under 30 seconds.
14. The owner answers "what did I earn today, and from what?" **without being shown how**.
15. No screen in the worker app exposes an internal term from §4.1's right-hand column.
16. Every destructive action is either undoable or confirmed — and no routine action is
    confirmed (§8.1).
17. The full till flow is operable **one-handed**, with touch targets ≥ 48 px throughout.

**Catalogue, tax & practice**
18. A 20% VAT receipt shows a tax figure equal to the sum of its lines' tax and **already
    inside** the total; the same basket in a turnover-tax shop shows no tax line and an
    identical total (§10.8).
    **And under a tax-exclusive basis** the same basket prints subtotal, tax and total as three
    lines that add up, with a **larger** total than the inclusive case — then, after the setting
    is switched back, that sale reprints exactly as it was rung up (§11 `Sale.priceBasis`).
19. A full shift spent in practice mode leaves the real database with **no sale, no stock
    movement and no debt entry** — and exactly two `AuditLog` rows, recording that practice
    was entered and left (§19.4).
20. Two customer records for one person are merged, and the merged ledger's balance **and its
    aging** equal the sum of the two originals (§6.13).
21. `decimalPlaces` cannot be changed on a product that has stock movements (§6.12).
22. Returning a delivery to a supplier credits the **invoice** amount, records the unrefunded
    freight separately, and leaves a weighted average that is **never outside the range of landed
    costs actually paid for that product** (§13.7). Tested **twice**: once with no sale between
    the receipt and the return, where the average returns exactly to what it was beforehand; and
    once with stock sold in between, where the naïve formula yields 8 ֏ against a true 12 ֏ and
    the guard must therefore refuse the figure and flag it. *The figures restate §13.7's worked
    table on purpose: an acceptance criterion that makes the reader open another section to learn
    what it asserts is one that gets implemented from memory. Keep both copies in step.* *The earlier wording — "restores the
    weighted average to what it was before that delivery arrived" — was satisfiable only in the
    first case, so the test would have been written without an intervening sale, passed, and
    certified the bug. An acceptance criterion that cannot fail is not one.*
23. A basket parked on one till and completed on another reconciles against the **second** till's
    drawer, is listed as a transfer on that Z-report, and leaves an audit row naming both shifts
    (§12.1, §12.5, §10.7).

**Added 2026-09-12 — the Tier A findings, each written so it can fail**
24. A sale completed offline and synced **after its shift has closed** posts successfully, keeps
    naming the closed shift, appears in the correct day's takings by `businessDate`, and is
    stated on that shift's Z-report as a late arrival — while the printed variance is **not**
    rewritten (§11, §12.5).
25. A cash refund of 8 000 ֏ leaves a shift's expected cash exactly 8 000 ֏ lower, and the
    variance at close is **zero** when the drawer is counted correctly (§12.4, §12.5).
26. A sale paid 30 000 ֏ cash and 20 000 ֏ on nisya, partly returned for 25 000 ֏, pays 15 000 ֏
    from the drawer and reduces the debt by 10 000 ֏ (§12.4).
27. A 100 000 ֏ basket discounted 10% and partly returned refunds the **discounted** share of the
    returned line — 18 000 ֏ on a 20 000 ֏ line, never 20 000 (§12.4).
28. A `POST /sales` carrying a forged `lineTotal`, a discount above the role's cap, or a price
    override beyond it is **rejected or recomputed by the server**, with no admin re-auth
    present — proving the cap is a control rather than a UI convention. The mirror of §27.9,
    on the write side (§15.3, §12.1).
29. A product quick-added at the till and sold before it is ever received reports **no margin**
    rather than 100%, and the first goods receipt **seeds** its average cost instead of averaging
    against zero (§10.5).
30. Replaying the stock ledger reproduces both `stockQty` **and** `avgCostMdram`, and a sale that
    arrives an hour late does not cause the drift job to report drift (§10.4).
31. A `ProductUnit` factor cannot be changed once the product has movements; the receipt of
    3 spools × 50 m still reads back as **3 spools** after commit (§11, §27.3).
32. Two tills, both offline, each take a repayment allocating oldest-first against the same
    charge. Both post on sync, the charge is settled exactly once, the excess becomes a credit
    `ADJUSTMENT`, and the aging report gives the same answer when run twice (§10.6, §14.6).
33. A cost typed as 14 000 ֏ instead of 1 400 ֏ and corrected a week later leaves every original
    sale line untouched, and §20.2 reports the affected period **as booked and restated**, naming
    the correction (§10.5, §11).
34. A session that expires while a completed sale sits in the outbox does **not** park that sale;
    it drains after the next sign-in. A return whose original sale is still queued behind it does
    not park either (§14.4).

---

*Sections 17 (fiscal/tax) and 26 (open questions) must be resolved with local professional
advice before commercial launch. Everything else in this document is a build instruction.*
