# 9. Three tiers with per-employee permissions, and sign-in by name

Date: 2026-09-18 · Status: accepted · PRD: §16.2, §16.4, §16.5, §6.17, §15.4, §26.2, §0's 3.81 entry, `packages/shared/src/access.ts`, `packages/shared/src/staff-policy.ts`, `backend/src/domain/person-name.ts`

## Context

Access was three ranked roles — `WORKER`, `STOCK`, `ADMIN` — each a superset of the one below.
Two things the owner asked for could not be said in that model.

- **A job is not a rung.** A shop with a stockroom has people who receive goods and never sell,
  and cashiers who sell for cash and must not lend. A ladder can only grow a role by everything
  below it, so *"can receive but not sell"* and *"sells but not on credit"* had no representation.
- **Not every admin is the owner.** Every `ADMIN` saw cost, margin, supplier terms, backups and
  their passphrase, settings, the audit trail and everyone's personal details. The owner wanted
  someone to run the shop day to day without any of that: *"manager can't see owner's infos, and
  owner related data."*

Separately, §26.2 had recorded as a decision that `GET /auth/users` answers without a session, so
the sign-in screen can be a row of faces, and `GET /auth/admins` told the re-auth sheet who may
approve an override. Both handed the staff list — and which accounts are privileged — to anyone
on the shop Wi-Fi, which §16.1 ranks as a threat. The owner's words: *"no need to show all users
to all."*

§16.5 also granted `STOCK` *read and write* on invoice costs it entered. The code never
implemented the read half: costs a non-admin typed were written and stripped on the way back.

## Decision

**Three tiers, and an employee carries grants.**

- `OWNER` — exactly one, created at setup (wizard Q2). Nobody, the owner included, can demote or
  deactivate the owner. Only the owner holds a recovery code. The owner alone sees what is the
  owner's: every cost field (`COST_KEYS`), supplier terms, the `margin`, `valuation` and `audit`
  reports and the audit-log route, diagnostics, imports, backups (passphrase reveal, rotation and
  restore, whose re-auth only the owner can give), settings, sessions and devices, cost
  corrections, purchase-order drafting and reorder suggestions, the products *needs detail* filter,
  resolving `COST_VARIANCE`, home's profit and system alerts, and the owner's own record.
- `MANAGER` — any number, created by the owner. Passes every permission gate, runs the catalogue,
  customers, suppliers and stocktake approval, reads home without profit and every other report
  with cost swept out, approves overrides by re-auth. Manages employees only; may keep their own
  name, PIN and details but not their own tier or active state. Cannot see the owner at all: not
  in the list, `404` by id, `404` for a person-scoped report on the owner.
- `EMPLOYEE` — does what was granted from `sell`, `returns`, `debt`, `receive`, `stocktake`,
  `writeoff`, `labels`, stored as a JSON array on `User.permissions` and read on every request.
  Two presets: *cashier* (`sell`, `returns`, `debt`) and *stock* (all seven).

Route guards are `requireOwner()`, `requireManager()`, `requirePermission(p)` and
`requireAnyPermission(...)`; a refusal carries `required: "OWNER" | "MANAGER" | <permission>`. Who
may manage whom is a pure module, `@simon/shared`'s `staff-policy.ts`, tested without HTTP.

**Cost is the owner's, with no receiving exception.** Whoever receives types invoice costs, which
are written, and reads none back.

**Sign in by name, then PIN; nobody is listed before sign-in.** `GET /auth/users` and
`GET /auth/admins` are removed. `POST /auth/login` takes `{name, pin}`; `POST /auth/reauth` takes
the approver's `{name, pin, action}`; `POST /auth/recover` takes the recovery code alone. Names
match by key — NFC, whitespace collapsed and trimmed, case-folded in the Armenian locale — and two
active people may not share a key (`duplicate-name`, 422). **An unknown name fails exactly as a
wrong PIN**: the same `pin-incorrect`, after a decoy argon2 verification so it takes the same time.
An approver who could not approve fails the same way. The lockout stays per user, unchanged.

**The migration maps people, not columns.** A hand-written `User` rebuild
(`20260918140000_owner_manager_employee`) makes the admin holding the recovery code — else the
earliest — the `OWNER`, every other admin a `MANAGER` (their recovery code hash dropped), `STOCK`
an employee with the stock preset and `WORKER` one with the cashier preset.

## Consequences

- **Nobody gains or loses a capability in the migration except the admins who become managers**,
  and what they lose is the owner's data — the change itself, not a side effect of it.
- The last-admin guard is gone, because there is no last-admin case: the one owner cannot be
  demoted or deactivated, so a shop can never be left without someone who reaches its settings,
  backups and recovery code.
- Signing in costs typing a name. Per-user lockout and the per-person audit trail are kept, which
  a shared PIN or a shop-wide code would not have kept. §24.2's A4 now notes that the friction
  pulls toward PIN-sharing, and the pilot should watch for it.
- The photograph stays, and is shown only after sign-in. `GET /users/:id/avatar` still answers
  without a session because an `<img>` cannot send a bearer token; with the list gone, an id is
  only ever handed to someone already signed in, so nothing before sign-in can name a face.
- The client reads `permissions` from the login response and `/auth/me` to leave out what a person
  cannot do; the server stays the control. Grants take effect on the next request.
- The owner's session wears a distinct dark theme so it is recognisable on a shared device; that
  is a signal, not a control.
- The receiving screen still shows the previous invoice cost, which §13.2's variance question
  quotes. That is the one cost figure a non-owner is shown, and the PRD says so rather than claiming
  none.
