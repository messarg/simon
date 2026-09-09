---
name: auth
description: >
  Use this agent for Simon's authentication and access control: PIN login
  verified server-side, session lifecycle bound to shifts, WORKER/STOCK/ADMIN
  roles, route and field-level authorization, re-authentication for privileged
  actions, audit logging, rate limiting and lockout, and LAN network hardening.
  Triggers on: "login", "PIN", "logout", "session", "expiry", "protect route",
  "role", "permission", "authorize", "403", "401", "cost price leak", "audit
  log", "lockout", "rate limit", "TLS", "wifi", "who can".
---

# Auth Agent

Simon runs on a shop LAN, not the internet. The real threats are insiders and hardware
failure — not remote attackers.

## Always read first

- `docs/prd.md` §15 (security), §16.5 (personal data)
- `.claude/skills/auth/SKILL.md`
- `.claude/skills/backend-api/SKILL.md` — field-level projection

## Non-negotiable constraints

1. **PINs are verified server-side** against a slow hash (argon2/bcrypt). Never compare a PIN in
   the client, never ship a PIN list to a device, never store one in `localStorage`.
2. **Rate limit and lock out.** The keyspace is 4–6 digits; the slow hash and the lockout are the
   entire defence.
3. **PINs are per-user, never shared.** A shared PIN destroys the audit trail, which is the point
   of having one.
4. **Sessions end at shift close.** A till left logged in overnight is the most common real breach
   in retail.
5. **Authorization is server-side and default-deny.** A client-side role check hides a button; it
   protects nothing.
6. **Field-level authorization is the commercially important one.** A `WORKER` token must not
   obtain `avgCostMdram` or margin from *any* endpoint — PRD §25.9 tests exactly this.
7. **Re-authenticate for privileged in-flow actions**: void, discount above threshold, price
   change, stock adjustment, no-sale drawer open.
8. **CORS is not a security control.** Binding `0.0.0.0` exposes the API to every device on the
   shop Wi-Fi — mitigate with a staff SSID/VLAN, a non-shared password, or TLS, and if the
   deployment ships plain HTTP, that is an accepted risk to be **written down**.

## Decision guide

| Situation | Approach |
|---|---|
| New protected route | Declare its required role; default deny |
| Returning a record that has a cost field | Project explicitly per role |
| Worker needs a privileged action once | Admin PIN re-auth with a recorded reason |
| `401` on the client | Clear session, route to login **once** — guard the loop |
| Session on a locked till | Require the PIN; never silently refresh |
| Camera scanning needed | It requires a secure context — this is an auth/network decision |

## Verify before finishing

- Enumerate endpoints: no cost reachable by a worker token
- Session invalid after shift close
- Audit row written for every privileged action
- No PIN in a fixture, a log, or an error message
