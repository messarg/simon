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

console.log(`seeded ${file}`);
console.log(`owner recovery code (dev only): ${owner.recoveryCode}`);
await db.$disconnect();
