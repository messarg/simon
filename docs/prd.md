# Product Requirements Document — Simon

**Product:** Simon (Սիմոն) — trade management for small retail
**Document version:** 3.0 (adds the experience layer; supersedes v2, which is in git at `18f4b18`)
**Primary market:** Small & medium retail and hardware stores in Armenia
**UI language:** Armenian. Code, schema, API, comments, commits: English.
**Currency:** Armenian Dram (AMD, ֏)
**Status:** §16 (fiscal) and §24 (open questions) need local professional advice before launch.

---

## 0. How to read this document

The document is in four parts. Read the part you need; they are written to stand alone.

| Part | Sections | For |
|:--|:--|:--|
| **A — The people and the experience** | §1–§9 | Anyone. Who this is for, how it must feel, what each screen does |
| **B — The rules** | §10–§14 | Engineers. Data, money, ledgers, flows. The correctness core |
| **C — The environment** | §15–§19 | Engineers and ops. Security, compliance, hardware, data, reporting |
| **D — Delivery** | §20–§25 | Everyone. Budgets, architecture, roadmap, risks, acceptance |

**What changed from v2.** v2 established the correctness core — integer money, append-only
ledgers, weighted-average costing, idempotent sync. All of that is unchanged and is now
Part B. What v2 lacked was any account of how a person with limited computer experience
learns to use it. Part A is new: personas, a mental model, an information architecture, full
screen specifications, a learnability plan, and an error-recovery catalogue. Part D adds
usability acceptance criteria alongside functional ones, because a POS that is correct and
unlearnable has failed.

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
   speed budgets (§20) and the one-screen till (§6.1).
2. **Արամ stops trusting it.** One unexplainable number is enough. Mitigated by making every
   figure drill down to the events that produced it (§3, rule 3).

Everything in Part A exists to prevent one of these two.

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
| The day's sales book | **Օրվա վաճառք** (today's sales) | `Sale` + `SaleLine` |
| The debt notebook | **Պարտքեր** (debts) | `DebtEntry` + `DebtAllocation` |
| What's on the shelf | **Պահեստ** (stock) | `StockMovement` ledger + cached `stockQty` |
| Goods coming in | **Ընդունում** (receiving) | `GoodsReceipt` + movements |
| The cash drawer | **Հերթափոխ** (shift) | `Shift` + `CashMovement` |
| What I earned | **Վաստակ** (earnings) | revenue − COGS from snapshotted unit costs |

**The user is never shown the right-hand column.** Not in a label, not in an error, not in
an export header. If a screen needs the word "ledger", "movement", "allocation",
"idempotent", or "reconciliation", that screen is wrong.

### 4.2 Vocabulary rules

- **Use the shopkeeper's word, not the accountant's.** "Ի՞նչ եմ վաստակել" (what did I earn),
  not "Gross margin analysis".
- **One word per concept, everywhere.** If a debt is *պարտք* on the till, it is *պարտք* in
  the report, on the receipt, and in the export. Synonyms are how a UI stops feeling like
  one product.
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

## 5. Information architecture

### 5.1 Two apps in one

Role determines what exists, not just what is enabled. A worker never sees a greyed-out
button for something he cannot do — the concept is simply absent from his world.

**Worker (phone/tablet).** Four destinations. That is the whole app.

```
Վաճառել  (Sell)      ← default, ~90% of use, opens on launch
Պարտքեր  (Debts)     ← look up a customer, take a repayment
Պահեստ   (Stock)     ← look up an item, receive goods (if permitted)
Հերթափոխ (Shift)     ← open, close, cash in/out
```

**Owner (desktop, back room or home).** Everything the worker sees, plus:

