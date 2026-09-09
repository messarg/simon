# Product Requirements Document — Simon

**Product:** Simon (Սիմոն) — trade management for small retail
**Document version:** 2.0 (restructured; supersedes v1, kept at `docs/prd.v1.backup.md`)
**Primary market:** Small & medium retail and hardware stores in Armenia
**UI language:** Armenian. Code, schema, comments, API, and this document: English.
**Currency:** Armenian Dram (AMD, ֏)

---

## 0. What changed in this version, and why

v1 described a point-of-sale app. The product goal is the **full trade cycle — buying and selling goods of any type**, so this version adds the entire procurement side (suppliers, purchase orders, goods receipt, payables) that v1 reduced to a single "Restock" bullet, and it generalises the catalogue beyond hardware.

Six changes are **correctness fixes, not preferences**. They are called out here because each one is expensive to retrofit once real money is in the database:

| # | v1 | v2 | Why it matters |
|:--|:---|:---|:---|
| 1 | Money as `Float` | Money as `Int` (whole drams; unit costs in milli-drams) | Binary floats cannot represent decimal money exactly. Errors compound across totals, VAT, and debt balances until the books stop reconciling. Non-negotiable. |
| 2 | `Product.stockQty` mutated in place | Append-only `StockMovement` ledger; `stockQty` is a derived cache | A mutable counter cannot answer "why is my stock wrong?" It also loses every reconciliation, and races between concurrent sales. |
| 3 | `Customer.currentDebt` mutated in place | Append-only debt ledger with payment allocation | Same reason, plus debtor **aging** (30/60/90) is impossible from a single number, and aging is the main reason to digitise a Nisya notebook. |
| 4 | Single `Product.costPrice` | Explicit costing method (moving weighted average) + `unitCost` snapshot on every sale line | With one mutable cost field, every historical profit report silently changes whenever you restock at a new price. Reported margins become fiction. |
| 5 | Flat `uom` string | Purchase UoM ↔ stock UoM ↔ sale UoM with conversion factors | Hardware stores buy a 50 m spool and sell by the metre; buy a pallet, sell a bag. A single unit string breaks on day one. |
| 6 | "CORS configured to accept local IPs" as the security control | Server-side authentication + **field-level** authorisation | CORS is a browser convention, not access control — `curl` ignores it entirely. And if the API returns whole `Product` objects, `costPrice` leaks to workers no matter what the UI hides. |

Two contradictions in v1 are resolved in §8 (offline-first vs. a LAN server the phone depends on) and §10 (a cash-handling retail app in Armenia vs. fiscal receipt law).

---

## 1. Vision & positioning

Simon is a **digital employee**: a tireless clerk and bookkeeper for a traditional Armenian store owner. It replaces two paper notebooks — the stock book and the *Nisya* (Նիսյա) debt book — with a phone the worker already carries and a dashboard the owner already trusts.

The product promise is not "software". It is: *at closing time you know exactly what you sold, what you earned on it, what is left on the shelf, who owes you money, and whether the cash in the drawer matches.*

**100% self-hosted.** Everything runs on the store's own computer and its own Wi-Fi. No vendor cloud, no subscription dependency, no data leaving the premises. This is a deliberate response to local owners' preference for keeping records on their own hard drive — and it is a competitive advantage against cloud POS vendors, not a limitation.

### Design principles

1. **The queue never stops.** A customer is standing at the counter. No error, sync failure, or missing barcode may block a sale. Degrade, warn, reconcile later — never block.
2. **Paper is the benchmark.** A paper notebook is instant, always available, and never asks for a password. Anything slower than paper will not be adopted.
3. **Every number is explainable.** For any balance, the owner can drill to the individual events that produced it.
4. **Nothing financial is ever deleted.** Mistakes are corrected by reversing entries, which leave a trail.
5. **Thumbs, not styluses.** Workers use one hand, in bad light, sometimes with dusty or gloved fingers.

---

## 2. Users & jobs to be done

| Persona | Context | Jobs |
|:--|:--|:--|
| **Worker / cashier** (Աշխատող) | Phone or tablet, on their feet, customer waiting. Possibly low digital literacy. | Scan and sell; sell unbarcoded goods by weight/length; record a debt sale; take a repayment; open/close a shift. |
| **Owner / admin** (Տնօրեն) | Desktop in the back room or at home on the LAN. Numerate, distrustful of black boxes. | See revenue and true profit; see who owes what and for how long; order stock before it runs out; reconcile the drawer; spot theft. |
| **Stock keeper** (may be the owner) | Warehouse or shop floor, tablet. | Receive deliveries against an order; count stock; write off damage; return to supplier. |

