/** Runtime configuration, read once from the environment. */
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

export const config = {
  port: Number(process.env.PORT ?? 5000),
  host: process.env.HOST ?? "0.0.0.0",
  dataDir: process.env.SIMON_DATA_DIR ?? path.join(root, "var/data"),
  printDir: process.env.SIMON_PRINT_DIR ?? path.join(root, "var/prints"),
  printer: (process.env.SIMON_PRINTER ?? "console") as "console" | "escpos-tcp",
  printerHost: process.env.SIMON_PRINTER_HOST ?? "",
  printerPort: Number(process.env.SIMON_PRINTER_PORT ?? 9100),
  logLevel: process.env.LOG_LEVEL ?? "info",
  version: process.env.SIMON_VERSION ?? "0.1.0",
  /** Argon2id cost. §16.2 asks for ≥ 250 ms on the host; tests lower it. */
  argon2: {
    memoryCost: Number(process.env.SIMON_ARGON2_MEMORY ?? 65_536),
    timeCost: Number(process.env.SIMON_ARGON2_TIME ?? 3),
  },
  tillIdleMinutes: 15,
  ownerIdleMinutes: 8 * 60,
};

export const databaseFile = (mode: "LIVE" | "PRACTICE") =>
  path.join(config.dataDir, mode === "LIVE" ? "simon.db" : "simon-practice.db");
