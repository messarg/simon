/** The staff row as `GET /users` returns it (§6.11.1). There is no delete — rule 4. */
import type { Permission, Role } from "@simon/shared";

export interface StaffUser {
  id: string;
  name: string;
  role: Role;
  /** An employee's granted jobs; empty for an owner or manager, who can do every job (§16.4). */
  permissions: Permission[];
  isActive: boolean;
  lockedUntil: string | null;
  createdAt?: string;
  /** When the photograph was last written; null when there is none. */
  avatarUpdatedAt?: string | null;
  /**
   * The personal details: the owner reads everyone's, a manager an employee's; any other row comes
   * back with these null (§16.5, §19.6). Nothing before sign-in carries them — there is no list.
   */
  phone?: string | null;
  /** A business date, `YYYY-MM-DD`. */
  startedOn?: string | null;
  note?: string | null;
}

export const staffKey = ["users"] as const;

/** Locked out right now — `lockedUntil` is a moment in the future, not a flag (§16.2). */
export const isLockedOut = (u: StaffUser, now: number) => u.lockedUntil !== null && Date.parse(u.lockedUntil) > now;