**Explicit non-users in v1:** the end customer (no customer-facing app, no loyalty portal), and the accountant (export serves them; no direct login).

---

## 3. Scope

### v1 — must ship together to be useful
Catalogue & units · barcode and non-barcode selling · sales & checkout · debt (Nisya) ledger with aging · suppliers, purchase orders & goods receipt · stock ledger · returns both directions · shifts & cash reconciliation · roles and field-level permissions · owner dashboard · backup & restore · Armenian UI · data import from existing lists.

### v2 — next
Fiscal/ՀԴՄ integration (§10) · label printing · stocktake sessions with variance approval · reorder suggestions from sales velocity · multi-location · Tauri desktop packaging.

### Later / conditional
Batch & expiry tracking · serial numbers · barcode-scale (weight-embedded) integration · supplier price lists · multi-currency · customer-facing display.

### Non-goals (v1)
Cloud sync or multi-store consolidation · payroll · full double-entry general ledger · e-commerce · CRM/marketing · manufacturing or bill-of-materials.

---

## 4. Foundational data decisions

These are the rules every model and endpoint must follow.

### 4.1 Money
- **Stored as integers. Never floats.**
- Transactional amounts (line totals, sale totals, payments, debt) — **whole drams**, `Int`.
- **Unit costs and unit prices — milli-drams** (`amount_mdram = drams × 1000`), `Int`. Rationale: a moving weighted average cost of a screw bought at 12 ֏ and 13 ֏ must not round to a whole dram on every receipt, or the drift accumulates into visible COGS error. Round to whole drams only when producing a line total.
- One helper module owns every conversion, rounding, and formatting operation. No ad-hoc arithmetic in components or routes.
- **Rounding rule:** half-up, applied once at the line total, then summed. Never round intermediate factors. Cash rounding to the smallest practical denomination is a separate, explicit `roundingAdjustment` line on the sale so the receipt always adds up.

### 4.2 Quantity
- Stored as `Int` scaled ×1000 (**milli-units**): 2.5 kg → `2500`; 3 pieces → `3000`. Gives three decimals of precision with exact arithmetic.
- Each product declares `decimalPlaces` (0 for pieces, 2–3 for kg/m) which drives input validation and display.

### 4.3 Units of measure
Three roles, related by conversion factors on the product:
- **Stock UoM** — the canonical unit inventory is held in (e.g. metre).
- **Purchase UoM** — how the supplier sells it (e.g. 50 m spool), with `unitsPerPurchaseUnit`.
- **Sale UoM(s)** — how customers buy it (metre, or a pre-cut 5 m length).

Receiving 3 spools posts `+150` metres to the ledger. This is what makes "buy in one unit, sell in another" work.

### 4.4 Stock is a ledger, not a number
`StockMovement` is **append-only**. Every change in quantity is a row with a type, a signed quantity, a unit cost, a reason, an actor, and a link to its source document.

```
Movement types: SALE · SALE_RETURN · PURCHASE_RECEIPT · PURCHASE_RETURN
                ADJUSTMENT · WRITE_OFF · STOCKTAKE · TRANSFER · OPENING_BALANCE
```

`Product.stockQty` is a **cached projection**, recomputed inside the same transaction that writes the movement, and rebuildable from scratch by replaying the ledger. A nightly job asserts cache == ledger sum and reports drift.

### 4.5 Costing method — moving weighted average (WAC)
Chosen over FIFO: materially simpler, adequate for this scale, and it does not require lot tracking.

On goods receipt:
```
newAvgCost = (stockQty × currentAvgCost + receivedQty × receiptUnitCost)
             ÷ (stockQty + receivedQty)
```
- **Landed cost:** delivery charges, duty, and other receipt-level costs are apportioned across received lines by value before the average is updated. Ignoring this systematically overstates margin.
- On sale, the current average is **snapshotted onto the line** as `unitCost`. Historical profit is then immutable — restocking at a new price never rewrites last month's numbers.
- Negative stock (see §7.6) uses the last known average and flags the movement for review.

### 4.6 Debt is a ledger with allocation
`DebtEntry` is append-only: `CHARGE` (from a debt sale) or `PAYMENT` (repayment), plus `ADJUSTMENT` for write-offs and corrections. Payments are **allocated to specific charges**, oldest first by default, with manual override. Without allocation there is no aging, and without aging the owner cannot tell a customer who pays slowly from one who has stopped paying.

### 4.7 Immutability & correction
Finalised sales, receipts, and payments are never updated or deleted. Corrections create a linked reversing document (`reversesId`). `AuditLog` records every price change, stock adjustment, discount above threshold, void, and permission change — actor, timestamp, before/after.

---

## 5. Domain model

