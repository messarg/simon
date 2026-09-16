# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Simon** (Սիմոն) is a self-hosted trade-management / POS system for small retail and hardware stores in Armenia, covering the full buy–sell cycle. **`docs/prd.md` is the authoritative specification — read the relevant section before implementing anything.**

One repository, npm workspaces — frontend, backend, and shared code ship as a single artifact:

```
packages/shared/   @simon/shared — money, units, shared types. Imported by BOTH sides.
frontend/          React 19 + Vite 8, pure SPA (no SSR)
backend/           Node + Express + Prisma + SQLite  (skeleton only so far)
docs/prd.md        authoritative specification
docs/event-storming/  domain-discovery output (events, commands, bounded contexts, personas)
```

`packages/shared` is consumed as TypeScript **source** — no build step, no build ordering. It is the load-bearing reason this is a monorepo: the money rules must exist exactly once.

### Current state of the tree

Built phase by phase in PRD §23's order, each phase committed and reviewed before the next. **Phases 0–5 are done, which is §9's v1 feature list**: foundations, Sell, Trust, Buy, Control, Adopt. **Phase 6 (v2) is partly done**: stocktake sessions, purchase orders with reorder-to-order, shelf labels and the fiscal adapter seam are built; multi-location (unspecified in the PRD beyond a nullable `locationId`) and Tauri packaging (no Rust toolchain) are waiting on decisions.

