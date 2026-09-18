/**
 * Who may do what (PRD §16.4). Both sides import this: the server enforces it, the client uses
 * it only to leave out what a person cannot do — never as the control (§16.5).
 *
 * - `OWNER` does everything, and is the only one who sees what is the owner's: cost, margin and
 *   profit, backups, diagnostics, shop settings, the audit trail, and their own personal record.
 * - `MANAGER` runs the shop — every operation, every employee — without any of that.
 * - `EMPLOYEE` holds a set of permissions granted by the owner or a manager, and nothing else.
 */
import { z } from "zod";
import type { Role } from "./enums.ts";

/** Each is a job a person does at the counter or in the stockroom. Order is display order. */
export const Permission = z.enum(["sell", "returns", "debt", "receive", "stocktake", "writeoff", "labels"]);
export type Permission = z.infer<typeof Permission>;

/**
 * The two roles an employee used to have, kept as starting points: a new person is usually one or
 * the other, and the owner adjusts from there. They are also what the role migration mapped to.
 */
export const PERMISSION_PRESETS = {
  cashier: ["sell", "returns", "debt"],
  stock: ["sell", "returns", "debt", "receive", "stocktake", "writeoff", "labels"],
} as const satisfies Record<string, readonly Permission[]>;

export interface Actor { role: Role; permissions: readonly Permission[] }

/** Cost, margin, profit, backups, settings, the audit trail: the owner's alone. */
export const isOwner = (role: Role) => role === "OWNER";

/** Runs the shop and its people: the owner, or a manager. */
export const isManager = (role: Role) => role === "OWNER" || role === "MANAGER";

/** An owner or manager can do every job; an employee only the ones granted. */
export function can(actor: Actor, permission: Permission): boolean {
  return isManager(actor.role) || actor.permissions.includes(permission);
}

/** Stored as a JSON array on `User.permissions`. Unknown entries are dropped, not trusted. */
export function parsePermissions(raw: string | null | undefined): Permission[] {
  let list: unknown;
  try { list = JSON.parse(raw ?? "[]"); } catch { return []; }
  if (!Array.isArray(list)) return [];
  return normalisePermissions(list.filter((p): p is Permission => Permission.safeParse(p).success));
}

/** Deduplicated, in display order — so the stored value and the audit diff are stable. */
export function normalisePermissions(list: readonly Permission[]): Permission[] {
  return Permission.options.filter((p) => list.includes(p));
}

/**
 * The reports that exist to show cost, or whole-record snapshots — the owner's alone. A manager
 * reads every other report, with cost swept out of each row on the way (§16.5, §20.2).
 */
export const OWNER_REPORTS = ["margin", "valuation", "audit"] as const;