Money fields are `Int` per §4.1; quantities `Int` per §4.2. All ids are UUIDv7 (time-sortable, client-generatable — see §8).

### Catalogue
| Model | Key fields | Notes |
|:--|:--|:--|
| **Product** | `id`, `sku`, `name` (hy), `nameSearch`, `categoryId`, `stockUom`, `decimalPlaces`, `avgCostMdram`, `sellPriceMdram`, `taxCategory`, `reorderPoint`, `reorderQty`, `trackStock`, `isActive` | Never deleted — deactivated, because historical sale lines reference it. `nameSearch` holds a normalised/transliterated form for Armenian + Latin search (§13.3). |
| **ProductBarcode** | `id`, `productId`, `barcode` (unique), `isPrimary` | **One-to-many.** A product legitimately has several codes: manufacturer EAN, an internal code, and a second supplier's code. v1's single `barcode` field cannot express this. |
| **ProductUnit** | `id`, `productId`, `uom`, `factorToStockUom`, `role` (PURCHASE/SALE), `barcode?` | Drives §4.3 conversions. |
| **Category** | `id`, `name`, `parentId` | Shallow tree. Drives reporting and dashboard grouping. |
| **PriceHistory** | `id`, `productId`, `sellPriceMdram`, `effectiveFrom`, `changedBy` | Answers "when did this get more expensive, and who did it?" |

### Selling
| Model | Key fields | Notes |
|:--|:--|:--|
| **Sale** | `id` (client-generated), `number` (human-readable), `shiftId`, `userId`, `customerId?`, `status` (DRAFT/COMPLETED/VOIDED), `subtotal`, `discountTotal`, `taxTotal`, `roundingAdjustment`, `total`, `completedAt`, `reversesId?`, `fiscalReceiptId?` | Unique `id` is the idempotency key (§8.3). |
| **SaleLine** | `id`, `saleId`, `productId`, `qty`, `uom`, `factorToStockUom`, `unitPriceMdram`, `unitCostMdram`, `discountAmount`, `discountReason?`, `lineTotal` | **Both price and cost snapshotted.** Product name also denormalised for receipt reprints. |
| **Payment** | `id`, `saleId`, `method` (CASH/CARD/DEBT/TRANSFER), `amount`, `tenderedAmount?`, `changeGiven?` | **Multiple payments per sale** — split tender ("2000 cash, rest on debt") is normal and v1 could not represent it. |
| **SaleReturn** | `id`, `originalSaleId`, `userId`, `reason`, `refundMethod`, `restock` (bool), `total` | Partial returns supported; `restock=false` routes to write-off for damaged goods. Reverses COGS at the **original** `unitCost`. |

### Buying — new in v2
| Model | Key fields | Notes |
|:--|:--|:--|
| **Supplier** | `id`, `name`, `taxId`, `phone`, `paymentTerms`, `leadTimeDays`, `isActive` | `leadTimeDays` feeds reorder-point maths. |
| **PurchaseOrder** | `id`, `number`, `supplierId`, `status` (DRAFT/SENT/PARTIAL/RECEIVED/CANCELLED), `expectedAt`, `total` | Optional in the flow — a small store often receives goods with no prior order. |
| **PurchaseOrderLine** | `id`, `poId`, `productId`, `qtyOrdered`, `qtyReceived`, `unitCostMdram` | Partial receipt is the norm, not the exception. |
| **GoodsReceipt** | `id`, `number`, `supplierId`, `poId?`, `receivedAt`, `userId`, `supplierInvoiceNo`, `landedCostTotal`, `total` | The document that moves stock **and** updates WAC. |
| **GoodsReceiptLine** | `id`, `receiptId`, `productId`, `qty`, `unitCostMdram`, `apportionedLandedCost` | |
| **SupplierPayment** | `id`, `supplierId`, `amount`, `method`, `paidAt`, `allocations[]` | Accounts payable — the mirror of Nisya. The owner needs "what do *I* owe" as much as "what am I owed". |
| **PurchaseReturn** | `id`, `supplierId`, `receiptId?`, `reason`, `total` | Damaged or wrong goods going back. |

