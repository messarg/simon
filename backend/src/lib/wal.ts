/**
 * WAL checkpointing, so §19.5's diagnostics can report how long the write-ahead log has gone
 * without one. A WAL that never checkpoints grows until the disk does, on a machine nobody watches.
 */
import type { Db } from "./db.ts";
import { clock } from "./time.ts";

let lastAt: string | null = null;

export async function checkpoint(db: Db) {
  await db.$queryRawUnsafe("PRAGMA wal_checkpoint(PASSIVE)");
  lastAt = clock.iso();
  return lastAt;
}

export const lastCheckpointAt = () => lastAt;
