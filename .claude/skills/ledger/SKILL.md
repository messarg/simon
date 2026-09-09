---
name: ledger
description: Append-only ledgers for Simon — stock movements and customer debt. Posting rules, cached balance projection, payment allocation and debtor aging, reversal instead of deletion, and the transactional integrity rules every document must follow. Use whenever code changes stock quantity, customer debt, or supplier payables.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Ledgers: stock & debt

Two append-only ledgers carry every quantity and every dram of credit in Simon. PRD §10.4,
§10.6, §10.7, §13.1.

## The rule

**Never mutate a balance. Append an entry and reproject.**

`Product.stockQty` and any customer debt total are **caches** — derived, disposable, and
rebuildable by replaying the ledger from the beginning. The ledger is the truth.

A mutable counter cannot answer the question the owner will actually ask — *"why does the
system say 14 and the shelf has 11?"* — and it silently loses every concurrent write.

## Stock ledger

```prisma
model StockMovement {
  id            String   @id            // UUIDv7
  productId     String
  type          MovementType
  qtyDelta      Int                     // signed milli-units: negative = out
  unitCostMdram Int                     // cost at the moment of movement
  balanceAfter  Int                     // running balance, for audit + fast reads
  sourceType    String                  // "Sale" | "GoodsReceipt" | "Stocktake" | ...
  sourceId      String
  userId        String
  note          String?
  createdAt     DateTime @default(now())

  @@index([productId, createdAt])
}
```

```
SALE · SALE_RETURN · PURCHASE_RECEIPT · PURCHASE_RETURN
ADJUSTMENT · WRITE_OFF · STOCKTAKE · TRANSFER · OPENING_BALANCE
```

**Every movement carries its source document.** A movement with no `sourceType`/`sourceId`
is a bug — it means stock changed and nothing explains why.

### Posting

```ts
// Inside ONE transaction. Read → write → reproject, never split across transactions.
await prisma.$transaction(async (tx) => {
  const product = await tx.product.findUniqueOrThrow({ where: { id }, select: { stockQty: true, avgCostMdram: true } });
  const balanceAfter = product.stockQty + qtyDelta;

  await tx.stockMovement.create({ data: { ...movement, balanceAfter } });
  await tx.product.update({ where: { id }, data: { stockQty: balanceAfter } });
});
```

The read that informs the write happens **inside** the transaction. Reading stock, deciding,
then writing in a second transaction is the classic oversell race.

### Reprojection & drift

A rebuild function must exist and be tested:

```ts
rebuildStock(productId): recompute stockQty and avgCost by replaying movements in order
```

A scheduled job asserts `cache === replay` for every product and reports drift. Drift is
never auto-corrected silently — it is surfaced, because a mismatch means a bug worth finding.

## Debt ledger (Nisya)

```prisma
model DebtEntry {
  id         String   @id
  customerId String
  type       DebtType   // CHARGE | PAYMENT | ADJUSTMENT
  amount     Int        // whole drams, always POSITIVE; type carries direction
  saleId     String?
  dueDate    DateTime?
  createdAt  DateTime
  userId     String
  @@index([customerId, createdAt])
}

model DebtAllocation {
  id             String @id
  paymentEntryId String
  chargeEntryId  String
  amount         Int
}
```

**Amounts are always positive; `type` carries the sign.** Mixed-sign amounts make every
aggregate query a source of bugs.

### Allocation — why it matters

A payment is not just a number against a balance; it is **allocated to specific charges**,
oldest first by default, overridable by the worker. Without allocation you cannot produce
debtor aging, and aging is the entire reason to digitise the paper Nisya book. "Owes 45,000"
is not actionable. "Owes 45,000, of which 30,000 is over 90 days" is.

```ts
export function allocateOldestFirst(payment: Dram, openCharges: OpenCharge[]): Allocation[]
```

- Allocations for one payment **must sum exactly** to the payment amount.
- Overpayment becomes a credit — an `ADJUSTMENT` entry, not a negative charge.
- `outstanding(charge) = charge.amount - sum(allocations)`. Never store it.

### Aging buckets

`0–30 / 31–60 / 61–90 / 90+`, measured from the **charge** date (not the last payment), by
outstanding amount per charge. Surface the oldest unpaid charge at checkout before a new
debt sale is confirmed (PRD §12.2) — that screen is the product's core value.

## Correction, never deletion

Finalised sales, receipts, and payments are immutable (PRD §10.7).

| Wrong | Right |
|---|---|
| `DELETE FROM sales WHERE id = ...` | Create a linked reversing document (`reversesId`) |
| `UPDATE product SET stockQty = 11` | Post an `ADJUSTMENT` movement with a reason |
| Editing a posted payment's amount | Reverse it and post the correct one |

A `DRAFT` sale that was never completed may be discarded — nothing was posted. Once
`COMPLETED`, only reversal.

Every posting writes an `AuditLog` row: actor, action, entity, before/after.

## Transactional integrity

One database transaction per business document. For a sale that commits:
sale → lines → payments → stock movements → debt charge → audit log.

- SQLite in **WAL** mode with a `busy_timeout`; single writer, so keep transactions short.
- No network calls, no printing, no toast inside a transaction. Print **after** commit —
  a printer failure must never roll back a sale that the customer already paid for.
- Idempotency is enforced at the document id (see the `offline-sync` skill), so a retried
  request cannot post the same movements twice.

## Checklist

- [ ] Balance changed only by appending a movement/entry
- [ ] Read-for-write inside the transaction
- [ ] `sourceType`/`sourceId` set on every movement
- [ ] `balanceAfter` recorded
- [ ] Cache reprojection function exists and is tested
- [ ] Payment allocations sum exactly to the payment
- [ ] Correction is a reversal, never an update or delete
- [ ] Audit log written in the same transaction
