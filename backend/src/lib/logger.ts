/**
 * Structured logging. PINs, tokens and customer records never reach a log (§16.5, §19.6).
 * One line per request to stdout and, on a host, to a rotating file support can read (§19.5, §22).
 */
import pino from "pino";
import { config } from "./config.ts";
import { rotatingFile } from "./log-file.ts";

const redact = {
  paths: ["pin", "*.pin", "req.headers.authorization", "token", "*.token", "*.pinHash", "*.recoveryCode", "*.phone", "*.fullName", "passphrase", "*.passphrase"],
  censor: "[redacted]",
};

const streams = [{ stream: process.stdout }, ...(config.logDir ? [{ stream: rotatingFile(config.logDir) }] : [])];

export const logger = pino(
  // Tests are silent unless one is being chased: SIMON_TEST_LOG=1 turns the server's own errors back on.
  { level: process.env.NODE_ENV === "test" && process.env.SIMON_TEST_LOG !== "1" ? "silent" : config.logLevel, redact },
  streams.length > 1 ? pino.multistream(streams) : undefined,
);
