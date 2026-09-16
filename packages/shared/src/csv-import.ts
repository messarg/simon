/**
 * Reading a shopkeeper's spreadsheet. PRD §19.1, §7.3, §27.38.
 *
 * This is the one path where decimals arrive by design — a file written by a person — so a money
 * or quantity cell that is not whole in its scaled unit is a **row error, never a rounded value**:
 * `12.5` in a price column means the file and Simon disagree about units, and rounding it writes a
 * wrong price that looks deliberate.
 *
 * Headers may be Armenian or English, in any order, because the file came from whatever the shop
 * already had.
 */

export interface ParsedCsv {
  header: string[];
  /** One entry per data line, with its 1-based line number in the file. */
  rows: Array<{ lineNumber: number; cells: string[] }>;
}

/** Excel writes `;` in some locales and `,` in others; the header line decides. */
function detectDelimiter(firstLine: string): string {
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0][1] > 1 ? counts.sort((a, b) => b[1] - a[1])[0][0] : ",";
}

export function parseCsv(text: string): ParsedCsv {
  const clean = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(clean.split(/\r?\n/, 1)[0] ?? "");
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let lineStart = true;
  const pushCell = () => { row.push(cell.trim()); cell = ""; };
  const pushRow = () => { pushCell(); lines.push(row); row = []; };

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
      continue;
    }
    if (c === '"' && cell.trim() === "") { quoted = true; cell = ""; lineStart = false; continue; }
    if (c === delimiter) { pushCell(); lineStart = false; continue; }
    if (c === "\r") continue;
    if (c === "\n") { pushRow(); lineStart = true; continue; }
    cell += c;
    lineStart = false;
  }
  if (!lineStart || cell !== "" || row.length) pushRow();

  const nonEmpty = lines.map((cells, index) => ({ lineNumber: index + 1, cells })).filter((l) => l.cells.some((c) => c !== ""));
  const [head, ...rest] = nonEmpty;
  return { header: (head?.cells ?? []).map((h) => h.toLowerCase()), rows: rest };
}

/** Header names one column may go by, Armenian first because that is what the shop's file says. */
export const COLUMN_ALIASES = {
  name: ["անուն", "անվանում", "ապրանք", "name", "product", "title"],
  price: ["գին", "վաճառքի գին", "price", "sell price", "sale price"],
  barcode: ["շտրիխկոդ", "շտրիխ", "barcode", "ean", "code"],
  sku: ["կոդ", "ներքին կոդ", "sku", "article"],
  unit: ["չափ", "չափման միավոր", "միավոր", "unit", "uom"],
  qty: ["քանակ", "մնացորդ", "qty", "quantity", "stock"],
  cost: ["ինքնարժեք", "գնման գին", "cost", "unit cost"],
  phone: ["հեռախոս", "հեռ", "phone", "mobile"],
  amount: ["գումար", "պարտք", "amount", "balance", "debt"],
  date: ["ամսաթիվ", "օր", "date"],
  limit: ["սահմանաչափ", "limit", "credit limit"],
  note: ["նշում", "մեկնաբանություն", "note", "comment"],
} as const;

export type ColumnName = keyof typeof COLUMN_ALIASES;

export function columnIndex(header: readonly string[], column: ColumnName): number {
  const aliases = COLUMN_ALIASES[column] as readonly string[];
  return header.findIndex((h) => aliases.includes(h.trim().toLowerCase()));
}

export type CellErrorReason = "not-a-number" | "not-whole" | "negative" | "missing" | "bad-date";

export class CellError extends Error {
  readonly cell: string;
  readonly reason: CellErrorReason;
  constructor(cell: string, reason: CellErrorReason) {
    super(reason);
    this.cell = cell;
    this.reason = reason;
  }
}

/**
 * A number as a person typed it: spaces and non-breaking spaces group thousands, a comma is a
 * decimal point (hy-AM), and anything else is not a number.
 */
function normalizeNumeric(cell: string): string {
  return cell.replace(/[\s  ]/g, "").replace(",", ".");
}

/** Whole drams only — `12.5` is the file disagreeing about units (§27.38). */
export function parseDramCell(cell: string, { required = true } = {}): number {
  const raw = cell.trim();
  if (raw === "") {
    if (required) throw new CellError(cell, "missing");
    return 0;
  }
  const value = normalizeNumeric(raw);
  if (!/^-?\d+(\.\d+)?$/.test(value)) throw new CellError(cell, "not-a-number");
  if (value.includes(".")) throw new CellError(cell, "not-whole");
  const n = Number(value);
  if (n < 0) throw new CellError(cell, "negative");
  return n;
}

/** A quantity may carry as many decimals as the product itself does, and not one more (§10.2). */
export function parseQtyCell(cell: string, decimalPlaces: number, { required = true } = {}): number {
  const raw = cell.trim();
  if (raw === "") {
    if (required) throw new CellError(cell, "missing");
    return 0;
  }
  const value = normalizeNumeric(raw);
  if (!/^-?\d+(\.\d+)?$/.test(value)) throw new CellError(cell, "not-a-number");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimalPlaces) throw new CellError(cell, "not-whole");
  const scaled = Number(`${whole}${fraction.padEnd(3, "0").slice(0, 3)}`);
  if (scaled < 0) throw new CellError(cell, "negative");
  return scaled;
}

/** `2026-03-14`, `14.03.2026` or `14/03/2026` — the formats a shop's file actually carries. */
export function parseDateCell(cell: string): string {
  const raw = cell.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const dotted = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(raw);
  const parts = iso ? [iso[1], iso[2], iso[3]] : dotted ? [dotted[3], dotted[2], dotted[1]] : null;
  if (!parts) throw new CellError(cell, "bad-date");
  const [y, m, d] = parts.map((p) => Number(p));
  if (m < 1 || m > 12 || d < 1 || d > 31) throw new CellError(cell, "bad-date");
  const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new CellError(cell, "bad-date");
  return date;
}
