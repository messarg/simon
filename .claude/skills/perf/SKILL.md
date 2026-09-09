---
name: perf
description: Performance for Simon — the scan-to-line latency budget, Vite bundle analysis and code splitting, SQLite query cost, IndexedDB access patterns, React re-render discipline on the checkout screen, and low-end Android reality. Always measure before optimizing.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Performance

Performance here is not a score — it is whether a worker can clear a queue. The budgets in
PRD §14 are product requirements, not aspirations.

| Budget | Target |
|---|---|
| Scan → line rendered | **< 200 ms p95** |
| 3-item cash sale, start to finish | **< 15 s** |
| App interactive from cold | **< 3 s** on a mid-range Android |
| Concurrent users | 3 workers + owner dashboard, no lock contention |

**Measure first.** Optimise against a trace, not a hunch — and measure on a cheap phone over
shop Wi-Fi, never on a desktop over localhost. The desktop number is always wrong and always
flattering.

## The scan path

The only truly hot path. Everything else can be a little slow.

```
keypress burst → buffer → lookup → basket update → render
```

- **Lookup is local first.** Hit the IndexedDB catalogue cache, not the network. A LAN round
  trip is fast until the Wi-Fi is congested, and then it is not.
- Barcode index must be a real IndexedDB index — never scan the object store.
- **Do not re-render the whole basket** on each scan. Key lines stably and memoise the row;
  a 40-line basket re-rendering per scan will miss the budget on a low-end device.
- Keep the scan handler off the React state path until the item resolves; buffer keystrokes
  in a ref, not in state.
- Audible feedback fires immediately, before the render settles — the worker is listening,
  not looking.

## Bundle (Vite)

```bash
npx vite-bundle-visualizer      # or rollup-plugin-visualizer wired into vite.config.ts
npm run build                   # check the printed chunk sizes
```

- **Route-level code splitting** with `React.lazy` — the owner dashboard, reports, and
  charting must not ship in the till bundle. A worker's phone should never download the
  reporting stack.
- The camera scanning library is large; import it **dynamically**, only when camera mode is
  actually opened.
- Watch for a chart or date library pulled in transitively by one small component.
- The app is served from the shop PC over LAN — bandwidth is fine, but **parse and execute
  time on a cheap Android is not**. Bundle size matters for CPU, not download.

## React

- The checkout screen is the one place to be deliberate: memoise line rows, keep derived
  totals in `useMemo`, and avoid context values that change on every keystroke.
- Everywhere else, prefer clarity. Do not scatter `memo` defensively.
- Virtualise long lists (product catalogue, movement history) past a few hundred rows.
- Debounce search input; do not debounce scanning.

## Data layer

- Cache reads with sensible `staleTime` — a product list does not need refetching on every
  focus. Stock levels do.
- Do not refetch the whole catalogue after every sale; invalidate narrowly.
- Paginate every list endpoint. "It is only a small shop" stops being true after a year of
  movement history.

## Backend & SQLite

- SQLite is fast; the failure mode is **lock contention**, not query speed. Keep write
  transactions short and free of I/O (see the `backend-api` skill).
- WAL mode lets reads proceed during a write — verify it is actually on.
- Index the hot paths: barcode (unique), `StockMovement(productId, createdAt)`,
  `Sale(completedAt)`, `DebtEntry(customerId, createdAt)`.
- Watch N+1 in list endpoints with `include`.
- Reports over a year of movements should be **precomputed or paginated**, never a full
  table scan on the owner's dashboard load.
- The stock cache exists precisely so the till never aggregates the ledger at read time.

## Startup

- Precache the app shell in the service worker so a cold start with no LAN still reaches a
  usable till.
- Hydrate the catalogue cache in the background; show the till immediately.
- Do not block first paint on session validation — render the shell, then gate.

## Measuring

```bash
npm run build          # chunk sizes
# Chrome DevTools Performance, CPU throttled 4–6×, on the real device
```

Instrument the scan path in dev with `performance.mark` / `measure` so the 200 ms budget is
observable rather than assumed. A regression here is a product regression.

## Checklist

- [ ] Measured on a real low-end device over shop Wi-Fi
- [ ] Barcode lookup hits a local index, not the network
- [ ] Basket does not fully re-render per scan
- [ ] Dashboard/reports/camera lazily loaded
- [ ] Lists paginated and virtualised where long
- [ ] Write transactions short, no I/O inside
- [ ] Hot indexes present
- [ ] Shell precached for cold start
