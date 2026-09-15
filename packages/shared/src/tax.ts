/**
 * Tax and the price basis. PRD §10.8.
 *
 * One module owns both bases. Under INCLUSIVE the tax is extracted from a line and is a
 * memo of what is already inside the total; under EXCLUSIVE it is added and is a term of it.
 * The rate travels on the line (`taxRateBp`) and is never re-read from the current setting.
 */
import { BPS_SCALE, roundHalfUp, type Bps, type Dram } from "./money.ts";
import type { PriceBasis } from "./enums.ts";

/** Tax on one already-rounded line amount, rounded once (§10.1: stored in its own column). */
export function lineTax(amount: Dram, rateBp: Bps, basis: PriceBasis): Dram {
  if (rateBp === 0) return 0;
  return basis === "INCLUSIVE"
    ? roundHalfUp(amount * rateBp, BPS_SCALE + rateBp)
    : roundHalfUp(amount * rateBp, BPS_SCALE);
}
