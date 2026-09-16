import { describe, expect, it } from "vitest";
import { addDays, periodRange, startOfWeek } from "./periods.ts";

describe("periods", () => {
  it("adds days across month and leap-year boundaries", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("starts the week on Monday", () => {
    expect(startOfWeek("2026-09-16")).toBe("2026-09-14"); // a Wednesday
    expect(startOfWeek("2026-09-20")).toBe("2026-09-14"); // a Sunday belongs to the week before
    expect(startOfWeek("2026-09-14")).toBe("2026-09-14");
  });

  it("names each preset as an inclusive range", () => {
    const today = "2026-03-10";
    expect(periodRange("today", today)).toEqual({ from: today, to: today });
    expect(periodRange("yesterday", today)).toEqual({ from: "2026-03-09", to: "2026-03-09" });
    expect(periodRange("month", today)).toEqual({ from: "2026-03-01", to: today });
    expect(periodRange("lastMonth", today)).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(periodRange("lastMonth", "2026-01-05")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });
});