What exists:
- `packages/shared/src/` — money (`groupDigits`, `formatDram`), `tax.ts`, `sale-math.ts` (`computeSale`, the one sale total the till shows and the server recomputes), `return-math.ts` (`computeReturn`), `cash.ts` (denominations), `search.ts` (Latin-typed Armenian), `time.ts`, `enums.ts`, `problems.ts`, `settings.ts`, `schemas.ts` (request bodies both sides validate).
- `backend/src/domain/` — pure rules with tests: costing, ledger replay/drift, debt allocation projection, aging, shift cash, discount cap, drawer, PIN policy.
- `backend/prisma/schema.prisma` — every §11 model; migrations post-processed by `prisma/strictify.ts` (STRICT + CHECKs) and applied on startup by `src/lib/migrate.ts`.
- `backend/src/{lib,services,routes,middleware,jobs}` — Express 5 app: auth (PIN, lockout, devices, sessions, re-auth grants), settings, users, catalogue, sales (idempotent on id + status, server-owned arithmetic, the cap, accept-and-flag), returns, shifts and cash movements, printing and the drawer behind `lib/hardware/printer.ts`, review flags, drift job. Supertest suites name the §27 criteria they prove.
- `frontend/src/` — theme, Armenian strings, `lib/` (http, session, connection probe, IndexedDB, catalogue cache, outbox, HID scanner, device receipt numbers), shells, and screens: sign-in, first-run owner setup, till (scan/search/tiles/camera, keypad, swipe-undo, price override, held baskets, quick-add, discount, payment with split), returns, shift (open, X-report, cash movements, denomination close, Z-report), stock, products, settings (with users, devices, sessions).
- Debt book (Phase 2): `backend/src/services/{debt,customer}.service.ts` and `routes/debt.routes.ts` — debt sales with limit/block (refused at the counter, flagged from the queue), repayments (cash writes REPAYMENT, card writes nothing), reversal with re-entry, merge, erasure, aging, a debt-reduction tender on returns, linked reversal of cash movements with drill-through; `frontend/src/features/debt/` — customer picker with inline create, the four-line debt panel, repayment, ledger, owner controls; `lib/customers.ts` IndexedDB cache with the offline debt cap.
- Buying (Phase 3): `backend/src/services/{supplier,receiving,purchase-return,supplier-payment,stock-adjust,margin}.service.ts` and `routes/buy.routes.ts` — receiving with unit conversion, landed cost and the weighted average; purchase returns at landed cost with §13.7's band guard (applied identically by the ledger replay); payables through one allocation table with overpayment credits and linked payment reversal; write-offs and admin-re-authed adjustments; cost corrections and a margin report as booked and restated; `frontend/src/features/buying/` and `features/stock/` — receiving, receipts and returns, suppliers with payment, write-off and adjustment sheets.
- Control (Phase 4): `backend/src/services/{report,home,diagnostics,backup,stock-status}.service.ts`, `jobs/product-stats.ts` and `routes/control.routes.ts` — §20.2's thirteen reports behind one `GET /reports/:name` shape, owner home aggregates with every figure drilling to a report or a ledger, velocity and reorder suggestions, the audit trail as a route, `GET /diagnostics`, and encrypted backups (`VACUUM INTO` → AES-256-GCM, GFS rotation, USB copy at close, staged one-click restore, `npm run restore -w backend` for the drill); `frontend/src/features/{reports,control}/` with `app/pages/{HomePage,ReportsPage,AttentionPage}.tsx` — the report catalogue, one table with CSV export, the needs-attention list, and the backup and diagnostics panels in Settings.
- `tests/e2e/` — Playwright journeys: J1 → J2 → offline sale synced exactly once → J4, and the owner's day-end (passphrase, first backup, the alert clearing).
- Adopt (Phase 5): `backend/src/services/{import,practice}.service.ts` with `routes/control.routes.ts`'s import endpoints and `POST /session/mode` — CSV import for products, customers, opening stock and opening debts (idempotent on a natural key, per-row errors, never partially applied, original dates preserved), and practice mode as a second database file seeded from the shop and deleted on exit; `frontend/src/app/pages/{SetupPage,ImportPage}.tsx`, `app/practice.ts` and `components/shared/ScreenHelp.tsx` — the five-question wizard (skippable, resumable, ending on the two secrets), the import preview, the practice toggle, and contextual help with one-time coach marks.
- Extend (Phase 6): `backend/src/services/{stocktake,purchase-order,label,fiscal}.service.ts`, `lib/hardware/{label-printer,fiscal}.ts` and `routes/extend.routes.ts`, with the pure rules in `domain/{stocktake,purchase-order}.ts` and Code128 in `packages/shared/src/code128.ts`. Stocktake counts blind and compares each line with the ledger at the moment it was counted (ADR 0006); purchase orders are optional, filled by receiving, and drafted from reorder suggestions; labels print as an A4 sheet from the screen or as ZPL to a label printer; fiscal receipts go through a device seam that never blocks a sale (ADR 0007). Screens: `app/pages/{StocktakePage,LabelsPage}.tsx`, `features/buying/{OrdersPanel,OrderEditor}.tsx` under Suppliers, and "from an order" in receiving.
- Packaging: `Dockerfile` (one file, two images — Express and Nginx+SPA), `docker-compose.yml`, `docker/nginx.conf` and `scripts/dev-cert.sh`. And a Mac app: `desktop/macos/main.swift` (a WKWebView window that starts the bundled API on `127.0.0.1:47800`) built by `scripts/build-macos.sh` into `release/` — a single-machine preview, not a shop install, until Tauri arrives in v2. The API serves the SPA itself when `SIMON_STATIC_DIR` is set. TLS is required, not optional (§16.6). The SPA is installable: `vite-plugin-pwa` precaches the shell only — data has its own cache and queue.
- `docs/runbook.md` (installing a shop, the restore drill, and what each in-app alert means) and `docs/adr/` (the decisions that deviate from a literal reading of the PRD, with the reasoning).

Unbuilt by choice: everything §9 assigns to v2. The Docker images are written but have not been built on this machine (no daemon), and Armenian on a real ESC/POS printer is still unverified.

### Invariants from the PRD that are expensive to fix later

