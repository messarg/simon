/**
 * §27.15 — no screen exposes an internal term from §4.1's right-hand column, and §4.2's rule that
 * every user-facing string lives in this file and nowhere else.
 *
 * Both were audited by hand once. A rule audited once is a rule that rots, and the terms are
 * exactly the ones an engineer reaches for while writing a screen at speed.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hy } from "./hy.ts";

const SRC = path.resolve(import.meta.dirname, "..");
const ARMENIAN = /[԰-֏]/;

/** §4.1: "If a screen needs the word ledger, movement, allocation, idempotent, or reconciliation, that screen is wrong." */
const FORBIDDEN: Array<[RegExp, string]> = [
  [/\bշարժ(ը|ի|եր|ում)?\b/u, "movement — the stock ledger's word, not the shelf's"],
  [/\bմատյան/u, "ledger"],
  [/\bբաշխում/u, "allocation — how a payment settles charges is not the customer's word"],
  [/\bհամաժամեց/u, "sync"],
  [/\bսերվեր/u, "server"],
  [/\bիդեմպոտ/u, "idempotent"],
  [/\bհամաձայնեցում/u, "reconciliation"],
  [/\bSaleLine|DebtEntry|StockMovement|GoodsReceipt|CashMovement|DebtAllocation|PurchaseReturn\b/u, "a model name"],
  [/\bCOGS\b/u, "COGS"],
];

/** The diagnostics screen is support's, and §19.5 specifies the database's size on it by name. */
const EXEMPT_KEYS = new Set(["diagnostics.database"]);

function walk(node: unknown, trail: string[] = []): Array<[string, string]> {
  if (typeof node === "string") return [[trail.join("."), node]];
  if (Array.isArray(node)) return node.flatMap((v, i) => walk(v, [...trail, String(i)]));
  if (node && typeof node === "object") return Object.entries(node).flatMap(([k, v]) => walk(v, [...trail, k]));
  return [];
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && name !== "hy.ts" ? [full] : [];
  });
}

/** Comments are English by convention, but they quote Armenian labels; only string literals count. */
function armenianLiterals(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const found: string[] = [];
  for (const m of code.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
    if (ARMENIAN.test(m[2])) found.push(m[2]);
  }
  return found;
}

describe("§27.15 — the user is never shown the right-hand column", () => {
  const strings = walk(hy).filter(([key]) => !EXEMPT_KEYS.has(key));

  it("holds no internal term in any user-facing string", () => {
    const offenders = strings.flatMap(([key, value]) =>
      FORBIDDEN.flatMap(([pattern, why]) => (pattern.test(value) ? [`${key}: ${value} — ${why}`] : [])),
    );
    expect(offenders).toEqual([]);
  });

  it("keeps every user-facing string in this file", () => {
    const offenders = sourceFiles(SRC).flatMap((file) =>
      armenianLiterals(readFileSync(file, "utf8")).map((s) => `${path.relative(SRC, file)}: ${s.slice(0, 40)}`),
    );
    expect(offenders).toEqual([]);
  });

  it("explains every screen a person can open", () => {
    expect(Object.keys(hy.help.screens).sort()).toEqual(["debts", "home", "products", "reports", "settings", "shift", "stock", "till"]);
    for (const [, sentence] of walk(hy.help.screens)) expect(sentence.length).toBeGreaterThan(40);
  });
});
