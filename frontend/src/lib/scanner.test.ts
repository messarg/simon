import { describe, expect, it } from "vitest";
import { feed, newScanBuffer } from "./scanner.ts";

const typeAt = (code: string, start: number, gap: (i: number) => number) => {
  const buf = newScanBuffer();
  let at = start;
  code.split("").forEach((c, i) => { at += i === 0 ? 0 : gap(i); feed(buf, c, at); });
  return feed(buf, "Enter", at + 6);
};

describe("HID scan detection", () => {
  it("a fast burst ending in Enter is a scan", () => {
    expect(typeAt("4820024700016", 1000, () => 8)).toBe("4820024700016");
  });

  it("one delayed key inside a burst does not split the scan", () => {
    // The second key arrives 80 ms late — a busy main thread — and the code must still be whole.
    expect(typeAt("4850001234567", 1000, (i) => (i === 1 ? 80 : 6))).toBe("4850001234567");
  });

  it("slow human typing is not a scan", () => {
    expect(typeAt("12345", 1000, () => 300)).toBeNull();
  });

  it("a pause longer than a second starts over", () => {
    const buf = newScanBuffer();
    "999".split("").forEach((c, i) => feed(buf, c, 1000 + i * 5));
    "4820".split("").forEach((c, i) => feed(buf, c, 5000 + i * 5));
    expect(feed(buf, "Enter", 5030)).toBe("4820");
  });

  it("too short to be a barcode is not a scan", () => {
    expect(typeAt("12", 1000, () => 5)).toBeNull();
  });
});
