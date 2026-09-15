/**
 * When the cash drawer opens freely. PRD §15.4, §16.3, FR-DAT-08.
 *
 * Free once per document that accounts for the cash, and freely throughout a shift's float
 * count or close. Anything else — no document, or one already spent — is a no-sale open:
 * admin re-auth plus a NO_SALE movement. Every open is audited either way.
 */
export type DrawerDocument =
  | { kind: "sale"; hasCash: boolean }
  | { kind: "return"; hasCash: boolean }
  | { kind: "repayment"; hasCash: boolean }
  | { kind: "cash-movement" }
  | { kind: "none" };

export type DrawerDecision = "free" | "no-sale";

export function decideDrawerOpen(args: {
  document: DrawerDocument;
  alreadySpent: boolean;
  shiftCounting: boolean;
}): DrawerDecision {
  if (args.shiftCounting) return "free";
  const d = args.document;
  if (d.kind === "none" || args.alreadySpent) return "no-sale";
  if (d.kind === "cash-movement") return "free";
  return d.hasCash ? "free" : "no-sale";
}
