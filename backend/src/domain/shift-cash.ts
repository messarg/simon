/**
 * Expected cash in the drawer. PRD §12.5.
 *
 * expected = openingFloat + cashSales + REPAYMENT + PAY_IN − REFUND − PAY_OUT − DROP.
 * NO_SALE carries zero and cannot move it.
 */
import type { CashMovementType, Dram } from "@simon/shared";

export interface CashFigures {
  openingFloat: Dram;
  cashSales: Dram;
  movements: ReadonlyArray<{ type: CashMovementType; amount: Dram }>;
}

const SIGN: Record<CashMovementType, number> = { REPAYMENT: 1, PAY_IN: 1, REFUND: -1, PAY_OUT: -1, DROP: -1, NO_SALE: 0 };

export function expectedCash(f: CashFigures): Dram {
  return f.movements.reduce((sum, m) => sum + SIGN[m.type] * m.amount, f.openingFloat + f.cashSales);
}

export interface Denomination {
  value: Dram;
  count: number;
}

export const DENOMINATIONS: readonly Dram[] = [20_000, 10_000, 5_000, 2_000, 1_000, 500, 200, 100, 50, 20, 10];

export function countedTotal(breakdown: readonly Denomination[]): Dram {
  return breakdown.reduce((a, d) => {
    if (!Number.isInteger(d.count) || d.count < 0) throw new RangeError("denomination count must be a non-negative integer");
    return a + d.value * d.count;
  }, 0);
}

export function needsVarianceNote(variance: Dram, threshold: Dram): boolean {
  return Math.abs(variance) >= threshold;
}
