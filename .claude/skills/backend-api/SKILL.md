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
is not enforced at all — and §11's `ON DELETE RESTRICT` convention silently enforces nothing on
whichever connection missed it.

**Assert it on a connection taken from the pool, not on the first one opened.** Those are
different questions and only the second is easy to answer by accident. Under Prisma 7 the driver
adapter (`@prisma/adapter-better-sqlite3`) is what opens connections, so it is what applies these.

**Money and quantity tables are `STRICT`** (PRD §11). SQLite is dynamically typed: a column
declared `INTEGER` accepts a `REAL` without complaint, so the declaration alone is a convention
the storage engine does not know about. Prisma does not emit `STRICT` — append it in the generated
migration SQL, which is checked in, and keep a schema test that asserts it is still there.

**`STRICT` permits exactly six type names: `INT`, `INTEGER`, `REAL`, `TEXT`, `BLOB`, `ANY`.**
Prisma's SQLite provider emits `BOOLEAN` for `Boolean` and `DATETIME` for `DateTime`, and **neither
is legal** — the migration fails at `migrate dev`, not at review. So: booleans are `Int` in the
Prisma schema (0/1), timestamps are `String` holding RFC 3339, per §11's field conventions. This
is the one place adopting `STRICT` constrains the schema language rather than just the data.

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
cost in the UI is not a control; PRD §25.9 tests exactly this.

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

**Prisma 7.10 with the `prisma-client` generator and `@prisma/adapter-better-sqlite3`.** The client is
generated as TypeScript into `backend/src/generated/prisma/` (gitignored, regenerated on `postinstall`)
with `importFileExtension = "ts"`, and runs directly under `--experimental-strip-types`. The CLI reads
its URL from `backend/prisma.config.ts`; the runtime builds clients in `src/lib/db.ts`, which sets the
four PRAGMAs on every client and opens the live and practice files separately.

- **New migration:** `npm run db:new-migration -w backend` = `prisma migrate dev --create-only` then
  `prisma/strictify.ts` on the new SQL. Strictify appends `STRICT` and the enum/boolean/range `CHECK`s
  from its two tables (`ENUM_CHECKS`, `EXTRA_CHECKS`); add a check there, not by hand in SQL.
  `src/lib/schema.test.ts` fails if any migration table lacks `STRICT`.
- **Applied on startup** by `src/lib/migrate.ts`, which records into the same `_prisma_migrations`
  table the CLI uses. Tests use it too (`src/test/db.ts`), so every test runs on the real SQL.
- Interactive transaction type: `Tx` from `src/lib/db.ts`. Services take `Db | Tx` and never open
  their own transaction when handed one.
- Migrations are checked in and applied on startup; the owner never runs a CLI.
- `Int` for money and quantity. **No `Float`, no `Decimal`** — Prisma's SQLite `Decimal`
  mapping does not give reliable precision.
- Index what is queried hot: `ProductBarcode.barcode` (unique), **`StockMovement(productId, seq)`**,
  `Sale(businessDate)`, `Sale(completedAt)`, `DebtEntry(customerId, createdAt)`,
  `ReviewFlag(resolvedAt, type)`.
- **The ledger replays by `seq`, never `createdAt`** (PRD §10.4). `seq` is the server's monotonic
  insertion order and the order `balanceAfter` was computed in; `createdAt` comes from the device,
  so a sale that sat an hour in an outbox carries an earlier timestamp than rows already posted.
  Replaying by `createdAt` reorders every late arrival and makes the drift job fire on ordinary
  Wi-Fi drops — an alert that fires on a normal Tuesday is one the owner mutes by week two.
- Never `delete` a product, customer, or supplier — deactivate. Historical documents
  reference them.
- Watch N+1 on list endpoints; use `select`/`include` deliberately, and remember `select`
  is also how field-level authorization is enforced.

## Logging

Structured (`pino`), one line per request with method, path, status, duration, user id.
**Never log** PINs, session tokens, or full customer records. Debt amounts tied to a named
customer are personal data (PRD §16.5).

## Testing

- `domain/` — unit tests, exhaustive, no I/O. Highest value in the repo.
- `services/` — integration tests against a temp SQLite file; assert ledger effects, not
  just the return value.
- `routes/` — Supertest for auth, validation, and error mapping. Include a test that a
  worker token cannot read cost from any endpoint.

## Settings: two routes, and the difference is the point

