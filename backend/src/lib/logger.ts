/**
 * Structured logging. PINs, tokens and customer records never reach a log (§16.5, §19.6).
 */
import pino from "pino";
import { config } from "./config.ts";

export const logger = pino({
  level: process.env.NODE_ENV === "test" ? "silent" : config.logLevel,
  redact: {
    paths: ["pin", "*.pin", "req.headers.authorization", "token", "*.token", "*.pinHash", "*.recoveryCode", "*.phone", "*.fullName"],
    censor: "[redacted]",
  },
});