```
Գլխավոր       (Home)         ← today at a glance
Հաշվետվություն (Reports)     ← tiered, see §5.3
Ապրանքներ     (Products)     ← catalogue, prices, costs
Հաճախորդներ   (Customers)    ← debts, limits
Մատակարարներ  (Suppliers)    ← orders, what I owe
Կարգավորումներ (Settings)     ← few, defaulted, explained
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

## 6. Screens

Each screen below specifies: **purpose · layout · states · interactions · what can go wrong ·
why it is learnable**. Where a rule from §3 drives a decision, it is cited.

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
2. **Camera** — for a worker selling from the aisle. (Constrained by §17.)
3. **Quick tiles (Արագ)** — a grid of the most-sold unbarcoded goods: sand, cable, cement,
   rebar. **Auto-populated from actual sales velocity**, manually pinnable. Essential for a
   hardware store, where much of the stock has no barcode at all.
4. **Search (Փնտրել)** — Armenian or Latin-typed (§19.3).

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
- **Hold sale (Պահել)** → park the basket, serve the next customer, resume later. Multiple
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
- **Void vs. return:** a sale not yet completed is simply discarded. A completed sale is
  never deleted — it is reversed by a linked return (rule 4).

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
  deliveries arrive with just a paper invoice.
- Scan or search each item, enter quantity and unit cost from the invoice.
- **"Առաքման ծախս" (delivery charge)** — one field. Simon spreads it across the goods by
  value so the real cost is right. The user is never told the word "apportionment"; they
  just see each item's cost land slightly higher than the invoice line.
- Unit conversion is invisible and automatic: receiving 3 spools of 50 m adds 150 m of
  stock, because the product knows its own packaging (§10.3).
- Cost fields are **hidden entirely from workers without stock permission** — not greyed
  out, absent.

---

### 6.8 Stocktake — Հաշվառում

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

Tiered per §5.3. Available: sales by period/product/category/worker · **margin by product**
· stock valuation at cost · **debtor aging 0–30/31–60/61–90/90+** · supplier payables ·
stock movement history per item · shift Z-reports with variances · discount report by worker
· write-offs by reason · stock turnover and dead stock.

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
| Tax regime | Ask at setup | Changes receipt and reports (§16) |
| Cash rounding | None | Some shops round to 10 ֏ |
| Negative stock | Warn (not block) | Rule 1; strict shops may differ |
| Max discount without admin | 5% | Shrinkage control |
| Credit limit default | 50,000 ֏ | Starting point per customer |
| Low-stock alert | Auto from velocity | Manual override per product |
| Backup destination | Local + USB | §18.2 |
| Text size | Normal | Older owners; a real accessibility need |

Anything not on this list is a decision Simon should make itself.

---

## 7. Making it easy to learn

The single largest risk to this product is not a bug. It is a shop that installs Simon,
finds it too much work to start, and goes back to paper in week two.

### 7.1 The first hour, day, and week

**First hour — setup wizard.** Five questions, no jargon, skippable and resumable:

1. Shop name?
2. Who will use it? (names + PINs — the owner sets them)
3. Do you sell by weight or length, or only by piece?
4. Do you keep a debt book? (turns Nisya on)
5. Do you have a product list to import, or shall we build it as you sell?

Nothing else. Everything else has a working default. At the end of the wizard the shop can
make a real sale.

**First day — sell with the catalogue empty.** Simon must be useful before it is complete.
An unknown barcode opens a 15-second add sheet (§7.4), so the catalogue fills through normal
trading. Day one is productive even if nothing was imported.

**First week — the numbers arrive.** By day 3 there is enough history for low-stock
suggestions; by day 7, velocity-based quick tiles and a first weekly report. Value should
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

### 7.3 Progressive catalogue building

Nobody will type in 3,000 products. This is the most common reason small-retail software
pilots fail, and it must be designed against directly:

- **CSV/Excel import** with preview, validation, duplicate-barcode detection, and per-row
  errors. Idempotent and re-runnable — a failed import must never leave a half-built mess.
- **Opening debts import**, with their **original dates**, so aging is correct from day one.
  Importing them as "today" would make every debt look fresh and destroy the feature's value
  in its first week.
- **Quick-add at checkout** — the 15-second sheet: name, price, unit. Cost and category can
  come later; the sale must not wait.
- **A "needs detail" list** for the owner to complete later at his own pace.

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
| Host PC won't start | *Not recoverable in-app* | Runbook + tested restore (§18.2) |

### 8.3 Offline, in human language

Never the word "offline", never a status code, never a stack trace.

| State | Copy (indicative) |
|:--|:--|
| Connected | *nothing — no chrome at all* |
| Working offline | «Աշխատում է առանձին։ Վաճառքները կպահվեն։» |
| Pending | «3 վաճառք դեռ չի ուղարկվել» — tappable |
| Sync problem | «Չհաջողվեց ուղարկել 1 վաճառք» + what to do |

A calm banner, never a blocking modal (rule 1). The till keeps selling.

### 8.4 Empty states

Every empty state does three things: says what belongs here, says why it is empty, and
offers the action that fills it. "Ոչինչ չի գտնվել" alone is a dead end and a missed
teaching moment.

---

## 9. Scope

### v1 — must ship together to be useful
Catalogue & units · barcode and non-barcode selling · till, split payment, held sales ·
debt (Nisya) with aging and limits · suppliers, receiving with landed cost · stock ledger ·
returns both directions · shifts with denomination counting · roles and field-level
permissions · owner home with drill-down · backup & tested restore · Armenian UI · setup
wizard, import, quick-add, practice mode.

### v2 — next
Fiscal/ՀԴՄ integration (§16) · label printing · stocktake sessions with approval · velocity
reorder suggestions · purchase orders · multi-location · Tauri desktop packaging.

### Later / conditional
Batch & expiry · serial numbers · barcode-scale integration · supplier price lists ·
multi-currency · customer-facing display.

### Non-goals (v1)
Cloud sync or multi-store consolidation · payroll · full double-entry general ledger ·
e-commerce · CRM/marketing · manufacturing or bill-of-materials.

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
Never round a unit price, a factor, or an intermediate product. Sum already-rounded line
totals to get the sale total. Half-up on the absolute value (rather than banker's rounding)
means a return of 12.5 rounds to the same magnitude as the sale of 12.5 — otherwise a
partial return leaves a one-dram ghost balance that nobody can explain.

**Cash rounding is a separate, visible line.** If the shop rounds to 10 ֏,
`sum(lines) + roundingAdjustment == total` must always hold, so the receipt adds up.

One module owns every conversion, rounding, and formatting operation. No arithmetic on money
anywhere else.

### 10.2 Quantity is integers

`Int` scaled ×1000. Each product declares `decimalPlaces` (0 for pieces, 2–3 for kg/m),
which drives both input validation and display — and is why the till keypad refuses `2.5`
pieces (§6.1).

### 10.3 Units of measure

Three roles, related by integer conversion factors on the product:

- **Stock UoM** — the canonical unit inventory is held in (metre).
- **Purchase UoM** — how the supplier sells it (a 50 m spool), with `unitsPerPurchaseUnit`.
- **Sale UoM(s)** — how customers buy it (metre, or a pre-cut 5 m length).

Receiving 3 spools posts +150 metres. A single flat unit string cannot express this and
breaks on day one in a hardware store.

### 10.4 Stock is a ledger, not a number

`StockMovement` is **append-only**. Every quantity change is a row with a type, a signed
quantity, a unit cost, a reason, an actor, and a link to its source document.

```
SALE · SALE_RETURN · PURCHASE_RECEIPT · PURCHASE_RETURN
ADJUSTMENT · WRITE_OFF · STOCKTAKE · TRANSFER · OPENING_BALANCE
```

`Product.stockQty` is a **cached projection**, recomputed inside the same transaction that
writes the movement, and rebuildable from scratch by replaying the ledger.

A mutable counter cannot answer *"why does it say 14 when the shelf has 11?"* — which is
rule 3 applied to inventory. It also silently loses concurrent writes. A scheduled job
asserts cache == replay and **surfaces drift rather than silently correcting it**, because a
mismatch means a bug worth finding.

### 10.5 Costing — moving weighted average

Chosen over FIFO: materially simpler, adequate at this scale, and it needs no lot tracking.

```
newAvgCost = (stockQty × currentAvgCost + receivedQty × receiptUnitCost)
             ÷ (stockQty + receivedQty)
