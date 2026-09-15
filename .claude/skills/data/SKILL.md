---
name: data
description: TanStack Query v5 patterns — queries, mutations, query keys, invalidation, and filter state aligned with this codebase
argument-hint: "[query | mutation | keys | invalidation | filter]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Data layer

> **Simon specifics first** — the generic sections below this block describe another codebase's
> setup (Next.js `"use client"`, `src/app/providers.tsx`, feature `hooks.ts` barrels). In Simon:
>
> - The `QueryClient` is created in `frontend/src/app/App.tsx`: `staleTime` 30 s, one retry only on a
>   network failure (status 0), mutations never retried.
> - Reads go through `http` in `lib/http.ts` (relative `/api`, RFC 7807 → `ApiProblem` with `.type`
>   and `.field()`).
> - **Queue-drained writes never use `useMutation` or `http.post` directly** — sales, returns and cash
>   movements go through `outbox.enqueue` (`lib/outbox.ts`), which returns at once. Printing and the
>   drawer run after the server accepts a document, and only if it was completed online.
> - Offline-capable reads fall back to IndexedDB (`lib/local-db.ts`): the catalogue (`lib/catalogue.ts`,
>   synced by `?since=`), client settings (`app/settings.ts`) and the current shift (`app/shift.ts`).
>   A till with no settings cache refuses to price rather than guessing (§14.4).
> - Customers are cached like the catalogue (`lib/customers.ts`, `GET /customers/snapshot?since=`); `Customer.updatedAt` is touched on every debt entry so balances resync. Repayments go through the outbox as `debt-payment`; the offline debt cap sums debt already queued for that customer (`queuedDebtFor`).
> - Query keys in use: `["settings","client"]`, `["shifts","current",userId]`, `["products",…]`,
>   `["sales","held"]`, `["sales","recent"]`, `["customers","list",q]`, `["customers",id,"ledger"]`, `["shifts",id,"cash-movements"]`, `["users"]`, `["devices"]`, `["sessions"]`.

# TanStack

Covers **TanStack Query v5** — the data-fetching and mutation layer for this app. `@tanstack/react-table` is **not installed**, and there is **no generic DataTable or Pagination component** in the consumer app: list surfaces render plain cards/tables per feature and most consumer endpoints return plain arrays (not paginated pages). Do not reach for a shared table/pagination primitive — none exists.

---

## Package Versions

```json
"@tanstack/react-query": "^5.62.0",
"@tanstack/react-query-devtools": "^5.62.0"
```

Devtools **is** installed (dev dependency) — you can mount `<ReactQueryDevtools />` when debugging.

---

## 1. QueryClient Setup

**File:** `src/app/providers.tsx` — component `Providers`, client built by the `createQueryClient` factory.

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,          // 60s global default
        retry: 1,
        refetchOnWindowFocus: false, // off globally in this app
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

(The real `Providers` also wraps `ThemeProvider` + the sonner `<Toaster>` and wires the auth refresh handler in a `useEffect` — see the file.)

**Rules:**
- `useState(createQueryClient)` — factory form prevents recreating the client on re-render
- Global `staleTime: 60_000` — override per-query only when data changes faster or slower
- Global `retry: 1` — mutations default to 0 retries regardless
- Global `refetchOnWindowFocus: false` — refetch-on-focus is OFF app-wide; opt back in per-query only if you need it

---

## 2. Query Keys — Conventions

Each feature exports its query keys as **named consts or factory functions** at the top of its `hooks.ts` (there is no global/centralized key factory, but keys are not left as anonymous inline arrays either). Reuse the exported key everywhere the query is read or invalidated so the two never drift.

```typescript
// src/features/customers/hooks.ts
export const customerDebtKey = (customerId: string) => ["customers", customerId, "debt"] as const;

// src/features/subscriptions/hooks.ts
export const subscriptionKey = ["subscriptions", "status"] as const;

// src/features/people/hooks.ts
export const peopleRegistryKey = (profileId: string) => ["people", profileId] as const;
export const peoplePickerKey = (profileId: string, fldUid: string) =>
  ["people", "picker", profileId, fldUid] as const;
```

