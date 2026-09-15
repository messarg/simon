import { describe, expect, it } from "vitest";
import { matchesSearch, normalizeForSearch } from "./search.ts";

describe("normalizeForSearch — §20.3, §27.44", () => {
  it("finds Armenian names from Latin-typed queries", () => {
    expect(matchesSearch(normalizeForSearch("Մալուխ 3x2.5"), "malukh")).toBe(true);
    expect(matchesSearch(normalizeForSearch("Դավիթ Սարգսյան"), "Dav")).toBe(true);
    expect(matchesSearch(normalizeForSearch("Մալուխ 3x2.5"), "malux")).toBe(true);
  });

  it("matches every word of a query wherever it sits in the name", () => {
    const name = normalizeForSearch("Մալուխ ՊՎՍ 3x2.5");
    expect(matchesSearch(name, "malukh 3x")).toBe(true);
    expect(matchesSearch(name, "3x2 pvs")).toBe(true);
    expect(matchesSearch(name, "malukh 4x")).toBe(false);
  });

  it("matches Armenian queries and substrings from the middle", () => {
    expect(matchesSearch(normalizeForSearch("Պտուտակ 4x40"), "տուտ")).toBe(true);
    expect(matchesSearch(normalizeForSearch("Ցեմենտ M400"), "cement")).toBe(true);
  });

  it("is NFC-stable and strips Armenian marks", () => {
    expect(normalizeForSearch("Ինչ՞")).toBe(normalizeForSearch("Ինչ"));
    expect(normalizeForSearch("é")).toBe(normalizeForSearch("é"));
  });

  it("never matches an empty query", () => {
    expect(matchesSearch("malukh", "  ")).toBe(false);
  });
});
