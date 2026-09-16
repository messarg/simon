/** Runtime configuration, read once from the environment. */
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const isTest = process.env.NODE_ENV === "test";

export const config = {
  port: Number(process.env.PORT ?? 5000),
  host: process.env.HOST ?? "0.0.0.0",
  dataDir: process.env.SIMON_DATA_DIR ?? path.join(root, "var/data"),
  printDir: process.env.SIMON_PRINT_DIR ?? path.join(root, "var/prints"),
  printer: (process.env.SIMON_PRINTER ?? "console") as "console" | "escpos-tcp",
  printerHost: process.env.SIMON_PRINTER_HOST ?? "",
  printerPort: Number(process.env.SIMON_PRINTER_PORT ?? 9100),
  /** Shelf labels (§18): `console` writes ZPL to the print directory; `zpl-tcp` sends it to a label printer. */
  labelPrinter: (process.env.SIMON_LABEL_PRINTER ?? "console") as "console" | "zpl-tcp",
  labelPrinterHost: process.env.SIMON_LABEL_PRINTER_HOST ?? "",
  labelPrinterPort: Number(process.env.SIMON_LABEL_PRINTER_PORT ?? 9100),
  /** Fiscal receipts (§17): `none` until a certified device and the legal answers exist; `file` for development. */
  fiscal: (process.env.SIMON_FISCAL ?? "none") as "none" | "file",
  logLevel: process.env.LOG_LEVEL ?? "info",
  /** Rotating log files (§19.5). Empty disables the file; tests never write one. */
  logDir: process.env.SIMON_LOG_DIR ?? (isTest ? "" : path.join(root, "var/logs")),
  version: process.env.SIMON_VERSION ?? "0.1.0",
  /** The built SPA, when the API serves it itself — the desktop app, which has no Nginx. */
  staticDir: process.env.SIMON_STATIC_DIR ?? "",
  /** Argon2id cost. §16.2 asks for ≥ 250 ms on the host; tests lower it. */
  argon2: {
    memoryCost: Number(process.env.SIMON_ARGON2_MEMORY ?? 65_536),
    timeCost: Number(process.env.SIMON_ARGON2_TIME ?? 3),
  },
  tillIdleMinutes: 15,
  ownerIdleMinutes: 8 * 60,
  backup: {
    /** Where the passphrase lives: on the host, outside the data directory and never in the database (§19.2). */
    keyDir: process.env.SIMON_KEY_DIR ?? path.join(root, "var/keys"),
    dir: process.env.SIMON_BACKUP_DIR ?? path.join(root, "var/backups"),
    /** The removable drive's mount point. Empty means none is configured. */
    usbDir: process.env.SIMON_USB_DIR ?? "",
    /** The hourly timer and the backup at shift close. Off under test, where each test takes its own. */
    automatic: !isTest && process.env.SIMON_BACKUP_AUTOMATIC !== "0",
  },
};

export const databaseFile = (mode: "LIVE" | "PRACTICE") =>
  path.join(config.dataDir, mode === "LIVE" ? "simon.db" : "simon-practice.db");
