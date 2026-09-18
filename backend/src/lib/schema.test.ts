/**
 * §11 "Table storage" and §23.1 item 1: STRICT is a keyword at creation and a full rewrite
 * afterwards, so this asserts every migration still carries it, and that the database
 * actually refuses what the conventions forbid (§27.38's storage half).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../test/db.ts";

const migrationsDir = path.resolve(import.meta.dirname, "../../prisma/migrations");

describe("schema", () => {
  let t: TestDb;
  beforeAll(async () => { t = await createTestDb(); });
  afterAll(async () => { await t.close(); });

  it("every table created by a migration is STRICT", () => {
    for (const dir of readdirSync(migrationsDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const sql = readFileSync(path.join(migrationsDir, dir.name, "migration.sql"), "utf8");
      const tables = [...sql.matchAll(/CREATE TABLE "(\w+)" \([\s\S]*?\n\)( STRICT)?;/g)];
      for (const [, name, strict] of tables) expect(strict, `${dir.name}: ${name}`).toBe(" STRICT");
    }
  });

  it("the live database reports STRICT tables", async () => {
    const rows = await t.db.$queryRawUnsafe<{ name: string; strict: bigint }[]>(
      "SELECT name, strict FROM pragma_table_list WHERE schema = 'main' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'",
    );
    expect(rows.length).toBeGreaterThan(40);
    for (const r of rows) expect(r.strict, r.name).toBe(1n);
  });

  it("foreign keys are enforced on the connection", async () => {
    const [row] = await t.db.$queryRawUnsafe<{ foreign_keys: bigint }[]>("PRAGMA foreign_keys");
    expect(row.foreign_keys).toBe(1n);
  });

  it("refuses a REAL in a money column and an unknown enum value", async () => {
    const now = new Date().toISOString();
    await expect(t.db.$executeRawUnsafe(
      `INSERT INTO Product (id, name, nameSearch, stockUom, decimalPlaces, sellPriceMdram, createdAt, updatedAt) VALUES ('p1', 'x', 'x', 'pc', 0, 12.5, '${now}', '${now}')`,
    )).rejects.toThrow();
    await expect(t.db.$executeRawUnsafe(
      `INSERT INTO User (id, name, pinHash, role, createdAt) VALUES ('u1', 'x', 'h', 'ADMIN', '${now}')`,
    )).rejects.toThrow(); // the retired role is an unknown value now (§16.4)
  });

  it("requires a reason code on a write-off and only there", async () => {
    const now = new Date().toISOString();
    await t.db.$executeRawUnsafe(`INSERT INTO User (id, name, pinHash, role, createdAt) VALUES ('u2', 'x', 'h', 'OWNER', '${now}')`);
    await t.db.$executeRawUnsafe(`INSERT INTO Product (id, name, nameSearch, stockUom, decimalPlaces, sellPriceMdram, createdAt, updatedAt) VALUES ('p2', 'x', 'x', 'pc', 0, 1000, '${now}', '${now}')`);
    const insert = (type: string, reason: string | null) => t.db.$executeRawUnsafe(
      `INSERT INTO StockMovement (id, productId, seq, type, qtyDelta, balanceAfter, sourceType, sourceId, userId, reasonCode, createdAt) VALUES ('${crypto.randomUUID()}', 'p2', ${Math.floor(Math.random() * 1e9)}, '${type}', -1000, -1000, 'StockMovement', 'x', 'u2', ${reason ? `'${reason}'` : "NULL"}, '${now}')`,
    );
    await expect(insert("WRITE_OFF", null)).rejects.toThrow();
    await expect(insert("SALE", "DAMAGE")).rejects.toThrow();
    await expect(insert("WRITE_OFF", "DAMAGE")).resolves.toBe(1);
  });
});
