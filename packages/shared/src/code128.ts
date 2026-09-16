/**
 * Code128 encoding for shelf labels. PRD §18: internal barcodes for unbarcoded goods are Code128.
 *
 * Code set B carries any printable ASCII — internal codes look like `S0000042` — and a run of
 * digits switches to set C, which packs two digits per symbol and keeps a 13-digit EAN narrow
 * enough for a 40 mm label. The output is a list of bar/space module widths, which the screen
 * draws as SVG and a label printer draws as it likes.
 */

/** Bar/space widths for symbol values 0–105, each summing to 11 modules. */
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232",
] as const;
const STOP = "2331112";

const START_B = 104;
const START_C = 105;
const CODE_B = 100;
const CODE_C = 99;

export class Code128Error extends Error {}

/** Digits worth switching to set C for: four or more in a row (or the whole value, if even). */
function digitRun(value: string, from: number) {
  let end = from;
  while (end < value.length && value.charCodeAt(end) >= 48 && value.charCodeAt(end) <= 57) end++;
  return end - from;
}

/** Symbol values, start and checksum included, stop excluded. */
export function code128Values(value: string): number[] {
  if (!value.length) throw new Code128Error("empty value");
  for (const ch of value) {
    const c = ch.charCodeAt(0);
    if (c < 32 || c > 126) throw new Code128Error(`cannot encode ${JSON.stringify(ch)}`);
  }
  const symbols: number[] = [];
  let set: "B" | "C";
  let i = 0;
  const leading = digitRun(value, 0);
  if (leading >= 4 && (leading === value.length ? leading % 2 === 0 : true)) {
    set = "C";
    symbols.push(START_C);
  } else {
    set = "B";
    symbols.push(START_B);
  }
  while (i < value.length) {
    const run = digitRun(value, i);
    if (set === "B" && run >= 4) {
      // Switch to C for an even number of digits; an odd leading digit stays in B.
      if (run % 2 === 1) { symbols.push(value.charCodeAt(i) - 32); i++; }
      symbols.push(CODE_C);
      set = "C";
      continue;
    }
    if (set === "C") {
      if (run >= 2) {
        symbols.push(Number(value.slice(i, i + 2)));
        i += 2;
        continue;
      }
      symbols.push(CODE_B);
      set = "B";
      continue;
    }
    symbols.push(value.charCodeAt(i) - 32);
    i++;
  }
  const checksum = symbols.reduce((sum, v, k) => sum + v * (k === 0 ? 1 : k), 0) % 103;
  symbols.push(checksum);
  return symbols;
}

/** Alternating bar and space widths, in modules, starting with a bar and ending with the stop's bar. */
export function code128Widths(value: string): number[] {
  const pattern = code128Values(value).map((v) => PATTERNS[v]).join("") + STOP;
  return [...pattern].map(Number);
}

/** The bars as rectangles: x and width in modules. Quiet zones are the caller's (10 modules each side). */
export function code128Bars(value: string): { bars: Array<{ x: number; width: number }>; modules: number } {
  const widths = code128Widths(value);
  const bars: Array<{ x: number; width: number }> = [];
  let x = 0;
  widths.forEach((w, k) => {
    if (k % 2 === 0) bars.push({ x, width: w });
    x += w;
  });
  return { bars, modules: x };
}

export const CODE128_PATTERNS: readonly string[] = PATTERNS;
export const CODE128_STOP = STOP;
