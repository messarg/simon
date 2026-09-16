import { describe, expect, it } from "vitest";
import { BackupDecryptError, decryptBackup, encryptBackup, generatePassphrase } from "./backup-crypto.ts";

describe("backup encryption — §19.2", () => {
  const data = Buffer.from("SQLite format 3 ... Մալուխ 3x2.5");

  it("round-trips with nothing but the passphrase, typed however the owner types it", () => {
    const pass = generatePassphrase();
    expect(pass).toMatch(/^([A-HJ-NP-Z2-9]{4}-){5}[A-HJ-NP-Z2-9]{4}$/);
    const file = encryptBackup(data, pass);
    expect(file.includes(data)).toBe(false);
    expect(decryptBackup(file, pass.toLowerCase().replaceAll("-", " "))).toEqual(data);
  });

  it("refuses a wrong passphrase and a damaged file rather than restoring garbage", () => {
    const file = encryptBackup(data, "AAAA-BBBB");
    expect(() => decryptBackup(file, "AAAA-BBBC")).toThrow(BackupDecryptError);
    const flipped = Buffer.from(file);
    flipped[flipped.length - 1] ^= 1;
    expect(() => decryptBackup(flipped, "AAAA-BBBB")).toThrow(BackupDecryptError);
    const salted = Buffer.from(file);
    salted[12] ^= 1;
    expect(() => decryptBackup(salted, "AAAA-BBBB")).toThrow(BackupDecryptError);
    expect(() => decryptBackup(Buffer.from("hello"), "AAAA-BBBB")).toThrow(BackupDecryptError);
  });
});
