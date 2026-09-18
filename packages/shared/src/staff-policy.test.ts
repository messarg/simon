import { describe, expect, it } from "vitest";
import type { Role } from "./enums.ts";
import { assignableRoles, canManage, listsPerson, type StaffAction } from "./staff-policy.ts";

const owner = { id: "o", role: "OWNER" as Role };
const manager = { id: "m", role: "MANAGER" as Role };
const other = { id: "m2", role: "MANAGER" as Role };
const employee = { id: "e", role: "EMPLOYEE" as Role };
const ALL: StaffAction[] = ["view", "edit", "setRole", "deactivate"];

describe("canManage", () => {
  it("lets the owner manage every manager and employee", () => {
    for (const t of [manager, employee]) for (const a of ALL) expect(canManage(owner, t, a)).toBe(true);
  });

  it("never lets anyone demote or deactivate the owner — the owner included", () => {
    for (const actor of [owner, manager, employee]) {
      expect(canManage(actor, owner, "setRole")).toBe(false);
      expect(canManage(actor, owner, "deactivate")).toBe(false);
    }
    expect(canManage(owner, owner, "edit")).toBe(true);
  });

  it("lets a manager manage employees and nobody above them", () => {
    for (const a of ALL) expect(canManage(manager, employee, a)).toBe(true);
    for (const a of ALL) expect(canManage(manager, other, a)).toBe(false);
    for (const a of ALL) expect(canManage(manager, owner, a)).toBe(false);
  });

  it("lets a manager keep their own record but not change their own standing", () => {
    expect(canManage(manager, manager, "view")).toBe(true);
    expect(canManage(manager, manager, "edit")).toBe(true);
    expect(canManage(manager, manager, "setRole")).toBe(false);
    expect(canManage(manager, manager, "deactivate")).toBe(false);
  });

  it("lets an employee manage no one, themselves included", () => {
    for (const t of [owner, manager, employee]) for (const a of ALL) expect(canManage(employee, t, a)).toBe(false);
  });
});

describe("assignableRoles", () => {
  it("never hands out OWNER", () => {
    for (const r of ["OWNER", "MANAGER", "EMPLOYEE"] as Role[]) expect(assignableRoles(r)).not.toContain("OWNER");
  });
  it("lets only the owner make a manager", () => {
    expect(assignableRoles("OWNER")).toEqual(["MANAGER", "EMPLOYEE"]);
    expect(assignableRoles("MANAGER")).toEqual(["EMPLOYEE"]);
    expect(assignableRoles("EMPLOYEE")).toEqual([]);
  });
});

describe("listsPerson", () => {
  it("hides the owner from a manager's staff list, and nobody else", () => {
    expect(listsPerson("MANAGER", "OWNER")).toBe(false);
    expect(listsPerson("MANAGER", "MANAGER")).toBe(true);
    expect(listsPerson("OWNER", "OWNER")).toBe(true);
  });
});