### Money, stock & people
| Model | Key fields | Notes |
|:--|:--|:--|
| **StockMovement** | `id`, `productId`, `type`, `qtyDelta` (signed), `unitCostMdram`, `balanceAfter`, `sourceType`, `sourceId`, `userId`, `note`, `createdAt` | §4.4. The single source of truth for inventory. |
| **Customer** | `id`, `fullName`, `phone`, `discountPercent`, `creditLimit`, `isBlocked`, `notes` | `creditLimit` + `isBlocked` are the controls v1 lacked — nothing stopped unbounded debt. |
| **DebtEntry** | `id`, `customerId`, `type` (CHARGE/PAYMENT/ADJUSTMENT), `amount`, `saleId?`, `dueDate?`, `createdAt`, `userId` | §4.6. |
| **DebtAllocation** | `id`, `paymentEntryId`, `chargeEntryId`, `amount` | Enables aging. |
| **Shift** | `id`, `userId`, `openedAt`, `closedAt?`, `openingFloat`, `expectedCash`, `countedCash`, `variance`, `status`, `notes` | Variance is the theft signal. |
| **CashMovement** | `id`, `shiftId`, `type` (PAY_IN/PAY_OUT/DROP), `amount`, `reason`, `userId` | Cash leaves the drawer for non-sale reasons constantly (supplier paid in cash, owner takes money). Unmodelled, this destroys every reconciliation. |
| **User** | `id`, `name`, `pinHash`, `role` (WORKER/STOCK/ADMIN), `isActive`, `failedAttempts`, `lockedUntil` | §9. |
| **AuditLog** | `id`, `userId`, `action`, `entityType`, `entityId`, `before`, `after`, `createdAt` | §4.7. |
| **Setting** | `key`, `value` | Store name, rounding denomination, tax regime, negative-stock policy, backup schedule. |

**Indexing:** `ProductBarcode.barcode` (unique), `StockMovement (productId, createdAt)`, `Sale (completedAt)`, `DebtEntry (customerId, createdAt)`, `Product.nameSearch`. Barcode lookup is the hottest path in the system and must stay indexed.

---

## 6. Selling flows

### 6.1 Checkout (the critical path)
Target: **scan → line on screen in under 200 ms**; a three-item cash sale completed in under 15 seconds.

1. **Add items** by any of four routes, all equally first-class:
   - **Hardware scanner (HID)** — a cheap USB/Bluetooth laser scanner acts as a keyboard. A hidden always-focused input captures the rapid keystroke burst ending in `Enter`. *This is the fastest path and the one a busy shop will actually use.* v1 listed only camera scanning; camera-only is a significant adoption risk.
   - **Phone camera** — for mobile workers and aisle-side selling.
   - **Quick tiles** — a configurable grid of the ~30 most-sold unbarcoded goods (sand, cable, rebar, cement). Essential for hardware retail, where much of the stock has no barcode at all.
   - **Search** — Armenian or Latin-typed, partial match (§13.3).
2. **Quantity** — large numeric keypad, decimal-aware per the product's `decimalPlaces`. Long-press a line to edit or void it.
3. **Discounts** — line-level or sale-level, percentage or fixed. Gated by role, capped by a configurable maximum, and above that cap require an admin PIN and a reason. Uncapped discounting is a standard shrinkage route.
4. **Payment** — cash (with tendered/change calculation), card, debt, or **any split combination**. Debt requires selecting a customer and passes the credit-limit check (§6.2).
5. **Finalise** — one atomic transaction (§7.1) writes the sale, its lines and payments, the stock movements, any debt charge, and the fiscal receipt reference. Then: print or skip.

**Held sales:** a sale can be parked and resumed (customer forgot their wallet, went back for another item) without blocking the till.

### 6.2 Debt sale (Nisya)
- Worker picks the customer (search by name or phone; recent customers first).
- System checks `creditLimit` and `isBlocked`. Over limit → **warn, and require admin override with a reason**, rather than hard-blocking (principle 1: never block the queue), unless the owner has set the limit to strict.
- Creates a `CHARGE` entry with an optional due date.
- The customer's running balance and their oldest unpaid charge are shown **before** confirming, so the worker sees "already owes 45,000 ֏, oldest 62 days" at the moment of decision. This single screen is the core value of digitising the Nisya book.

### 6.3 Repayment
- Select customer → shows outstanding charges oldest-first with ages.
- Enter amount → auto-allocates oldest-first, manually overridable.
- Partial payments fully supported. Creates a `PAYMENT` entry plus `DebtAllocation` rows, and a cash movement into the shift.
- Produces a printable receipt — in a cash-and-trust economy, the paper acknowledgement matters to the customer.

### 6.4 Returns & refunds
- Always initiated **from the original sale** (scan the receipt number or search recent sales). Blind returns are an easy fraud route and are admin-only.
- Partial quantities allowed; cannot exceed what was sold and not already returned.
- `restock=true` → `SALE_RETURN` movement back into stock at the original `unitCost`. `restock=false` → `WRITE_OFF` for damaged goods.
- Refund method must be recorded; refunding a debt sale reduces the debt rather than paying out cash.
- **Void vs. return:** a sale not yet finalised is voided (no ledger effect). A finalised sale is *never* deleted — it is reversed by a linked return.

