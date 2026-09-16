# 2. Backups are AES-256-GCM files whose salt travels with them

Date: 2026-09-16 · Status: accepted · PRD: §19.2, §27.10, FR-DAT-06

## Context

§19.2 requires encrypted, consistent snapshots, a passphrase the owner holds on paper, and a key the
host holds — and §27.10 requires a restore **on a different machine, from the drive and the paper
alone**. Those two pull in opposite directions: anything the replacement machine needs and does not
have makes the drill fail on the day it matters.

## Decision

- A snapshot is `VACUUM INTO` a temporary file, never a copy of a database being written.
- The file is `SIMONBK1` ‖ scrypt cost ‖ salt ‖ IV ‖ GCM tag ‖ ciphertext. The key is
  scrypt(passphrase, salt), so **the salt and cost travel inside the file** and the passphrase alone
  opens it anywhere.
- The header is authenticated as well as the body: a flipped byte refuses to decrypt rather than
  restoring a quietly corrupt database.
- The passphrase is generated at setup and kept in a file on the host outside the database
  (`var/keys/`), so the hourly unattended backup has a key and a stolen USB stick does not.
- Restoring verifies the decrypted bytes with SQLite's own `integrity_check` before anything is
  replaced, and moves the existing database aside instead of deleting it.

## Consequences

A backup is portable by construction. Rotating the passphrase re-encrypts only later backups, which
the rotation screen says in as many words. The key file is the thing to protect on the host; losing
it is survivable while the paper exists, and losing both is not.
