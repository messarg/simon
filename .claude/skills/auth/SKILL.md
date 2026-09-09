---
name: auth
description: Simon's authentication and roles — PIN login verified server-side, session tokens, WORKER/STOCK/ADMIN roles, field-level authorization, shift-bound sessions, LAN threat model and network hardening. Use for login, session handling, route protection, role checks, or anything touching who may see or do what.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Auth & roles

Simon runs on the shop's own LAN, not the internet. That changes the threat model — but it
does **not** make authentication optional. PRD §9.

## Threat model (in real order of likelihood)

1. A worker viewing cost prices or profit margins.
2. A worker voiding or discounting their own sales to cover cash taken from the drawer.
3. Anyone on the shop Wi-Fi — including customers, if the network is shared — reaching the API.
4. Loss or theft of the host PC.
5. A failed disk with no tested backup.

Remote attackers are a distant concern. **Insiders and hardware failure are the real ones**,
and the controls below are aimed at them.

## PIN login

Workers enter a short PIN on a shared device many times a day. A password would be written on
a sticky note next to the till.

```ts
// server — the ONLY place a PIN is compared
const user = await userService.findByName(name);
const ok = await argon2.verify(user.pinHash, pin);
```

**Never compare a PIN in the client.** Never send a PIN list to the device. Never store a PIN
in `localStorage`.

Because the keyspace is tiny (4–6 digits), compensate:
- **Rate limit** per user and per device; exponential backoff.
- **Lock** after N failures (`failedAttempts`, `lockedUntil`) — admin unlock only.
- Argon2/bcrypt with a real work factor. The login path is not hot; a slow hash costs nothing
  and is the whole defence.
- PINs are per-user, never shared. A shared PIN destroys the audit trail, which is the point.

## Sessions

- Server issues an opaque session token on successful PIN entry; **the client never parses it**.
- Stored per-device, revocable from the admin panel.
- **Sessions end at shift close.** A till left logged in overnight is the most common real
  breach in retail.
- Short idle timeout on the till, longer on the owner's dashboard.
- Re-authentication (admin PIN) required for privileged in-flow actions: discount above the
  threshold, void, price change, stock adjustment, opening the drawer without a sale.

## Roles

| Role | May |
|---|---|
| `WORKER` | Sell, take repayments, open/close own shift |
| `STOCK` | Worker, plus goods receipt, stocktake, write-offs |
| `ADMIN` | Everything, including cost, margin, prices, users, settings |

Checks are **server-side and default-deny**. A client-side role check is a UX affordance
only — it hides a button, it does not protect anything.

### Field-level authorization

The gap that is easiest to leave open and the one that matters most commercially.

```ts
// Cost, margin, and supplier terms stripped server-side for non-admins.
return role === "ADMIN" ? { ...base, avgCostMdram } : base;
```

A `WORKER` token must not be able to obtain cost from **any** endpoint — list, search,
detail, report, export, or an error message that echoes the record. PRD §25.9 is an explicit
acceptance test for this. Never `res.json(prismaObject)`.

## Network hardening

The API binds `0.0.0.0` so phones can reach it, which means **every device on that Wi-Fi can
reach it**. Mitigate in this order:

1. A separate SSID or VLAN for staff devices.
2. WPA2/WPA3 with a password that is *not* the one given to customers.
3. TLS with a certificate trusted on staff devices — also **required** for camera scanning
   (`getUserMedia` needs a secure context; see the `barcode` skill).

If the deployment ships plain HTTP on a shared network, that is an **accepted risk that must
be written down and shown to the owner**, not an oversight to discover later.

CORS is not a security control. It restricts browsers; `curl` ignores it entirely.

## Audit

Every privileged action writes an `AuditLog` row — actor, action, entity, before/after,
timestamp. Voids, discounts, price changes, stock adjustments, and refunds are the ones the
owner will actually review. Without per-user PINs this data is worthless, which is why shared
PINs are forbidden.

## Client-side

- Post-login navigation is a normal SPA route change — there is no SSR cache to invalidate.
- The route guard reads session state from one place (a context/store hydrated at boot), not
  from scattered `localStorage` reads.
- On `401`, clear the session and route to login **once** — guard against redirect loops when
  several queries fail together.
- Do not auto-refresh a session on a locked till; require the PIN.

## Testing

- Unit: role matrix, lockout, backoff.
- Integration: **a worker token cannot read cost from any endpoint** (enumerate them).
- Integration: session invalid after shift close.
- Never put a real PIN in a fixture or a log.

## Checklist

- [ ] PIN verified server-side against a slow hash
- [ ] Rate limit + lockout
- [ ] Per-user PINs, never shared
- [ ] Session ends at shift close; idle timeout set
- [ ] Route checks default-deny, server-side
- [ ] Field-level projection strips cost for non-admins
- [ ] Re-auth for void / large discount / price change
- [ ] Network mitigation chosen and documented
- [ ] Audit row for every privileged action
