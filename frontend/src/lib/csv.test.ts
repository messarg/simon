import { describe, expect, it } from "vitest";
import { toCsv } from "./csv.ts";

const columns = [{ key: "productName", label: "Ապրանք" }, { key: "qty", label: "Քանակ", kind: "qty" }, { key: "value", label: "Գումար", kind: "money" }];

describe("CSV export — §6.10", () => {
  it("writes Armenian headings a spreadsheet can read, and numbers it can add", () => {
    const csv = toCsv(columns, [{ productName: "Մալուխ 3x2.5", qty: 2_500, decimalPlaces: 2, value: 12_400 }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Ապրանք,Քանակ,Գումար");
    expect(csv).toContain("Մալուխ 3x2.5,2.5,12400");
    expect(csv).not.toContain(" ");
  });

  it("quotes a value holding a comma, a quote or a newline, and leaves a missing one empty", () => {
    const csv = toCsv(columns, [{ productName: 'Ցեմենտ, 50 կգ "M400"', qty: null, value: 0 }]);
    expect(csv).toContain('"Ցեմենտ, 50 կգ ""M400""",,0');
  });

  it("puts the totals on a last row, under the first column's label", () => {
    const csv = toCsv(columns, [{ productName: "Ավազ", qty: 1_000, decimalPlaces: 0, value: 300 }], { value: 300 }, "Ընդամենը");
    expect(csv.trimEnd().split("\r\n").at(-1)).toBe("Ընդամենը,,300");
  });
});
