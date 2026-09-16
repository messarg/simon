# 6. A stocktake line is compared with the ledger at the moment it was counted

Date: 2026-09-16 · Status: accepted · PRD: §6.8, §13.4, §11 `StocktakeLine`, §10.4

## Context

§6.8 promises that counting "may happen while the shop trades" because "variance is computed
against the snapshot, not against a moving target", and §11 stores one `expectedQty` per line —
"the snapshot taken at `COUNTING`".

That is not enough. Take 40 sacks on the books at the snapshot. Two are sold before anyone reaches
that aisle; the counter finds 38. Against the snapshot the variance is −2, and approval books two
sacks as stolen that were sold and paid for. The snapshot removes the moving target from the
*expectation*, but the *shelf* keeps moving until the moment it is counted.

## Decision

- `Stocktake.snapshotSeq` records the ledger position the expectations were read at.
- Each count records `StocktakeLine.countedSeq`, the ledger position when it was taken.
- A line's expectation is the snapshot plus every stock movement between those two positions,
  stocktake postings excluded. The variance is the count minus that.
- Approval posts one `STOCKTAKE` movement per differing line, at the average at that moment
  (§10.4's table), and movements after the count are left alone.

This is possible only because §10.4 made `seq` the ledger's replay order; it needs no clock.

Also decided here, where the PRD is silent:

- **The count is blind** — the person counting sees what they counted, not what the books say,
  until the count goes to review. A counter shown "40" finds 40.
- **Uncounted lines are not adjusted.** An item nobody reached is not an item found missing.
- **One count at a time**, so two sessions cannot adjust the same shelf twice.
- **Approving clears the product's open `INSUFFICIENT_STOCK` flags**, since §13.6 calls that flag
  "the recount list" and the recount has happened.

## Consequences

Four columns the PRD's field list does not have (`snapshotSeq`, `countedSeq`, `countedAt`,
`countedBy`), plus `varianceQty` and `varianceTotal` so an approved count reads back as it was
approved. §11's `StocktakeLine` row should be amended to match; this is a PRD finding of the kind
its own history records — a rule complete as a sentence and incomplete as an instruction.

A recount by scanning (`mode: add`) takes its position from the latest scan, so an item sold
between two scans of the same product is still miscounted by that sale. Counting by typing the
total, which the screen offers first, does not have that gap.