```

- **Landed cost first.** Delivery, duty, and other receipt-level charges are apportioned
  across lines **by value** before the average moves. Ignoring this systematically overstates
  margin — the most common costing error in small-retail systems, and the reason §6.7 has a
  delivery-charge field.
- **Snapshot on sale.** The current average is written onto the sale line as `unitCost`.
  Historical profit then becomes immutable: restocking at a new price never rewrites last
  month's numbers. Without this, every margin report silently changes under the owner and
  rule 3 is violated.
- Negative stock uses the last known average and flags the movement.

### 10.6 Debt is a ledger with allocation

`DebtEntry` is append-only: `CHARGE`, `PAYMENT`, or `ADJUSTMENT`. **Amounts are always
positive; the type carries direction** — mixed signs make every aggregate a source of bugs.

Payments are **allocated to specific charges**, oldest first by default, manually
overridable. Allocations for one payment must sum exactly to the payment.

Without allocation there is no aging, and without aging "owes 45,000" is not actionable
while "45,000, of which 30,000 is over 90 days" is. Aging is measured from the **charge**
date, not the last payment. Overpayment becomes a credit `ADJUSTMENT`, never a negative
charge.

### 10.7 Correction, never deletion

Finalised sales, receipts, and payments are never updated or deleted. Corrections create a
linked reversing document (`reversesId`). A `DRAFT` sale that never completed may simply be
discarded — nothing was posted.

`AuditLog` records every price change, stock adjustment, discount above threshold, void, and
permission change: actor, timestamp, before/after. This is what makes rule 4 real, and it
protects the honest worker as much as it catches the dishonest one.

---

## 11. Domain model

All ids are UUIDv7 — time-sortable, so they cluster in index order, and client-generatable
(§14.3). Money and quantity per §10.1–10.2.

### Catalogue
| Model | Key fields | Notes |
|:--|:--|:--|
| **Product** | `id`, `sku`, `name`, `nameSearch`, `categoryId`, `stockUom`, `decimalPlaces`, `avgCostMdram`, `sellPriceMdram`, `taxCategory`, `reorderPoint`, `reorderQty`, `trackStock`, `isActive` | Never deleted — deactivated; sale lines reference it. `nameSearch` holds the normalised/transliterated form (§19.3) |
| **ProductBarcode** | `id`, `productId`, `barcode` (unique), `isPrimary` | **One-to-many.** A product legitimately has a manufacturer EAN, an internal code, and a second supplier's code |
| **ProductUnit** | `id`, `productId`, `uom`, `factorToStockUom`, `role`, `barcode?` | Drives §10.3 |
| **Category** | `id`, `name`, `parentId` | Shallow tree |
| **PriceHistory** | `id`, `productId`, `sellPriceMdram`, `effectiveFrom`, `changedBy` | "When did this get more expensive, and who did it?" |

### Selling
| Model | Key fields | Notes |
|:--|:--|:--|
| **Sale** | `id` (client-generated), `number`, `shiftId`, `userId`, `customerId?`, `status` (DRAFT/HELD/COMPLETED/VOIDED), `subtotal`, `discountTotal`, `taxTotal`, `roundingAdjustment`, `total`, `completedAt`, `reversesId?`, `fiscalReceiptId?` | `id` is the idempotency key. `HELD` supports §6.1 parked sales |
| **SaleLine** | `id`, `saleId`, `productId`, `productName`, `qty`, `uom`, `factorToStockUom`, `unitPriceMdram`, `unitCostMdram`, `discountAmount`, `discountReason?`, `lineTotal` | **Price and cost both snapshotted.** Name denormalised for reprints |
| **Payment** | `id`, `saleId`, `method` (CASH/CARD/DEBT/TRANSFER), `amount`, `tenderedAmount?`, `changeGiven?` | **Multiple per sale** — split tender (§6.2) |
| **SaleReturn** | `id`, `originalSaleId`, `userId`, `reason`, `refundMethod`, `restock`, `total` | Partial supported; reverses COGS at the **original** unit cost |

### Buying
| Model | Key fields | Notes |
|:--|:--|:--|
| **Supplier** | `id`, `name`, `taxId`, `phone`, `paymentTerms`, `leadTimeDays`, `isActive` | `leadTimeDays` feeds reorder maths |
| **PurchaseOrder** | `id`, `number`, `supplierId`, `status`, `expectedAt`, `total` | Optional — most deliveries arrive unordered |
| **PurchaseOrderLine** | `id`, `poId`, `productId`, `qtyOrdered`, `qtyReceived`, `unitCostMdram` | Partial receipt is normal |
| **GoodsReceipt** | `id`, `number`, `supplierId`, `poId?`, `receivedAt`, `userId`, `supplierInvoiceNo`, `landedCostTotal`, `total` | Moves stock **and** updates the average |
| **GoodsReceiptLine** | `id`, `receiptId`, `productId`, `qty`, `unitCostMdram`, `apportionedLandedCost` | |
| **SupplierPayment** | `id`, `supplierId`, `amount`, `method`, `paidAt`, `allocations[]` | Payables — the mirror of Nisya (§6.9) |
| **PurchaseReturn** | `id`, `supplierId`, `receiptId?`, `reason`, `total` | |

### Money, stock & people
| Model | Key fields | Notes |
|:--|:--|:--|
| **StockMovement** | `id`, `productId`, `type`, `qtyDelta` (signed), `unitCostMdram`, `balanceAfter`, `sourceType`, `sourceId`, `userId`, `note`, `createdAt` | §10.4. A movement with no source is a bug |
| **Customer** | `id`, `fullName`, `phone`, `discountPercent`, `creditLimit`, `isBlocked`, `notes` | Limit + block are the controls; nothing else stops unbounded debt |
| **DebtEntry** | `id`, `customerId`, `type`, `amount`, `saleId?`, `dueDate?`, `createdAt`, `userId` | §10.6 |
| **DebtAllocation** | `id`, `paymentEntryId`, `chargeEntryId`, `amount` | Enables aging |
| **Shift** | `id`, `userId`, `openedAt`, `closedAt?`, `openingFloat`, `expectedCash`, `countedCash`, `countedBreakdown`, `variance`, `status`, `notes` | `countedBreakdown` stores the denomination counts from §6.6 |
| **CashMovement** | `id`, `shiftId`, `type` (PAY_IN/PAY_OUT/DROP), `amount`, `reason`, `userId` | Cash leaves the drawer for non-sale reasons constantly; unmodelled, it destroys every reconciliation |
| **User** | `id`, `name`, `pinHash`, `role`, `isActive`, `failedAttempts`, `lockedUntil` | §17 |
| **AuditLog** | `id`, `userId`, `action`, `entityType`, `entityId`, `before`, `after`, `createdAt` | §10.7 |
| **Setting** | `key`, `value` | §6.11 |

**Indexing.** `ProductBarcode.barcode` (unique) · `StockMovement(productId, createdAt)` ·
`Sale(completedAt)` · `DebtEntry(customerId, createdAt)` · `Product.nameSearch`. Barcode
lookup is the hottest path in the system.

---

## 12. Selling logic

### 12.1 Checkout
Target: **scan → line in under 200 ms**; three-item cash sale in under 15 seconds (§20).

Finalising commits **one transaction**: sale → lines → payments → stock movements → debt
charge (if any) → audit row. Printing happens **after** commit.

**Discounts** are line-level or sale-level, percentage or fixed, gated by role and capped by
a configurable maximum. Above the cap: admin PIN plus a reason. Uncapped discounting is a
standard shrinkage route, and the discount-by-worker report exists because of it.

**Held sales** persist across app restarts. A parked basket that vanishes because the phone
locked is a lost sale and a lost user.

### 12.2 Debt sale
Credit-limit check → warn and allow override with reason (rule 1), unless set to strict.
Creates a `CHARGE` with an optional due date. The pre-confirmation summary in §6.3 is a
functional requirement, not decoration.

### 12.3 Repayment
Oldest-first allocation, overridable, partial supported. Creates a `PAYMENT` plus
`DebtAllocation` rows and a cash movement into the shift. Prints a receipt.

### 12.4 Returns
From the original sale only (blind returns admin-only). Cannot exceed quantity sold less
already returned. Restock → `SALE_RETURN` at the original unit cost; damaged → `WRITE_OFF`.
Refunding a debt sale reduces the debt.

### 12.5 Shift & cash
```
expected = openingFloat + cashSales + repayments + payIns − payOuts − drops
variance = counted − expected
```
Variance is always recorded. X-report mid-shift, Z-report at close.

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

### 13.3 Reorder logic
The static threshold is the floor; Simon suggests better values:

```
reorderPoint ≈ (average daily sales over trailing 30d × supplier leadTimeDays) + safety stock
```

Presented to the owner as a plain sentence — *"Սովորաբար վաճառվում է օրական 4, մատակարարը
բերում է 5 օրում"* — not as a formula. Dead stock is surfaced alongside (§6.9).

### 13.4 Stocktake
Snapshot → count → review variances → approve. Approval posts `STOCKTAKE` adjustments,
valuing shrinkage at cost. Counting may proceed while trading.

### 13.5 Write-offs
Explicit reasons: damage, expiry, theft, internal use, sample. Reason codes turn "stock
disappears" into a chart the owner can act on.

### 13.6 Negative stock
Default **allow with warning** (rule 1). The goods are physically leaving the shop; refusing
the record does not stop that. The movement is flagged, the product joins a recount list,
and COGS uses the last known average. Owners may switch to strict.

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
this" and must not have to. The primary key *is* the idempotency key.

Applies to every queue-drained endpoint: sales, returns, repayments, cash movements.

### 14.4 Client behaviour
- **Catalogue cache** in IndexedDB — products, barcodes, prices, customer names and balances.
  A worker can scan and build a basket with the server unreachable.
- **Outbox queue** — completed sales are written locally first, then drained FIFO and
  serially. The UI never awaits the network to complete a sale.
- Retry with backoff on network/5xx; **never** on other 4xx — park those and surface them.
- Cached stock and prices are **last-known and must be labelled as such**.

### 14.5 What may happen offline
| Operation | Offline | Why |
|:--|:--|:--|
| Scan, build a basket, take cash | ✅ | Catalogue cached |
| Complete a cash/card sale | ✅ | Queued, idempotent |
| Debt sale | ⚠️ capped | Credit limit uncheckable — allow to a cap, flag |
| Repayment | ✅ | Additive; allocation recomputed on sync |
| Receiving, stocktake, price change | ❌ | Needs authoritative stock; block clearly |
| Reports | ❌ | Server-computed |

### 14.6 Conflicts
Accept and flag; never reject. Negative stock on sync → flag for recount. Credit limit
breached by a queued sale → flag for owner review. Deactivated product → accept, flag.
**Never silently discard a recorded sale.** If one genuinely cannot post, it goes to a
visible "needs attention" list with a reason.

---

# Part C — The environment

## 15. Security & access control

### 15.1 Threat model
Realistic threats, in order: a worker viewing cost prices or margins; a worker voiding or
discounting their own sales to cover cash theft; anyone on the shop Wi-Fi (including
customers) reaching the API; loss or theft of the host PC; a failed disk with no working
backup. **Remote attackers are a distant concern — insiders and hardware failure are the
real ones**, and the controls are aimed at them.

### 15.2 PIN authentication
Workers enter a short PIN on a shared device many times a day; a password would be on a
sticky note beside the till within a week.

- Verified **server-side** against a slow hash (argon2/bcrypt). Never compared in the client,
  never stored in `localStorage`, never logged.
- Because the keyspace is tiny: **rate limit** per user and device, **lock** after N failures,
  and use a real work factor. The login path is not hot; a slow hash costs nothing.
- **PINs are per-user, never shared.** A shared PIN destroys the audit trail, which is the
  entire point of having one.

### 15.3 Sessions
Opaque server-issued token, per-device, revocable. **Sessions end at shift close** — a till
left logged in overnight is the most common real breach in retail. Short idle timeout on the
till, longer on the owner's dashboard. Re-authentication (admin PIN) for: discount above
threshold, void, price change, stock adjustment, no-sale drawer open.

### 15.4 Roles
| Role | May |
|:--|:--|
| `WORKER` | Sell, take repayments, open/close own shift |
| `STOCK` | Worker, plus receiving, stocktake, write-offs |
| `ADMIN` | Everything: cost, margin, prices, users, settings |

### 15.5 Field-level authorization
The gap easiest to leave open and the most commercially damaging.

Cost, margin, and supplier terms are **stripped server-side** for non-admins. A `WORKER`
token must not obtain `avgCostMdram` from **any** endpoint — list, search, detail, report,
export, or an error message echoing the record. Never return a raw ORM object.

**Hiding cost in the UI is not a control.** §25 tests this explicitly.

### 15.6 Network
The API binds `0.0.0.0` to serve phones, which means every device on that Wi-Fi can reach
it. Mitigations, in order of preference:

1. A separate SSID or VLAN for staff devices.
2. WPA2/WPA3 with a password not shared with customers.
3. TLS with a certificate trusted on staff devices — **also required for camera scanning**
   (§17).

If the deployment ships plain HTTP on a shared network, that is an **accepted risk that must
be written down and shown to the owner**, not an oversight discovered later.

**CORS is not a security control.** It restricts browsers; `curl` ignores it entirely.

---

## 16. Regulatory & fiscal compliance (Armenia)

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
   in §18.2.
5. **Personal data.** The Nisya ledger holds names, phones, and debts — personal data under
   Armenian law. Confirm consent and retention obligations.

**Product implication.** The architecture assumes a **fiscal adapter** exists —
`Sale.fiscalReceiptId` is reserved for it — even though v1 may run without one. Retrofitting
fiscalisation into a system that never anticipated it means rewriting the checkout path.

**Interim position for v1.** Simon operates as an internal management and stock system
alongside whatever fiscal device the shop already uses, with integration scheduled for v2.
**This must be stated to every pilot store in writing.**

---

## 17. Hardware & peripherals

| Device | Approach |
|:--|:--|
| **Barcode scanner** | USB/Bluetooth HID keyboard-wedge. No driver, no integration code, ~15–25k ֏. **Support this first** |
| **Phone camera** | `html5-qrcode` / `react-zxing`. ⚠️ Requires a **secure context** — on a plain-HTTP LAN IP, camera access fails *silently* on Android and iOS. This constrains §15.6 toward TLS and must be resolved before relying on camera scanning |
| **Receipt printer** | 58/80 mm thermal, ESC/POS. Browsers cannot drive these — **the backend owns printing** (network printer on TCP 9100, or USB on the host). Design it as a service from the start |
| **Label printer** | Internal barcodes (Code128) for unbarcoded goods. v2 |
| **Cash drawer** | Opens via the printer's kick-out port |
| **Scale** | Manual entry in v1; weight-embedded EAN-13 (`2x` prefix) later |

**Internal barcodes.** Goods arriving without a barcode get a generated internal code and a
printed label, using a reserved prefix so they are distinguishable. Retired codes are never
reused — historical sale lines reference them. Without this, "scan to sell" is unusable for
much of a hardware store's catalogue.

---

## 18. Data lifecycle

### 18.1 Onboarding & migration
See §7.3 for the user-facing design. Technically: CSV/Excel import for products, opening
stock, customers, and **opening debt balances with their original dates** (posted as
`OPENING_BALANCE` movements and back-dated `CHARGE` entries so aging is correct on day one).
Import is idempotent, re-runnable, and reports per-row errors without partially applying.

### 18.2 Backup & restore
"A daily export at 20:00" loses a day of trade and copies a live SQLite file unsafely.

- **Consistent snapshots** via SQLite's backup API or `VACUUM INTO` — never a raw file copy
  of a database being written to.
- **Hourly** during trading hours, **daily** at close, grandfather-father-son rotation.
- Destinations: local disk **plus** a removable USB drive, matching how these owners already
  think about backups. **Encrypted**, because they contain customer PII.
- **A one-click restore path and a documented restore drill.** An untested backup is not a
  backup — the owner should have restored once, in training, before go-live (§25.10).
- Separately: human-readable CSV/Excel exports for the accountant. A different job from
  disaster recovery; both are needed.

### 18.3 Growth
A busy shop reaches ~100k sale lines a year. SQLite handles this comfortably. Log rotation
matters — this is someone's C: drive, and it holds the database too.

---

## 19. Reporting & language

### 19.1 Owner reporting
Per §5.3 and §6.10. Every figure drills to its source events (rule 3).

### 19.2 Report catalogue
Sales by period/product/category/worker · **margin by product** · COGS and stock valuation
at cost · **debtor aging 0–30/31–60/61–90/90+** · supplier payables · stock movement history
· shift Z-reports with variances · discount by worker · write-offs by reason · stock turnover
and dead stock. All exportable.

### 19.3 Armenian language & search
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

## 20. Non-functional requirements

| Area | Requirement |
|:--|:--|
| Scan latency | Barcode → line rendered **< 200 ms** (p95) |
| Checkout | 3-item cash sale completable in **< 15 s** |
| App start | Interactive **< 3 s** on a mid-range Android |
| Concurrency | 3 workers + owner dashboard, no lock contention |
| Availability | Selling continues through a LAN drop (§14) |
| Durability | **Zero acknowledged sales lost.** RPO ≤ 1 hour, RTO ≤ 1 hour |
| Devices | Android Chrome (primary), iOS Safari, desktop Chrome/Firefox |
| Accessibility | Touch targets ≥ 48 px; readable in poor light; one-handed; adjustable text size |
| Correctness | Money, costing, allocation, rounding under unit + property tests; ledger-vs-cache reconciliation in CI |

### 20.1 Learnability targets
Measured with real users during the pilot, not estimated:

| Metric | Target |
|:--|:--|
| Time for a new worker to complete their first unaided sale | **< 10 minutes** |
| Worker training to productive | **< 15 minutes** (§7.6) |
| Owner setup to first real sale | **< 30 minutes** |
| Taps for a 1-item cash sale | **≤ 4** (scan, pay, cash, done) |
| Worker error rate at end of week 1 | **< 2%** of sales needing correction |
| Owner able to answer "what did I earn today" unaided | **week 1** |

**Measure on a real low-end device over shop Wi-Fi**, never on a desktop over localhost —
that number is always flattering and always wrong.

---

## 21. Architecture

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
/docs       this PRD, ADRs, operator runbook
```

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