- **Money is never a float.** Integers only: whole drams for transaction amounts, milli-drams (×1000) for unit costs and prices. `packages/shared/src/money.ts` owns all conversion and rounding.
- **Quantities are integers scaled ×1000** (milli-units), so 2.5 kg is `2500`.
- **Rounding is half-up on the absolute value, and happens exactly once** — on a line total, never on a unit price or an intermediate product. A return of 12.5 must round to the same magnitude as the sale of 12.5, or a one-dram ghost balance survives it.
- **Stock is an append-only `StockMovement` ledger.** `Product.stockQty` is a rebuildable cache, never the source of truth. Debt works the same way.
- **Costing is moving weighted average**, and `unitCost` is snapshotted onto each sale line so historical margins stay immutable.
- **Cost prices must be stripped server-side** for non-admin roles — hiding them in the UI is not access control. Costs also travel inside a `ReviewFlag.note`, which no field-by-field rule would look inside: notes are stripped in `shapeFlag`.
- **Practice mode is a second database file, never a flag on a row** (§19.4). Nothing in `schema.prisma` knows practice exists except `Session.mode`, so no report, export or replay has to remember a `WHERE` clause. A queued practice document is tagged in the outbox and discarded on exit, never drained.
- **A money or quantity cell that is not whole in its scaled unit is an import row error, never a rounded value** (§19.1, §27.38). This is the one path where decimals arrive by design.
- **The backup passphrase never enters the database.** It lives in a file on the host (`SIMON_KEY_DIR`), so a stolen USB drive carries no way to decrypt itself, and a restore needs only the file and the owner's paper (§19.2, §27.10).
- **Sale ids are client-generated (UUIDv7) and `POST /sales` is idempotent** on them, so a retried request cannot double-charge.
- Business logic belongs in `backend/src/domain` (pure, unit-tested), not in routes or components. The test for correct layering: can the rule be unit-tested with no HTTP and no database?
- UI strings are Armenian and live in resource files; code, schema, and comments are English.

Unresolved: Armenian fiscal (ՀԴՄ) and tax-regime requirements — see PRD §17 and §26.

## Working with the PRD

`docs/prd.md` is ~3,700 lines / 290 KB — too large to read whole. Navigate it:

- **§0** maps the document into four parts and says which audience each serves.
- **§23.1 is where to start before writing code.** It orders *code* into dependency layers (arithmetic → schema → services → HTTP → access → client → operations), names the PRD section that specifies each, and lists the acceptance criteria that close it. §23's phase table orders *features* instead; the two lists differ deliberately.
- **§9 is the authority on what ships in a release** (§23 only orders the building), and indexes every numbered requirement to the criterion that verifies each.
- **§27 holds the v1 acceptance criteria** that §9 and §23.1 both reference.
- `npm run check:prd` enforces that those three indexes agree, **and that the document's enumerated sets agree with each other** — movement types against §10.4's per-type table, `CashMovement` types and `PAY_OUT` reason codes against §11's source rule, `ReviewFlag` against §8.5's warning types, the three audit lists against one another, and admin-re-auth operations against §14.5's offline table. Sets that live in prose declare their membership in a `<!-- prd-check: key = ... -->` marker beside the argument for them; adding a member means adding it there.
- `npm run check:prd:test` mutation-tests the checker: defects the PRD actually shipped, reintroduced one at a time, each asserted caught. Run it after changing `check-prd.py`; `npm test` runs both via `pretest`. Both failure modes it guards against were found only by reading the whole document again — five times for the indexes, six more for the sets.

## Commands

Run from the repository root.

