import { describe, expect, it } from "vitest";
import { age } from "./aging.ts";
import { allocate, type DebtEntryInput } from "./debt-allocation.ts";

const charge = (id: string, amount: number, createdAt: string): DebtEntryInput => ({ id, type: "CHARGE", amount, createdAt, reversesId: null });
const payment = (id: string, amount: number, createdAt: string, reversesId: string | null = null): DebtEntryInput => ({ id, type: "PAYMENT", amount, createdAt, reversesId });

describe("allocate — §10.6", () => {
  it("allocates oldest first and supports partial payment", () => {
    const p = allocate([charge("c1", 10_000, "2026-01-01T10:00:00Z"), charge("c2", 5_000, "2026-02-01T10:00:00Z"), payment("p1", 12_000, "2026-03-01T10:00:00Z")]);
    expect(p.chargeBalance.get("c1")).toBe(0);
    expect(p.chargeBalance.get("c2")).toBe(3_000);
    expect(p.outstanding).toBe(3_000);
  });

  it("two offline tills over-paying one charge leave a credit, never a broken row (§27.32)", () => {
    const p = allocate([charge("c1", 25_000, "2026-01-01T10:00:00Z"), payment("pA", 20_000, "2026-01-02T10:00:00Z"), payment("pB", 30_000, "2026-01-02T10:01:00Z")]);
    const onCharge = p.allocations.filter((a) => a.chargeEntryId === "c1").reduce((s, a) => s + a.amount, 0);
    expect(onCharge).toBe(25_000);
    expect(p.outstanding).toBe(-25_000);
    for (const a of p.allocations) expect(a.amount).toBeGreaterThan(0);
  });

  it("honours an override, bounded at derivation time", () => {
    const p = allocate(
      [charge("c1", 10_000, "2026-01-01T10:00:00Z"), charge("c2", 10_000, "2026-02-01T10:00:00Z"), payment("p1", 10_000, "2026-03-01T10:00:00Z")],
      [{ creditEntryId: "p1", chargeEntryId: "c2", amount: 999_999, createdAt: "2026-03-01T10:00:01Z" }],
    );
    expect(p.chargeBalance.get("c1")).toBe(10_000);
    expect(p.chargeBalance.get("c2")).toBe(0);
  });

  it("a reversed payment and its reversal both leave the inputs, so aging survives", () => {
    const entries = [charge("c1", 10_000, "2026-01-01T10:00:00Z"), payment("p1", 10_000, "2026-01-05T10:00:00Z"), payment("r1", 10_000, "2026-01-06T10:00:00Z", "p1")];
    const p = allocate(entries, [{ creditEntryId: "p1", chargeEntryId: "c1", amount: 10_000, createdAt: "2026-01-05T10:00:00Z" }]);
    expect(p.allocations).toEqual([]);
    expect(p.outstanding).toBe(10_000);
    const buckets = age(entries, p, "2026-04-15", "Asia/Yerevan");
    expect(buckets.d90plus).toBe(10_000);
    expect(buckets.oldestChargeDays).toBe(104);
  });

  it("is reproducible: same inputs, same output", () => {
    const entries = [charge("c1", 7_000, "2026-01-01T10:00:00Z"), payment("p1", 3_000, "2026-01-02T10:00:00Z")];
    expect(allocate(entries)).toEqual(allocate([...entries].reverse()));
  });
});