## 22. Roadmap

| Phase | Contents | Exit criterion |
|:--|:--|:--|
| **0 — Foundations** | Monorepo split, Prisma schema, money/quantity/UoM domain modules with tests, auth & roles, audit log | Domain tests green; a movement can be posted and replayed |
| **1 — Sell** | Catalogue, barcode (HID + camera), till, split tender, held sales, shifts with denomination counting, receipt printing | A real sale completes end-to-end on a phone in the shop |
| **2 — Trust** | Customers, debt ledger, allocation, repayments, aging, credit limits | Owner reconciles the digital ledger against the paper Nisya book |
| **3 — Buy** | Suppliers, receiving, landed cost, weighted average, payables, purchase returns | Margin report matches a hand-calculated check |
| **4 — Control** | Owner home with drill-down, reports, stocktake, write-offs, reorder suggestions, backup/restore drill | Owner runs a month-end unaided |
| **5 — Adopt** | Setup wizard, CSV import, quick-add, practice mode, embedded help, PWA polish, offline queue, Tauri, fiscal adapter (§16) | Pilot store runs a full month with no manual intervention |

**Pilot before scale.** One friendly store, running Simon in parallel with paper for two
weeks. Adoption by an actual worker under real queue pressure is the only meaningful
validation; everything before that is a hypothesis.

