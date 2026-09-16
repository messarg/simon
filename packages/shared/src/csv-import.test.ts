import { describe, expect, it } from "vitest";
import { CellError, columnIndex, parseCsv, parseDateCell, parseDramCell, parseQtyCell } from "./csv-import.ts";

describe("reading a shop's spreadsheet — §19.1, §27.38", () => {
  it("reads quoted cells, CRLF, a BOM and a semicolon delimiter", () => {
    const file = '﻿Անուն;Գին;Շտրիխկոդ\r\n"Ցեմենտ M400, 50 կգ";3200;4850001234567\r\nԱվազ;25;\r\n';
    const parsed = parseCsv(file);
    expect(parsed.header).toEqual(["անուն", "գին", "շտրիխկոդ"]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].cells).toEqual(["Ցեմենտ M400, 50 կգ", "3200", "4850001234567"]);
    expect(parsed.rows[0].lineNumber).toBe(2);
    expect(parsed.rows[1].cells[2]).toBe("");
  });

  it("finds a column by its Armenian or English name, wherever it sits", () => {
    const { header } = parseCsv("SKU,Name,Price\nA1,Ավազ,25\n");
    expect(columnIndex(header, "sku")).toBe(0);
    expect(columnIndex(header, "name")).toBe(1);
    expect(columnIndex(header, "qty")).toBe(-1);
  });

  it("refuses a price that is not whole drams rather than rounding it", () => {
    expect(parseDramCell("3200")).toBe(3200);
    expect(parseDramCell("3 200")).toBe(3200);
    expect(parseDramCell("3 200")).toBe(3200);
    expect(() => parseDramCell("12.5")).toThrow(CellError);
    expect(() => parseDramCell("12,5")).toThrow(CellError);
    expect(() => parseDramCell("шт")).toThrow(CellError);
    expect(() => parseDramCell("-5")).toThrow(CellError);
    expect(() => parseDramCell("")).toThrow(CellError);
    expect(parseDramCell("", { required: false })).toBe(0);
  });

  it("accepts as many decimals as the product itself has, and not one more", () => {
    expect(parseQtyCell("12.5", 3)).toBe(12_500);
    expect(parseQtyCell("12,5", 1)).toBe(12_500);
    expect(parseQtyCell("40", 0)).toBe(40_000);
    expect(() => parseQtyCell("12.5", 0)).toThrow(CellError); // pieces do not come in halves
    expect(() => parseQtyCell("1.2345", 3)).toThrow(CellError);
  });

  it("reads the date formats a shop's file actually carries, and refuses the rest", () => {
    expect(parseDateCell("2026-03-14")).toBe("2026-03-14");
    expect(parseDateCell("14.03.2026")).toBe("2026-03-14");
    expect(parseDateCell("4/3/2026")).toBe("2026-03-04");
    expect(() => parseDateCell("14 March")).toThrow(CellError);
    expect(() => parseDateCell("2026-13-01")).toThrow(CellError);
  });
});
