import { defineConfig } from "vitest/config";

// One runner for every workspace. Vitest owns src/**; Playwright (later) owns tests/**.
export default defineConfig({
  test: {
    include: ["{packages,backend,frontend}/**/src/**/*.test.{ts,tsx}"],
    // Shift and report boundaries are shop-local time (PRD §19.3). Pin it so a
    // machine in another timezone cannot produce different results.
    env: { TZ: "Asia/Yerevan" },
  },
});
