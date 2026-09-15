/**
 * Development seed: one user per role and the installation settings (§7.1). Refuses to run
 * against a database that already has users, so it can never touch a shop's data.
 *
 *   npm run db:seed --workspace backend
 *
 * PINs: owner 1111 · stock 2222 · worker 3333.
 */
import { databaseFile } from "../src/lib/config.ts";
import { openDatabase } from "../src/lib/db.ts";
import { applyMigrations } from "../src/lib/migrate.ts";
import { writeSettings } from "../src/services/settings.service.ts";
import { uuidv7 } from "@simon/shared";
import { createProduct } from "../src/services/product.service.ts";
import { postMovement } from "../src/services/stock-ledger.service.ts";
import { createOwner, createUser } from "../src/services/user.service.ts";

const file = databaseFile("LIVE");
applyMigrations(file);
const db = await openDatabase(file);

if ((await db.user.count()) > 0) {
  console.error("seed: database already has users — refusing to seed");
  process.exit(1);
}

const owner = await createOwner(db, { shopName: "Շինանյութ «Արարատ»", ownerName: "Արամ", pin: "1111" });
await createUser(db, owner.user.id, { name: "Լուսինե", pin: "2222", role: "STOCK" });
await createUser(db, owner.user.id, { name: "Գոռ", pin: "3333", role: "WORKER" });
await db.$transaction((tx) => writeSettings(tx, { "tax.regime": "VAT", "tax.priceBasis": "INCLUSIVE", "tax.rateBp": 2000, "shop.address": "Երևան" }, owner.user.id));

// A small hardware-store catalogue: name, price ֏, unit, decimals, stock (display units), cost ֏, barcode, pinned.
const catalogue: Array<[string, number, string, number, number, number | null, string | null, boolean]> = [
  ["Մալուխ ՊՎՍ 3x2.5", 1200, "մ", 2, 250, 820, null, true],
  ["Մալուխ ՊՎՍ 2x1.5", 650, "մ", 2, 180, 430, null, true],
  ["Պտուտակ 4x40", 50, "հատ", 0, 2000, 22, "4820000000401", false],
  ["Պտուտակ 5x60", 80, "հատ", 0, 1500, 38, "4820000000602", false],
  ["Ցեմենտ M400, 50 կգ", 3200, "տուփ", 0, 40, 2600, "4850001234567", true],
  ["Ավազ", 25, "կգ", 3, 1200, null, null, true],
  ["Ներկ սպիտակ 2.5 լ", 6800, "հատ", 0, 12, 4900, "4600000025001", false],
  ["Դյուբել 6x40", 30, "հատ", 0, 800, 12, "4820000000640", false],
  ["Մեկուսիչ ժապավեն", 450, "հատ", 0, 60, 210, "6901234567892", false],
  ["Հարդ PVC խողովակ 20 մմ", 520, "մ", 1, 300, 330, null, true],
  ["Վարդակ կրկնակի", 1900, "հատ", 0, 25, 1150, "8690000000121", false],
  ["Լամպ LED 10W", 900, "հատ", 0, 0, 560, "8690000010106", false],
];
for (const [name, price, uom, dp, stock, cost, barcode, pinned] of catalogue) {
  const p = await createProduct(db, owner.user.id, { id: uuidv7(), name, sellPriceMdram: price * 1000, stockUom: uom, decimalPlaces: dp, barcode });
  if (pinned) await db.product.update({ where: { id: p.id }, data: { tilePinnedAt: new Date().toISOString() } });
  if (stock > 0) {
    await db.$transaction((tx) => postMovement(tx, {
      productId: p.id, type: cost === null ? "OPENING_BALANCE" : "PURCHASE_RECEIPT", qtyDelta: stock * 1000,
      unitCostMdram: cost === null ? null : cost * 1000, source: { type: "Seed", id: p.id }, userId: owner.user.id,
    }));
  }
}

console.log(`seeded ${file} with ${catalogue.length} products`);
console.log(`owner recovery code (dev only): ${owner.recoveryCode}`);
await db.$disconnect();
