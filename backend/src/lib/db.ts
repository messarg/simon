/**
 * Database clients. PRD §11, §13.1, §19.4.
 *
 * Two files: the live database and the practice database. A PRACTICE session is routed to
 * the second and cannot write to the first (§27.19). Every connection gets WAL,
 * busy_timeout, foreign_keys and synchronous=NORMAL — foreign_keys is per connection and
 * off by default in SQLite, so it is set here rather than assumed.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client.ts";
import { databaseFile } from "./config.ts";

export type Db = PrismaClient;
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
export type Mode = "LIVE" | "PRACTICE";

const PRAGMAS = ["journal_mode = WAL", "busy_timeout = 5000", "foreign_keys = ON", "synchronous = NORMAL"];

export async function openDatabase(file: string): Promise<PrismaClient> {
  mkdirSync(path.dirname(file), { recursive: true });
  const client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}`, timeout: 5000 }) });
  for (const p of PRAGMAS) await client.$queryRawUnsafe(`PRAGMA ${p}`);
  return client;
}

const clients = new Map<Mode, PrismaClient>();

export function registerClient(mode: Mode, client: PrismaClient) {
  clients.set(mode, client);
}

export async function dbFor(mode: Mode): Promise<PrismaClient> {
  let c = clients.get(mode);
  if (!c) {
    c = await openDatabase(databaseFile(mode));
    clients.set(mode, c);
  }
  return c;
}

/** Closes one mode's client and forgets it, so the file underneath can be replaced (§19.4). */
export async function closeClient(mode: Mode) {
  const client = clients.get(mode);
  if (!client) return;
  clients.delete(mode);
  await client.$disconnect();
}

export async function closeAll() {
  await Promise.all([...clients.values()].map((c) => c.$disconnect()));
  clients.clear();
}
