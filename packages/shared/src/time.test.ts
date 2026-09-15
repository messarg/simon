import { describe, expect, it } from "vitest";
import { businessDate, daysBetween } from "./time.ts";

describe("businessDate", () => {
  it("uses the shop's timezone, not UTC (§20.3)", () => {
    // 21:30 UTC is 01:30 the next day in Yerevan (UTC+4).
    expect(businessDate("2026-09-14T21:30:00Z", "Asia/Yerevan")).toBe("2026-09-15");
    expect(businessDate("2026-09-14T21:30:00Z", "UTC")).toBe("2026-09-14");
  });
  it("counts days", () => {
    expect(daysBetween("2026-01-01", "2026-03-02")).toBe(60);
  });
});
