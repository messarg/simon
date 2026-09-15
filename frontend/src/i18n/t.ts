/**
 * String lookup. `t("nav.sell")`, `t("signIn.locked", { n: 5 })`, and plural objects via
 * `tp("status.pending", 3)` using Intl.PluralRules("hy"). Numbers in messages are formatted
 * with the Armenian locale.
 */
import { groupDigits } from "@simon/shared";
import { hy } from "./hy.ts";

type Leaf = string | { one: string; other: string };
type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : T[K] extends { one: string; other: string } ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];

export type StringKey = Paths<typeof hy>;

const plural = new Intl.PluralRules("hy");

function resolve(key: string): Leaf | undefined {
  return key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], hy) as Leaf | undefined;
}

function interpolate(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined ? `{${k}}` : typeof v === "number" ? groupDigits(v) : v;
  });
}

export function t(key: StringKey, vars?: Record<string, string | number>): string {
  const leaf = resolve(key);
  if (typeof leaf === "string") return interpolate(leaf, vars);
  if (leaf && typeof leaf === "object") return interpolate(leaf[plural.select(Number(vars?.n ?? 0)) === "one" ? "one" : "other"], vars);
  return key;
}

/** Message for a problem `type` slug, with a safe fallback. */
export function problemMessage(type: string): string {
  const table = hy.problems as Record<string, string>;
  return table[type] ?? hy.problems["internal-error"];
}

export function warningMessage(type: string): string {
  return (hy.warnings as Record<string, string>)[type] ?? type;
}
