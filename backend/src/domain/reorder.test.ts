import { describe, expect, it } from "vitest";
import { dailyVelocity, DEAD_STOCK_DAYS, stockStatus, suggestedReorderPoint } from "./reorder.ts";

const base = { trackStock: true, isActive: true, stockQty: 10_000, reorderPoint: 0, avgDailyQty30d: 0, daysSinceLastSale: 1, ageDays: 400 };

describe("reorder suggestion — §13.3", () => {
  it("averages net units sold over thirty days, half-up, never negative", () => {
    expect(dailyVelocity(120_000)).toBe(4_000);
    expect(dailyVelocity(45)).toBe(2);
    expect(dailyVelocity(-3_000)).toBe(0);
  });

  it("covers the supplier's lead time plus the safety days", () => {
    // Sells 4 a day, the supplier brings it in 5 days, 3 safety days: reorder at 32.
    expect(suggestedReorderPoint(4_000, 5, 3)).toBe(32_000);
  });

  it("uses the owner's reorder point when one is set, the suggestion otherwise", () => {
    expect(stockStatus({ ...base, avgDailyQty30d: 4_000, stockQty: 30_000 }, 5, 3)).toMatchObject({ threshold: 32_000, manual: false, low: true, daysOfCover: 7 });
    expect(stockStatus({ ...base, avgDailyQty30d: 4_000, stockQty: 30_000, reorderPoint: 20_000 }, 5, 3)).toMatchObject({ threshold: 20_000, manual: true, low: false });
  });

  it("does not call something low that nobody buys and nobody set a threshold for", () => {
    expect(stockStatus({ ...base, stockQty: 0 }, 5, 3).low).toBe(false);
  });

  it("calls stock dead after ninety days without a sale, and a never-sold product only once it is ninety days old", () => {
    expect(stockStatus({ ...base, daysSinceLastSale: DEAD_STOCK_DAYS }, 0, 3).dead).toBe(true);
    expect(stockStatus({ ...base, daysSinceLastSale: DEAD_STOCK_DAYS - 1 }, 0, 3).dead).toBe(false);
    expect(stockStatus({ ...base, daysSinceLastSale: null, ageDays: 10 }, 0, 3).dead).toBe(false);
    expect(stockStatus({ ...base, daysSinceLastSale: null, ageDays: 120 }, 0, 3).dead).toBe(true);
    expect(stockStatus({ ...base, daysSinceLastSale: 200, stockQty: 0 }, 0, 3).dead).toBe(false);
    expect(stockStatus({ ...base, daysSinceLastSale: 200, isActive: false }, 0, 3).dead).toBe(false);
  });
});
