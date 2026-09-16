/**
 * A real app over a fresh database, with one user per role and the tax regime set.
 *
 * The app listens once, on its own ephemeral port, and every request goes to that server.
 * Supertest otherwise starts and tears down a server per request, and under a parallel run a
 * client could reach a server another test file had just been given the same port for — which
 * showed up as "socket hang up", "Expected HTTP/", a 404 on a route that exists, and writes that
 * landed in another test's database.
 */
import type { Server } from "node:http";
import request from "supertest";
import type { Role } from "@simon/shared";
import { createApp } from "../app.ts";
import type express from "express";
import { writeSettings } from "../services/settings.service.ts";
import { createOwner, createUser } from "../services/user.service.ts";
import { createTestDb, type TestDb } from "./db.ts";

export const PINS = { ADMIN: "1111", STOCK: "2222", WORKER: "3333" } as const;

export interface TestApp extends TestDb {
  app: express.Express;
  /** The listening server every request in a test goes through. */
  server: Server;
  users: Record<Role, { id: string; name: string }>;
  tokens: Record<Role, string>;
  devices: Record<Role, string>;
  loginAs: (role: Role) => Promise<{ token: string; deviceId: string }>;
}

export async function createTestApp(opts: { extraRouters?: express.Router[]; configure?: (t: TestDb) => Promise<void> } = {}): Promise<TestApp> {
  const t = await createTestDb();
  const owner = await createOwner(t.db, { shopName: "Փորձնական խանութ", ownerName: "Արամ", pin: PINS.ADMIN });
  const stock = await createUser(t.db, owner.user.id, { name: "Լուսինե", pin: PINS.STOCK, role: "STOCK" });
  const worker = await createUser(t.db, owner.user.id, { name: "Գոռ", pin: PINS.WORKER, role: "WORKER" });
  await t.db.$transaction((tx) => writeSettings(tx, { "tax.regime": "VAT", "tax.priceBasis": "INCLUSIVE", "tax.rateBp": 2000 }, null));
  await opts.configure?.(t);
  const app = createApp({ live: t.db, practice: async () => t.db, extraRouters: opts.extraRouters });
  const server = app.listen(0);
  const users = { ADMIN: owner.user, STOCK: { id: stock.id, name: stock.name }, WORKER: { id: worker.id, name: worker.name } };

  const loginAs = async (role: Role) => {
    const res = await request(server).post("/api/auth/login").send({ userId: users[role].id, pin: PINS[role], deviceLabel: `${role} till` });
    if (res.status !== 200) throw new Error(`login ${role} failed: ${res.status} ${JSON.stringify(res.body)}`);
    return { token: res.body.token as string, deviceId: res.body.device.id as string };
  };
  const tokens = {} as Record<Role, string>;
  const devices = {} as Record<Role, string>;
  for (const role of ["ADMIN", "STOCK", "WORKER"] as const) {
    const s = await loginAs(role);
    tokens[role] = s.token;
    devices[role] = s.deviceId;
  }
  const close = async () => { await new Promise<void>((resolve) => server.close(() => resolve())); await t.close(); };
  return { ...t, app, server, users, tokens, devices, loginAs, close };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
