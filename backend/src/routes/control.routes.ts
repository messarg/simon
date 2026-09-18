/**
 * The owner's routes: home, the report catalogue, the audit trail, diagnostics and backups.
 * PRD §6.9, §6.10, §15.4, §19.2, §19.5, §20.2.
 *
 * Two tiers here (§16.4). Home and the operational reports are the owner's and a manager's, with
 * cost swept out for a manager exactly as it is everywhere else. What is the owner's alone is
 * gated as a route, because §16.5 gates a payload that cannot be stripped field by field that way:
 * the reports that exist to show cost, the audit trail's whole-record JSON, diagnostics, imports
 * (which write opening costs) and backups.
 */
import { Router } from "express";
import { z } from "zod";
import { businessDate, ImportBody } from "@simon/shared";
import { auth, requireManager, requireOwner } from "../middleware/auth.ts";
import { config, databaseFile } from "../lib/config.ts";
import { isOwner, stripCost } from "../lib/shape.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { consumeGrant } from "../services/auth.service.ts";
import { listBackups, revealPassphrase, rotatePassphrase, stageRestore, takeBackup } from "../services/backup.service.ts";
import { diagnostics } from "../services/diagnostics.service.ts";
import { listImports, loadImport, runImport } from "../services/import.service.ts";
import { ownerHome } from "../services/home.service.ts";
import { auditRows, OWNER_REPORTS, REPORT_NAMES, runReport, type ReportName } from "../services/report.service.ts";
import { readSettings } from "../services/settings.service.ts";

const dateish = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export function controlRoutes() {
  const r = Router();
  const admin = requireOwner();
  const manager = requireManager();

  r.get("/home", manager, async (req, res) => {
    const a = auth(req);
    res.json(stripCost(await ownerHome(a.db, { owner: isOwner(a.role) }), a.role));
  });

  r.get("/reports/:name", manager, async (req, res) => {
    const a = auth(req);
    const name = String(req.params.name);
    if (!(REPORT_NAMES as readonly string[]).includes(name)) throw problem("not-found");
    if (!isOwner(a.role) && (OWNER_REPORTS as readonly string[]).includes(name)) throw problem("not-permitted", { required: "OWNER" });
    const today = businessDate(clock.now(), (await readSettings(a.db))["shop.timezone"]);
    const q = z.object({
      from: dateish.optional(), to: dateish.optional(), groupBy: z.string().max(20).optional(),
      productId: z.string().max(60).optional(), userId: z.string().max(60).optional(),
      entityType: z.string().max(40).optional(), entityId: z.string().max(60).optional(), action: z.string().max(60).optional(),
    }).parse(req.query);
    // One person's figures are about that person, and the owner's are the owner's (§6.17).
    if (q.userId && !isOwner(a.role)) {
      const person = await a.live.user.findUnique({ where: { id: q.userId }, select: { role: true } });
      if (!person || person.role === "OWNER") throw problem("not-found");
    }
    res.json(stripCost(await runReport(a.db, name as ReportName, { ...q, from: q.from ?? today, to: q.to ?? today }), a.role));
  });

  // An audit trail nobody can read is a trail nobody is protected by (§10.7).
  r.get("/audit-log", admin, async (req, res) => {
    const a = auth(req);
    const q = z.object({
      from: dateish.optional(), to: dateish.optional(), userId: z.string().max(60).optional(),
      entityType: z.string().max(40).optional(), entityId: z.string().max(60).optional(), action: z.string().max(60).optional(),
      limit: z.coerce.number().int().min(1).max(500).default(200),
    }).parse(req.query);
    const settings = await readSettings(a.db);
    const rows = await auditRows(a.db, settings["shop.timezone"], q);
    res.json({ items: rows.map((x) => ({ id: x.id, at: x.createdAt, userId: x.userId, userName: x.user.name, action: x.action, entityType: x.entityType, entityId: x.entityId, reason: x.reason, before: x.before, after: x.after })) });
  });

  r.get("/diagnostics", admin, async (req, res) => { res.json(await diagnostics(auth(req).live)); });

  // ── Import (§19.1, §7.3). Preview first, then the same call without dryRun. ─
  r.post("/imports", admin, async (req, res) => {
    const a = auth(req);
    const body = ImportBody.parse(req.body);
    const result = await runImport(a.db, a.userId, body);
    res.status(body.dryRun ? 200 : 201).json(result);
  });

  r.get("/imports", admin, async (req, res) => { res.json({ items: await listImports(auth(req).db) }); });

  r.get("/imports/:id", admin, async (req, res) => {
    const batch = await loadImport(auth(req).db, String(req.params.id));
    res.json({
      id: batch.id, kind: batch.kind, rowCount: batch.rowCount, appliedCount: batch.appliedCount,
      skippedCount: batch.skippedCount, failedCount: batch.failedCount, startedAt: batch.startedAt, completedAt: batch.completedAt,
      rows: batch.rows.map((x) => ({ rowNumber: x.rowNumber, naturalKey: x.naturalKey, status: x.status, entityId: x.entityId, error: x.error })),
    });
  });

  // ── Backups (§19.2). Always the live database, never the practice one. ─────
  r.get("/backups", admin, async (req, res) => { res.json(await listBackups(auth(req).live)); });

  r.post("/backups", admin, async (req, res) => {
    const result = await takeBackup(auth(req).live, "MANUAL");
    if (!result.ok) throw problem("internal-error", { component: "backup", reason: result.error });
    res.status(201).json(result);
  });

  r.post("/backup/passphrase/reveal", admin, async (req, res) => {
    const a = auth(req);
    const { reauthGrant } = z.object({ reauthGrant: z.string().min(1) }).parse(req.body);
    if (!consumeGrant(reauthGrant, "backupPassphrase")) throw problem("reauth-required", { action: "backupPassphrase" });
    res.json({ passphrase: await revealPassphrase(a.live, a.userId) });
  });

  r.post("/backup/passphrase/rotate", admin, async (req, res) => {
    const a = auth(req);
    const { reauthGrant } = z.object({ reauthGrant: z.string().min(1) }).parse(req.body);
    if (!consumeGrant(reauthGrant, "backupPassphrase")) throw problem("reauth-required", { action: "backupPassphrase" });
    res.json({ passphrase: await rotatePassphrase(a.live, a.userId) });
  });

  r.post("/backup/restore", admin, async (req, res) => {
    const a = auth(req);
    const { file, reauthGrant } = z.object({ file: z.string().min(1).max(80), reauthGrant: z.string().min(1) }).parse(req.body);
    if (!consumeGrant(reauthGrant, "backupRestore")) throw problem("reauth-required", { action: "backupRestore" });
    res.json({ ...(await stageRestore(a.live, a.userId, file, databaseFile("LIVE"))), version: config.version });
  });

  return r;
}
