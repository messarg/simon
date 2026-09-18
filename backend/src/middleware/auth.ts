/**
 * Route-level authorization, default deny. PRD §16.4, §15.2.
 *
 * `requireSession` resolves the bearer token to a session and picks the database for its
 * mode; one of the three gates below then decides. A route with none is reachable by anyone on
 * the shop Wi-Fi, so only /health, sign-in and first-run setup are mounted without them.
 *
 * The gates are not a ladder. `OWNER` and `MANAGER` are tiers, but an employee's reach is a set
 * of granted jobs, and "can receive goods but not sell" is not a rung on anything — so a route
 * names the job (`requirePermission`) or the tier (`requireManager`, `requireOwner`), and an
 * owner or manager passes every job gate.
 */
import type { RequestHandler } from "express";
import { can, isManager, isOwner, parsePermissions, type Permission, type Role } from "@simon/shared";
import type { AuthContext } from "../lib/auth-context.ts";
import type { Db } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { resolveSession } from "../services/auth.service.ts";

export function requireSession(live: Db, practice: () => Promise<Db>): RequestHandler {
  return async (req, _res, next) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return next(problem("session-expired"));
    const s = await resolveSession(live, token);
    if (!s) return next(problem("session-expired"));
    const mode = s.mode as AuthContext["mode"];
    req.auth = {
      sessionId: s.id, userId: s.userId, userName: s.user.name, role: s.user.role as Role, permissions: parsePermissions(s.user.permissions),
      deviceId: s.deviceId, mode, shiftId: s.shiftId, live, db: mode === "PRACTICE" ? await practice() : live,
    };
    next();
  };
}

function gate(allowed: (a: { role: Role; permissions: Permission[] }) => boolean, required: Role | Permission): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(problem("session-expired"));
    if (!allowed(req.auth)) return next(problem("not-permitted", { required }));
    next();
  };
}

/** What is the owner's alone: cost, backups, settings, the audit trail (§16.4). */
export const requireOwner = (): RequestHandler => gate((a) => isOwner(a.role), "OWNER");

/** Running the shop and its people: the owner or a manager. */
export const requireManager = (): RequestHandler => gate((a) => isManager(a.role), "MANAGER");

/** One job. An employee needs it granted; an owner or manager always has it. */
export const requirePermission = (p: Permission): RequestHandler => gate((a) => can(a, p), p);

/** Any one of several jobs — a shift, say, is where both a sale and a refund happen. */
export const requireAnyPermission = (...ps: Permission[]): RequestHandler => gate((a) => ps.some((p) => can(a, p)), ps[0]!);

export function auth(req: Express.Request): AuthContext {
  if (!req.auth) throw problem("session-expired");
  return req.auth;
}
