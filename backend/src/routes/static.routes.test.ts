/** The desktop app has no Nginx, so the API serves the SPA itself — without swallowing the API. */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.ts";
import { createTestDb, type TestDb } from "../test/db.ts";

describe("serving the SPA from the API", () => {
  let t: TestDb;
  let dir = "";
  let server: ReturnType<ReturnType<typeof createApp>["listen"]>;

  beforeAll(async () => {
    t = await createTestDb();
    dir = mkdtempSync(path.join(tmpdir(), "simon-spa-"));
    mkdirSync(path.join(dir, "assets"));
    writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>Սիմոն</title>");
    writeFileSync(path.join(dir, "assets", "app-abc123.js"), "console.log(1)");
    server = createApp({ live: t.db, practice: async () => t.db, staticDir: dir }).listen(0);
  });
  afterAll(async () => {
    server.close();
    rmSync(dir, { recursive: true, force: true });
    await t.close();
  });

  it("answers a client-side route with the shell, never cached", async () => {
    const res = await request(server).get("/sell");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Սիմոն");
    expect(res.headers["cache-control"]).toBe("no-cache");
  });

  it("caches hashed assets for good", async () => {
    const res = await request(server).get("/assets/app-abc123.js");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toContain("immutable");
  });

  it("leaves the API's own answers alone", async () => {
    expect((await request(server).get("/api/health")).body.status).toBe("ok");
    const missing = await request(server).get("/api/no-such-route");
    expect(missing.status).toBe(401); // behind the session gate, as it is without the SPA
    expect(missing.headers["content-type"]).toContain("problem+json");
  });
});