### 6.5 Shift & cash reconciliation
- **Open:** declare the opening float. Only one open shift per user per till.
- **During:** all cash sales, repayments, pay-ins, pay-outs, and drops attach to the shift.
- **Close:** system computes expected cash = float + cash sales + repayments + pay-ins − pay-outs − drops. Worker counts and enters actual. **Variance is recorded, never silently absorbed.** Large variance requires a note.
- **X-report** (mid-shift, non-resetting) and **Z-report** (at close) — the standard retail pair, and what an accountant will ask for.

---

## 7. Buying & inventory flows

### 7.1 Atomicity
Every document that touches stock or money commits in **one database transaction**: validate → write document → write stock movements → recompute cached balances → write audit entry. Partial writes are the failure mode that corrupts a POS beyond repair. SQLite runs in **WAL mode** with a `busy_timeout`; stock reads that inform a write happen *inside* the transaction, never before it.

### 7.2 Purchase order → receipt
1. Create a PO (manually, or seeded from reorder suggestions), send to supplier.
2. Goods arrive → create a **GoodsReceipt**, optionally against the PO. Received quantities may differ from ordered; the PO moves to PARTIAL or RECEIVED accordingly.
3. Enter unit costs and any landed costs (delivery, duty), apportioned by value (§4.5).
4. Commit → `PURCHASE_RECEIPT` movements, WAC recalculated, supplier payable created.
5. **Receiving without a PO is a first-class path**, not an exception — most small-store deliveries arrive with just a paper invoice.

### 7.3 Reorder logic
v1's static low-stock threshold is kept as the floor, but the dashboard suggests better values:
```
reorderPoint ≈ (average daily sales over trailing 30d × supplier leadTimeDays) + safety stock
```
Traffic lights (green / yellow / red) remain, now driven by this. Dead stock (no movement in N days, capital tied up) is surfaced alongside — the opposite and equally expensive problem.

### 7.4 Stocktake
A counting **session**: snapshot expected quantities, enter counted quantities (by category, aisle, or scan), review the variance list, then approve. Approval posts `STOCKTAKE` adjustment movements with the variance valued at cost, so shrinkage is measurable in drams. Counting may happen while the shop trades; variance is computed against the snapshot.

### 7.5 Write-offs
Explicit reasons: damage, expiry, theft, internal use, sample. Reason codes turn "stock disappears" into a chart the owner can act on.

### 7.6 Negative stock policy
Configurable, defaulting to **allow with warning**. Real stores have inaccurate data and a customer holding the goods; blocking the sale is worse than a temporary negative. The movement is flagged, the product appears in a "needs recount" list, and COGS uses the last known average. Owners who prefer strictness can switch to block.

---

## 8. Offline behaviour & sync

### 8.1 The contradiction in v1, stated plainly
v1 was titled "offline-first" but specified a phone talking to an Express server on the shop PC. If that PC sleeps, reboots, or the Wi-Fi drops, an "offline-first" app stops selling. Offline-first and thin-client-to-LAN are different architectures and the difference must be a deliberate choice.

**Decision: LAN-primary with a resilient client.** The host PC is authoritative. The client is built so that a brief LAN interruption does not lose a sale.

### 8.2 What the client does
- **Catalogue cache** in IndexedDB (products, barcodes, prices, customer names and balances), refreshed on connect. A worker can scan and build a basket with the server unreachable.
- **Outbox queue** — completed sales are written locally first, then drained to the server. The UI shows a clear pending indicator and count.
- **Sales queue offline; debt and stock are server-authoritative.** Credit limits and stock levels cannot be validated offline, so offline debt sales are permitted only within a configurable cap and flagged for review on sync.
- Clear, non-technical Armenian status: connected / working offline / N sales pending.

### 8.3 Idempotency — mandatory
The client generates the sale `id` (UUIDv7) **before** submitting. The server treats `POST /sales` as idempotent on that id: a replay returns the original result rather than creating a second sale. Without this, one dropped response after a successful write double-charges the customer and double-deducts stock. Every queue-drained endpoint follows the same rule.

### 8.4 Conflict handling
Sales are additive and rarely conflict. The genuine cases: stock going negative on sync (accept, flag — §7.6) and a credit limit breached by a queued offline sale (accept, flag for owner review). Never silently discard a recorded sale; it represents goods that physically left the shop.

---

## 9. Security & access control

### 9.1 Threat model
Realistic threats, in order: a worker viewing cost prices or margins; a worker deleting or discounting their own sales to cover cash theft; anyone on the shop Wi-Fi (including guests) reaching the API; loss or theft of the host PC; and a failed disk with no working backup. Remote attackers are a distant concern — insiders and hardware failure are the real ones.

