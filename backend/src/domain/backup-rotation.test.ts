import { describe, expect, it } from "vitest";
import { LOCAL_GENERATIONS, retain, USB_GENERATIONS } from "./backup-rotation.ts";

const TZ = "Asia/Yerevan";
/** One backup an hour for `days` days ending 2026-09-16 20:00 Yerevan (16:00 UTC). */
function hourly(days: number) {
  const end = Date.parse("2026-09-16T16:00:00Z");
  return Array.from({ length: days * 24 }, (_, i) => { const at = new Date(end - i * 3_600_000).toISOString(); return { id: at, at }; });
}

describe("backup rotation — §19.2", () => {
  it("keeps every backup while there are fewer than a day's worth", () => {
    expect(retain(hourly(1).slice(0, 10), TZ).size).toBe(10);
  });

  it("keeps 24 hourly, then the newest of each day, week and month, and nothing else", () => {
    const b = hourly(400);
    const kept = retain(b, TZ, LOCAL_GENERATIONS);
    for (const h of b.slice(0, 24)) expect(kept.has(h.id)).toBe(true);
    expect(kept.size).toBeLessThanOrEqual(24 + 14 + 8 + 12);
    expect(kept.size).toBeGreaterThan(24 + 12);
    expect(kept.has(b[b.length - 1].id)).toBe(false);
  });

  it("counts a day in shop-local time: 23:30 and 00:30 Yerevan are two days", () => {
    const late = { id: "late", at: "2026-09-15T19:30:00Z" };
    const early = { id: "early", at: "2026-09-15T20:30:00Z" };
    const earlier = { id: "earlier", at: "2026-09-15T18:30:00Z" };
    const kept = retain([late, early, earlier], TZ, { hourly: 0, daily: 14, weekly: 0, monthly: 0 });
    expect([...kept].sort()).toEqual(["early", "late"]);
  });

  it("gives the USB drive dailies and monthlies only", () => {
    // 72 hours back from 20:00 reaches 21:00 three days earlier: four shop days, the newest month among them.
    expect(retain(hourly(3), TZ, USB_GENERATIONS).size).toBe(4);
  });
});
