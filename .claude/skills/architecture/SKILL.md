---
name: architecture
description: Simon's monorepo structure and module conventions — frontend/backend layout, dependency flow, feature-module scaffolding, compliance review, and minimal-change refactors. Merges the former scaffold, architecture-review, and refactor skills. Use when creating a module, reviewing structure, or planning a refactor.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Architecture

## Monorepo layout

```
/frontend        React 19 + Vite 8 + TypeScript, pure SPA (no SSR)
  src/
    features/    domain modules, one per resource
    components/  ui/ (primitives) · shared/ (reusable) · common/ (shell)
    lib/         domain-agnostic infra — http, money, outbox, logger, i18n
    config/      env, navigation, settings
    types/       shared response/enum types
/backend         Node + Express + Prisma + SQLite
  src/
    domain/      pure logic — money, costing, allocation, units
    services/    transactional use cases
    routes/      thin HTTP
    jobs/        backup, reconciliation, stats
/docs            prd.md is authoritative
```

> The repository root is currently the Vite app. **Moving it under `/frontend` is the first
> structural step** (PRD §22 Phase 0) — do it before adding backend code, not after.

## Dependency flow

```
frontend:  app/routes → features → lib
                  ↘ components
backend:   routes → services → domain
```

Allowed: routes → features/components/lib · features → lib/config/types · components → ui/lib
· lib → config only.

**Forbidden:** `lib` importing from `features` · `features` importing from routes ·
cross-feature imports · `domain` importing Prisma or Express.

`domain/` importing Prisma is the violation to watch for — it is what makes money logic
untestable, and it creeps in one convenience import at a time.

## Feature module

```
frontend/src/features/<name>/
  schema.ts    Zod schemas + z.infer types
  types.ts     API response interfaces
  service.ts   service object using httpClient
  hooks.ts     TanStack Query hooks
  index.ts     barrel
```

Import features through the barrel, everything else by path:

```ts
import { useProducts, type Product } from "@/features/products";
import { FormField } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { httpClient } from "@/lib/http";
```

Backend counterpart:

```
backend/src/services/<name>.service.ts     transactional use cases
backend/src/routes/<name>.routes.ts        thin HTTP
backend/src/domain/<name>.ts               pure rules, if any
```

## Scaffolding a new feature

1. Confirm it is a feature, not a component. A feature owns data and a lifecycle.
2. Backend first — Prisma model → domain rules + tests → service → route.
3. Frontend — schema, types, service, hooks, barrel.
4. Wire navigation and roles.
5. Tests at the right layer (see the `testing` skill).

Do not scaffold all five frontend files if only two are needed. An empty `schema.ts` is
noise; add it when there is a schema.

## Review

Run these when auditing:

```bash
grep -rn "from \"@/features/" frontend/src/lib frontend/src/components   # forbidden direction
grep -rn "@prisma/client" backend/src/domain                             # domain must stay pure
grep -rn "from \"@/features/[a-z]*\"" frontend/src/features              # cross-feature import
grep -rniE "float|decimal" backend/prisma/schema.prisma                  # money must be Int
grep -rn "res.json(product\|res.json(sale" backend/src/routes            # raw object leak
```

Also check: business logic sitting in a route or component; a balance mutated outside the
ledger; a mutation bypassing the outbox; hardcoded Armenian in a component; a hardcoded LAN
IP.

## Refactoring

- **Minimal change.** Preserve behaviour; do not restyle or redesign while restructuring.
- One concern per pass: move files, *then* change logic — never both in one commit, or the
  diff becomes unreviewable.
- Prove behaviour is preserved with tests that pass before and after. For money and ledger
  code this is non-negotiable.
- Deleting is a legitimate refactor. Dead code in a POS is a liability.
- Do not "improve" the architecture of code you were not asked to touch.

## Recurring decisions

| Question | Answer |
|---|---|
| Where does business logic go? | `backend/src/domain/`, pure and tested |
| Component used by two features? | `components/shared/` |
| Feature needs another feature's data? | Lift to `lib/` or compose at the route level |
| New third-party dependency? | Justify it — this ships to a low-end phone and a shop PC |
| Server-side rendering? | Never. Pure SPA (PRD §2) |

## Checklist

- [ ] Dependency flow respected
- [ ] `domain/` free of Prisma/Express
- [ ] No cross-feature imports
- [ ] Feature files earned, not boilerplate
- [ ] Refactor preserves behaviour, proven by tests
- [ ] Moves and logic changes in separate commits
