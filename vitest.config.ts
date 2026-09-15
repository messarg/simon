import { defineConfig } from "vitest/config";

// One runner for every workspace. Vitest owns src/**; Playwright (later) owns tests/**.
export default defineConfig({
  test: {
    include: ["{packages,backend,frontend}/**/src/**/*.test.{ts,tsx}"],
    // Shift and report boundaries are shop-local time (PRD §19.3). Pin it so a
    // machine in another timezone cannot produce different results.
    env: {
      TZ: "Asia/Yerevan",
      NODE_ENV: "test",
      // Argon2id at test cost; production keeps §16.2's ≥ 250 ms.
      SIMON_ARGON2_MEMORY: "1024",
      SIMON_ARGON2_TIME: "1",
    },
    // Service and route tests each open a SQLite file; keep them off one another's writer.
    fileParallelism: true,
    testTimeout: 20_000,
  },
});
