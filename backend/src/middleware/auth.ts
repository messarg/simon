/**
 * Route-level authorization, default deny. PRD §16.4, §15.2.
 *
 * `requireSession` resolves the bearer token to a session and picks the database for its
 * mode; `requireRole` then gates by role. A route with neither is reachable by anyone on
 * the shop Wi-Fi, so only /health, sign-in and first-run setup are mounted without them.
 */
import type { RequestHandler } from "express";
import type { Role } from "@simon/shared";
import type { AuthContext } from "../lib/auth-context.ts";
import type { Db } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { resolveSession } from "../services/auth.service.ts";

const RANK: Record<Role, number> = { WORKER: 0, STOCK: 1, ADMIN: 2 };

export function requireSession(live: Db, practice: () => Promise<Db>): RequestHandler {
  return async (req, _res, next) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return next(problem("session-expired"));
    const s = await resolveSession(live, token);
    if (!s) return next(problem("session-expired"));
    const mode = s.mode as AuthContext["mode"];
    req.auth = {
      sessionId: s.id, userId: s.userId, userName: s.user.name, role: s.user.role as Role,
      deviceId: s.deviceId, mode, shiftId: s.shiftId, live, db: mode === "PRACTICE" ? await practice() : live,
    };
    next();
  };
}

/** Allows `role` and every role above it: STOCK is a worker plus, ADMIN is everything. */
export function requireRole(role: Role): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(problem("session-expired"));
    if (RANK[req.auth.role] < RANK[role]) return next(problem("not-permitted", { requiredRole: role }));
    next();
  };
}

export function auth(req: Express.Request): AuthContext {
  if (!req.auth) throw problem("session-expired");
  return req.auth;
}
