/**
 * The Express application, separate from `index.ts` so Supertest drives the real thing.
 * PRD §15. Every route is mounted under /api and every error leaves through one handler.
 */
import path from "node:path";
import express from "express";
import type { Db } from "./lib/db.ts";
import { logger } from "./lib/logger.ts";
import { errorHandler, problem } from "./lib/problem.ts";
import { requireSession } from "./middleware/auth.ts";
import { accountRoutes, adminRoutes } from "./routes/admin.routes.ts";
import { catalogueRoutes } from "./routes/catalogue.routes.ts";
import { controlRoutes } from "./routes/control.routes.ts";
import { extendRoutes } from "./routes/extend.routes.ts";
import { buyRoutes } from "./routes/buy.routes.ts";
import { debtRoutes } from "./routes/debt.routes.ts";
import { sellRoutes } from "./routes/sell.routes.ts";
import { systemRoutes } from "./routes/system.routes.ts";

export interface AppDeps {
  live: Db;
  practice: () => Promise<Db>;
  /** Phase routers, mounted behind the session gate. */
  extraRouters?: express.Router[];
  /**
   * The built SPA, served from the same origin. On a shop install Nginx does this (§22); the
   * desktop app has no Nginx, so the API serves it itself.
   */
  staticDir?: string;
}

export function createApp(deps: AppDeps) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");
  // 2 MB is a generous sale and a small spreadsheet; an import file is the reason for the rest (§19.1).
  app.use(express.json({ limit: "6mb" }));

  app.use((req, res, next) => {
    const start = performance.now();
    res.on("finish", () => {
      logger.info({ method: req.method, path: req.path, status: res.statusCode, ms: Math.round(performance.now() - start), userId: req.auth?.userId }, "request");
    });
    next();
  });

  const api = express.Router();
  api.use(systemRoutes(deps.live));
  api.use(requireSession(deps.live, deps.practice));
  api.use(accountRoutes());
  api.use(catalogueRoutes());
  api.use(sellRoutes());
  api.use(debtRoutes());
  api.use(buyRoutes());
  api.use(controlRoutes());
  api.use(extendRoutes());
  for (const router of deps.extraRouters ?? []) api.use(router);
  api.use(adminRoutes());
  api.use((_req, _res, next) => next(problem("not-found")));

  app.use("/api", api);

  if (deps.staticDir) {
    const dir = deps.staticDir;
    // The shell and the service worker must never be served stale, or the app keeps opening
    // yesterday's version; hashed assets can be cached for good.
    app.use(express.static(dir, {
      index: false,
      setHeaders: (res, file) => {
        if (/(index\.html|sw\.js|manifest\.webmanifest)$/.test(file)) res.setHeader("Cache-Control", "no-cache");
        else if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    }));
    // Every other path is a client-side route.
    app.get("/{*route}", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(dir, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
