/**
 * Rotating log files. PRD §19.5: 10 MB per file, 10 files kept, nothing older than 30 days —
 * whichever bound is reached first. This is someone's C: drive and the database is on it, so an
 * uncapped log is a disk that fills and a shop that stops selling.
 */
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, renameSync, rmSync, statSync, writeSync } from "node:fs";
import path from "node:path";

export interface RotationLimits { maxBytes: number; maxFiles: number; maxAgeDays: number }
export const LOG_LIMITS: RotationLimits = { maxBytes: 10 * 1024 * 1024, maxFiles: 10, maxAgeDays: 30 };

export const BASE_NAME = "simon.log";

/** A pino destination: anything with `write`. Writes are synchronous — a log line lost in a crash is a log line that mattered. */
export function rotatingFile(dir: string, limits: RotationLimits = LOG_LIMITS, now: () => number = Date.now) {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, BASE_NAME);
  let fd = openSync(file, "a");
  let size = existsSync(file) ? statSync(file).size : 0;

  const prune = () => {
    const cutoff = now() - limits.maxAgeDays * 86_400_000;
    for (const name of readdirSync(dir)) {
      if (!name.startsWith(`${BASE_NAME}.`)) continue;
      const full = path.join(dir, name);
      const index = Number(name.slice(BASE_NAME.length + 1));
      if (Number.isFinite(index) && (index >= limits.maxFiles || statSync(full).mtimeMs < cutoff)) rmSync(full, { force: true });
    }
  };

  const rotate = () => {
    closeSync(fd);
    for (let i = limits.maxFiles - 1; i >= 1; i--) {
      const from = `${file}.${i}`;
      if (existsSync(from)) renameSync(from, `${file}.${i + 1}`);
    }
    renameSync(file, `${file}.1`);
    prune();
    fd = openSync(file, "a");
    size = 0;
  };

  return {
    write(line: string) {
      const bytes = Buffer.byteLength(line);
      if (size + bytes > limits.maxBytes && size > 0) rotate();
      writeSync(fd, line);
      size += bytes;
    },
  };
}
