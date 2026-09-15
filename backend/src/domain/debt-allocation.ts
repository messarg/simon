/**
 * Debt allocation as a derived projection. PRD §10.6, §11 `DebtAllocation`, FR-DEBT-08.
 *
 * allocations = allocate(charges, credits, overrides) over the entries that still stand.
 * A reversed entry and its reversal both leave the inputs; an override naming either
 * leaves with them. Same inputs, same output — which is what keeps aging reproducible.
 */
import type { DebtEntryType, Dram } from "@simon/shared";

export interface DebtEntryInput {
  id: string;
  type: DebtEntryType;
  amount: Dram;
  createdAt: string;
  reversesId: string | null;
}

export interface OverrideInput {
  creditEntryId: string;
  chargeEntryId: string;
  amount: Dram;
  createdAt: string;
}

export interface Allocation {
  creditEntryId: string;
  chargeEntryId: string;
  amount: Dram;
}

export interface Projection {
  allocations: Allocation[];
  /** Remaining balance per charge id. */
  chargeBalance: Map<string, Dram>;
  /** Unconsumed amount per credit id. */
  creditRemaining: Map<string, Dram>;
  /** Σ charges − Σ allocations − Σ unallocated credits (§10.6). Negative means the shop owes the customer. */
  outstanding: Dram;
}

const chronological = (a: { createdAt: string; id: string }, b: { createdAt: string; id: string }) =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export function standingEntries(entries: readonly DebtEntryInput[]): DebtEntryInput[] {
  const reversed = new Set(entries.filter((e) => e.reversesId).map((e) => e.reversesId as string));
  return entries.filter((e) => !e.reversesId && !reversed.has(e.id));
}

export function allocate(entries: readonly DebtEntryInput[], overrides: readonly OverrideInput[] = []): Projection {
  const standing = standingEntries(entries);
  const charges = standing.filter((e) => e.type === "CHARGE").sort(chronological);
  const credits = standing.filter((e) => e.type !== "CHARGE").sort(chronological);
  const chargeBalance = new Map(charges.map((c) => [c.id, c.amount]));
  const creditRemaining = new Map(credits.map((c) => [c.id, c.amount]));
  const totals = new Map<string, Allocation>();

  const add = (creditEntryId: string, chargeEntryId: string, amount: Dram) => {
    if (amount <= 0) return;
    chargeBalance.set(chargeEntryId, (chargeBalance.get(chargeEntryId) ?? 0) - amount);
    creditRemaining.set(creditEntryId, (creditRemaining.get(creditEntryId) ?? 0) - amount);
    const key = `${creditEntryId}:${chargeEntryId}`;
    const existing = totals.get(key);
    if (existing) existing.amount += amount;
    else totals.set(key, { creditEntryId, chargeEntryId, amount });
  };

  // Overrides first, in the order people made them, each bounded by what the projection sees now.
  for (const o of [...overrides].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))) {
    if (!creditRemaining.has(o.creditEntryId) || !chargeBalance.has(o.chargeEntryId)) continue;
    add(o.creditEntryId, o.chargeEntryId, Math.min(o.amount, creditRemaining.get(o.creditEntryId)!, chargeBalance.get(o.chargeEntryId)!));
  }

  // Then oldest credit to oldest charge.
  for (const credit of credits) {
    for (const charge of charges) {
      const left = creditRemaining.get(credit.id)!;
      if (left <= 0) break;
      add(credit.id, charge.id, Math.min(left, chargeBalance.get(charge.id)!));
    }
  }

  const sum = (m: Map<string, Dram>) => [...m.values()].reduce((a, b) => a + b, 0);
  return { allocations: [...totals.values()], chargeBalance, creditRemaining, outstanding: sum(chargeBalance) - sum(creditRemaining) };
}