---

## 23. Risks

| Risk | Impact | Mitigation |
|:--|:--|:--|
| **Fiscal/ՀԴՄ non-compliance** | Product unusable or illegal | Resolve §16 before build completes; adapter reserved in the schema |
| **Worker rejects it under queue pressure** | No adoption; data rots | Sub-15-second checkout as a hard requirement; practice mode; pilot with a real worker |
| **Catalogue never gets populated** | System unusable | CSV import + quick-add at checkout (§7.3) |
| **Owner stops trusting the numbers** | Reverts to paper | Every figure drills to source events (rule 3) |
| Camera scanning needs a secure context | Core feature fails silently on phones | HID scanner primary; solve TLS early (§17) |
| Host PC dies | Total data loss, business stops | Tested restore, USB backups, spare-machine runbook |
| Money handled as floats | Books stop reconciling | §10.1, enforced by lint rule and domain tests |
| Shop Wi-Fi open to customers | API exposed to strangers | Staff SSID/VLAN, real auth, documented accepted risk |
| Too many settings | Owner cannot configure it, or misconfigures it | §6.11 — every setting must justify itself |

---

## 24. Open questions

1. **Fiscal:** is the pilot store obliged to use an ՀԴՄ, and can Simon drive or integrate
   with one? *(blocks §16 — highest priority)*
2. **Tax regime:** VAT, turnover, or micro? Are shelf prices tax-inclusive?
3. **Scale:** how many products, workers, tills, and daily transactions in the pilot store?
4. **Existing data:** what format is the current product list and debt book in?
5. **Hardware budget:** can the shop buy an HID scanner and a thermal printer, or must v1 be
   camera-only?
6. **Network:** is there staff/guest Wi-Fi separation, and who administers it?
7. **Multi-location:** a second shop within a year? *(Changes whether stock is keyed by
   location from the start — cheap now, expensive later.)*
8. **Support:** who fixes it at 9 p.m. on a Saturday when the host PC will not boot? The
   support model is a product requirement, not an afterthought.
9. **Language:** who reviews and owns the Armenian copy? (§4.2 — this cannot be left to the
   engineers.)

---

## 25. v1 acceptance criteria

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
9. A worker's session cannot obtain cost price or margin from **any** API endpoint.
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

---

*Sections 16 (fiscal/tax) and 24 (open questions) must be resolved with local professional
advice before commercial launch. Everything else in this document is a build instruction.*
