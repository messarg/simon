/**
 * Who may manage whom (PRD §6.17, §16.4). Pure, so the whole table is testable without HTTP, and
 * shared, so the staff screen offers exactly what the server will accept — the server enforces it,
 * the screen only leaves out what would be refused.
 *
 * - The owner manages everyone, and no one — the owner included — can demote or deactivate the
 *   owner: there is exactly one, and a shop with none has nobody who can reach its settings,
 *   its backups or its recovery code (§7.1, §16.2).
 * - A manager manages employees. Another manager is not theirs to manage, and the owner is not
 *   even theirs to look at: the owner's record is owner data.
 * - A manager may keep their own record — a new PIN, a corrected name — but not raise, lower or
 *   switch themselves off.
 * - An employee manages no one; the routes never let them this far.
 */
import type { Role } from "./enums.ts";

export type StaffAction = "view" | "edit" | "setRole" | "deactivate";

interface Person { id: string; role: Role }

export function canManage(actor: Person, target: Person, action: StaffAction): boolean {
  if (actor.role === "OWNER") return target.role !== "OWNER" || action === "view" || action === "edit";
  if (actor.role !== "MANAGER") return false;
  if (target.role === "EMPLOYEE") return true;
  return target.id === actor.id && (action === "view" || action === "edit");
}

/** The roles a person may hand out. `OWNER` is never handed out: it is created at setup. */
export function assignableRoles(actor: Role): readonly Role[] {
  if (actor === "OWNER") return ["MANAGER", "EMPLOYEE"];
  if (actor === "MANAGER") return ["EMPLOYEE"];
  return [];
}

/** Whether `viewer` sees `target` in the staff list at all. A manager is not shown the owner. */
export function listsPerson(viewer: Role, target: Role): boolean {
  return viewer === "OWNER" || target !== "OWNER";
}
