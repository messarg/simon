---
name: http
description: Simon's frontend HTTP layer — a single same-origin client to the local Express API, service objects, idempotent mutation submission through the outbox, RFC 7807 error mapping to Armenian, and offline-aware failure handling. Use when adding an API call, writing a service, or handling a request failure.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# HTTP layer

**One client.** Simon is a pure SPA talking to the Express backend on the same origin. There
is no server-side rendering, no server component, no second client, and no cookie/header
plumbing to reason about.

```ts
import { httpClient } from "@/lib/http";
```

If you find yourself reaching for a "server" variant, that is a Next.js habit — it does not
apply here.

## Base URL

The API is same-origin in production (Nginx serves the SPA and proxies `/api`), so the client
uses a **relative** base path:

```ts
const BASE = "/api/v1";
```

**Never hardcode a LAN IP.** The shop's address changes, and a device that has the old one
burned into the bundle silently stops working. In dev, Vite's proxy points `/api` at
`localhost:5000` — configure it in `vite.config.ts`, not in application code.

## Service objects

One service per resource, a plain object of async methods. Services own URLs and shapes;
components and hooks never build a URL.

```ts
// features/products/service.ts
export const productService = {
  list: (params: ListParams) => httpClient.get<Paginated<Product>>("/products", { params }),
  byBarcode: (code: string) => httpClient.get<Product | null>(`/products/barcode/${encodeURIComponent(code)}`),
  create: (body: CreateProduct) => httpClient.post<Product>("/products", body),
};
```

- Always `encodeURIComponent` path segments — barcodes and Armenian names contain characters
  that will otherwise break the URL.
- Return typed responses; the type mirrors the backend's Zod schema. Keep one source of truth
  (a shared package or generated types), not two hand-maintained copies that drift.

## Mutations that must not be lost

Sales, returns, repayments, and cash movements **do not go straight to `httpClient`**. They
go through the outbox (see the `offline-sync` skill):

```ts
// wrong — a dropped connection loses the sale
await httpClient.post("/sales", body);

// right — durable, idempotent, drains in the background
await outbox.enqueue({ id: uuidv7(), kind: "sale", body });
```

The client generates the document `id` up front and the server treats it as the idempotency
key. Read-only requests and non-critical writes (settings, product edits) may call
`httpClient` directly.

## Errors

The API returns RFC 7807:

```json
{ "type": "insufficient_stock", "title": "...", "status": 422,
  "errors": { "lines.0.qty": ["exceeds available"] } }
```

Map **once**, centrally, in the client — not per call site:

| Status | Handling |
|---|---|
| `400` | Programming error; log, show generic failure |
| `401` | Clear session, route to login once (guard the loop) |
| `403` | "Not permitted" — do not offer a retry |
| `404` | Feature-specific empty state, not an error toast |
| `409` | State conflict (shift closed, sale already returned) — refetch and re-render |
| `422` | Map `errors` onto form fields; this is user-correctable |
| `429` | Respect `Retry-After`; back off |
| `5xx` / network | Retryable — outbox retries, queries surface a retry affordance |

**Armenian messages are resolved on the client**, keyed by `type`. The API never returns
Armenian prose — it cannot be tested, reused on a receipt, or kept consistent.

Never show a raw status code or English exception text to a worker.

## Offline awareness

A failed request is not automatically an error worth interrupting for.

- Distinguish **offline** (expected, banner) from **broken** (unexpected, surface it).
- Never fire an error toast per failed background query while offline — that is a wall of
  noise on a device the worker is trying to sell from.
- Reads fall back to the IndexedDB catalogue cache, labelled as last-known.

## Uploads

Product images and CSV imports use `FormData` — do not set `Content-Type` manually, the
browser must add the multipart boundary. Everything is LAN-local, so uploads are fast, but
still show progress for imports: an owner importing 3,000 products needs to see it working.

## Checklist

- [ ] One same-origin client; relative base path
- [ ] No hardcoded LAN IP anywhere
- [ ] URLs live in services, not components
- [ ] Path segments encoded
- [ ] Critical mutations go through the outbox with a client-generated id
- [ ] Errors mapped centrally; `422` lands on form fields
- [ ] Armenian resolved client-side from `type`
- [ ] Offline distinguished from broken