### 9.2 Controls
- **Authentication:** PIN entry on the device; PIN verified **server-side** against a slow hash (bcrypt/argon2). Never compare PINs in the client. Rate-limit attempts, lock after N failures.
- **Sessions:** short-lived token, per-device, revocable from the admin panel. Sessions end at shift close.
- **Field-level authorisation:** `costPrice`, `avgCost`, margin, and supplier terms are **stripped server-side** for non-admin roles. The API must never return them to a worker token. Hiding them in the UI is not a control — this was the most exploitable gap in v1.
- **Endpoint authorisation** on every route, defaulting to deny. CORS is a convenience, never a security boundary (§0).
- **Transport:** the API binds `0.0.0.0` to serve phones on the LAN, so it is reachable by every device on that Wi-Fi. Mitigations, in order of preference: a separate SSID/VLAN for staff devices; WPA2/3 with a password not shared with customers; a self-signed TLS certificate trusted on staff devices. If the deployment ships plain HTTP on a shared network, that is an **accepted risk that must be written down**, not an oversight.
- **Audit:** §4.7. Every sensitive action attributable to a named user.
- **PII:** customer names, phones, and debts are personal data. Backups are encrypted (§12.2).

---

## 10. Regulatory & fiscal compliance (Armenia)

> **This section needs verification with a practising Armenian accountant or tax adviser before launch.** The general shape below is stated with confidence; specific thresholds, rates, and current-year procedures change and are deliberately not asserted here.

v1 did not mention compliance at all. For a product that records retail cash sales in Armenia, this is the largest single risk to the whole venture — it can make the software unusable regardless of quality.

**What must be established:**
1. **Cash register (ՀԴՄ / HDM) obligation.** Retail sales in Armenia are generally required to be recorded through a fiscal cash register registered with the **State Revenue Committee (ՊԵԿ)**, issuing a fiscal receipt to the customer. Determine: whether the target store size is obliged, which certified HDM devices or software are approved, and whether a third-party POS may drive an HDM or must integrate with a certified fiscal module.
2. **Tax regime.** Armenia operates a **VAT (ԱԱՀ)** regime with a standard rate of 20%, alongside a **turnover tax** regime and a **micro-business** regime for smaller taxpayers. The product must be told which regime the store is in, because it changes whether prices are VAT-inclusive, whether tax is broken out on the receipt, and which reports the accountant needs. Model `taxCategory` on products from the start even if v1 ships single-rate.
3. **Invoices & waybills.** Confirm obligations around electronic tax invoices for B2B sales and goods-movement documentation, and whether Simon must produce or merely export them.
4. **Record retention.** Confirm the required retention period for sales records; it will set the backup retention policy in §12.
5. **Personal data.** Customer debt records fall under Armenian personal data protection law — confirm consent and retention obligations for the Nisya ledger.

**Product implication:** the architecture must assume a **fiscal adapter** exists (`Sale.fiscalReceiptId` is reserved in §5 for this) even though the v1 build may run without it. Retrofitting fiscalisation into a system that never anticipated it means rewriting the checkout path.

**Interim position for v1:** Simon operates as an internal management and stock system alongside whatever fiscal device the store already uses, with the integration scheduled for v2. This must be stated to every pilot store in writing.

---

## 11. Hardware & peripherals

| Device | Approach |
|:--|:--|
| **Barcode scanner** | USB or Bluetooth HID (keyboard-wedge). No driver, no integration code — the fastest and cheapest path. Support it first. |
| **Phone camera** | `html5-qrcode` or `react-zxing`. Requires a secure context (HTTPS or `localhost`) for camera access on mobile browsers — **a plain-HTTP LAN IP will silently fail on Android and iOS.** This constrains §9.2 toward TLS and must be resolved before relying on camera scanning. |
| **Receipt printer** | 58/80 mm thermal, ESC/POS. Browsers cannot drive these directly — the **backend** owns printing (network printer over TCP 9100, or USB on the host). Design it as a print service from the start. |
| **Label printer** | For internally generated barcodes (Code128) on unbarcoded goods. v2. |
| **Cash drawer** | Opens via the receipt printer's kick-out port. |
| **Scale** | Manual entry in v1. Weight-embedded EAN-13 (prefix `2x`) parsing later. |

**Internal barcodes:** goods arriving without a barcode get a generated internal code and a printed label. Without this, "scan to sell" is unusable for a large part of a hardware store's catalogue.

---

## 12. Data lifecycle

### 12.1 Onboarding & migration — a launch blocker
No owner will type in 3,000 products. v1 had no migration story; this is the most common reason small-retail software pilots fail.

