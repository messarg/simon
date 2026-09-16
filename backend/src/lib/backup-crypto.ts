/**
 * Backup encryption. PRD §19.2, §27.10, FR-DAT-06.
 *
 * AES-256-GCM under a key derived with scrypt from the owner's passphrase. The salt, the scrypt
 * cost and the IV travel in the file's header, so a replacement machine needs only the file and the
 * paper — nothing the dead host held. The header is authenticated as well as the body: a flipped
 * byte anywhere refuses to decrypt rather than restoring a quietly corrupt database.
 */
import { createCipheriv, createDecipheriv, randomBytes, randomInt, scryptSync } from "node:crypto";

const MAGIC = Buffer.from("SIMONBK1", "ascii");
const SALT = 16;
const IV = 12;
const TAG = 16;
const HEADER = MAGIC.length + 1 + SALT + IV;
const LOG2_N = 15;

/** No 0/O or 1/I: the passphrase is read off paper, sometimes over the phone. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class BackupDecryptError extends Error {}

/** Six groups of four, 120 bits: K7PM-3QXD-9RTA-W4HN-C2EF-M8LZ. */
export function generatePassphrase(): string {
  return Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")).join("-");
}

/** Dashes, spaces and case do not matter when it is typed back in. */
export const normalizePassphrase = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

const deriveKey = (passphrase: string, salt: Buffer, log2n: number) =>
  scryptSync(normalizePassphrase(passphrase), salt, 32, { N: 2 ** log2n, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });

export function encryptBackup(plain: Buffer, passphrase: string): Buffer {
  const salt = randomBytes(SALT);
  const iv = randomBytes(IV);
  const header = Buffer.concat([MAGIC, Buffer.from([LOG2_N]), salt, iv]);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(passphrase, salt, LOG2_N), iv);
  cipher.setAAD(header);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([header, cipher.getAuthTag(), body]);
}

export function decryptBackup(file: Buffer, passphrase: string): Buffer {
  if (file.length < HEADER + TAG || !file.subarray(0, MAGIC.length).equals(MAGIC)) throw new BackupDecryptError("not a Simon backup");
  const log2n = file[MAGIC.length];
  if (log2n < 10 || log2n > 20) throw new BackupDecryptError("not a Simon backup");
  const header = file.subarray(0, HEADER);
  const salt = file.subarray(MAGIC.length + 1, MAGIC.length + 1 + SALT);
  const iv = file.subarray(MAGIC.length + 1 + SALT, HEADER);
  const tag = file.subarray(HEADER, HEADER + TAG);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(passphrase, salt, log2n), iv);
  decipher.setAAD(header);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(file.subarray(HEADER + TAG)), decipher.final()]);
  } catch {
    throw new BackupDecryptError("wrong passphrase or damaged file");
  }
}
