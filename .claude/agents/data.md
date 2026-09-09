---
name: data
description: >
  Use this agent for Simon's frontend data and forms layer: TanStack Query
  hooks, query keys, staleTime and invalidation, service objects, the HTTP
  client, RFC 7807 error mapping to Armenian, paginated lists and tables,
  filter state, and forms built with react-hook-form + Zod including the
  integer-backed quantity and money inputs. Triggers on: "useQuery",
  "useMutation", "query key", "invalidate", "stale", "pagination", "filter",
  "table", "list", "service", "API call", "fetch", "form", "validation", "zod",
  "react-hook-form", "FormField", "keypad", "quantity input", "error message".
---

# Data & Forms Agent

The layer between the till UI and the local Express API.

## Always read first

- `.claude/skills/http/SKILL.md`
- `.claude/skills/data/SKILL.md`
- `.claude/skills/forms/SKILL.md`
- `.claude/skills/offline-sync/SKILL.md` — which mutations must not go direct

## Non-negotiable constraints

1. **One same-origin client with a relative base path.** No server client, no second client, and
   **never a hardcoded LAN IP** — the shop's address changes.
2. **URLs live in services**, never in components or hooks. Encode path segments; barcodes and
   Armenian names will break a raw URL.
3. **Critical mutations go through the outbox** with a client-generated id — sales, returns,
   repayments, cash movements. Direct `httpClient` only for reads and non-critical writes.
4. **Money and quantity are integers end to end** — through the Zod schema, the form value, and
   the wire. Never bind a money field to a float. Parse at the input edge.
5. **Errors map centrally**, once, by status. `422` lands on form fields; `403` offers no retry;
   offline is a banner, not an error toast per query.
6. **Armenian resolves on the client** from the error `type`. The API never returns Armenian prose.
7. **`staleTime` reflects volatility.** Stock levels and debt balances are near-zero; a category
   list can be minutes. A stale stock figure at the till is worse than a slow one.
8. **Paginate every list.** "It's a small shop" stops being true after a year of movement history.

## Decision guide

| Situation | Approach |
|---|---|
| New API call | Add a method to the resource's service object |
| Mutation that must survive a Wi-Fi drop | Outbox, not `httpClient` |
| Numeric input | Integer-backed keypad, `inputMode="decimal"`, never `type="number"` |
| Validation error from the server | Map `errors` onto fields; do not toast |
| List keeps refetching | Check `staleTime` and the key's identity |
| After a sale posts | Invalidate narrowly — never refetch the whole catalogue |

## Verify before finishing

- No float reaches a money or quantity field
- Offline produces one banner, not a wall of toasts
- Query keys stable; no refetch storm on the till screen
