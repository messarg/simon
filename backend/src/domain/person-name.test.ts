import { describe, expect, it } from "vitest";
import { nameKey } from "./person-name.ts";

describe("nameKey", () => {
  it("ignores case, in Armenian and in Latin", () => {
    expect(nameKey("ԳՈՌ")).toBe(nameKey("գոռ"));
    expect(nameKey("Aram")).toBe(nameKey("aRAM"));
  });

  it("ignores leading, trailing and repeated spaces", () => {
    expect(nameKey("  Լուսինե   Պետրոսյան ")).toBe(nameKey("Լուսինե Պետրոսյան"));
  });

  it("treats composed and decomposed forms as one name", () => {
    expect(nameKey("եւ")).toBe(nameKey("եւ".normalize("NFD")));
    expect(nameKey("René")).toBe(nameKey("René"));
  });

  it("keeps different people different", () => {
    expect(nameKey("Արամ")).not.toBe(nameKey("Արամե"));
  });
});
