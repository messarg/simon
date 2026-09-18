/** The staff row as `GET /users` returns it (§6.11.1). There is no delete — rule 4. */
import type { Role } from "@simon/shared";

export interface StaffUser {
  id: string;
  name: string;
  role: Role;
  isActive: boolean;
  lockedUntil: string | null;
  createdAt?: string;
  /** When the photograph was last written; null when there is none. */
  avatarUpdatedAt?: string | null;
  /**
   * The personal details, `ADMIN`-only and served only to a signed-in admin: the sign-in tiles
   * come from `GET /auth/users`, which is unauthenticated and carries none of this (§26.2).
   */
  phone?: string | null;
  /** A business date, `YYYY-MM-DD`. */
  startedOn?: string | null;
  note?: string | null;
}

export const staffKey = ["users"] as const;

/** Locked out right now — `lockedUntil` is a moment in the future, not a flag (§16.2). */
export const isLockedOut = (u: StaffUser, now: number) => u.lockedUntil !== null && Date.parse(u.lockedUntil) > now;
