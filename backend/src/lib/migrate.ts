/**
 * Applies checked-in migrations on startup (§15.4: the owner never runs a CLI).
 *
 * Reads prisma/migrations/<name>/migration.sql in order and records each in the same
 * `_prisma_migrations` table `prisma migrate` uses, so the CLI and the server agree about
 * what has been applied. Each migration runs in its own transaction.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../../prisma/migrations");

export function applyMigrations(file: string, dir: string = MIGRATIONS_DIR): string[] {
  mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  try {
    sqlite.pragma("journal_mode = WAL");
    sqlite.exec(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT PRIMARY KEY NOT NULL, "checksum" TEXT NOT NULL, "finished_at" DATETIME, "migration_name" TEXT NOT NULL,
      "logs" TEXT, "rolled_back_at" DATETIME, "started_at" DATETIME NOT NULL DEFAULT current_timestamp, "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0)`);
    const done = new Set(sqlite.prepare(`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL`).all().map((r) => (r as { migration_name: string }).migration_name));
    const applied: string[] = [];
    for (const name of readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
      if (done.has(name)) continue;
      const sql = readFileSync(path.join(dir, name, "migration.sql"), "utf8");
      sqlite.transaction(() => {
        sqlite.exec(sql);
        sqlite.prepare(`INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count) VALUES (?, ?, current_timestamp, ?, 1)`)
          .run(randomUUID(), createHash("sha256").update(sql).digest("hex"), name);
      })();
      applied.push(name);
    }
    return applied;
  } finally {
    sqlite.close();
  }
}