| Pattern | Key shape | Invalidates |
|---------|-----------|-------------|
| Collection | `["items"]` | All item queries |
| Collection scoped by id | `["items", profileId]` | One owner's collection |
| Collection + filter | `["items", filter]` | Only that filter combo |
| Single resource | `["item", id]` | One item |
| Single resource + variant | `["item", id, variant]` | One item in one variant |
| Static/singleton | `["subscriptions", "status"]` | One singleton query |

**Rules:**
- Export the key as a `const` (static) or a factory `(...) => [...] as const` (parameterised) — don't scatter anonymous inline arrays
- Every variable used inside `queryFn` must appear in the key
- Filter objects go directly in the key — TQ hashes them, property order doesn't matter
- Strip empty strings before passing to filter objects — use `|| undefined`
- For broad invalidation prefer the `["items"]` prefix — it also invalidates `["items", profileId]`, `["item", id]`, etc. via prefix matching

---

## 3. useQuery — Standard Pattern

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { itemService } from "./service";
import type { ItemListFilter } from "./schema";

// Collection query
export function useItems(filter: ItemListFilter = {}) {
  return useQuery({
    queryKey: ["items", filter],
    queryFn: () => itemService.getAll(filter),
    staleTime: 60_000,
  });
}

// Single resource
export function useItem(id: string) {
  return useQuery({
    queryKey: ["item", id],
    queryFn: () => itemService.getById(id),
    enabled: !!id,              // don't run until id is available
    staleTime: 60_000,
  });
}
```

**Key options:**

| Option | Type | Use |
|--------|------|-----|
| `staleTime` | `number` | Override global 60s (e.g. 300_000 for rarely-changing, 10_000 for live checks) |
| `enabled` | `boolean` | Guard against empty/falsy deps; defaults to `true` |
| `placeholderData` | `keepPreviousData \| (prev) => prev` | Prevent content flash on paginated queries |
| `select` | `(data) => T` | Transform/extract data before returning to component |
| `gcTime` | `number` | How long to cache when no subscribers (default 5min) |
| `refetchOnWindowFocus` | `boolean` | **Off globally** in this app (set `false` in the provider) — set `true` per-query only if you want focus refetch back |

Per-hook `staleTime` varies by data volatility — many hooks re-state `staleTime: 60_000` to match the global default, stock levels and debt balances drop much lower, or to `0` — a stale stock figure at the till is worse than a slow one. Set it explicitly per query rather than relying on the reader to remember the global.

**Return values used in practice:**
- `data` — the resolved value or `undefined` while loading
- `isLoading` — `true` only on first load (no cached data)
- `isFetching` — `true` on any background refetch; use for subtle loading indicators
- `isError` / `error` — error state
- `isSuccess` — data is available

---

## 4. Conditional & Dependent Queries

```typescript
// Conditional — only runs when value is non-empty
export function useCheckSlug(slug: string) {
  return useQuery({
    queryKey: ["items", "slug-check", slug],
    queryFn: () => itemService.checkSlug(slug),
    enabled: slug.length >= 1,
    staleTime: 10_000,
  });
}

// Dependent — second query uses result of first
export function useItemWithOwner(id: string) {
  const { data: item } = useItem(id);
  return useQuery({
    queryKey: ["users", item?.ownerId],
    queryFn: () => userService.getById(item!.ownerId),
    enabled: !!item?.ownerId,
  });
}
```

---

## 5. Parallel Queries in queryFn

When a computed result needs data from multiple sources fetch them inside a single query:

```typescript
const { data: combined } = useQuery({
  queryKey: ["combined-view", typeAIds, typeBIds],
  queryFn: async () => {
    const [typeADetails, typeBDetails] = await Promise.all([
      Promise.all(typeAIds.map((id) => typeAService.getById(id))),
      Promise.all(typeBIds.map((id) => typeBService.getById(id))),
    ]);
    return { typeA: typeADetails, typeB: typeBDetails };
  },
  enabled: typeAIds.length > 0 || typeBIds.length > 0,
  staleTime: 300_000,
});
```

**Rule:** Prefer this over two separate `useQuery` calls when the component only needs the combined result.

---

## 6. useMutation — Standard Pattern

```typescript
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiRequestError } from "@/types/common";
import { itemService } from "./service";
import type { CreateItemInput, UpdateItemInput } from "./schema";

