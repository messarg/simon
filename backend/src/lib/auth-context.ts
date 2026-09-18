import type { Permission, Role, SessionMode } from "@simon/shared";
import type { Db } from "./db.ts";

/** What an authenticated request carries. `db` is the live or practice database (§19.4). */
export interface AuthContext {
  sessionId: string;
  userId: string;
  userName: string;
  role: Role;
  /** An employee's granted jobs; empty, and unused, for an owner or manager (§16.4). */
  permissions: Permission[];
  deviceId: string;
  mode: SessionMode;
  shiftId: string | null;
  db: Db;
  /** Sessions, devices and users always live in the live database. */
  live: Db;
}
