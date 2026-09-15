/**
 * The discount cap. PRD §12.1, §14.5, §15.3.
 *
 * Online, above the cap without admin re-auth is a 422. From the outbox, the till could not
 * reach an admin, so up to the offline ceiling it is accepted and flagged; above the
 * ceiling it is refused on either path, because the till refuses it at the counter.
 */
import { BPS_SCALE, type Bps, type Dram } from "@simon/shared";

export type CapDecision = "ok" | "flag" | "reject-cap" | "reject-ceiling";

export function exceeds(discount: Dram, base: Dram, rateBp: Bps): boolean {
  return discount * BPS_SCALE > base * rateBp;
}

export function evaluateDiscount(args: {
  discount: Dram;
  base: Dram;
  maxBp: Bps;
  offlineCeilingBp: Bps;
  drained: boolean;
  reauthorised: boolean;
}): CapDecision {
  const { discount, base, maxBp, offlineCeilingBp, drained, reauthorised } = args;
  if (discount <= 0 || !exceeds(discount, base, maxBp)) return "ok";
  if (reauthorised) return "ok";
  if (!drained) return "reject-cap";
  return exceeds(discount, base, Math.max(offlineCeilingBp, maxBp)) ? "reject-ceiling" : "flag";
}
