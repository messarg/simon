import { BarcodeFormat, BinaryBitmap, Code128Reader, DecodeHintType, HybridBinarizer, RGBLuminanceSource } from "@zxing/library";
import { describe, expect, it } from "vitest";
import { Code128Error, CODE128_PATTERNS, CODE128_STOP, code128Bars, code128Values } from "./code128.ts";

/** Draw the bars into a greyscale image and read it back with an independent decoder. */
function decode(value: string): string {
  const { bars, modules } = code128Bars(value);
  const scale = 3;
  const quiet = 10;
  const width = (modules + quiet * 2) * scale;
  const height = 40;
  const pixels = new Uint8ClampedArray(width * height).fill(255);
  for (const bar of bars) {
    for (let x = (bar.x + quiet) * scale; x < (bar.x + bar.width + quiet) * scale; x++) {
      for (let y = 0; y < height; y++) pixels[y * width + x] = 0;
    }
  }
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, width, height)));
  const hints = new Map<DecodeHintType, unknown>([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]], [DecodeHintType.PURE_BARCODE, true]]);
  return new Code128Reader().decode(bitmap, hints).getText();
}

describe("Code128 — §18 shelf labels", () => {
  it("has a well-formed symbol table", () => {
    expect(CODE128_PATTERNS).toHaveLength(106);
    for (const p of CODE128_PATTERNS) expect([...p].reduce((a, b) => a + Number(b), 0)).toBe(11);
    expect([...CODE128_STOP].reduce((a, b) => a + Number(b), 0)).toBe(13);
    expect(new Set(CODE128_PATTERNS).size).toBe(106);
  });

  it.each(["S0000042", "4850001234567", "4820000000401", "MAL-325", "C-400", "A", "12", "123", "X1234567Y", "00"])(
    "encodes %s so that an independent decoder reads it back",
    (value) => { expect(decode(value)).toBe(value); },
  );

  it("packs a digit run into set C, so an EAN fits a small label", () => {
    const ean = code128Values("4850001234567");
    const allB = "4850001234567".length + 2;
    expect(ean.length).toBeLessThan(allB);
  });

  it("computes the weighted modulo-103 checksum", () => {
    const values = code128Values("PJJ123C");
    const body = values.slice(0, -1);
    const sum = body.reduce((s, v, k) => s + v * (k === 0 ? 1 : k), 0);
    expect(values.at(-1)).toBe(sum % 103);
  });

  it("refuses what Code128 cannot carry, including Armenian", () => {
    expect(() => code128Values("")).toThrow(Code128Error);
    expect(() => code128Values("Մալուխ")).toThrow(Code128Error);
  });
});