```bash
npm install                  # installs every workspace and links @simon/*
npm run dev                  # frontend dev server, HMR at http://localhost:5173
npm run dev:api              # backend on :5000 (Vite proxies /api to it)
                             # macOS: AirPlay Receiver holds :5000 — run PORT=5055 npm run dev:api
                             # and SIMON_API_URL=http://localhost:5055 npm run dev
npm run build                # per-workspace build (frontend only emits — see below)
npm run typecheck            # tsc --noEmit across every workspace
npm run lint                 # oxlint — frontend only; no other workspace has a lint script
npm test                     # vitest, single root run across all workspaces
npm run test:watch
npm run check:prd            # PRD index consistency (python3 scripts/check-prd.py)
npm run db:seed -w backend   # dev database: owner 1111, stock 2222, worker 3333, 12 products (refuses if users exist)
npm run restore -w backend -- --from <backup.simonbak>   # restore drill (§27.10); asks for the passphrase
scripts/dev-cert.sh simon.local 192.168.1.50             # the shop's TLS certificate (§16.6); trust it on every device
docker compose up -d --build                             # Nginx + Express on one origin; see docs/runbook.md §0
scripts/build-macos.sh       # release/Simon-<version>-arm64.dmg — the Mac app (needs swiftc)
npm run test:e2e             # Playwright journeys; starts its own API (:5065) and SPA (:5175) on a throwaway database
npm run db:new-migration -w backend   # prisma migrate dev --create-only, then strictify the new SQL
```

`build`, `typecheck` and `lint` fan out with `--workspaces --if-present`; `test` does not — `vitest.config.ts` at the root is one runner covering `{packages,backend,frontend}/**/src/**/*.test.{ts,tsx}`. Playwright (when added) will own `tests/**`.

Single test file or case:

```bash
npm test -- money                    # by file/path pattern
npm test -- -t "rounds half up"      # by test name
```

Tests never write into the working tree: `vitest.config.ts` points the data directory, the backup directory and the host key file at a scratch path, and each `createTestApp` **listens once** and sends every request to that server — Supertest otherwise starts and tears down a server per request, and under a parallel run a client could reach another test file's server, which showed up as `socket hang up`, `Expected HTTP/`, a 404 on a route that exists, and writes landing in another test's database.

`TZ` is pinned to `Asia/Yerevan` in `vitest.config.ts` — shift and report boundaries are shop-local time (PRD §19.3), so an unpinned machine would produce different results.

Frontend `build` is `tsc -b && vite build`, so a build failure there is often a type error rather than a bundling error. **Backend `build` is `tsc --noEmit`** — it produces no artifact at all (see below), so a green `npm run build` does not mean the backend was compiled.

## Architecture

### Backend: TypeScript is the runtime format

`backend` runs under `node --experimental-strip-types`, straight from `src/*.ts`. There is no transpile step and no `dist/`. Consequences that bite:

- **Relative imports must carry the `.ts` extension** (`./domain/sale.ts`), because Node resolves the real file.
- `erasableSyntaxOnly` is on: **no enums, no parameter properties, no namespaces** — only syntax that erases to nothing. Use union types and plain assignment instead.
- `module`/`moduleResolution` are `nodenext` here, while the frontend and shared use `bundler`. The same import can typecheck in one workspace and fail in the other.
- **The Prisma CLI is a dev dependency.** The running API needs only `@prisma/client` and the adapter; `backend/scripts/postinstall.mjs` generates the client when the CLI is present and otherwise requires it to have been generated at build time. A production install must be `--omit=dev --omit=optional --omit=peer`, or `@prisma/client`'s optional peer drags the CLI and ~150 MB back in.

### `@simon/shared` resolves two different ways

- **Frontend:** the Vite alias in `frontend/vite.config.ts` plus `paths` in `frontend/tsconfig.app.json`, both pointing at `packages/shared/src/index.ts`. Declared in **both** — setting only one gives an editor that resolves imports the build then fails on.
- **Backend:** the npm workspace symlink, via `packages/shared/package.json`'s `main`/`types`/`exports`, which all point at the TypeScript source. Node type-stripping reads it directly.
- Because the export map is a **single entry point**, a new file under `packages/shared/src/` is invisible until it is re-exported from `index.ts`.

### Frontend

