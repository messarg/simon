---
name: testing
description: Testing strategy for Simon — Vitest unit and property tests for money/ledger logic, component tests with Testing Library, Supertest for the Express API, and Playwright for critical journeys. Covers the test pyramid, what belongs in each layer, and the domain invariants that must be property-tested.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Testing

A pyramid, thinnest at the top. Match a new test to the layer that fits — do not push logic
up into E2E, where it runs slowly and fails flakily.

```
        Playwright     critical journeys, real browser
      Supertest        API contract, auth, error mapping
    Component          Testing Library + jsdom
  Unit + property      domain logic — the widest layer
```

## Layer 1 — unit & property (the important one)

`backend/src/domain/**` and `frontend/src/lib/**`, node environment, no I/O.

This is where Simon's correctness actually lives. Money, costing, allocation, and unit
conversion are pure functions — there is no excuse for them not to be exhaustively tested.

**Property tests (fast-check) for the invariants:**

```ts
// money
sum(lineTotals) + roundingAdjustment === saleTotal
net + tax === gross                              // for any rate, any gross
apportionByValue(values, cost).sum() === cost    // remainder never vanishes
lineTotal(q, p) is monotonic in q

// costing
WAC after receipt is between min and max of the inputs
sale then full return nets to zero in both stock and cash

// allocation
allocations for one payment sum exactly to the payment
sum(outstanding) === sum(charges) - sum(payments)

// ledger
replaying movements reproduces the cached balance, for any ordering of appends
```

Table tests for every rounding boundary: `.5` up, negative `.5`, zero, and the largest
realistic amount.

## Layer 2 — component

Vitest + jsdom + Testing Library, opted into per file.

Worth testing: the checkout basket (scan adds a line, rescanning increments, void removes),
numeric keypad decimal handling per `decimalPlaces`, form validation display, and the
Armenian search input matching a Latin-typed query — that last one is a regression that
will otherwise recur.

- Query by role and accessible name, not by test id or class. If that is hard, the component
  has an accessibility problem worth fixing.
- Include an `axe` assertion on components workers touch under time pressure.
- Adversarial input: emoji, mixed script, very long Armenian names, `<script>` (must render
  as inert text).
- Stub heavy client-only modules (camera scanner) with `vi.mock`.

## Layer 3 — API

Supertest against a temp SQLite file, migrations applied, per-test rollback or a fresh file.

**Drive `t.server`, never `t.app`.** `createTestApp` listens once and every request goes to that
server. Handing Supertest an Express app instead makes it start and tear down a server per request,
and under a parallel run a client can reach another test file's server — seen as `socket hang up`,
`Expected HTTP/`, a `404` on a route that plainly exists, and a write that lands in another test's
database. A test file that builds its own app must `.listen(0)` and close it too.

Tests write nothing into the working tree: `vitest.config.ts` points `SIMON_DATA_DIR`,
`SIMON_BACKUP_DIR` and `SIMON_KEY_DIR` at a scratch path, and anything touching backups assigns its
own temporary directories to `backupPaths` in `backup.service.ts`.

Must cover:
- **Idempotency:** POST the same sale id twice → exactly one sale and one set of movements.
- **Field-level authorization:** enumerate endpoints; a `WORKER` token gets cost from none.
- Transaction integrity: a failure mid-sale leaves no partial movements.
- RFC 7807 shapes and status mapping.
- Business rules: insufficient stock, credit limit, shift already closed, double return.
- **Reports against a hand-worked day**, not against themselves: build the sales, the return, the
  write-off and the receipt, then assert each report's rows and totals (`control.routes.test.ts`).
- The audit trail and diagnostics are gated **as routes** — assert the `403` for `WORKER` and `STOCK`.

Assert **ledger effects**, not just the response body. A sale that returns `201` but posts
the wrong stock movement is the bug that matters.

## Layer 4 — E2E (Playwright)

Few, high-value, slow. The PRD §25 acceptance criteria are the shortlist:

- Cash sale of three scanned items completes.
- Split payment lands correctly against drawer and customer.
- Partial return restocks and reverses COGS.
- Shift close computes expected cash and records variance.
- **Selling continues through a simulated network outage and every queued sale syncs exactly
  once** — the highest-value E2E in the project.

Notes:
- Simulate the outage with route interception, not by killing the server.
- Barcode scanning is keyboard input — `page.keyboard.type` reproduces an HID scanner
  faithfully. Camera scanning cannot be E2E-tested; cover it manually.
- Run the responsive projects (phone / tablet / desktop) for the till screens.
- Keep Playwright in `tests/`, Vitest in `src/` — the runners must never pick up each
  other's specs.

## What not to test

- Prisma itself, Express itself, the router.
- Exact Armenian copy — assert keys, not translated strings, or every copy edit breaks tests.
- Visual snapshots of the whole till screen; they will churn constantly.

## Running

```bash
npm test                 # Vitest, watch off
npm run test:watch
npm run test:coverage
npm run test:e2e         # Playwright
npm test -- money        # single file / pattern
npm test -- -t "rounds half up"   # single test by name
```

Pin `TZ` in the Vitest config. Shift and report boundaries are shop-local time (PRD §19.3),
and a machine in another timezone must not produce different results.

## CI

Fast job on every push: typecheck + lint + unit/component + API tests. E2E separately — it is
slower and needs a booted app. A failing domain test blocks everything; this is money.

## Checklist

- [ ] New domain logic has unit tests before it has callers
- [ ] Money/ledger invariants covered by property tests
- [ ] Idempotency test for every queue-drained endpoint
- [ ] Field-level authorization test enumerates endpoints
- [ ] Ledger effects asserted, not just responses
- [ ] `TZ` pinned
- [ ] Tests query by role, not test id
