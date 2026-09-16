import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Nothing a test writes belongs in the working tree: the shop's data directory, its backups and the
// host key file all move to a scratch path (§19.2, §19.4).
const scratch = path.join(tmpdir(), "simon-vitest");

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
      SIMON_DATA_DIR: path.join(scratch, "data"),
      SIMON_KEY_DIR: path.join(scratch, "keys"),
      SIMON_BACKUP_DIR: path.join(scratch, "backups"),
    },
    // Service and route tests each open a SQLite file; keep them off one another's writer.
    fileParallelism: true,
    testTimeout: 20_000,
    // Setup hooks hash PINs with argon2 and open SQLite files; under a full parallel run that alone can pass 10 s.
    hookTimeout: 30_000,
  },
});
