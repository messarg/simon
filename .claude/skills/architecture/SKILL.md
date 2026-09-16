---
name: architecture
description: Simon's monorepo structure and module conventions — frontend/backend layout, dependency flow, feature-module scaffolding, compliance review, and minimal-change refactors. Merges the former scaffold, architecture-review, and refactor skills. Use when creating a module, reviewing structure, or planning a refactor.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Architecture

## Monorepo layout

```
/                npm workspaces root — vitest config, scripts across all workspaces
/packages/shared @simon/shared — money, units, shared types. Used by BOTH sides.
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

> The split is done. `packages/shared` is consumed as TypeScript **source** via a path alias
> (`@simon/shared`) — no build step and no build ordering. Add a new shared module by
> exporting it from `packages/shared/src/index.ts`.

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


## Keeping the PRD's indexes honest

`docs/prd.md` carries three indexes that must agree, and they are edited in different places:

| Index | Holds |
|---|---|
| §9 FR index | every requirement, and which §27 criterion verifies it |
| §23.1 build order | every criterion, and which layer proves it |
| §27 | the criteria themselves |

**Adding a model to §11 or a criterion to §27 means updating the sections that index them.**
Between 2026-09-10 and 09-12 that step was missed five times in three review rounds — a stale
model count, eleven criteria with no requirement, eleven with no build layer, a criterion
assigned to one layer when it needed two, and a cross-reference to a setting that did not
exist. Every one was silent, and every one was found only by reading the whole document again.

Run `npm run check:prd` after any edit to §9, §11, §23.1 or §27. It asserts that every criterion
has both a requirement and a layer, that no index cites something that does not exist, and that
no FR id is referenced without being defined. It also warns about count claims of the
"All 37 models" kind, which §23.1's own prose correctly predicts will rot.

A criterion that deliberately has no requirement is declared in the PRD itself, in the
`<!-- prd-check: criteria-without-requirement = ... -->` comment beside the prose that justifies
it — so the exemption and its reasoning live together, and the tool honours it. Add to that
comment rather than weakening the check.


---

## Packaging (phase 5)

One repository, one artifact: `Dockerfile` builds two images — `runtime` (Express, TypeScript run
directly under `--experimental-strip-types`) and `web` (Nginx serving the built SPA and proxying
`/api` on the same origin). `docker-compose.yml` names the volumes that hold the database, the
backups, the host key file, the prints and the logs; `scripts/dev-cert.sh` writes the certificate.

**TLS is not optional** (§16.6): there is no plain-HTTP deployment, because the camera needs a secure
context and a daily warning teaches people to tap through warnings. The certificate has to be trusted
on each staff device — that step belongs in the install, not in a footnote.
