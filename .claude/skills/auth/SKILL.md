---
name: auth
description: Simon's authentication and roles — sign-in by name + PIN verified server-side, session tokens, OWNER/MANAGER/EMPLOYEE tiers with per-employee permissions, field-level authorization, shift-bound sessions, LAN threat model and network hardening. Use for login, session handling, route protection, role checks, or anything touching who may see or do what.
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

The PIN is **exactly 6 digits**, and its shape lives once, in `@simon/shared`'s `pin.ts`
(`PIN_LENGTH`, `PIN_PATTERN`, `isValidPin`, `normalisePinInput`) — never re-written in a route,
a form or a keypad default. Because the keyspace is still small, compensate:
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
- Re-authentication required for privileged in-flow actions: discount above the threshold,
  void, price change, stock adjustment, opening the drawer without a sale. The approver types
  **their name and PIN**; an owner or a manager qualifies, the owner alone for the backup actions.

## Sign-in (PRD §16.2)

**Nobody is listed before sign-in** — no `GET /auth/users`, no `GET /auth/admins`. A person types
their name and their PIN on **one form**, posted as a single `POST /auth/login {name, pin}` —
there is no earlier step for the server to answer, which is what keeps an unknown name
indistinguishable. The sign-in screen carries **no keypad**: a name field has already raised the
device's keyboard, and `PinPad`'s window-level key listener would eat digits typed into a field
beside it (that listener is why the screen used to be two steps). Names match by `nameKey`
(`backend/src/domain/person-name.ts`: NFC, spaces collapsed, Armenian case-fold) and two active
people may not share one (`duplicate-name`). **An unknown name must fail exactly as a wrong PIN**
— same `pin-incorrect`, same time (a decoy argon2 verify) — or the screen is the staff list again,
one guess at a time. Recovery is `{recoveryCode}` alone: only the owner holds one.

## Tiers and permissions (PRD §16.4)

| Tier | May |
|---|---|
| `OWNER` | Everything. The only one who sees cost/margin/profit, supplier terms, backups, settings, sessions, the audit trail, and their own record. Exactly one; nobody can demote or deactivate them |
| `MANAGER` | Runs the shop — passes every permission gate — and manages **employees**. Never the owner's data; cannot even see the owner (`404`) |
| `EMPLOYEE` | Exactly the jobs granted: `sell`, `returns`, `debt`, `receive`, `stocktake`, `writeoff`, `labels` |

Everything lives in `@simon/shared`: `access.ts` (`Permission`, `can`, `isOwner`, `isManager`,
the `cashier`/`stock` presets, `OWNER_REPORTS`) and `staff-policy.ts` (`canManage`,
`assignableRoles`, `listsPerson` — who may manage whom). Routes gate with `requireOwner()`,
`requireManager()`, `requirePermission(p)` or `requireAnyPermission(...)` — **not a ladder**, so
"receives but does not sell" is expressible. A `403` carries `required`.

Checks are **server-side and default-deny**. A client-side check is a UX affordance only — it
leaves a destination out, it does not protect anything.

### Field-level authorization

The gap that is easiest to leave open and the one that matters most commercially.

```ts
// Cost, margin, and supplier terms are the owner's alone — a manager does not see them either.
return seesCost(role) ? { ...base, avgCostMdram } : base;
```

Neither an employee's token nor a manager's may obtain cost from **any** endpoint — list, search,
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
- [ ] Field-level projection strips cost for everyone but the owner (`seesCost`, `stripCost`)
- [ ] Re-auth for void / large discount / price change
- [ ] Network mitigation chosen and documented
- [ ] Audit row for every privileged action
