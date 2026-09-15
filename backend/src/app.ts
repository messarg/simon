/**
 * The Express application, separate from `index.ts` so Supertest drives the real thing.
 * PRD §15. Every route is mounted under /api and every error leaves through one handler.
 */
import express from "express";
import type { Db } from "./lib/db.ts";
import { logger } from "./lib/logger.ts";
import { errorHandler, problem } from "./lib/problem.ts";
import { requireSession } from "./middleware/auth.ts";
import { accountRoutes, adminRoutes } from "./routes/admin.routes.ts";
import { catalogueRoutes } from "./routes/catalogue.routes.ts";
import { sellRoutes } from "./routes/sell.routes.ts";
import { systemRoutes } from "./routes/system.routes.ts";

export interface AppDeps {
  live: Db;
  practice: () => Promise<Db>;
  /** Phase routers, mounted behind the session gate. */
  extraRouters?: express.Router[];
}

export function createApp(deps: AppDeps) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");
  app.use(express.json({ limit: "2mb" }));

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
  for (const router of deps.extraRouters ?? []) api.use(router);
  api.use(adminRoutes());
  api.use((_req, _res, next) => next(problem("not-found")));

  app.use("/api", api);
  app.use(errorHandler);
  return app;
}
