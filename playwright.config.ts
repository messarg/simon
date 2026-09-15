/**
 * Playwright owns tests/** (Vitest owns src/**). The journeys run against a real API and the
 * real SPA, each started here on its own ports with a throwaway, freshly seeded data directory.
 */
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const DATA = path.resolve(import.meta.dirname, ".e2e-data");
const API_PORT = 5065;
const WEB_PORT = 5175;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 8_000 },
  use: { baseURL: `http://localhost:${WEB_PORT}`, ...devices["Pixel 7"], locale: "hy-AM", timezoneId: "Asia/Yerevan", trace: "retain-on-failure" },
  webServer: [
    {
      command: `rm -rf ${DATA} && node --experimental-strip-types backend/prisma/seed.ts && node --experimental-strip-types backend/src/index.ts`,
      url: `http://localhost:${API_PORT}/api/health`,
      env: { SIMON_DATA_DIR: DATA, SIMON_PRINT_DIR: path.join(DATA, "prints"), PORT: String(API_PORT), LOG_LEVEL: "warn" },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      cwd: "frontend",
      url: `http://localhost:${WEB_PORT}`,
      env: { SIMON_API_URL: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
