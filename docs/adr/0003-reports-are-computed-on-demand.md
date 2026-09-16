# 3. Reports are computed from the ledgers on demand

Date: 2026-09-16 · Status: accepted · PRD: §20.1, §20.2, §6.9, rule 3

## Context

Thirteen reports and an owner home screen need sums over sales, movements, debt and payables. The
usual answer is rollup tables refreshed on a schedule.

## Decision

Every figure is computed from the stored rows when it is asked for. The only cached derivations are
the ones §11 already declares caches and drift-checks: `Product.stockQty`, `avgCostMdram` and
`ProductStats` (velocity, refreshed by a job).

## Consequences

Every number drills to its rows, which is rule 3 and the thing that converts a suspicious owner into
a trusting one — a rollup would have to be re-derived to prove itself anyway. There is no window in
which a report and the ledger disagree, and no rebuild step after a correction or a restore.

The cost is query time at §19.3's volumes — thousands of rows a month on one shop's PC, indexed by
`businessDate`. If a shop ever outgrows that, the fix is an index or a materialised view behind the
same function, not a second source of truth.
