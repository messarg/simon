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
});
