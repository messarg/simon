import { describe, expect, it } from "vitest";
import { feed, type ScanBuffer } from "./scanner.ts";

describe("HID scan detection", () => {
  it("a fast burst ending in Enter is a scan", () => {
    const buf: ScanBuffer = { chars: "", last: 0 };
    let code: string | null = null;
    "4820024700016".split("").forEach((c, i) => { code = feed(buf, c, 1000 + i * 10); });
    code = feed(buf, "Enter", 1130);
    expect(code).toBe("4820024700016");
  });
  it("slow human typing is not", () => {
    const buf: ScanBuffer = { chars: "", last: 0 };
    "12345".split("").forEach((c, i) => feed(buf, c, 1000 + i * 300));
    expect(feed(buf, "Enter", 2600)).toBeNull();
  });
});
