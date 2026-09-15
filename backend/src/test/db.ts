/** A migrated, empty SQLite file per test file. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Db } from "../lib/db.ts";
import { openDatabase } from "../lib/db.ts";
import { applyMigrations } from "../lib/migrate.ts";

export interface TestDb {
  db: Db;
  file: string;
  close: () => Promise<void>;
}

export async function createTestDb(): Promise<TestDb> {
  const dir = mkdtempSync(path.join(tmpdir(), "simon-test-"));
  const file = path.join(dir, "test.db");
  applyMigrations(file);
  const db = await openDatabase(file);
  return { db, file, close: async () => { await db.$disconnect(); rmSync(dir, { recursive: true, force: true }); } };
}