// Local per-feature helper (duplicated across features — there is no global getProblemDetail).
// httpClient throws ApiRequestError, so narrow on it to reach detail / field-level errors.
function messageFromError(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    if (error.errors) {
      const lines = Object.values(error.errors).flat();
      if (lines.length > 0) return lines.join(" ");
    }
    return error.detail ?? error.payload.title ?? fallback;
  }
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateItemInput) => itemService.create(data),
    onSuccess: () => {
      toast.success("Item created successfully");
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
    onError: (error) => toast.error(messageFromError(error, "Failed to create item")),
  });
}

export function useUpdateItem(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateItemInput) => itemService.update(id, data),
    onSuccess: () => {
      toast.success("Changes saved");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["item", id] });
    },
    onError: (error) => toast.error(messageFromError(error, "Failed to save changes")),
  });
}
```

**Rules:**
- `toast` lives inside `onSuccess/onError` — never in the component's submit handler
- `queryClient.invalidateQueries` lives inside `onSuccess` — never in the component
- Collection mutations (create/delete): invalidate `["items"]` (prefix match covers all)
- Single-resource mutations (update): invalidate both `["items"]` and `["item", id]`
- Scoped sub-resource updates: only invalidate `["item", id]` (no need to blow out the list)
- Error handling: `httpClient` throws `ApiRequestError` (from `@/types/common`) — route it through the feature's local `messageFromError(error, fallback)` rather than reading a raw `.message`

### Inline callbacks — for navigation and form reset only

```typescript
// In component — inline callbacks are only for UI side-effects, never for toast/invalidation
createItem.mutate(data, {
  onSuccess: (result) => router.push(`/<feature>/${result.id}`),
});

// Form reset after inline add
addChild.mutate(data, {
  onSuccess: () => form.reset(),
});
```

### mutate vs mutateAsync

```typescript
// mutate — fire-and-forget; use in event handlers
createItem.mutate(data);

// mutateAsync — returns Promise; use when you need to await or compose
try {
  const result = await createItem.mutateAsync(data);
  // further logic that depends on result
} catch (error) {
  // onError in hook already handles toast; only catch here for extra logic
}
```

### Mutation state flags

| Flag | Meaning |
|------|---------|
| `isPending` | In flight — disable submit buttons |
| `isSuccess` | Last call succeeded |
| `isError` | Last call failed |
| `reset()` | Clears error/data back to idle |

---

## 7. Query Invalidation Strategy

```typescript
// Prefix invalidation — hits ["items"], ["items", filter], ["item", id], etc.
queryClient.invalidateQueries({ queryKey: ["items"] })

// Exact invalidation — only ["item", "abc123"]
queryClient.invalidateQueries({ queryKey: ["item", id], exact: true })

// Predicate — full control
queryClient.invalidateQueries({
  predicate: (query) => query.queryKey[0] === "items" && query.queryKey[1] !== "slug-check",
})
```

**Conventions:**
- Mutations that affect the collection → `invalidateQueries({ queryKey: ["items"] })`
- Mutations that affect one item → also `invalidateQueries({ queryKey: ["item", id] })`
- Mutations that affect only a sub-resource → `invalidateQueries({ queryKey: ["item", id] })` only

---

## 8. Filter + Search State (List Page Pattern)

Most consumer list endpoints return plain arrays, so client-side filter/search state is the common case; page state is only needed for the rare truly-paginated endpoint. Keep the debounced-search pattern regardless.

```typescript
"use client";

const ALL_VALUE = "__all__";   // sentinel for Select "show all" option