- **CSV/Excel import** for products, opening stock, customers, and **opening debt balances** (posted as `OPENING_BALANCE` movements and `CHARGE` entries with their original dates so aging is correct from day one).
- Import preview with validation, duplicate barcode detection, and per-row error reporting. Idempotent and re-runnable.
- **Progressive catalogue building:** an unknown barcode at checkout opens a 15-second "add product" sheet (name, price, unit) so the catalogue fills up through normal trading rather than in one exhausting session. This is the single highest-leverage onboarding feature.

### 12.2 Backup & restore
v1's "daily export at 20:00" loses up to a day of trade and copies a live SQLite file unsafely.

- **Consistent snapshots** via SQLite's backup API or `VACUUM INTO` — never a raw file copy of a database being written to.
- **Hourly** snapshots during trading hours; **daily** at close; retention on a grandfather-father-son rotation.
- Destinations: local disk **plus** a removable USB drive (matching how these owners already think about backups). Encrypted, because they contain customer PII.
- **A one-click restore path, and a documented restore drill.** An untested backup is not a backup. The owner should have restored once, in training, before go-live.
- Additionally: human-readable CSV/Excel exports for the accountant — a different job from disaster recovery, and both are needed.

### 12.3 Growth
A busy store might reach ~100k sale lines/year. SQLite handles this comfortably. Archive strategy is deferred but the ledger design makes it possible.

---

## 13. Owner dashboard & reporting

### 13.1 At a glance
Today's revenue · **gross profit** (revenue − COGS from snapshotted `unitCost`, not a guess) · sales count and average basket · cash position and open shift variance · total receivable with aged breakdown · total payable to suppliers · low-stock and dead-stock counts · pending offline sales.

### 13.2 Reports
Sales by period / product / category / worker · **margin by product** (the one v1 could not produce correctly) · COGS and inventory valuation at cost · **debtor aging 0–30 / 31–60 / 61–90 / 90+** · supplier payables · stock movement history per product · shift Z-reports with variances · discount report by worker · write-offs by reason · stock turnover and dead stock.

All reports exportable to CSV/Excel for the accountant.

### 13.3 Armenian language & search
- Full Armenian UI (Վաճառել, Սկանավորել, Պարտքեր, Պահեստ, Մատակարարներ, Հերթափոխ). All strings in resource files — none hardcoded in components.
- **Search must tolerate Latin-typed Armenian.** Workers frequently type on a Latin keyboard layout; searching `mекеna`/`mexen` style transliterations must find Armenian product names. Store a normalised `nameSearch` (Armenian folded + transliterated) and match against both. Overlooking this makes search feel broken.
- AMD formatting (`֏`, thousands separators), Armenian date formats, and correct Armenian pluralisation.

---

## 14. Non-functional requirements

| Area | Requirement |
|:--|:--|
| Scan latency | Barcode → line rendered < 200 ms (p95) |
| Checkout | 3-item cash sale completable in < 15 s |
| App start | Interactive < 3 s on a mid-range Android phone |
| Concurrency | 3 simultaneous workers + owner dashboard, no lock contention |
| Availability | Selling continues through a LAN drop (§8) |
| Durability | Zero acknowledged sales lost; RPO ≤ 1 hour, RTO ≤ 1 hour |
| Devices | Android Chrome (primary), iOS Safari, desktop Chrome/Firefox |
| Accessibility | Touch targets ≥ 48 px; readable in poor light; usable one-handed |
| Correctness | Money, WAC, allocation, and rounding logic covered by unit tests; ledger-vs-cache reconciliation test in CI |

---

## 15. Architecture

Constraints from v1 retained: **decoupled client–server, local-only, no Next.js, no SSR.**

```
/backend    Node.js + Express (REST), Prisma, SQLite (WAL)
            /domain    money, costing, allocation, units — pure, heavily tested
            /services  transactional use cases (sale, receipt, repayment)
            /routes    thin HTTP layer, auth + field-level projection
            /jobs      backup, cache reconciliation, reorder stats
/frontend   React + Vite, SPA (no SSR), Tailwind, vite-plugin-pwa
            IndexedDB catalogue cache + outbox queue
/docs       this PRD, ADRs, operator runbook
```

- **Monorepo.** Note the current repository root is already a Vite React app; moving it under `/frontend` is a required first step.
- **Business logic lives in `/backend/domain`, not in routes or components.** Money and costing rules must be unit-testable without HTTP or a database.
- **Shared types** between frontend and backend from one source (generated from Prisma or a shared package).
- **Server binds `0.0.0.0`**; CORS restricted to LAN origins as convenience, with real authorisation on every route (§9).
- **Deployment:** Docker Compose (Nginx serving the built SPA + Express, one port) for phase 1; Tauri desktop packaging for phase 2, so the owner double-clicks an icon instead of learning Docker.

