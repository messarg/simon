---
name: testing
description: >
  Use this agent for Simon's tests: Vitest unit and fast-check property tests
  for money, costing, allocation and ledger invariants; Testing Library
  component tests; Supertest API tests for idempotency, authorization and
  transaction integrity; and Playwright journeys including the offline sync
  test. Triggers on: "test", "unit test", "property test", "fast-check",
  "vitest", "supertest", "playwright", "e2e", "coverage", "flaky", "fixture",
  "mock", "test a single", "invariant".
---

# Testing Agent

A pyramid, thinnest at the top. Simon's correctness lives in pure domain logic — test it there,
not through a browser.

## Always read first

- `.claude/skills/testing/SKILL.md`
- `docs/prd.md` §19 (v1 acceptance criteria) — the E2E shortlist
- `.claude/skills/money/SKILL.md` and `ledger/SKILL.md` — the invariants to assert

## Non-negotiable constraints

1. **Domain logic is tested at the unit layer**, exhaustively, with no I/O. Never smuggle money
   maths into an E2E test.
2. **Property-test the invariants**: `sum(lines) + rounding === total`; `net + tax === gross`;
   apportionment sums to input; allocations sum to the payment; ledger replay reproduces the
   cached balance; sale → full return nets to zero.
3. **Every queue-drained endpoint has an idempotency test** — same id twice, one document.
4. **Field-level authorization is tested by enumeration** — a worker token against every endpoint.
5. **Assert ledger effects**, not just response bodies. A `201` with the wrong stock movement is
   the bug that matters.
6. **Pin `TZ`.** Shift and report boundaries are shop-local; a machine in another timezone must
   not change results.
7. **Query by role and accessible name**, not test ids. If that's hard, fix the component.
8. **Don't assert translated Armenian strings** — assert keys, or every copy edit breaks the suite.
9. Runners stay separate: Vitest owns `src/**`, Playwright owns `tests/**`.

## Decision guide

| Situation | Approach |
|---|---|
| New pure function | Unit + property test, before it has callers |
| New endpoint | Supertest: happy path, authz, validation, ledger effect, idempotency |
| New screen | Component test for behaviour; E2E only if it's a PRD §19 criterion |
| Simulating an outage | Route interception, not killing the server |
| Testing a scan | `page.keyboard.type` — an HID scanner *is* a keyboard |
| Camera scanning | Not E2E-testable; cover manually and say so |
| Flaky test | Fix the race or the assumption; never add a sleep |

## Running

```bash
npm test                          # Vitest
npm test -- money                 # single file / pattern
npm test -- -t "rounds half up"   # single test by name
npm run test:e2e                  # Playwright
```
