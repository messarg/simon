/** Health, first-run setup and sign-in. The only routes reachable without a session. */
import { Router } from "express";
import { z } from "zod";
import type { Db } from "../lib/db.ts";
import { config } from "../lib/config.ts";
import { problem } from "../lib/problem.ts";
import { DeviceRateLimiter } from "../domain/pin-policy.ts";
import { login, recover, reauth } from "../services/auth.service.ts";
import { createInstallPassphrase } from "../services/backup.service.ts";
import { readSettings } from "../services/settings.service.ts";
import { createOwner, listAdmins, listSignInUsers, needsSetup } from "../services/user.service.ts";

const pin = z.string().regex(/^\d{4,8}$/);

/** `If-None-Match` is a list, and a proxy may have made ours weak on the way out. */
function matchesEtag(header: string | string[] | undefined, etag: string) {
  const raw = Array.isArray(header) ? header.join(",") : header;
  if (!raw) return false;
  return raw.split(",").map((x) => x.trim()).some((x) => x === "*" || x === etag || x === `W/${etag}`);
}

export function systemRoutes(live: Db) {
  const r = Router();
  const limiter = new DeviceRateLimiter();

  // Liveness only (§15.4): no session, nothing an unauthenticated probe should not know.
  r.get("/health", (_req, res) => { res.json({ status: "ok", version: config.version }); });

  // What the wizard needs to know before anyone has signed in: whether to start, and where to resume
  // (§7.1, §27.35). Nothing here is the shop's business — no name, no figures.
  r.get("/setup/status", async (_req, res) => {
    const settings = await readSettings(live);
    res.json({
      needsOwner: await needsSetup(live),
      step: settings["setup.step"],
      completedAt: settings["setup.completedAt"] || null,
      taxRegimeSet: settings["tax.regime"] !== null,
    });
  });

  r.post("/setup/owner", async (req, res) => {
    const body = z.object({ shopName: z.string().trim().min(1).max(120), ownerName: z.string().trim().min(1).max(60), pin }).parse(req.body);
    if (!(await needsSetup(live))) throw problem("not-permitted");
    const owner = await createOwner(live, body);
    // The wizard ends by showing two secrets once, written down together (§7.1, §19.2).
    res.status(201).json({ ...owner, backupPassphrase: createInstallPassphrase() });
  });

  r.get("/auth/users", async (_req, res) => {
    if (await needsSetup(live)) throw problem("setup-required");
    res.json({ items: await listSignInUsers(live) });
  });

  /**
   * The photograph itself, one request per face and the only personal field served without a
   * session (§6.11.1, §16.5, §26.2). It draws the sign-in tiles, so it cannot require the session
   * you do not have yet. `ETag` is the write stamp: the browser asks once per face and is told
   * `304` every time afterwards, while `no-cache` keeps a replaced photograph from surviving.
   */
  r.get("/users/:id/avatar", async (req, res) => {
    const u = await live.user.findUnique({
      where: { id: String(req.params.id) },
      select: { avatar: true, avatarType: true, avatarUpdatedAt: true },
    });
    if (!u?.avatar || !u.avatarType || !u.avatarUpdatedAt) throw problem("not-found");
    const etag = `"${u.avatarUpdatedAt}"`;
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Type", u.avatarType);
    if (matchesEtag(req.headers["if-none-match"], etag)) {
      res.status(304).end();
      return;
    }
    res.send(Buffer.from(u.avatar));
  });

  // The admins an override can be approved by (§16.3): the same names, filtered by who may say yes.
  r.get("/auth/admins", async (_req, res) => {
    res.json({ items: await listAdmins(live) });
  });

  r.post("/auth/login", async (req, res) => {
    const body = z.object({ userId: z.string().min(1), pin: z.string(), deviceId: z.string().nullish(), deviceLabel: z.string().max(40).optional() }).parse(req.body);
    res.json(await login(live, limiter, { ...body, rateKey: req.ip ?? "unknown" }));
  });

  r.post("/auth/reauth", async (req, res) => {
    const body = z.object({
      adminUserId: z.string().min(1), pin: z.string(),
      action: z.enum(["discount", "priceOverride", "priceChange", "stockAdjustment", "blindReturn", "repaymentReversal", "noSaleDrawer", "creditLimitOverride", "unlock", "backupPassphrase", "backupRestore"]),
    }).parse(req.body);
    res.json(await reauth(live, limiter, { ...body, rateKey: req.ip ?? "unknown" }));
  });

  r.post("/auth/recover", async (req, res) => {
    const body = z.object({ userId: z.string().min(1), recoveryCode: z.string().min(4) }).parse(req.body);
    res.json(await recover(live, body));
  });

  return r;
}
