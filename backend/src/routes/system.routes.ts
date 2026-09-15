/** Health, first-run setup and sign-in. The only routes reachable without a session. */
import { Router } from "express";
import { z } from "zod";
import type { Db } from "../lib/db.ts";
import { config } from "../lib/config.ts";
import { problem } from "../lib/problem.ts";
import { DeviceRateLimiter } from "../domain/pin-policy.ts";
import { login, recover, reauth } from "../services/auth.service.ts";
import { createOwner, listSignInUsers, needsSetup } from "../services/user.service.ts";

const pin = z.string().regex(/^\d{4,8}$/);

export function systemRoutes(live: Db) {
  const r = Router();
  const limiter = new DeviceRateLimiter();

  // Liveness only (§15.4): no session, nothing an unauthenticated probe should not know.
  r.get("/health", (_req, res) => { res.json({ status: "ok", version: config.version }); });

  r.get("/setup/status", async (_req, res) => { res.json({ needsOwner: await needsSetup(live) }); });

  r.post("/setup/owner", async (req, res) => {
    const body = z.object({ shopName: z.string().trim().min(1).max(120), ownerName: z.string().trim().min(1).max(60), pin }).parse(req.body);
    if (!(await needsSetup(live))) throw problem("not-permitted");
    res.status(201).json(await createOwner(live, body));
  });

  r.get("/auth/users", async (_req, res) => {
    if (await needsSetup(live)) throw problem("setup-required");
    res.json({ items: await listSignInUsers(live) });
  });

  r.post("/auth/login", async (req, res) => {
    const body = z.object({ userId: z.string().min(1), pin: z.string(), deviceId: z.string().nullish(), deviceLabel: z.string().max(40).optional() }).parse(req.body);
    res.json(await login(live, limiter, { ...body, rateKey: req.ip ?? "unknown" }));
  });

  r.post("/auth/reauth", async (req, res) => {
    const body = z.object({
      adminUserId: z.string().min(1), pin: z.string(),
      action: z.enum(["discount", "priceOverride", "priceChange", "stockAdjustment", "blindReturn", "repaymentReversal", "noSaleDrawer", "creditLimitOverride", "unlock", "backupPassphrase"]),
    }).parse(req.body);
    res.json(await reauth(live, limiter, { ...body, rateKey: req.ip ?? "unknown" }));
  });

  r.post("/auth/recover", async (req, res) => {
    const body = z.object({ userId: z.string().min(1), recoveryCode: z.string().min(4) }).parse(req.body);
    res.json(await recover(live, body));
  });

  return r;
}
