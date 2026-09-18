/**
 * Upgrading a shop that already holds data. The Phase 6 migration redefines four tables, and a
 * table redefinition that drops a column or a foreign key loses a live shop's rows silently — so
 * this builds a database at the first migration, writes the rows a v1 shop could have, applies the
 * rest, and checks every row and every reference survived.
 */
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterAll, describe, expect, it } from "vitest";
import { applyMigrations, MIGRATIONS_DIR } from "./migrate.ts";

const dirs: string[] = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

describe("migrations over existing data", () => {
  it("keeps every row and reference when the Phase 6 tables are redefined", () => {
    const work = mkdtempSync(path.join(tmpdir(), "simon-migrate-"));
    dirs.push(work);
    const first = path.join(work, "first");
    const [init] = readdirSync(MIGRATIONS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    mkdirSync(first);
    cpSync(path.join(MIGRATIONS_DIR, init), path.join(first, init), { recursive: true });

    const file = path.join(work, "shop.db");
    expect(applyMigrations(file, first)).toEqual([init]);

    const now = new Date().toISOString();
    const db = new Database(file);
    db.pragma("foreign_keys = ON");
    db.prepare(`INSERT INTO User (id, name, pinHash, role, createdAt) VALUES ('u1', 'Արամ', 'x', 'ADMIN', ?)`).run(now);
    db.prepare(`INSERT INTO Supplier (id, name, nameSearch, createdAt, updatedAt) VALUES ('s1', 'Քար', 'qar', ?, ?)`).run(now, now);
    db.prepare(`INSERT INTO PurchaseOrder (id, number, supplierId, status, total, createdAt) VALUES ('po1', 'PO-1', 's1', 'OPEN', 5000, ?)`).run(now);
    db.prepare(`INSERT INTO PurchaseOrderLine (id, poId, productId, qtyOrdered, unitCostMdram) VALUES ('pl1', 'po1', 'p1', 5000, 1000000)`).run();
    db.prepare(`INSERT INTO GoodsReceipt (id, number, supplierId, poId, receivedAt, userId, supplierInvoiceNo, landedCostTotal, total) VALUES ('gr1', 'GR-1', 's1', 'po1', ?, 'u1', 'INV', 0, 5000)`).run(now);
    db.prepare(`INSERT INTO Stocktake (id, status, startedAt, startedBy) VALUES ('st1', 'COUNTING', ?, 'u1')`).run(now);
    db.prepare(`INSERT INTO StocktakeLine (id, stocktakeId, productId, expectedQty) VALUES ('sl1', 'st1', 'p1', 4000)`).run();
    db.close();

    const applied = applyMigrations(file);
    expect(applied.length).toBeGreaterThan(0);

    const after = new Database(file, { readonly: true });
    expect(after.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(after.pragma("foreign_key_check")).toEqual([]);
    expect(after.prepare("SELECT number, status, total, createdBy, note FROM PurchaseOrder").get()).toEqual({ number: "PO-1", status: "OPEN", total: 5000, createdBy: "", note: "" });
    expect(after.prepare("SELECT qtyOrdered, qtyReceived, uom, factorToStockUom FROM PurchaseOrderLine").get()).toEqual({ qtyOrdered: 5000, qtyReceived: 0, uom: "", factorToStockUom: 1 });
    expect(after.prepare("SELECT poId FROM GoodsReceipt").get()).toEqual({ poId: "po1" });
    expect(after.prepare("SELECT status, snapshotSeq, varianceTotal FROM Stocktake").get()).toEqual({ status: "COUNTING", snapshotSeq: 0, varianceTotal: 0 });
    expect(after.prepare("SELECT expectedQty, countedQty, countedSeq FROM StocktakeLine").get()).toEqual({ expectedQty: 4000, countedQty: null, countedSeq: null });
    // The redefined tables are still STRICT and still check what they must.
    const strict = after.prepare("SELECT name, strict FROM pragma_table_list WHERE name IN ('PurchaseOrder','PurchaseOrderLine','Stocktake','StocktakeLine')").all() as Array<{ strict: number }>;
    expect(strict.every((r) => r.strict === 1)).toBe(true);
    after.close();

    const rw = new Database(file);
    expect(() => rw.prepare(`UPDATE PurchaseOrder SET status = 'SHIPPED'`).run()).toThrow(/CHECK/);
    expect(() => rw.prepare(`UPDATE StocktakeLine SET countedQty = 3000`).run()).toThrow(/CHECK/); // a count must say when it was taken
    rw.close();
  });

  /**
   * The three-tier migration (§16.4) maps people rather than columns, so it is checked person by
   * person: nobody may gain or lose a capability except an admin who becomes a manager.
   */
  it("maps every old role to a tier, and each employee to the grants their role carried", () => {
    const work = mkdtempSync(path.join(tmpdir(), "simon-roles-"));
    dirs.push(work);
    const TARGET = "20260918140000_owner_manager_employee";
    const before = path.join(work, "before");
    mkdirSync(before);
    const names = readdirSync(MIGRATIONS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    expect(names).toContain(TARGET);
    for (const n of names.filter((n) => n < TARGET)) cpSync(path.join(MIGRATIONS_DIR, n), path.join(before, n), { recursive: true });

    const file = path.join(work, "shop.db");
    applyMigrations(file, before);
    const db = new Database(file);
    db.pragma("foreign_keys = ON");
    const add = db.prepare(`INSERT INTO User (id, name, pinHash, recoveryCodeHash, role, createdAt, phone) VALUES (?, ?, 'x', ?, ?, ?, ?)`);
    // An admin added before the one holding the recovery code: age alone must not make an owner.
    add.run("early", "Անի", null, "ADMIN", "2026-01-01T00:00:00.000Z", "091");
    add.run("setup", "Արամ", "code-hash", "ADMIN", "2026-02-01T00:00:00.000Z", "010");
    add.run("stock", "Լուսինե", null, "STOCK", "2026-03-01T00:00:00.000Z", null);
    add.run("till", "Գոռ", null, "WORKER", "2026-03-02T00:00:00.000Z", null);
    db.prepare(`INSERT INTO Stocktake (id, status, startedAt, startedBy) VALUES ('st1', 'COUNTING', '2026-03-03T00:00:00.000Z', 'stock')`).run();
    db.close();

    expect(applyMigrations(file)).toContain(TARGET);
    const after = new Database(file);
    const rows = Object.fromEntries((after.prepare(`SELECT id, role, permissions, recoveryCodeHash, phone FROM User`).all() as Array<Record<string, string | null>>).map((r) => [r.id, r]));
    expect(rows.setup).toMatchObject({ role: "OWNER", permissions: "[]", recoveryCodeHash: "code-hash", phone: "010" });
    expect(rows.early).toMatchObject({ role: "MANAGER", permissions: "[]", recoveryCodeHash: null, phone: "091" });
    expect(rows.stock).toMatchObject({ role: "EMPLOYEE", permissions: '["sell","returns","debt","receive","stocktake","writeoff","labels"]' });
    expect(rows.till).toMatchObject({ role: "EMPLOYEE", permissions: '["sell","returns","debt"]' });
    // References into the rebuilt table survive, and the old role is now an unknown value.
    expect(after.pragma("foreign_key_check")).toEqual([]);
    expect(after.prepare(`SELECT startedBy FROM Stocktake`).get()).toEqual({ startedBy: "stock" });
    expect(() => after.prepare(`UPDATE User SET role = 'ADMIN' WHERE id = 'early'`).run()).toThrow(/CHECK/);
    expect(after.prepare(`SELECT strict FROM pragma_table_list WHERE name = 'User'`).get()).toEqual({ strict: 1 });
    after.close();
  });
});
