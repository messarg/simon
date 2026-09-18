/**
 * §27.9 — an employee's session obtains no cost field from any API endpoint, and neither does a
 * manager's: cost is the owner's alone (§16.4, §16.5).
 *
 * Walks every GET route registered on the app (collected from the Express router stack, so
 * a new route joins the sweep without anyone remembering to add it) and asserts no key in
 * COST_KEYS appears anywhere in the body. Each phase re-runs it with its routes mounted.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { COST_KEYS } from "../lib/shape.ts";
import { OWNER_REPORTS, REPORT_NAMES } from "../services/report.service.ts";
import { bearer, createTestApp, type Persona, type TestApp } from "../test/app.ts";
import { makeCustomer, makeProduct, openShift, post, saleBody } from "../test/fixtures.ts";

function collectGetPaths(app: TestApp["app"]): string[] {
  const out = new Set<string>();
  const walk = (stack: any[], prefix: string) => {
    for (const layer of stack) {
      if (layer.route?.methods?.get) out.add(prefix + layer.route.path);
      else if (layer.handle?.stack) walk(layer.handle.stack, layer.name === "router" && layer.matchers ? prefix : prefix);
    }
  };
  walk((app as any).router.stack, "");
  return [...out];
}

function findCostKeys(v: unknown, path = "$"): string[] {
  if (Array.isArray(v)) return v.flatMap((x, i) => findCostKeys(x, `${path}[${i}]`));
  if (v && typeof v === "object") {
    return Object.entries(v).flatMap(([k, x]) => [...((COST_KEYS as readonly string[]).includes(k) ? [`${path}.${k}`] : []), ...findCostKeys(x, `${path}.${k}`)]);
  }
  return [];
}

export async function sweepForCost(t: TestApp, fill: (path: string) => string | null, persona: Persona = "WORKER") {
  const leaks: string[] = [];
  for (const raw of collectGetPaths(t.app)) {
    const path = fill(raw);
    if (!path) continue;
    const res = await request(t.server).get(`/api${path}`).set(bearer(t.tokens[persona]));
    leaks.push(...findCostKeys(res.body).map((k) => `${path} → ${k}`));
  }
  return leaks;
}

describe("§27.9 cost sweep", () => {
  let t: TestApp;
  let ids: Record<string, string>;
  beforeAll(async () => {
    t = await createTestApp();
    const p = await makeProduct(t, { name: "Մալուխ", priceDram: 1200, stock: 10_000, costMdram: 800_000, barcode: "123" });
    const shiftId = await openShift(t, "WORKER");
    const sale = saleBody({ shiftId, lines: [{ product: p, qty: 1000 }] });
    await post(t, "/sales", sale);
    const customer = await makeCustomer(t, "Սմբատ");
    ids = { product: p.id, sale: sale.id, shift: shiftId, code: "123", number: sale.number!, customer: customer.id };
  });
  afterAll(async () => { await t.close(); });

  it("finds the routes and no cost field reaches a WORKER", async () => {
    expect(collectGetPaths(t.app).length).toBeGreaterThan(5);
    const fill = (p: string) => {
      if (p.startsWith("/products/:id") || p === "/products") return p.replace(":id", ids.product);
      if (p.startsWith("/sales/:id")) return p.replace(":id", ids.sale);
      if (p.startsWith("/shifts/:id")) return p.replace(":id", ids.shift);
      if (p.startsWith("/customers/:id")) return p.replace(":id", ids.customer);
      if (p.includes(":code")) return p.replace(":code", ids.code);
      if (p.includes(":number")) return p.replace(":number", ids.number);
      return p.replace(/:id/g, t.users.WORKER.id);
    };
    expect(await sweepForCost(t, fill)).toEqual([]);
    // The same routes do carry cost for the owner, so the sweep is not vacuous.
    const admin = await request(t.server).get(`/api/products/${ids.product}`).set(bearer(t.tokens.OWNER));
    expect(admin.body.avgCostMdram).toBe(800_000);
  });

  it("no cost field reaches a manager either — from any route, any report they may read, or home", async () => {
    const fill = (p: string) => {
      if (p.startsWith("/products/:id") || p === "/products") return p.replace(":id", ids.product);
      if (p.startsWith("/sales/:id")) return p.replace(":id", ids.sale);
      if (p.startsWith("/shifts/:id")) return p.replace(":id", ids.shift);
      if (p.startsWith("/customers/:id")) return p.replace(":id", ids.customer);
      if (p.includes(":code")) return p.replace(":code", ids.code);
      if (p.includes(":number")) return p.replace(":number", ids.number);
      return p.replace(/:id/g, t.users.WORKER.id);
    };
    expect(await sweepForCost(t, fill, "MANAGER")).toEqual([]);

    const leaks: string[] = [];
    for (const name of REPORT_NAMES.filter((n) => !(OWNER_REPORTS as readonly string[]).includes(n))) {
      const query = name === "item-history" ? `?productId=${ids.product}` : "";
      const res = await request(t.server).get(`/api/reports/${name}${query}`).set(bearer(t.tokens.MANAGER));
      expect([name, res.status]).toEqual([name, 200]);
      leaks.push(...findCostKeys(res.body).map((k) => `${name} → ${k}`));
    }
    expect(leaks).toEqual([]);
    for (const name of OWNER_REPORTS) {
      expect((await request(t.server).get(`/api/reports/${name}`).set(bearer(t.tokens.MANAGER))).status).toBe(403);
    }
    // Home is the owner's home without profit — the margin figure is cost by another name.
    const home = await request(t.server).get("/api/home").set(bearer(t.tokens.MANAGER));
    expect(home.status).toBe(200);
    expect(home.body.today).not.toHaveProperty("profit");
    expect(home.body).not.toHaveProperty("alerts");
    expect((await request(t.server).get("/api/home").set(bearer(t.tokens.OWNER))).body.today).toHaveProperty("profit");
  });
});
