import path from "node:path";
import { defineConfig } from "prisma/config";

// The CLI reads the database URL from here (Prisma 7); at runtime the client is built with a
// driver adapter in src/lib/db.ts. The path is absolute because a relative `file:` URL
// resolves against whichever directory the CLI decides is its base.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? `file:${path.resolve(import.meta.dirname, "var/data/simon.db")}` },
});