`GET /settings` is `ADMIN`-only and returns everything. **`GET /settings/client` answers any
authenticated session** and returns an explicit shape carrying the keys a till must **enforce or
render** (PRD §15.4, §14.4):

- **enforce** — tax rate, price basis, cash rounding, the discount cap, the offline debt cap, the
  offline discount ceiling, and the two strict modes (negative stock, credit limit);
- **render** — whether the debt book is on, which decides whether the worker's Պարտքեր destination
  exists at all (§5.1: the concept is absent, not disabled), and text size (§21, WCAG).

*Enforce or render* is the definition, not a flourish: writing only *enforce* is what left the
debt-book toggle out and would have drawn a tab for a feature the shop does not have.

A `WORKER`'s till has to enforce those numbers and cannot enforce a number it was never sent. The
control is the **shape**, not the route: a setting added later is invisible to the client until
someone adds it to that shape, which is the opposite failure mode from a filter that has to
remember to exclude things. Contrast `AuditLog`, which is gated as a whole route precisely because
its shape cannot be enumerated (§16.5).

The client caches the result in IndexedDB on the catalogue's `?since=` schedule. **A till whose
settings cache is empty refuses rather than guesses.**

## Vendored reference skills, and where Simon overrides them

Six third-party skills are checked in under `.claude/skills/`. They are **reference material, not
authority**: where one disagrees with `docs/prd.md` or with this file, the PRD wins. Each is
generic by design, and Simon is not a generic backend.

| Skill | Use it for | Simon overrides |
|---|---|---|
| `node` (mcollina) | Node 22 native TypeScript, type stripping, ESM, async patterns, graceful shutdown, profiling | Nothing contradicts us — it already says *use const objects instead of enums*, which is what `erasableSyntaxOnly` forces. Add: **relative imports must carry `.ts`**, and `module`/`moduleResolution` are `nodenext` in `backend/` while `frontend/` and `packages/shared` use `bundler` |
| `prisma-client-api` | `findMany`, filters, `select`/`include`, `$transaction` semantics | `$transaction` here is **one business document, no I/O inside** (§13.1). Interactive transactions hold the single writer — keep them short. `select` is also the field-authorization mechanism (§16.5), not just a perf tool |
| `prisma-cli` | `migrate dev`, `migrate deploy`, `generate`, `validate` | Migrations are **checked in and applied on startup** — the shop owner never runs a CLI. No `migrate reset` against anything but a scratch database |
| `prisma-database-setup` | `references/sqlite.md` only | Read the SQLite page. **Ignore the Postgres, MySQL, MongoDB, SQL Server and CockroachDB pages** — they are not our provider and their concurrency advice is actively wrong for a single-writer file |
| `prisma-upgrade-v7` | If and when we adopt Prisma 7 | v7 **requires a driver adapter**. For us that is `@prisma/adapter-better-sqlite3`, and the adapter is where the PRAGMAs below get set — on the connection, not in `schema.prisma`. Prisma is not yet a dependency, so this is a decision, not a migration |
| `sqlite-best-practices` | Pragmas, indexing, query plans, `EXPLAIN QUERY PLAN` | **`references/ops-read-replicas.md` does not apply** — one host, one file, one writer (§24.1). Everything in its Configuration and Query sections does |

**`STRICT` tables came from `sqlite-best-practices` and are now the rule** (PRD §11, §27.38).
A `STRICT` table rejects a value of the wrong storage class at write time, which turns §10.1's
*money is never a float* from a lint rule and a code review into a database constraint. That
matters because §21's lint rule only sees our source: it cannot see `$queryRaw`, a hand-edited
migration, or §19.1's spreadsheet import — the one path where decimals arrive by design. See
`references/schema-strict-tables.md`.

**When they conflict, the order is:** `docs/prd.md` → this skill → the vendored skill. A vendored
skill is a reference book on the shelf; it does not know about integer drams, the `seq` replay
order, or a shop with one PC.

## Checklist

- [ ] Logic in `domain/`, not routes
- [ ] One transaction per document; no external calls inside it
- [ ] `foreign_keys=ON`, WAL, `busy_timeout` set
- [ ] Route-level role check, default deny
- [ ] Field-level projection strips cost for non-admins
- [ ] Zod validation at every boundary
- [ ] RFC 7807 mapped centrally
- [ ] No `Float`/`Decimal` money in the schema
