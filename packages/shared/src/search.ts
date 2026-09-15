/**
 * Search normalisation. PRD §20.3, §11 `nameSearch`.
 *
 * Workers type Armenian on a Latin layout: `malukh` must find `Մալուխ` and `Dav` must find
 * `Դավիթ`. Both the stored name and the query go through the same function, which reduces
 * each to a loose Latin skeleton, and matching is a substring test on the results.
 */

const ARMENIAN: Record<string, string> = {
  "ա": "a", "բ": "b", "գ": "g", "դ": "d", "ե": "e", "զ": "z", "է": "e", "ը": "y",
  "թ": "t", "ժ": "zh", "ի": "i", "լ": "l", "խ": "kh", "ծ": "ts", "կ": "k", "հ": "h",
  "ձ": "dz", "ղ": "gh", "ճ": "ch", "մ": "m", "յ": "y", "ն": "n", "շ": "sh", "ո": "o",
  "չ": "ch", "պ": "p", "ջ": "j", "ռ": "r", "ս": "s", "վ": "v", "տ": "t", "ր": "r",
  "ց": "ts", "ւ": "v", "փ": "p", "ք": "k", "և": "ev", "օ": "o", "ֆ": "f",
};

/** Cyrillic letters that look like Latin ones, from mixed-layout typing. */
const HOMOGLYPHS: Record<string, string> = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y", "к": "k", "м": "m", "т": "t", "н": "h", "в": "b",
};

/** Folds applied to the Latin skeleton, so spelling variants of one sound collapse. */
const FOLDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/ou/g, "u"], [/x/g, "kh"], [/q/g, "k"], [/w/g, "v"], [/c(?!h)/g, "ts"], [/tz/g, "ts"],
  [/ph/g, "p"], [/th/g, "t"], [/ye/g, "e"], [/vo/g, "o"], [/(.)\1+/g, "$1"],
];

export function normalizeForSearch(input: string): string {
  let s = input.normalize("NFC").toLowerCase();
  // Armenian question, emphasis and abbreviation marks carry no letters.
  s = s.replace(/[՞՛՟՜]/g, "");
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    // ու is one vowel, u.
    if (ch === "ո" && s[i + 1] === "ւ") { out += "u"; i++; continue; }
    out += ARMENIAN[ch] ?? HOMOGLYPHS[ch] ?? ch;
  }
  for (const [re, to] of FOLDS) out = out.replace(re, to);
  return out.replace(/\s+/g, " ").trim();
}

export function matchesSearch(nameSearch: string, query: string): boolean {
  const q = normalizeForSearch(query);
  return q.length > 0 && nameSearch.includes(q);
}
