/** Session-bound account routes, and the ADMIN block of §15.4. */
import { Router } from "express";
import { z } from "zod";
import { Role } from "@simon/shared";
import { auth, requireRole } from "../middleware/auth.ts";
import { problem } from "../lib/problem.ts";
import { shapeDevice, shapeSession, shapeUser } from "../lib/shape.ts";
import { clock } from "../lib/time.ts";
import { enterPractice, exitPractice } from "../services/practice.service.ts";
import { deactivateDevice, logout, revokeSession, unlockUser } from "../services/auth.service.ts";
import { clientSettings, readSettings, writeSettings } from "../services/settings.service.ts";
import { createUser, listUsers, updateUser } from "../services/user.service.ts";

const safeList = (json: string): string[] => {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export function accountRoutes() {
  const r = Router();

  r.get("/auth/me", async (req, res) => {
    const a = auth(req);
    const [device, user] = await Promise.all([
      a.live.device.findUniqueOrThrow({ where: { id: a.deviceId } }),
      a.live.user.findUniqueOrThrow({ where: { id: a.userId }, select: { coachMarksSeen: true } }),
    ]);
    res.json({
      user: { id: a.userId, name: a.userName, role: a.role, coachMarksSeen: safeList(user.coachMarksSeen) },
      session: { id: a.sessionId, mode: a.mode, shiftId: a.shiftId }, device: shapeDevice(device),
    });
  });

  // First-run coach marks, once per screen per person, never again (§7.5).
  r.post("/me/coach-marks", async (req, res) => {
    const a = auth(req);
    const { screen } = z.object({ screen: z.string().max(40) }).parse(req.body);
    const user = await a.live.user.findUniqueOrThrow({ where: { id: a.userId }, select: { coachMarksSeen: true } });
    const seen = new Set(safeList(user.coachMarksSeen));
    seen.add(screen);
    await a.live.user.update({ where: { id: a.userId }, data: { coachMarksSeen: JSON.stringify([...seen]) } });
    res.json({ coachMarksSeen: [...seen] });
  });

  r.post("/auth/logout", async (req, res) => {
    await logout(auth(req).live, auth(req).sessionId);
    res.status(204).end();
  });

  // Any session: the explicit enforce-or-render shape (§15.4, §16.5).
  r.get("/settings/client", async (req, res) => { res.json(await clientSettings(auth(req).db)); });

  // Practice mode is entered and left per session; the file is the isolation (§7.2, §19.4).
  r.post("/session/mode", async (req, res) => {
    const a = auth(req);
    const { mode } = z.object({ mode: z.enum(["LIVE", "PRACTICE"]) }).parse(req.body);
    const actor = { userId: a.userId, sessionId: a.sessionId };
    res.json(mode === "PRACTICE" ? await enterPractice(a.live, actor) : await exitPractice(a.live, actor));
  });

  // Client-reported queue depths, on a one-minute heartbeat (§16.3). Bounded on write (§11).
  r.post("/devices/heartbeat", async (req, res) => {
    const a = auth(req);
    const body = z.object({
      outboxDepth: z.number().int().min(0).max(100_000), parkedDepth: z.number().int().min(0).max(100_000),
      outboxOldestAt: z.string().datetime().nullable(), lastSequence: z.number().int().min(0),
    }).parse(req.body);
    const device = await a.live.device.findUniqueOrThrow({ where: { id: a.deviceId } });
    await a.live.device.update({
      where: { id: a.deviceId },
      data: { ...body, lastSequence: Math.max(device.lastSequence, body.lastSequence), lastSeenAt: clock.iso() },
    });
    res.status(204).end();
  });

  return r;
}

export function adminRoutes() {
  const r = Router();
  r.use(requireRole("ADMIN"));

  r.get("/settings", async (req, res) => { res.json(await readSettings(auth(req).db)); });
  r.patch("/settings", async (req, res) => {
    const a = auth(req);
    const patch = z.record(z.string(), z.unknown()).parse(req.body);
    res.json(await a.db.$transaction((tx) => writeSettings(tx, patch, a.userId)));
  });

  r.get("/users", async (req, res) => { res.json({ items: (await listUsers(auth(req).live)).map(shapeUser) }); });
  r.post("/users", async (req, res) => {
    const body = z.object({ name: z.string().trim().min(1).max(60), pin: z.string(), role: Role }).parse(req.body);
    res.status(201).json(shapeUser(await createUser(auth(req).live, auth(req).userId, body)));
  });
  r.patch("/users/:id", async (req, res) => {
    const body = z.object({ name: z.string().trim().min(1).max(60).optional(), pin: z.string().optional(), role: Role.optional(), isActive: z.boolean().optional() }).parse(req.body);
    res.json(shapeUser(await updateUser(auth(req).live, auth(req).userId, req.params.id, body)));
  });

  r.post("/auth/unlock", async (req, res) => {
    const { userId } = z.object({ userId: z.string().min(1) }).parse(req.body);
    await unlockUser(auth(req).live, auth(req).userId, userId);
    res.status(204).end();
  });

  r.get("/sessions", async (req, res) => {
    const rows = await auth(req).live.session.findMany({ where: { revokedAt: null, expiresAt: { gt: clock.iso() } }, include: { user: true, device: true }, orderBy: { createdAt: "desc" } });
    res.json({ items: rows.map(shapeSession) });
  });
  r.post("/sessions/:id/revoke", async (req, res) => {
    await revokeSession(auth(req).live, auth(req).userId, req.params.id);
    res.status(204).end();
  });

  r.get("/devices", async (req, res) => { res.json({ items: (await auth(req).live.device.findMany({ orderBy: { registeredAt: "asc" } })).map(shapeDevice) }); });
  r.patch("/devices/:id", async (req, res) => {
    const body = z.object({ label: z.string().trim().min(1).max(40).optional(), isActive: z.literal(false).optional() }).parse(req.body);
    const a = auth(req);
    if (body.isActive === false) await deactivateDevice(a.live, a.userId, req.params.id);
    if (body.label) {
      const d = await a.live.device.findUnique({ where: { id: req.params.id } });
      if (!d) throw problem("not-found");
      await a.live.device.update({ where: { id: d.id }, data: { label: body.label } });
    }
    res.json(shapeDevice(await a.live.device.findUniqueOrThrow({ where: { id: req.params.id } })));
  });

  return r;
}
