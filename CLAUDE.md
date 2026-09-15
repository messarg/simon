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

Phase 0 of §23 is in progress. What exists: the workspace split, `packages/shared/src/money.ts` with its tests, and placeholder entry points. What does **not** exist yet, despite being specified in the PRD and described by the skills below: Prisma schema, Express, any route or service, Tailwind, shadcn, TanStack Query, react-hook-form, Zod, the Armenian resource files. `frontend/src/App.tsx` is still the Vite scaffold, and `backend/src/index.ts` only logs. `backend/src/{domain,services,routes,jobs,lib}/` hold README stubs marking the intended layering. Do not assume a convention the skills describe is already wired up — check first, then add it the way the skill says.

### Invariants from the PRD that are expensive to fix later

- **Money is never a float.** Integers only: whole drams for transaction amounts, milli-drams (×1000) for unit costs and prices. `packages/shared/src/money.ts` owns all conversion and rounding.
- **Quantities are integers scaled ×1000** (milli-units), so 2.5 kg is `2500`.
- **Rounding is half-up on the absolute value, and happens exactly once** — on a line total, never on a unit price or an intermediate product. A return of 12.5 must round to the same magnitude as the sale of 12.5, or a one-dram ghost balance survives it.
- **Stock is an append-only `StockMovement` ledger.** `Product.stockQty` is a rebuildable cache, never the source of truth. Debt works the same way.
- **Costing is moving weighted average**, and `unitCost` is snapshotted onto each sale line so historical margins stay immutable.
- **Cost prices must be stripped server-side** for non-admin roles — hiding them in the UI is not access control.
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
npm run build                # per-workspace build (frontend only emits — see below)
npm run typecheck            # tsc --noEmit across every workspace
npm run lint                 # oxlint — frontend only; no other workspace has a lint script
npm test                     # vitest, single root run across all workspaces
npm run test:watch
npm run check:prd            # PRD index consistency (python3 scripts/check-prd.py)
```

`build`, `typecheck` and `lint` fan out with `--workspaces --if-present`; `test` does not — `vitest.config.ts` at the root is one runner covering `{packages,backend,frontend}/**/src/**/*.test.{ts,tsx}`. Playwright (when added) will own `tests/**`.

Single test file or case:

```bash
npm test -- money                    # by file/path pattern
npm test -- -t "rounds half up"      # by test name
```

`TZ` is pinned to `Asia/Yerevan` in `vitest.config.ts` — shift and report boundaries are shop-local time (PRD §19.3), so an unpinned machine would produce different results.

Frontend `build` is `tsc -b && vite build`, so a build failure there is often a type error rather than a bundling error. **Backend `build` is `tsc --noEmit`** — it produces no artifact at all (see below), so a green `npm run build` does not mean the backend was compiled.

## Architecture

### Backend: TypeScript is the runtime format

`backend` runs under `node --experimental-strip-types`, straight from `src/*.ts`. There is no transpile step and no `dist/`. Consequences that bite:

- **Relative imports must carry the `.ts` extension** (`./domain/sale.ts`), because Node resolves the real file.
- `erasableSyntaxOnly` is on: **no enums, no parameter properties, no namespaces** — only syntax that erases to nothing. Use union types and plain assignment instead.
- `module`/`moduleResolution` are `nodenext` here, while the frontend and shared use `bundler`. The same import can typecheck in one workspace and fail in the other.

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
