/**
 * Diagnosis without remote access. PRD §19.5.
 *
 * One ADMIN-only payload the owner can read down the phone: what version, how big, when the last
 * backup worked, whether a passphrase exists at all, what is still waiting to be sent, and the three
 * settings installation sets — two of which fail silently when wrong. Every figure is a query over a
 * table, because a diagnostic that cannot be recomputed is a rumour. Never the passphrase itself.
 */
import { existsSync, statSync } from "node:fs";
import { config } from "../lib/config.ts";
import type { Db } from "../lib/db.ts";
import { clock } from "../lib/time.ts";
import { lastCheckpointAt } from "../lib/wal.ts";
import { passphraseIsSet } from "./backup.service.ts";
import { pendingFiscal } from "./fiscal.service.ts";
import { readSettings } from "./settings.service.ts";

export type Alert =
  | { type: "backup-stale"; lastAt: string | null }
  | { type: "ledger-drift"; count: number }
  | { type: "sale-waiting"; count: number; oldestAt: string; deviceLabel: string }
  | { type: "fiscal-pending"; count: number; oldestAt: string };

/** The three things that reach the owner in-app, because nothing else can reach him (§19.5). */
export async function systemAlerts(db: Db): Promise<Alert[]> {
  const now = clock.now().getTime();
  const [lastBackup, drift, devices] = await Promise.all([
    db.backupRun.findFirst({ where: { outcome: "OK" }, orderBy: { startedAt: "desc" } }),
    db.reviewFlag.count({ where: { type: "LEDGER_CACHE_DRIFT", resolvedAt: null } }),
    db.device.findMany({ where: { isActive: 1, outboxDepth: { gt: 0 }, outboxOldestAt: { not: null } } }),
  ]);
  const alerts: Alert[] = [];
  if (!lastBackup || now - Date.parse(lastBackup.startedAt) > 24 * 3_600_000) alerts.push({ type: "backup-stale", lastAt: lastBackup?.startedAt ?? null });
  if (drift > 0) alerts.push({ type: "ledger-drift", count: drift });
  // Parked baskets are excluded: one may sit there all afternoon by design (§14.4).
  const stale = devices.filter((d) => now - Date.parse(d.outboxOldestAt!) > 3_600_000);
  for (const d of stale) alerts.push({ type: "sale-waiting", count: d.outboxDepth, oldestAt: d.outboxOldestAt!, deviceLabel: `${d.prefix} ${d.label}` });
  // A fiscal device that stopped answering is noticed, not silently skipped (§17).
  const pending = await pendingFiscal(db);
  const oldest = pending[0]?.completedAt;
  if (oldest && now - Date.parse(oldest) > 10 * 60_000) alerts.push({ type: "fiscal-pending", count: pending.length, oldestAt: oldest });
  return alerts;
}

async function databaseSize(db: Db) {
  try {
    const rows = await db.$queryRawUnsafe<Array<{ name: string; file: string }>>("PRAGMA database_list");
    const file = rows.find((r) => r.name === "main")?.file;
    if (!file || !existsSync(file)) return { bytes: null, walBytes: null };
    return { bytes: statSync(file).size, walBytes: existsSync(`${file}-wal`) ? statSync(`${file}-wal`).size : 0 };
  } catch {
    return { bytes: null, walBytes: null };
  }
}

export async function diagnostics(db: Db) {
  const settings = await readSettings(db);
  const [size, lastOk, lastFailure, devices, drift, alerts] = await Promise.all([
    databaseSize(db),
    db.backupRun.findFirst({ where: { outcome: "OK" }, orderBy: { startedAt: "desc" } }),
    db.backupRun.findFirst({ where: { outcome: "FAILED" }, orderBy: { startedAt: "desc" } }),
    db.device.findMany({ where: { isActive: 1 } }),
    db.reviewFlag.count({ where: { type: "LEDGER_CACHE_DRIFT", resolvedAt: null } }),
    systemAlerts(db),
  ]);
  const oldest = devices.map((d) => d.outboxOldestAt).filter((x): x is string => x !== null).sort()[0] ?? null;
  const checkpoint = lastCheckpointAt();
  return {
    version: config.version,
    now: clock.iso(),
    uptimeSeconds: Math.round(process.uptime()),
    database: { bytes: size.bytes, walBytes: size.walBytes, lastCheckpointAt: checkpoint, checkpointAgeSeconds: checkpoint ? Math.round((clock.now().getTime() - Date.parse(checkpoint)) / 1000) : null },
    backup: {
      passphraseSet: passphraseIsSet(),
      lastOkAt: lastOk?.startedAt ?? null, lastOkSizeBytes: lastOk?.sizeBytes ?? null, lastOkDestination: lastOk?.destination ?? null,
      lastFailureAt: lastFailure?.startedAt ?? null, lastFailureError: lastFailure?.error ?? null,
      destination: settings["backup.destination"],
    },
    queues: {
      salesWaiting: devices.reduce((a, d) => a + d.outboxDepth, 0),
      parked: devices.reduce((a, d) => a + d.parkedDepth, 0),
      oldestAt: oldest,
      devices: devices.map((d) => ({ prefix: d.prefix, label: d.label, salesWaiting: d.outboxDepth, parked: d.parkedDepth, oldestAt: d.outboxOldestAt, lastSeenAt: d.lastSeenAt })),
    },
    ledgerDriftFlags: drift,
    installation: { taxRegime: settings["tax.regime"], priceBasis: settings["tax.priceBasis"], timezone: settings["shop.timezone"] },
    fiscal: { device: config.fiscal, since: settings["fiscal.since"] || null, pending: (await pendingFiscal(db)).length },
    labelPrinter: config.labelPrinter,
    alerts,
  };
}
