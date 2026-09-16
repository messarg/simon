/**
 * CSV export. PRD §6.10, FR-DAT-03: every report exports in one tap, and this is Սիրան's entire
 * relationship with the product.
 *
 * Written on the client so the Armenian column headings live in the resource file and nowhere else.
 * Money and quantities go out as plain integers — a spreadsheet must be able to add the column, and
 * a thousands separator or a currency sign turns it into text.
 */
import { QTY_SCALE } from "@simon/shared";

export interface CsvColumn { key: string; label: string; kind?: string }

const quote = (v: string) => (/[",\n;]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);

function cell(value: unknown, kind: string | undefined, row: Record<string, unknown>): string {
  if (value === null || value === undefined) return "";
  if (kind === "qty" && typeof value === "number") return (value / QTY_SCALE).toFixed(Number(row.decimalPlaces ?? 3)).replace(/\.?0+$/, "");
  if (kind === "percent" && typeof value === "number") return (value / 100).toFixed(2);
  if (typeof value === "number") return String(value);
  return String(value);
}

export function toCsv(columns: readonly CsvColumn[], rows: ReadonlyArray<Record<string, unknown>>, totals?: Record<string, unknown> | null, totalsLabel = ""): string {
  const lines = [columns.map((cx) => quote(cx.label)).join(",")];
  for (const row of rows) lines.push(columns.map((cx) => quote(cell(row[cx.key], cx.kind, row))).join(","));
  if (totals && Object.keys(totals).length) {
    lines.push(columns.map((cx, i) => quote(i === 0 ? totalsLabel : cell(totals[cx.key], cx.kind, totals))).join(","));
  }
  // The BOM is what makes Excel read UTF-8 Armenian rather than mojibake.
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Hands the file to the browser. Nothing leaves the shop: the bytes are built here (§1). */
export function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name.endsWith(".csv") ? name : `${name}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  // WebKit (the Mac app) fetches the blob after the click returns; revoking at once races it.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function downloadText(name: string, text: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  // WebKit (the Mac app) fetches the blob after the click returns; revoking at once races it.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
