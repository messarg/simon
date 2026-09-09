# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Simon** (Սիմոն) is a self-hosted trade-management / POS system for small retail and hardware stores in Armenia, covering the full buy–sell cycle. **`docs/prd.md` is the authoritative specification — read it before implementing anything.**

The repository currently holds only the Vite `react-ts` starter. Per the PRD it becomes a monorepo (`/frontend`, `/backend`); moving the existing app under `/frontend` is the first structural step.

### Invariants from the PRD that are expensive to fix later

- **Money is never a float.** Integers only: whole drams for transaction amounts, milli-drams (×1000) for unit costs and prices. One shared module owns all conversion and rounding.
- **Quantities are integers scaled ×1000** (milli-units), so 2.5 kg is `2500`.
- **Stock is an append-only `StockMovement` ledger.** `Product.stockQty` is a rebuildable cache, never the source of truth. Debt works the same way.
- **Costing is moving weighted average**, and `unitCost` is snapshotted onto each sale line so historical margins stay immutable.
- **Cost prices must be stripped server-side** for non-admin roles — hiding them in the UI is not access control.
- **Sale ids are client-generated (UUIDv7) and `POST /sales` is idempotent** on them, so a retried request cannot double-charge.
- Business logic belongs in `backend/domain` (pure, unit-tested), not in routes or components.
- UI strings are Armenian and live in resource files; code, schema, and comments are English.

Unresolved: Armenian fiscal (ՀԴՄ) and tax-regime requirements — see PRD §10 and §18.

## Commands

```bash
npm install       # install dependencies
npm run dev       # dev server with HMR at http://localhost:5173
npm run build     # tsc -b (typecheck, all projects) then vite build -> dist/
npm run preview   # serve the production build from dist/
npm run lint      # oxlint
```

There is **no test runner configured**. Do not reference `npm test` or invent a single-test command until one is added (Vitest is the conventional pairing with Vite; it must be installed and wired into `package.json` first).

To typecheck without emitting a build, run `npx tsc -b --noEmit`. Note `npm run build` typechecks as its first step, so a build failure is often a type error rather than a bundling error.

## Architecture

- **Build tool:** Vite 8 with `@vitejs/plugin-react` (`vite.config.ts`). React 19, TypeScript 6.
- **Entry chain:** `index.html` → `src/main.tsx` (creates the React root in `#root`, wraps in `StrictMode`) → `src/App.tsx`.
- **TypeScript project references:** `tsconfig.json` is a solution file with no sources of its own; it references `tsconfig.app.json` (browser code under `src/`) and `tsconfig.node.json` (Node-side config such as `vite.config.ts`). Compiler options belong in the referenced config that matches the file's environment — editing the root `tsconfig.json` generally has no effect. Builds are incremental (`tsc -b`), so stale `.tsbuildinfo` can mask changes; `tsc -b --force` clears that.
- **Linting:** oxlint, configured in `.oxlintrc.json`. It is a standalone binary, not ESLint — ESLint plugins and `eslintrc` config do not apply.
- **Static assets:** files in `public/` are served at the site root and copied verbatim; files imported from `src/assets/` are hashed and bundled. Choose based on whether the URL must be stable.

## Conventions

- `.idea/` is gitignored (JetBrains is in use).
- The default branch is `master`.