**Recommended additions to the v1 stack:** Zod (validate every request body — a POS takes numeric input from tired humans), Vitest + Supertest, `pino` structured logging, and `dinero.js` *or* a small in-house money module built on the §4.1 integer rules.

---

## 16. Roadmap

| Phase | Contents | Exit criterion |
|:--|:--|:--|
| **0 — Foundations** | Monorepo split, Prisma schema, money/quantity/UoM domain modules with tests, auth & roles, audit log | Domain tests green; a stock movement can be posted and replayed |
| **1 — Sell** | Catalogue, barcode (HID + camera), checkout with split tender, shifts & cash reconciliation, receipt printing | A real sale completes end-to-end on a phone in the shop |
| **2 — Trust** | Customers, debt ledger, allocation, repayments, aging, credit limits | Owner reconciles the digital ledger against the paper Nisya book |
| **3 — Buy** | Suppliers, POs, goods receipt, landed cost, WAC, payables, purchase returns | Margin report matches a hand-calculated check |
| **4 — Control** | Dashboard, reports, stocktake, write-offs, reorder suggestions, backup/restore + drill | Owner runs a month-end unaided |
| **5 — Harden** | CSV import, PWA polish, offline queue, Tauri packaging, fiscal adapter (§10) | Pilot store runs a full month with no manual intervention |

**Pilot before scale:** one friendly store, running Simon in parallel with paper for two weeks. Adoption by an actual worker under real queue pressure is the only meaningful validation.

---

## 17. Risks

| Risk | Impact | Mitigation |
|:--|:--|:--|
| **Fiscal/ՀԴՄ non-compliance** | Product unusable or illegal | Resolve §10 before build completes; fiscal adapter reserved in the schema |
| Camera scanning needs a secure context | Core feature silently fails on phones | Ship HID scanner as primary; solve TLS on LAN early (§11) |
| Host PC dies | Total data loss, business stops | Tested restore, USB backups, spare-machine runbook |
| Worker rejects the app under queue pressure | No adoption | Sub-15-second checkout as a hard requirement; pilot with a real worker |
| Catalogue never gets populated | System unusable | CSV import + progressive add-at-checkout (§12.1) |
| Money handled as floats | Books stop reconciling | §4.1, enforced by lint rule and domain tests |
| Shop Wi-Fi is open to customers | API exposed to strangers | Staff SSID/VLAN, real auth, documented accepted risk |
| Owner does not trust the numbers | Reverts to paper | Every figure drills down to its source events (principle 3) |

---

## 18. Open questions

1. **Fiscal:** is the pilot store obliged to use an ՀԴՄ, and can Simon drive or integrate with it? *(blocks §10 — highest priority)*
2. **Tax regime:** VAT, turnover, or micro? Are shelf prices tax-inclusive?
3. **Scale:** how many products, workers, tills, and daily transactions in the pilot store?
4. **Existing data:** what format is the current product list and debt book in — Excel, paper, another POS?
5. **Hardware budget:** can the store buy a 15,000–25,000 ֏ HID scanner and a thermal printer, or must v1 be camera-only?
6. **Network:** does the shop have staff/guest Wi-Fi separation, and who administers it?
7. **Multi-location:** is a second shop foreseeable within a year? (Changes whether stock is keyed by location from the start — cheap now, expensive later.)
8. **Who fixes it at 9 p.m. on a Saturday** when the host PC will not boot? Support model is a product requirement, not an afterthought.

---

## 19. v1 acceptance criteria

Simon v1 is done when, in a real store:

1. A worker completes a cash sale of three scanned items in under 15 seconds.
2. A sale with **split payment** (part cash, part debt) records correctly against both the drawer and the customer.
3. A goods receipt of 3 spools × 50 m adds 150 m of stock and updates the weighted average cost including delivery charges.
4. The margin report for a product restocked twice at different costs matches a hand calculation.
5. Debtor aging matches the owner's paper Nisya book after migration.
6. A partial return restocks the correct quantity and reverses COGS at the original cost.
7. Shift close computes expected cash, records the counted variance, and produces a Z-report.
8. Selling continues through a two-minute Wi-Fi outage, and every queued sale syncs exactly once with no duplicates.
9. A worker's session cannot obtain cost price or margin from **any** API endpoint.
10. The database is restored from backup onto a different machine, by the owner, following the runbook.

---

*Sections 10 (fiscal/tax) and 18 (open questions) must be resolved with local professional advice before commercial launch. Everything else in this document is a build instruction.*
