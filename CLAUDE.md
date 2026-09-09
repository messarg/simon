# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Simon** (Սիմոն) is a self-hosted trade-management / POS system for small retail and hardware stores in Armenia, covering the full buy–sell cycle. **`docs/prd.md` is the authoritative specification — read it before implementing anything.**

One repository, npm workspaces — frontend, backend, and shared code ship as a single artifact:

```
packages/shared/   @simon/shared — money, units, shared types. Imported by BOTH sides.
frontend/          React 19 + Vite 8, pure SPA (no SSR)
backend/           Node + Express + Prisma + SQLite  (skeleton only so far)
docs/prd.md        authoritative specification
```

`packages/shared` is consumed as TypeScript **source** through the `@simon/shared` alias — no build step, no build ordering. It is the load-bearing reason this is a monorepo: the money rules must exist exactly once.

### Invariants from the PRD that are expensive to fix later

- **Money is never a float.** Integers only: whole drams for transaction amounts, milli-drams (×1000) for unit costs and prices. One shared module owns all conversion and rounding.
- **Quantities are integers scaled ×1000** (milli-units), so 2.5 kg is `2500`.
- **Stock is an append-only `StockMovement` ledger.** `Product.stockQty` is a rebuildable cache, never the source of truth. Debt works the same way.
- **Costing is moving weighted average**, and `unitCost` is snapshotted onto each sale line so historical margins stay immutable.
- **Cost prices must be stripped server-side** for non-admin roles — hiding them in the UI is not access control.
- **Sale ids are client-generated (UUIDv7) and `POST /sales` is idempotent** on them, so a retried request cannot double-charge.
- Business logic belongs in `backend/domain` (pure, unit-tested), not in routes or components.
- UI strings are Armenian and live in resource files; code, schema, and comments are English.

Unresolved: Armenian fiscal (ՀԴՄ) and tax-regime requirements — see PRD §16 and §18.

## Commands

Run from the repository root; scripts fan out across workspaces.

```bash
npm install                  # installs every workspace and links @simon/*
npm run dev                  # frontend dev server, HMR at http://localhost:5173
npm run dev:api              # backend on :5000 (Vite proxies /api to it)
npm run build                # build every workspace
npm run typecheck            # tsc --noEmit across every workspace
npm run lint                 # oxlint
npm test                     # vitest, all workspaces
npm run test:watch
```

Single test file or case:

```bash
npm test -- money                    # by file/path pattern
npm test -- -t "rounds half up"      # by test name
```

Vitest owns `**/src/**/*.test.ts`; Playwright (when added) will own `tests/**`. `TZ` is pinned to `Asia/Yerevan` in `vitest.config.ts` — shift and report boundaries are shop-local time, so an unpinned machine would produce different results.

`npm run build` typechecks first, so a build failure is often a type error rather than a bundling error.

## Architecture

- **Build tool:** Vite 8 with `@vitejs/plugin-react` (`frontend/vite.config.ts`). React 19, TypeScript 6.
- **Entry chain:** `frontend/index.html` → `src/main.tsx` → `src/App.tsx`.
- **Aliases:** `@simon/shared` → `packages/shared/src`, `@/*` → `frontend/src/*`. Declared in **both** `vite.config.ts` (bundler) and `tsconfig.app.json` (type checker) — setting only one gives an editor that resolves imports the build then fails on.
- **API base URL:** relative (`/api`). Same-origin in production behind Nginx; Vite proxies to `localhost:5000` in dev. **Never hardcode a LAN IP.**
- **TypeScript 6 note:** `baseUrl` is deprecated and errors. `paths` resolve relative to the tsconfig file itself.
- **TypeScript project references:** `tsconfig.json` is a solution file with no sources of its own; it references `tsconfig.app.json` (browser code under `src/`) and `tsconfig.node.json` (Node-side config such as `vite.config.ts`). Compiler options belong in the referenced config that matches the file's environment — editing the root `tsconfig.json` generally has no effect. Builds are incremental (`tsc -b`), so stale `.tsbuildinfo` can mask changes; `tsc -b --force` clears that.
- **Linting:** oxlint, configured in `.oxlintrc.json`. It is a standalone binary, not ESLint — ESLint plugins and `eslintrc` config do not apply.
- **Static assets:** files in `public/` are served at the site root and copied verbatim; files imported from `src/assets/` are hashed and bundled. Choose based on whether the URL must be stable.

## Skills

Read the relevant `SKILL.md` **before** starting related work. After any change that adds,
removes, or modifies a convention, update the corresponding skill so it keeps matching the code.

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

## Agents

Spawn via the Agent tool for deep or parallel work.

| Agent | Domain |
|---|---|
| `pos-domain` | Money, costing, stock and debt ledgers, shifts, returns — the arithmetic |
| `offline` | Outbox, idempotency, sync conflicts, barcode input, PWA |
| `backend` | Express, Prisma, SQLite, transactions, validation, authorization |
| `auth` | PIN login, sessions, roles, field-level access, audit |
| `data` | HTTP services, TanStack Query, forms |
| `ui` | Components, styling, responsive, a11y, Armenian, audits |
| `testing` | All test layers |
| `perf` | Latency, bundle, SQLite contention, error handling, diagnostics |

## Conventions

- `.idea/` is gitignored (JetBrains is in use).
- The default branch is `master`; work happens on `development`. Releases are git tags — Simon is installed per shop, so there is no staging or production server to push to.
- Project instructions live in **this file only**. There is no `.claude/CLAUDE.md`.
