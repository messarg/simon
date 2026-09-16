/**
 * Import — §19.1, §7.3, §27.38 (a decimal is a row error, never a rounded value) and §27.5
 * (opening debts carry their original dates, so aging matches the paper book on day one).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { uuidv7 } from "@simon/shared";
import { createTestApp, type TestApp } from "../test/app.ts";
import { get, post } from "../test/fixtures.ts";

// A date in shop-local time (TZ is pinned to Asia/Yerevan), as aging counts days (§19.3). In UTC,
// between midnight and 04:00 in Yerevan, "100 days ago" was one shop day earlier and aged 101.
const daysAgo = (n: number) => {
  const d = new Date(Date.now() - n * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const importFile = (t: TestApp, kind: string, content: string, opts: { dryRun?: boolean; id?: string } = {}) =>
  post(t, "/imports", { id: opts.id ?? uuidv7(), kind, fileName: `${kind}.csv`, content, dryRun: opts.dryRun }, "ADMIN");

describe("import", () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.close(); });

  it("§27.38 — a price of 12.5 is a row error, and one bad row leaves the whole file unapplied", async () => {
    const file = [
      "Անուն,Գին,Շտրիխկոդ,Չափ",
      "Ցեմենտ M400,3200,4850001234567,տուփ",
      "Մալուխ ՊՎՍ 3x2.5,12.5,,մ",
      "Ավազ,25,,կգ",
    ].join("\n");
    const res = await importFile(t, "PRODUCTS", file);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ rowCount: 3, appliedCount: 0, failedCount: 1 });
    expect(res.body.rows.find((r: { rowNumber: number }) => r.rowNumber === 3)).toMatchObject({ status: "FAILED", error: "not-whole:price" });
    // Never partially applied: the two good rows are not in the catalogue either.
    expect(await t.db.product.count()).toBe(0);
    expect(res.body.rows.filter((r: { error: string }) => r.error === "batch-refused")).toHaveLength(2);

    // The owner fixes the cell and runs it again.
    const fixed = await importFile(t, "PRODUCTS", file.replace("12.5", "1200"));
    expect(fixed.body).toMatchObject({ appliedCount: 3, failedCount: 0 });
    const cement = await t.db.product.findFirstOrThrow({ where: { name: "Ցեմենտ M400" }, include: { barcodes: true, units: true } });
    expect(cement).toMatchObject({ sellPriceMdram: 3_200_000, stockUom: "տուփ", decimalPlaces: 0 });
    expect(cement.barcodes[0].barcode).toBe("4850001234567");
    // A unit that divides carries three decimals, a piece none.
    expect((await t.db.product.findFirstOrThrow({ where: { name: "Ավազ" } })).decimalPlaces).toBe(3);
    // A product with no barcode in the file still gets one, so it can be labelled and scanned.
    expect((await t.db.productBarcode.count())).toBe(3);
  });

  it("running the same file twice applies nothing the second time", async () => {
    const before = await t.db.product.count();
    const again = await importFile(t, "PRODUCTS", ["Անուն,Գին,Շտրիխկոդ,Չափ", "Ցեմենտ M400,3200,4850001234567,տուփ"].join("\n"));
    expect(again.body).toMatchObject({ appliedCount: 0, skippedCount: 1 });
    expect(again.body.rows[0]).toMatchObject({ status: "SKIPPED", error: "already-imported" });
    expect(again.body.duplicateOfBatchId).toBeNull(); // a different file, only an overlapping row
    expect(await t.db.product.count()).toBe(before);
  });

  it("a different product carrying someone else's barcode is refused, naming the row", async () => {
    // Keyed on its own SKU, so this is a new product — and its barcode belongs to the cement.
    const res = await importFile(t, "PRODUCTS", ["Կոդ,Անուն,Գին,Շտրիխկոդ", "A-77,Ուրիշ ապրանք,500,4850001234567"].join("\n"));
    expect(res.body.rows[0]).toMatchObject({ status: "FAILED", error: "duplicate-barcode:barcode" });
    expect(await t.db.product.count({ where: { sku: "A-77" } })).toBe(0);
  });

  it("a preview changes nothing and says what would happen", async () => {
    const before = await t.db.customer.count();
    const res = await importFile(t, "CUSTOMERS", ["Անուն,Հեռախոս,Սահմանաչափ", "Դավիթ Սարգսյան,+374 91 12-34-56,50000"].join("\n"), { dryRun: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ dryRun: true, appliedCount: 1, failedCount: 0 });
    expect(res.body.rows[0].preview).toMatchObject({ name: "Դավիթ Սարգսյան", phone: "+37491123456", limit: 50_000 });
    expect(await t.db.customer.count()).toBe(before);
    expect(await t.db.importBatch.count({ where: { kind: "CUSTOMERS" } })).toBe(0);
  });

  it("§27.5 — opening debts keep their original dates, so aging is right on day one and a second run does not double them", async () => {
    await importFile(t, "CUSTOMERS", ["Անուն,Հեռախոս", "Դավիթ Սարգսյան,+374 91 12-34-56", "Անահիտ Մկրտչյան,+374 77 55-44-33"].join("\n"));
    const debts = [
      "Անուն,Գումար,Ամսաթիվ",
      `Դավիթ Սարգսյան,12000,${daysAgo(40)}`,
      `Դավիթ Սարգսյան,8000,${daysAgo(100)}`,
      `Անահիտ Մկրտչյան,5000,${daysAgo(10)}`,
    ].join("\n");
    const res = await importFile(t, "OPENING_DEBTS", debts);
    expect(res.body).toMatchObject({ appliedCount: 3, failedCount: 0 });

    const david = await t.db.customer.findFirstOrThrow({ where: { phone: "+37491123456" } });
    const ledger = (await get(t, `/customers/${david.id}/ledger`, "ADMIN")).body;
    expect(ledger.outstanding).toBe(20_000);
    expect(ledger.aging).toMatchObject({ d31_60: 12_000, d90plus: 8_000, d0_30: 0 });
    expect(ledger.aging.oldestChargeDays).toBe(100);

    // The same file again: every balance stays where it was.
    const rerun = await importFile(t, "OPENING_DEBTS", debts);
    expect(rerun.body).toMatchObject({ appliedCount: 0, skippedCount: 3 });
    expect(rerun.body.duplicateOfBatchId).not.toBeNull(); // the same spreadsheet, recognised by its hash
    expect((await get(t, `/customers/${david.id}/ledger`, "ADMIN")).body.outstanding).toBe(20_000);
  });

  it("opening stock seeds the cost of a product that had none, and refuses a quantity finer than the product", async () => {
    const bad = await importFile(t, "OPENING_STOCK", ["Անուն,Քանակ,Ինքնարժեք", "Ցեմենտ M400,12.5,2600"].join("\n"));
    expect(bad.body.rows[0]).toMatchObject({ status: "FAILED", error: "not-whole:qty" }); // cement is sold by the sack

    const res = await importFile(t, "OPENING_STOCK", ["Անուն,Քանակ,Ինքնարժեք", "Ցեմենտ M400,40,2600", "Ավազ,12.5,25"].join("\n"));
    expect(res.body).toMatchObject({ appliedCount: 2, failedCount: 0 });
    const cement = await t.db.product.findFirstOrThrow({ where: { name: "Ցեմենտ M400" } });
    expect(cement).toMatchObject({ stockQty: 40_000, avgCostMdram: 2_600_000 });
    expect((await t.db.product.findFirstOrThrow({ where: { name: "Ավազ" } })).stockQty).toBe(12_500);
    expect(await t.db.stockMovement.count({ where: { type: "OPENING_BALANCE" } })).toBe(2);
  });

  it("an unknown product or customer is a row error naming what was not found", async () => {
    const stock = await importFile(t, "OPENING_STOCK", ["Անուն,Քանակ", "Չկա այդպիսին,5"].join("\n"));
    expect(stock.body.rows[0]).toMatchObject({ status: "FAILED", error: "unknown-product:name" });
    const debt = await importFile(t, "OPENING_DEBTS", ["Անուն,Գումար,Ամսաթիվ", `Ոչ ոք,5000,${daysAgo(5)}`].join("\n"));
    expect(debt.body.rows[0]).toMatchObject({ status: "FAILED", error: "unknown-customer:name" });
  });

  it("a file with no usable columns is refused as a request, not as rows", async () => {
    const res = await importFile(t, "PRODUCTS", ["Column A,Column B", "x,y"].join("\n"));
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ column: "name" });
  });

  it("importing is the owner's, and every batch is audited", async () => {
    expect((await post(t, "/imports", { id: uuidv7(), kind: "PRODUCTS", fileName: "x.csv", content: "a,b" }, "STOCK")).status).toBe(403);
    expect((await post(t, "/imports", { id: uuidv7(), kind: "PRODUCTS", fileName: "x.csv", content: "a,b" }, "WORKER")).status).toBe(403);
    expect(await t.db.auditLog.count({ where: { action: "import.run" } })).toBeGreaterThan(0);
    const list = (await get(t, "/imports", "ADMIN")).body.items;
    expect(list.length).toBeGreaterThan(0);
    expect((await get(t, `/imports/${list[0].id}`, "ADMIN")).body.rows.length).toBeGreaterThan(0);
  });
});
