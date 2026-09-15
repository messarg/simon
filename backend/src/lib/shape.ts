/**
 * Response shaping — the single place field-level authorization happens. PRD §16.5,
 * §15.1, §23.1 item 2.
 *
 * Every route returns data through a function in this file, never a raw ORM object. Cost,
 * margin and supplier terms appear only for ADMIN. A route test sweeps every endpoint with
 * a WORKER token and asserts none of COST_KEYS ever appears (§27.9).
 */
import type { Role } from "@simon/shared";

/** Keys a non-admin token must never receive, anywhere in a response body. */
export const COST_KEYS = ["avgCostMdram", "unitCostMdram", "marginDram", "cogs", "paymentTerms", "landedUnitCostMdram", "costDram"] as const;

export const isAdmin = (role: Role) => role === "ADMIN";

export const bool = (v: number) => v === 1;

export function shapeUser(u: { id: string; name: string; role: string; isActive: number; failedAttempts: number; lockedUntil: string | null; createdAt: string }) {
  return { id: u.id, name: u.name, role: u.role, isActive: bool(u.isActive), lockedUntil: u.lockedUntil, createdAt: u.createdAt };
}

export function shapeSession(s: { id: string; userId: string; deviceId: string; mode: string; shiftId: string | null; createdAt: string; lastSeenAt: string; expiresAt: string; revokedAt: string | null; user?: { name: string }; device?: { label: string; prefix: string } }) {
  return {
    id: s.id, userId: s.userId, userName: s.user?.name ?? null, deviceId: s.deviceId,
    deviceLabel: s.device?.label ?? null, devicePrefix: s.device?.prefix ?? null,
    mode: s.mode, shiftId: s.shiftId, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, expiresAt: s.expiresAt, revokedAt: s.revokedAt,
  };
}

export function shapeDevice(d: { id: string; prefix: string; label: string; registeredAt: string; lastSequence: number; outboxDepth: number; outboxOldestAt: string | null; parkedDepth: number; lastSeenAt: string | null; isActive: number }) {
  return { ...d, isActive: bool(d.isActive) };
}

/** Recursively removes cost keys — a backstop for composite report rows, not a substitute for shaping. */
export function stripCost<T>(value: T, role: Role): T {
  if (isAdmin(role)) return value;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).filter(([k]) => !(COST_KEYS as readonly string[]).includes(k)).map(([k, x]) => [k, walk(x)]));
    }
    return v;
  };
  return walk(value) as T;
}
