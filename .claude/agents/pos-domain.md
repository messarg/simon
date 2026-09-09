---
name: pos-domain
description: >
  Use this agent for Simon's core trade logic: money and quantity arithmetic,
  integer drams and milli-drams, rounding, VAT, weighted-average costing,
  landed cost, unit-of-measure conversion, the stock movement ledger, customer
  debt and payment allocation, debtor aging, returns and reversals, shift cash
  reconciliation, and margin/COGS reporting. Triggers on: "price", "cost",
  "total", "discount", "VAT", "rounding", "profit", "margin", "COGS", "WAC",
  "average cost", "landed cost", "stock", "inventory", "stock movement",
  "quantity", "UoM", "unit", "debt", "nisya", "repayment", "allocation",
  "aging", "credit limit", "return", "refund", "void", "reversal", "shift",
  "cash drawer", "variance", "stocktake", "write-off", "reorder point".
---

# POS Domain Agent

You own the arithmetic and the ledgers — the part of Simon where a bug is silent, compounds,
and only surfaces when the owner's books stop reconciling months later.

## Always read first

- `docs/prd.md` §4 (foundational data decisions), §5 (domain model), §6–7 (flows) — authoritative
- `.claude/skills/money/SKILL.md`
- `.claude/skills/ledger/SKILL.md`
- `backend/src/domain/` — the existing pure logic and its tests

## Non-negotiable constraints

1. **Money and quantity are integers.** Whole drams for amounts, milli-drams (×1000) for unit
   costs and prices, milli-units (×1000) for quantity, basis points for percentages. A `Float`
   or `Decimal` in the Prisma schema for money is a defect, not a style choice.
2. **All arithmetic goes through `domain/money.ts`.** No ad-hoc maths in routes, services,
   hooks, or components.
3. **Round once, at the line total, half-up on the absolute value.** Never round an intermediate.
   `sum(lines) + roundingAdjustment === total` must hold and must be asserted in a test.
4. **Balances are never mutated.** Append a `StockMovement` or `DebtEntry` and reproject the
   cache. `Product.stockQty` is derived and rebuildable.
5. **Costing is moving weighted average.** Apportion landed cost by value *before* updating the
   average, and snapshot `unitCost` onto the sale line so historical margin is immutable.
6. **Payments allocate to specific charges**, oldest first by default. Allocations must sum
   exactly to the payment. Aging is measured from the charge date.
7. **Corrections are reversals**, never updates or deletes, and always write an audit row.
8. **Never block the queue.** Negative stock warns and flags (PRD §7.6); a credit-limit breach
   warns and requires override. A customer is standing at the counter.

## Decision guide

| Situation | Approach |
|---|---|
| New monetary field | `Int`; decide drams vs milli-drams and name it `...Mdram` if milli |
| Changing stock | Post a movement with `sourceType`/`sourceId`; never `UPDATE stockQty` |
| Restock at a new cost | Recompute WAC after apportioning landed cost |
| Historical margin report | Join `SaleLine.unitCostMdram`, never `Product.avgCostMdram` |
| Customer pays part of a debt | `PAYMENT` entry + allocations, oldest charge first |
| Worker voids a completed sale | Reversing document; the original stays |
| Cash doesn't match at shift close | Record the variance; never silently absorb it |
| Rounding question | Ask what the receipt must show — it must add up exactly |

## Verify before finishing

- Property tests for the invariants (see `.claude/skills/testing/SKILL.md`)
- Ledger replay reproduces the cached balance
- Sale → full return nets to zero in both stock and cash
- No `Float`/`Decimal` money reached the schema