export default function ItemsPage() {
  const router = useRouter();

  // --- filter state ---
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");   // immediate input value
  const [search, setSearch] = useState("");             // debounced value sent to query

  // debounce search + auto-reset page
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // pass clean filter to query — strip empties
  const { data, isLoading } = useItems({
    page,
    search: search || undefined,
    status: status || undefined,
    category: category || undefined,
  });

  // ...
}
```

**Rules:**
- Always keep two `useState` for debounced text inputs: `searchInput` (bound to `<Input>`) and `search` (sent to query key)
- Debounce delay: 300ms for search; no delay for selects
- Always call `setPage(1)` whenever any filter changes
- Pass `|| undefined` to strip empty strings — prevents stale query keys
- Select "show all" uses sentinel `"__all__"` value — shadcn Select requires a non-empty value

---

## 9. List Rendering — No Shared DataTable / Pagination

There is **no** generic `DataTable`, `Column`, or `Pagination` component in the consumer app, and `@tanstack/react-table` is not installed. `src/components/shared` exports form/field and dialog primitives only (see its `index.ts`) — no table or pagination export exists. Do not `import { DataTable, Pagination } from "@/components/shared"`; it will not resolve.

Render lists directly from the query's array data with plain markup (cards, a `<ul>`, or a hand-rolled `<table>`), gated on the query flags:

```tsx
const { data: items, isLoading } = useItems(filter);   // items: ListItem[]

if (isLoading) return <ListSkeleton />;
if (!items?.length) return <EmptyState title="No items found." />;   // EmptyState is a real shared export

return (
  <ul className="space-y-2">
    {items.map((item) => (
      <li key={item.id}>
        <Card onClick={() => router.push(`/<feature>/${item.id}`)}>{item.name}</Card>
      </li>
    ))}
  </ul>
);
```

**Notes:**
- Query hooks in this app typically return the array directly (e.g. `Product[]`, `Customer[]`) — destructure `data` as the list, not `data.items`.
- Client-side filtering/sorting is done inline over the array (`items.filter(...)`, `items.sort(...)`); there is no column-config abstraction.
- For selectable filter chips, the shared `MultiSelectFilter` (from `@/components/shared`) is available; for empty states, `EmptyState`.
- If a genuinely paginated (`{ items, page, pageSize, totalCount }`) endpoint appears, build the prev/next controls inline against those fields — do not reach for a shared `Pagination`.

---

## 10. Optimistic Updates (When to Use)

All mutations in this project wait for server confirmation before invalidating.

**Only add optimistic updates** if a mutation visually blocks the user (e.g. toggle switches). Use the UI-variable approach — simpler and no cache rollback risk:

```tsx
const { isPending, variables } = useToggleItem();

// Render optimistic state using mutation variables
const isEffectivelyActive = isPending
  ? variables?.active    // optimistic: what we sent
  : item.isActive;       // settled: server value
```

---

## 11. PaginatedResponse Type

`PaginatedResponse<T>` exists in `src/types/common.ts` but is used by every list endpoint in Simon — movement history, sales, and the product catalogue all paginate (PRD §20). Reach for a plain array only for genuinely small, bounded sets (`Product[]`, `Customer[]`) or a single object, not a paged envelope. Reach for it only if you hit a backend endpoint that genuinely returns `{ items, page, pageSize, totalCount }`.

```typescript
// src/types/common.ts — note: NO totalPages field
export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
};
```

When you do use it, compute page count yourself: `Math.ceil(totalCount / pageSize)`.

Query params must be nested under `query` (a bare object is dropped — see the http skill):
```typescript
async getAll(filter: ItemListFilter = {}): Promise<PaginatedResponse<ListItem>> {
  return httpClient.get("/<plural-name>", { query: { ...filter } });
}
```

---

## 12. Anti-Patterns

| Wrong | Right |
|-------|-------|
| `toast.success(...)` in component `onSubmit` | Inside `useMutation` `onSuccess` |
| `queryClient.invalidateQueries` in component | Inside `useMutation` `onSuccess` |
| `new QueryClient()` directly in component | `useState(createQueryClient)` in the provider |
| Omitting deps from query key | All vars used in `queryFn` must be in key |
| `enabled: id !== null` when id is a string | `enabled: !!id` |
| `import { DataTable, Pagination } from "@/components/shared"` | Neither exists — render the array directly |
| Reading `data.items` / `data.totalPages` from a list hook | List hooks return the array — destructure `data` as the list |
| `setPage(n)` without resetting on filter change | `setPage(1)` whenever any filter changes |
| Passing `""` in filter object to query | Pass `undefined` — strip empty strings with `|| undefined` |
| `toast.error(error.message)` in `onError` | `messageFromError(error, fallback)` (narrows `ApiRequestError`) |
| Invalidating with `exact: true` in mutation hooks | Prefix invalidation so all related queries update |
