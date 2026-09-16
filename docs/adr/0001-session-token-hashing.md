# 1. Session tokens are hashed with SHA-256, not argon2id

Date: 2026-09-16 · Status: accepted · PRD: §16.2, §16.3

## Context

§16.2 specifies argon2id for secrets at rest, written with the PIN in mind. A session token is also
a secret at rest, and `Session.tokenHash` stores one — but every authenticated request resolves a
session by that hash, which is an equality lookup on an indexed column.

Argon2id is deliberately slow (≥ 250 ms on the shop's host, as §16.2 asks). Applying it per request
would add that to every scan, against §21.1's latency budget, and it cannot be an indexed lookup
either: the salt differs per row, so resolving a session would mean rehashing against every row.

## Decision

Session tokens are 256-bit random values, stored as a SHA-256 hash and looked up by it. PINs and
recovery codes keep argon2id.

## Consequences

The property that matters — a stolen database does not yield usable tokens — holds, because the
token has full entropy and is not guessable; slow hashing exists to defend low-entropy secrets like
a four-digit PIN, which a session token is not. Tokens stay short-lived (§16.3's idle timeouts) and
die with their shift.

This is a deviation from a literal reading of §16.2 and is recorded here rather than silently
implemented.
