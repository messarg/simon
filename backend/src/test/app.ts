/**
 * A real app over a fresh database, with one person per persona and the tax regime set.
 *
 * A persona is not a role (§16.4): `STOCK` and `WORKER` are both employees, carrying the two
 * permission presets the old roles of those names became — so a suite written against the old
 * roles still asks the same question of the same person.
 *
 * The app listens once, on its own ephemeral port, and every request goes to that server.
 * Supertest otherwise starts and tears down a server per request, and under a parallel run a
 * client could reach a server another test file had just been given the same port for — which
 * showed up as "socket hang up", "Expected HTTP/", a 404 on a route that exists, and writes that
 * landed in another test's database.
 */
import type { Server } from "node:http";
import request from "supertest";
import { PERMISSION_PRESETS } from "@simon/shared";
import { createApp } from "../app.ts";
import type express from "express";
import { writeSettings } from "../services/settings.service.ts";
import { createOwner, createUser } from "../services/user.service.ts";
import { createTestDb, type TestDb } from "./db.ts";

export const PINS = { OWNER: "1111", STOCK: "2222", WORKER: "3333", MANAGER: "4444" } as const;
export type Persona = keyof typeof PINS;
export const PERSONAS = Object.keys(PINS) as Persona[];

export interface TestApp extends TestDb {
  app: express.Express;
  /** The listening server every request in a test goes through. */
  server: Server;
  users: Record<Persona, { id: string; name: string }>;
  tokens: Record<Persona, string>;
  devices: Record<Persona, string>;
  loginAs: (persona: Persona) => Promise<{ token: string; deviceId: string }>;
}

export async function createTestApp(opts: { extraRouters?: express.Router[]; configure?: (t: TestDb) => Promise<void>; practice?: () => Promise<TestDb["db"]> } = {}): Promise<TestApp> {
  const t = await createTestDb();
  const owner = await createOwner(t.db, { shopName: "Փորձնական խանութ", ownerName: "Արամ", pin: PINS.OWNER });
  const by = { id: owner.user.id, role: "OWNER" as const };
  const stock = await createUser(t.db, by, { name: "Լուսինե", pin: PINS.STOCK, role: "EMPLOYEE", permissions: [...PERMISSION_PRESETS.stock] });
  const worker = await createUser(t.db, by, { name: "Գոռ", pin: PINS.WORKER, role: "EMPLOYEE", permissions: [...PERMISSION_PRESETS.cashier] });
  const manager = await createUser(t.db, by, { name: "Անի", pin: PINS.MANAGER, role: "MANAGER" });
  await t.db.$transaction((tx) => writeSettings(tx, { "tax.regime": "VAT", "tax.priceBasis": "INCLUSIVE", "tax.rateBp": 2000 }, null));
  await opts.configure?.(t);
  // Most suites never leave LIVE, so practice points back at the same database unless a test asks for the real thing.
  const app = createApp({ live: t.db, practice: opts.practice ?? (async () => t.db), extraRouters: opts.extraRouters });
  const server = app.listen(0);
  // Node's client agent keeps a socket alive for 5 s and the server closes idle sockets after 5 s:
  // when both fire at once the client loses a socket it was about to reuse ("socket hang up").
  // The server must outlive the client's idle window.
  server.keepAliveTimeout = 120_000;
  server.headersTimeout = 125_000;
  const users: Record<Persona, { id: string; name: string }> = {
    OWNER: owner.user, STOCK: { id: stock.id, name: stock.name }, WORKER: { id: worker.id, name: worker.name }, MANAGER: { id: manager.id, name: manager.name },
  };

  const loginAs = async (persona: Persona) => {
    const res = await request(server).post("/api/auth/login").send({ name: users[persona].name, pin: PINS[persona], deviceLabel: `${persona} till` });
    if (res.status !== 200) throw new Error(`login ${persona} failed: ${res.status} ${JSON.stringify(res.body)}`);
    return { token: res.body.token as string, deviceId: res.body.device.id as string };
  };
  const tokens = {} as Record<Persona, string>;
  const devices = {} as Record<Persona, string>;
  for (const persona of PERSONAS) {
    const s = await loginAs(persona);
    tokens[persona] = s.token;
    devices[persona] = s.deviceId;
  }
  const close = async () => { await new Promise<void>((resolve) => server.close(() => resolve())); await t.close(); };
  return { ...t, app, server, users, tokens, devices, loginAs, close };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