- **Build tool:** Vite 8 with `@vitejs/plugin-react` (`frontend/vite.config.ts`). React 19, TypeScript 6.
- **Entry chain:** `frontend/index.html` → `src/main.tsx` → `src/App.tsx`. `@/*` aliases `frontend/src/*`.
- **API base URL:** relative (`/api`). Same-origin in production behind Nginx; Vite proxies to `localhost:5000` in dev. **Never hardcode a LAN IP** — the backend binds `0.0.0.0` for shop phones, and authorization is per route, never CORS.
- **TypeScript 6 note:** `baseUrl` is deprecated and errors. `paths` resolve relative to the tsconfig file itself.
- **TypeScript project references:** `frontend/tsconfig.json` is a solution file with no sources of its own; it references `tsconfig.app.json` (browser code under `src/`) and `tsconfig.node.json` (Node-side config such as `vite.config.ts`). Compiler options belong in the referenced config that matches the file's environment — editing the root `tsconfig.json` generally has no effect. Builds are incremental (`tsc -b`), so stale `.tsbuildinfo` can mask changes; `tsc -b --force` clears that.
- **Linting:** oxlint, configured in `frontend/.oxlintrc.json`. It is a standalone binary, not ESLint — ESLint plugins and `eslintrc` config do not apply.
- **Static assets:** files in `public/` are served at the site root and copied verbatim; files imported from `src/assets/` are hashed and bundled. Choose based on whether the URL must be stable.

## Skills

Read the relevant `SKILL.md` in `.claude/skills/` **before** starting related work. After any change that adds, removes, or modifies a convention, update the corresponding skill so it keeps matching the code.

Domain skills — these encode the invariants above and are the ones that matter most:

| Skill | Use when |
|---|---|
| `money` | Any price, cost, total, discount, tax, or quantity. Integer arithmetic, rounding, WAC, landed cost, UoM |
| `ledger` | Any change to stock or debt. Append-only movements, allocation, aging, reversal |
| `offline-sync` | Sale submission, outbox, idempotency, IndexedDB cache, service worker |
| `barcode` | Scanning — HID wedge, camera and its secure-context constraint, unknown codes |
| `backend-api` | Express routes, Prisma, SQLite transactions, WAL, field-level authorization |
| `i18n-hy` | Armenian strings, Latin-typed search, AMD formatting, plurals, dates |

Platform skills:

| Skill | Use when |
|---|---|
| `architecture` | Monorepo layout, dependency flow, scaffolding a module, refactoring, compliance review |
| `auth` | PIN login, sessions, roles, re-auth, LAN hardening |
| `http` | Frontend API calls, service objects, error mapping |
| `data` | TanStack Query hooks, keys, invalidation, pagination, tables |
| `forms` | react-hook-form + Zod, integer-backed quantity and money inputs |
| `components` | Component tier placement, shadcn primitives (Vite path) |
| `styling` | Tailwind v4 semantic tokens |
| `responsive` | Breakpoints, container queries, touch layout, PWA offline |
| `a11y` | ARIA, keyboard, focus, contrast, WCAG 2.2 AA |
| `ui-audit` | Design-system audit before shipping a screen (colour, Tailwind, icons, touch) |
| `testing` | Vitest, property tests, Supertest, Playwright |
| `perf` | Scan latency, bundle, re-renders, SQLite contention |
| `observability` | Error boundaries, logging, error UX, diagnostics |

Vendored reference skills — third-party, checked in, **reference material rather than authority**.
Installed with `npx skills add <owner/repo> -s <skill> --copy` and pinned in `skills-lock.json`:

