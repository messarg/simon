---
name: observability
description: Failure handling for Simon — React error boundaries in an SPA, structured logging on the host, error UX that never stops the till, retry strategy, and diagnosing a self-hosted box with no remote access. Use for error boundaries, logging, crash handling, or user-facing failure states.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Observability

Simon runs on a PC in a shop with no ops team and no remote access. When something breaks,
the owner phones someone. Everything here exists to make that phone call short.

## The constraint that shapes everything

**No error may stop the till.** A customer is waiting. Degrade, log, flag — never block.
A white screen at the counter loses a sale and, worse, loses trust in the product.

## What the owner actually reads

- **`GET /health`** is liveness only — status and version, no session — because every till polls it.
  Everything else lives behind **`GET /diagnostics`** (the owner's): version, uptime, database and WAL size,
  the age of the last WAL checkpoint, the last successful backup with its size, **whether** a backup
  passphrase exists (never the passphrase), queue depths per device, open drift flags, and the three
  settings installation sets. Settings renders it with a copy button and a file to save.
- **Three alerts reach Home**, each saying what to do rather than what happened: no successful backup in
  24 hours, ledger-vs-cache drift, and a sale older than an hour in some device's outbox (parked
  baskets excluded — one may sit there all afternoon by design).

## Error boundaries (SPA, not Next.js)

Plain React boundaries — there is no `error.tsx` / `global-error.tsx` / `not-found.tsx` file
convention here. Place them deliberately:

```tsx
<AppBoundary>              {/* last resort: shell survives, offers reload */}
  <RouteBoundary>          {/* one route crashes, nav still works */}
    <CheckoutBoundary>     {/* a widget crashes, the basket survives */}
```

- The **checkout boundary is the important one**. If a line-item component throws, the
  basket and its totals must survive — never lose a half-built sale to a render error.
- A boundary must offer a real action: retry, reload, or "start a new sale". A dead-end
  boundary is a white screen with extra steps.
- Boundaries do not catch async errors or event handlers. Those need explicit handling.
- Route-level 404 is a router concern, rendered as a normal screen.

## Logging

**Backend** — structured (`pino`), one line per request: method, path, status, duration,
user id. It writes to stdout and, when `SIMON_LOG_DIR` is set (the default on a host), to a rotating
file: 10 MB each, 10 files, nothing older than 30 days — the database is on the same `C:` drive, so an
uncapped log is a disk that fills and a shop that stops selling. Tests are silent unless
`SIMON_TEST_LOG=1`, which is how a flake gets diagnosed. Business events worth their own line: sale completed, shift closed with variance,
stock adjusted, sync conflict flagged, backup succeeded/failed.

**Frontend** — a thin `logger` wrapper, not bare `console.log`. In production it buffers and
ships to the backend, because the worker's phone console is unreachable.

**Never log:** PINs, session tokens, full customer records. A customer's name joined to a
debt amount is personal data (PRD §16.5). Scrub before writing.

Log rotation matters — this is someone's C: drive, not a cloud volume. An unbounded log file
will eventually fill the disk that also holds the database.

## Error UX

| Situation | Presentation |
|---|---|
| Offline | Persistent, calm banner. Not an error. |
| Queued sales pending | Count badge, tappable |
| Validation (`422`) | Inline on the field |
| Permission (`403`) | Plain message, no retry button |
| Conflict (`409`) | Refetch and re-render, explain what changed |
| Unexpected | Toast + logged; boundary only if render is broken |

- **Never a blocking modal for a background failure** (sync, printer, backup).
- Never show a status code, stack trace, or English exception to a worker.
- Armenian, plain language, and say what to *do* — "Պահեստը թարմացվում է" beats "Error 409".

### Printing and other side effects

Printing happens **after** the transaction commits. A printer jam must never roll back a paid
sale. Failed print → offer reprint from the sale record; the sale itself is already safe.

## Retry

- **Queries:** retry a couple of times with backoff on network/5xx; never on 4xx.
- **Mutations:** never blind-retry. Retry only through the outbox, where the idempotency key
  makes it safe (see `offline-sync`). A retried non-idempotent mutation is how you
  double-charge someone.
- Respect `Retry-After` on `429`.

## Diagnosing a self-hosted box

The realistic support scenario. Provide:

- **Two endpoints, not one** (PRD §19.5). `GET /health` is the **liveness probe** the client
  polls to decide online/offline — unauthenticated, status and version only, nothing more.
  `GET /diagnostics` is everything else and is **the owner's alone**: version, DB size, WAL age, last
  backup time/result/size, whether a backup passphrase is set (never the passphrase), pending
  queue depth with parked baskets counted separately, ledger-vs-cache drift, disk free, and the
  three installation settings (tax regime, price basis, `shop.timezone`).
  **Do not merge them.** The probe has to answer a client that cannot authenticate; the payload is
  the shop's business, on a LAN the threat model treats as hostile (PRD §16.1). Neither figure is
  a cost field, so the field-stripping rule never looks at them — the gate is the route.
- **A diagnostics screen in Settings** rendering that payload in Armenian, readable down a phone.
- **An export-diagnostics button** producing one file (recent logs + counts, PII scrubbed) the
  owner can send.
- Version and build stamp visible in the UI — "which version are you on?" must not require a
  terminal.

Third-party error reporting (Sentry and similar) is **opt-in and off by default**. This is a
privacy-first self-hosted product; silently shipping errors off-premises contradicts the
core promise. If enabled, disclose it.

## Alerts that matter to the owner

Not developer alerts — owner-facing, on the dashboard:
- Backup failed or last backup is stale
- Sync queue not draining
- Ledger drift detected
- Disk nearly full

These are the failures that lose a business its records, and they are silent by nature.

## Checklist

- [ ] Boundary around checkout that preserves the basket
- [ ] Every boundary offers a real recovery action
- [ ] Structured backend logs with rotation
- [ ] No PINs/tokens/PII in logs
- [ ] Offline is a banner, not an error
- [ ] No blocking modal for background failures
- [ ] Printing after commit, reprint available
- [ ] Mutations retried only via the idempotent outbox
- [ ] Diagnostics screen + export
- [ ] Owner-facing alerts for backup, sync, drift, disk
