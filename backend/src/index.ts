/**
 * Simon backend entry point.
 *
 * Applies checked-in migrations, then binds 0.0.0.0 so staff phones on the shop LAN can
 * reach it (PRD §16.6). Every device on that Wi-Fi can reach it too — authorization is
 * enforced per route, never by CORS.
 */
import { createApp } from "./app.ts";
import { config, databaseFile } from "./lib/config.ts";
import { closeAll, dbFor, registerClient, openDatabase } from "./lib/db.ts";
import { logger } from "./lib/logger.ts";
import { applyMigrations } from "./lib/migrate.ts";
import { runStockDriftCheck } from "./jobs/stock-drift.ts";

const applied = applyMigrations(databaseFile("LIVE"));
if (applied.length) logger.info({ applied }, "migrations applied");

const live = await openDatabase(databaseFile("LIVE"));
registerClient("LIVE", live);

const app = createApp({
  live,
  practice: async () => { applyMigrations(databaseFile("PRACTICE")); return dbFor("PRACTICE"); },
});

const server = app.listen(config.port, config.host, () => {
  logger.info({ host: config.host, port: config.port, version: config.version }, "Simon backend listening");
});

// Nightly-ish drift check; reports, never repairs (§10.4).
const driftTimer = setInterval(() => { runStockDriftCheck(live).catch((err) => logger.error({ err }, "drift check failed")); }, 6 * 60 * 60_000);

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  clearInterval(driftTimer);
  server.close();
  await closeAll();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
