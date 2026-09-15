/**
 * RFC 7807 errors. PRD §15.2, §8.5.
 *
 * Services throw `ProblemError` with a frozen `type`; the single error middleware turns it
 * into `application/problem+json`. The server never sends Armenian prose.
 */
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { PROBLEM_BASE, SaleMathError, type ErrorType } from "@simon/shared";
import { logger } from "./logger.ts";

const STATUS: Record<ErrorType, number> = {
  "credit-limit-exceeded": 422, "customer-blocked": 422, "insufficient-stock-strict": 422,
  "return-exceeds-sold": 422, "discount-above-cap": 422, "tax-regime-not-set": 422,
  "shift-not-open": 422, "shift-has-open-baskets": 422, "duplicate-barcode": 422,
  "immutable-after-movements": 422, "illegal-transition": 422, "setup-required": 422, "duplicate-phone": 422,
  "pin-incorrect": 401, "session-expired": 401, "reauth-required": 403, "account-locked": 423,
  "too-many-attempts": 429, "not-permitted": 403, "not-found": 404,
  "malformed-request": 400, "internal-error": 500,
};

export class ProblemError extends Error {
  readonly type: ErrorType;
  readonly status: number;
  readonly fields: Record<string, unknown>;
  constructor(type: ErrorType, fields: Record<string, unknown> = {}) {
    super(type);
    this.type = type;
    this.status = STATUS[type];
    this.fields = fields;
  }
}

export const problem = (type: ErrorType, fields?: Record<string, unknown>) => new ProblemError(type, fields);

function titleFor(type: string) {
  return type.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let p: ProblemError;
  if (err instanceof ProblemError) p = err;
  else if (err instanceof ZodError) p = problem("malformed-request", { errors: err.issues.map((i) => ({ path: i.path.join("."), code: i.code })) });
  else if (err instanceof SaleMathError) p = problem("malformed-request", { detail: err.message });
  else if (err?.type === "entity.parse.failed") p = problem("malformed-request");
  else {
    logger.error({ err, path: req.path }, "unhandled error");
    p = problem("internal-error");
  }
  res.status(p.status).type("application/problem+json").json({ type: `${PROBLEM_BASE}${p.type}`, title: titleFor(p.type), status: p.status, ...p.fields });
};
