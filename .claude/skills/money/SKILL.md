---
name: money
description: Money and quantity arithmetic for Simon — integer drams and milli-drams, never floats. Rounding rules, weighted-average cost (WAC), landed-cost apportionment, unit-of-measure conversion, VAT extraction, and cash rounding. Use whenever code touches a price, cost, total, discount, tax, debt amount, or stock quantity.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Money & quantity

The single most important invariant in this codebase. Get it wrong and the books stop
reconciling; the damage is silent and only shows up months later when the owner's totals
disagree with the drawer. See PRD §10.1–4.5.

## The rule

**Money and quantity are integers. `number` with a decimal point never holds a monetary value.**

| Concept | Unit stored | Type | Example |
|---|---|---|---|
| Line total, sale total, payment, debt balance | whole dram | `int` | `12500` = 12,500 ֏ |
| Unit price, unit cost, weighted average cost | **milli-dram** (÷1000) | `int` | `12500000` = 12,500 ֏/unit |
| Quantity | **milli-unit** (÷1000) | `int` | `2500` = 2.5 kg |
| Percentage (discount, VAT) | basis points (÷10000) | `int` | `2000` = 20% |

### Why two scales for money

Transaction amounts are whole drams because that is what changes hands — AMD has no
circulating subunit. Unit costs need finer resolution: a weighted average of a screw bought
at 12 ֏ and 13 ֏ is 12.4 ֏, and rounding that to a whole dram on every goods receipt makes
the error compound into visible COGS drift. Three extra decimal places absorbs it.

## Never do this

```ts
const total = qty * price;              // float qty, float price — wrong twice over
const vat = total * 0.2;                // 0.1 + 0.2 !== 0.3
if (paid === total) { ... }             // float equality on money
const avg = (a + b) / 2;                // silent truncation, wrong direction
price.toFixed(2)                        // formatting used as arithmetic
```

## Do this

All arithmetic goes through **`packages/shared/src/money.ts`**, imported as `@simon/shared`
by both the backend and the till. It exists exactly once — this is the reason Simon is a
monorepo. Two copies drift, and a till displaying a total the server did not compute is
precisely the bug this representation exists to prevent.

```ts
export type Dram = number;        // integer, whole drams
export type MilliDram = number;   // integer, dram × 1000
export type MilliUnit = number;   // integer, quantity × 1000
export type Bps = number;         // integer, percent × 100

/** Line total in whole drams from a milli-unit qty and a milli-dram unit price. */
export function lineTotal(qty: MilliUnit, unitPrice: MilliDram): Dram {
  // qty(×1000) * price(×1000) = ×1_000_000 → divide back to whole drams
  return roundHalfUp(qty * unitPrice, 1_000_000);
}

/** Half-up division of integers. Handles negatives symmetrically (returns/refunds). */
export function roundHalfUp(numerator: number, denominator: number): number {
  const sign = Math.sign(numerator) || 1;
  return sign * Math.floor((Math.abs(numerator) + denominator / 2) / denominator);
}
```

### Rounding rules

1. **Round once, at the line total.** Never round a unit price, a factor, or an
   intermediate product. Sum already-rounded line totals to get the sale total.
2. **Half-up**, applied to the absolute value so a return of 12.5 rounds to the same
   magnitude as the sale of 12.5. Banker's rounding is wrong here — the receipt must mirror
   the original sale exactly or a partial return leaves a one-dram ghost balance.
3. **Cash rounding is a separate, visible line.** If the store rounds cash to the nearest
   10 ֏, the sale carries `roundingAdjustment` so `sum(lines) + rounding == total` always
   holds. Never fold it into a line.

### Integer overflow

`Number.MAX_SAFE_INTEGER` is 9.007e15. A milli-dram unit price times a milli-unit quantity
is ×10⁶, so a single line stays safe below ~9e9 drams. Fine in practice, but do not chain
two ×1000 multiplications before dividing back down.

## Weighted average cost (WAC)

Simon uses moving weighted average, not FIFO (PRD §10.5). On every goods receipt:

```ts
export function newAverageCost(
  stockQty: MilliUnit, currentAvg: MilliDram,
  receivedQty: MilliUnit, receiptUnitCost: MilliDram,
): MilliDram {
  const totalQty = stockQty + receivedQty;
  if (totalQty <= 0) return receiptUnitCost;       // restock from zero or negative
  const totalValue = stockQty * currentAvg + receivedQty * receiptUnitCost;
  return roundHalfUp(totalValue, totalQty);
}
```

- **Landed cost first.** Delivery, duty, and other receipt-level charges are apportioned
  across receipt lines **by value** before the average moves. Skipping this systematically
  overstates margin — the single most common costing error in small-retail systems.
- **Snapshot on sale.** `SaleLine.unitCostMdram` is written at sale time from the then-current
  average. Never join to `Product.avgCostMdram` for a historical margin report, or restocking
  silently rewrites last month's profit.
- **Negative stock** uses the last known average and flags the movement (PRD §13.6).

```ts
/** Apportion a receipt-level cost across lines by value; remainder to the largest line. */
export function apportionByValue(lineValues: Dram[], cost: Dram): Dram[] { /* ... */ }
```

Apportionment **must** sum exactly to the input cost. Distribute the rounding remainder to
the largest line rather than letting it vanish; assert the sum in a test.

## Unit of measure

Three roles per product (PRD §10.3): purchase, stock, sale. Conversion is by integer factor.

```ts
// Receiving 3 spools of 50 m: qty 3000 milli-units × factor 50 → 150_000 milli-metres
const stockQty = purchaseQty * unitsPerPurchaseUnit;
```

Never convert through a float. If a factor is genuinely fractional, store it scaled and
divide with `roundHalfUp` — and question the data model first.

## VAT

`taxCategory` sits on the product; the regime sits in settings (PRD §16). Whether prices are
tax-**inclusive** or tax-**exclusive** is a store-level setting and changes the maths:

```ts
// inclusive: extract the tax already inside the price
const net   = roundHalfUp(gross * 10_000, 10_000 + rateBps);
const tax   = gross - net;
// exclusive: add it on
const tax   = roundHalfUp(net * rateBps, 10_000);
```

Extract-then-subtract, so `net + tax === gross` exactly. Computing both independently
leaves off-by-one drams on roughly half of all receipts.

## Formatting — display only

```ts
formatDram(12500)      // "12 500 ֏"   — never used as an input to arithmetic
formatQty(2500, 3)     // "2.5"
```

Parsing user input is the inverse and belongs in the same module: parse to integer at the
edge, keep it integer everywhere inside. Never round-trip through `toFixed`.

## Testing

Money logic is pure and must be exhaustively tested — this is the highest-value test surface
in the project.

- Property tests (fast-check): `lineTotal` is monotonic in qty; apportionment sums to input;
  `net + tax === gross`; a sale followed by a full return nets to zero in both stock and cash.
- Table tests for every rounding boundary (`.5` up, negative `.5`, zero).
- A reconciliation test that replays a ledger and asserts the cached balance matches.

## Checklist

- [ ] No `float`/decimal money in Prisma schema — `Int` only
- [ ] No arithmetic on money outside `domain/money.ts`
- [ ] Rounding applied exactly once, at the line total
- [ ] `unitCost` snapshotted onto the sale line
- [ ] Landed cost apportioned before WAC update, and sums exactly
- [ ] `sum(lines) + rounding === total` asserted in a test
