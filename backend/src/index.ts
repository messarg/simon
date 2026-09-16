/**
 * Simon backend entry point.
 *
 * Applies checked-in migrations, then binds 0.0.0.0 so staff phones on the shop LAN can
 * reach it (PRD §16.6). Every device on that Wi-Fi can reach it too — authorization is
 * enforced per route, never by CORS.
 */
import { createApp } from "./app.ts";
import { config, databaseFile } from "./lib/config.ts";
import { closeAll, registerClient, openDatabase } from "./lib/db.ts";
import { logger } from "./lib/logger.ts";
import { applyMigrations } from "./lib/migrate.ts";
import { runProductStats } from "./jobs/product-stats.ts";
import { runStockDriftCheck } from "./jobs/stock-drift.ts";
import { applyPendingRestore, backupTick } from "./services/backup.service.ts";
import { openPractice } from "./services/practice.service.ts";
import { checkpoint } from "./lib/wal.ts";

// A restore staged by the owner is swapped in here, before anything opens the database (§19.2).
if (applyPendingRestore(databaseFile("LIVE"))) logger.warn("restored the database from a staged backup");

const applied = applyMigrations(databaseFile("LIVE"));
if (applied.length) logger.info({ applied }, "migrations applied");

const live = await openDatabase(databaseFile("LIVE"));
registerClient("LIVE", live);

const app = createApp({
  live,
  practice: openPractice,
  staticDir: config.staticDir || undefined,
});

const server = app.listen(config.port, config.host, () => {
  logger.info({ host: config.host, port: config.port, version: config.version }, "Simon backend listening");
});

// A till reuses its connection; Node's default idle window is the same 5 s at both ends, so the two
// can close on each other and a queued sale fails a round trip it did not need to. The server waits
// longer than any client would (§14.2: a completed sale is never lost, and a retry is time at the counter).
server.keepAliveTimeout = 120_000;
server.headersTimeout = 125_000;

// Nightly-ish drift check; reports, never repairs (§10.4).
const driftTimer = setInterval(() => { runStockDriftCheck(live).catch((err) => logger.error({ err }, "drift check failed")); }, 6 * 60 * 60_000);

// Velocity, read by the tiles, the low-stock count and the reorder suggestion (§13.3).
const statsTimer = setInterval(() => { runProductStats(live).catch((err) => logger.error({ err }, "product stats failed")); }, 6 * 60 * 60_000);
runProductStats(live).catch((err) => logger.error({ err }, "product stats failed"));

// Hourly while trading, daily regardless, and the WAL checkpointed so §19.5 can report its age.
const backupTimer = config.backup.automatic
  ? setInterval(() => { backupTick(live).catch((err) => logger.error({ err }, "backup failed")); }, 5 * 60_000)
  : null;
const walTimer = setInterval(() => { checkpoint(live).catch((err) => logger.error({ err }, "checkpoint failed")); }, 5 * 60_000);

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  clearInterval(driftTimer);
  clearInterval(statsTimer);
  clearInterval(walTimer);
  if (backupTimer) clearInterval(backupTimer);
  server.close();
  await closeAll();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
