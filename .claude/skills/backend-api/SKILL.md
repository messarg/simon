---
name: backend-api
description: Simon's Express + Prisma + SQLite backend — layering (domain/services/routes), transaction discipline, WAL and concurrency, field-level authorization that strips cost prices, request validation with Zod, RFC 7807 errors, and LAN binding. Use when adding or changing any backend route, service, or Prisma model.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Backend (Express + Prisma + SQLite)

Self-hosted on the shop PC, serving the SPA and staff phones over the LAN. No cloud, no SSR,
no serverless. PRD §15.

## Layering

```
backend/src/
  domain/     pure logic — money, costing, allocation, units. No HTTP, no Prisma.
  services/   transactional use cases — createSale, receiveGoods, recordRepayment
  routes/     thin HTTP — parse, authorize, call a service, map errors
  jobs/       backup, cache reconciliation, reorder stats
  lib/        prisma client, logger, config
```

**Business logic lives in `domain/`.** A route that computes a total or decides a stock
delta is misplaced. The test for correct layering: can you unit-test the rule with no HTTP
server and no database? If not, it is in the wrong layer.

Routes are thin enough to read in one screen:

```ts
router.post("/sales", requireRole("WORKER"), async (req, res, next) => {
  const body = createSaleSchema.parse(req.body);
  const sale = await saleService.create(body, req.user);
  res.status(201).json(sale);
});
```

## Transactions

One database transaction per business document (see the `ledger` skill).

```ts
await prisma.$transaction(async (tx) => { /* read → write → reproject */ });
```

- The read that informs a write happens **inside** the transaction.
- **Nothing external inside a transaction** — no printing, no HTTP, no file I/O. SQLite has a
  single writer; a slow call inside the transaction blocks every other till.
- Print, toast, and notify **after** commit. A printer jam must not roll back a paid sale.

### SQLite configuration

```sql
PRAGMA journal_mode = WAL;      -- concurrent readers alongside one writer
PRAGMA busy_timeout = 5000;     -- wait rather than throw SQLITE_BUSY under contention
PRAGMA foreign_keys = ON;       -- OFF by default in SQLite — must be set per connection
PRAGMA synchronous = NORMAL;    -- safe with WAL; FULL is needlessly slow here
```

`foreign_keys = ON` is per-connection and off by default. Without it, referential integrity
is not enforced at all.

## Authorization

Two layers, both mandatory.

**1. Route-level**, default deny. Every route declares its required role
(`WORKER` / `STOCK` / `ADMIN`).

**2. Field-level — the one that is easy to get wrong.**

```ts
// Cost, margin, and supplier terms are stripped SERVER-SIDE for non-admins.
function projectProduct(p: Product, role: Role) {
  const base = { id: p.id, name: p.name, sellPriceMdram: p.sellPriceMdram, stockQty: p.stockQty };
  return role === "ADMIN" ? { ...base, avgCostMdram: p.avgCostMdram } : base;
}
```

Never `res.json(product)` on a raw Prisma object. A worker token must not be able to obtain
`avgCostMdram` from **any** endpoint — including list, search, report, and export. Hiding
cost in the UI is not a control; PRD §19.9 tests exactly this.

CORS is **not** authorization. It is a browser convention; `curl` ignores it. Restrict
origins for convenience, authorize on every route for security.

## Validation

Every request body, query, and param goes through a Zod schema at the route boundary. A POS
takes numeric input from tired humans on phone keypads — assume malformed input.

- Money and quantity arrive as **integers** (see the `money` skill). Reject decimals at the
  boundary rather than coercing.
- Validate business invariants in the service, not the schema: sufficient stock, credit
  limit, shift open, sale not already returned.

## Errors — RFC 7807

```json
{ "type": "...", "title": "Insufficient stock", "status": 422,
  "detail": "...", "errors": { "lines.0.qty": ["exceeds available"] } }
```

Map centrally in one error middleware, not per-route. `400` malformed · `401` no/expired
session · `403` wrong role · `404` missing · `409` state conflict (shift already closed) ·
`422` business rule violated · `429` rate limited · `500` unexpected.

Client-facing messages are resolved to Armenian on the **client**, keyed by `type` — never
return Armenian prose from the API.

## Networking

- Bind `0.0.0.0` so phones on the shop Wi-Fi can reach it. This means **every device on that
  network can reach the API** — see the `auth` skill for the mitigations.
- Serve the built SPA and the API from one origin (Nginx in the Docker Compose deployment)
  so there is no cross-origin problem to solve in production.
- Never hardcode a LAN IP. The client discovers the API from its own origin.

## Prisma

- Migrations are checked in and applied on startup; the owner never runs a CLI.
- `Int` for money and quantity. **No `Float`, no `Decimal`** — Prisma's SQLite `Decimal`
  mapping does not give reliable precision.
- Index what is queried hot: `ProductBarcode.barcode` (unique), `StockMovement(productId, createdAt)`,
  `Sale(completedAt)`, `DebtEntry(customerId, createdAt)`.
- Never `delete` a product, customer, or supplier — deactivate. Historical documents
  reference them.
- Watch N+1 on list endpoints; use `select`/`include` deliberately, and remember `select`
  is also how field-level authorization is enforced.

## Logging

Structured (`pino`), one line per request with method, path, status, duration, user id.
**Never log** PINs, session tokens, or full customer records. Debt amounts tied to a named
customer are personal data (PRD §10.5).

## Testing

- `domain/` — unit tests, exhaustive, no I/O. Highest value in the repo.
- `services/` — integration tests against a temp SQLite file; assert ledger effects, not
  just the return value.
- `routes/` — Supertest for auth, validation, and error mapping. Include a test that a
  worker token cannot read cost from any endpoint.

## Checklist

- [ ] Logic in `domain/`, not routes
- [ ] One transaction per document; no external calls inside it
- [ ] `foreign_keys=ON`, WAL, `busy_timeout` set
- [ ] Route-level role check, default deny
- [ ] Field-level projection strips cost for non-admins
- [ ] Zod validation at every boundary
- [ ] RFC 7807 mapped centrally
- [ ] No `Float`/`Decimal` money in the schema