| Skill | Source | Use when | Read the override note first |
|---|---|---|---|
| `node` | `mcollina/skills` | Node 22 native TypeScript, type stripping, ESM, async patterns, graceful shutdown, profiling | `backend-api` |
| `prisma-client-api` | `prisma/skills` | Queries, filters, `select`/`include`, `$transaction` | `backend-api` |
| `prisma-cli` | `prisma/skills` | `migrate`, `generate`, `validate` | `backend-api` |
| `prisma-database-setup` | `prisma/skills` | **`references/sqlite.md` only** — the other providers do not apply | `backend-api` |
| `prisma-upgrade-v7` | `prisma/skills` | Only if we adopt Prisma 7, which requires a driver adapter | `backend-api` |
| `sqlite-best-practices` | `erayack/sqlite-best-practices` | Pragmas, indexing, query plans, `EXPLAIN QUERY PLAN` | `backend-api` |

**When they conflict, the order is `docs/prd.md` → Simon's own skill → the vendored skill.** These
are generic and Simon is not: none of them knows about integer drams, the `seq` replay order, a
single-writer file, or a shop with one PC. `backend-api` has a table of exactly which pages to
ignore and which Simon overrides — read it before following vendored advice. They are also not
maintained here: `npx skills update` pulls upstream changes, which may silently reintroduce advice
we have overridden.

## Spec tooling

Two generic toolkits live in `.claude/`, wired as slash commands whose bodies delegate to a `SKILL.md`:

- **PRD Builder** — `/prd-discover`, `/prd-draft`, `/prd-refine`, `/prd-analyze`, `/prd-validate`, `/prd-diff`, `/prd-search`, `/prd-status`, `/prd-tasks`, `/prd-diagram`, `/prd-export`, `/prd-add-feature`, `/prd-ui-prototype`. Instructions in `.claude/prd/<name>/SKILL.md`, templates in `.claude/prd/templates/`, guides in `.claude/prd/docs/`.
- **Event storming** — `/event-storming`, instructions in `.claude/event-storm/SKILL.md`, with five persona prompts. Output lands in `docs/event-storming/`.

These are general-purpose tools, not Simon-specific rules. They describe a `prd/<feature>/` output convention; Simon's actual spec is the single `docs/prd.md`, and `npm run check:prd` is what guards it.

## Agents

Spawn via the Agent tool for deep or parallel work. Definitions in `.claude/agents/`.

| Agent | Domain |
|---|---|
| `pos-domain` | Money, costing, stock and debt ledgers, shifts, returns — the arithmetic |
| `offline` | Outbox, idempotency, sync conflicts, barcode input, PWA |
| `backend` | Express, Prisma, SQLite, transactions, validation, authorization — routes and services |
| `database` | Prisma schema and migrations, indexes, query plans, pragmas, cache-drift jobs — what is stored and how it is read |
| `auth` | PIN login, sessions, roles, field-level access, audit |
| `data` | HTTP services, TanStack Query, forms |
| `ui` | Components, styling, responsive, a11y, Armenian, audits |
| `testing` | All test layers |
| `perf` | Latency, bundle, SQLite contention, error handling, diagnostics |

## Conventions

- `.idea/` is gitignored (JetBrains is in use), as is `.claude/settings.local.json`.
- **`skills-lock.json` is committed.** It pins the vendored skills above to a resolved version, so
  a fresh clone gets the same reference material. Vendored skills are copied (`--copy`), not
  symlinked into `node_modules`, because they are read by a human and by an agent long after any
  install step.
- `.claude/settings.json` denies reading `.env*`, `**/*.db` and `**/backups/**` — shop data and secrets stay out of context.
- Work happens on `development`, and local `origin/HEAD` points there. `master` is retained and fast-forwarded from `development`, never committed to directly. **GitHub's repository default is still `master`**, so a PR opened on github.com bases on `master` unless changed, and `git remote set-head origin --auto` will snap `origin/HEAD` back — verify with `git ls-remote --symref origin HEAD` rather than trusting the local ref. Releases are git tags — Simon is installed per shop, so there is no staging or production server to push to.
- Project instructions live in **this file only**. There is no `.claude/CLAUDE.md`.
