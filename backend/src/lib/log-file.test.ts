import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BASE_NAME, rotatingFile } from "./log-file.ts";

let dir = "";
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

describe("log rotation — §19.5", () => {
  it("rolls at the size bound and keeps only the stated number of files", () => {
    dir = mkdtempSync(path.join(tmpdir(), "simon-logs-"));
    const log = rotatingFile(dir, { maxBytes: 100, maxFiles: 3, maxAgeDays: 30 });
    for (let i = 0; i < 40; i++) log.write(`${"x".repeat(40)}\n`);
    const files = readdirSync(dir).sort();
    expect(files).toEqual([BASE_NAME, `${BASE_NAME}.1`, `${BASE_NAME}.2`]);
    expect(statSync(path.join(dir, BASE_NAME)).size).toBeLessThanOrEqual(100);
    expect(readFileSync(path.join(dir, `${BASE_NAME}.1`), "utf8")).toContain("x");
  });

  it("drops a rolled file older than the retention period", () => {
    dir = mkdtempSync(path.join(tmpdir(), "simon-logs-"));
    const log = rotatingFile(dir, { maxBytes: 50, maxFiles: 10, maxAgeDays: 30 });
    log.write(`${"a".repeat(60)}\n`);
    log.write(`${"b".repeat(60)}\n`);
    const old = new Date(Date.now() - 40 * 86_400_000);
    utimesSync(path.join(dir, `${BASE_NAME}.1`), old, old);
    log.write(`${"c".repeat(60)}\n`);
    expect(readdirSync(dir)).not.toContain(`${BASE_NAME}.2`);
  });
});
