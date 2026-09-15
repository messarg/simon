/** Keypad editing rules, shared by every numeric entry (§6.1, §10.2). */
export function applyKey(value: string, key: string, allowDecimal: boolean, maxDecimals: number, maxLength: number): string {
  if (key === "back") return value.slice(0, -1);
  if (key === "clear") return "";
  if (key === ".") {
    if (!allowDecimal || value.includes(".")) return value;
    return value === "" ? "0." : value + ".";
  }
  if (value.length >= maxLength) return value;
  const [, frac] = value.split(".");
  if (frac !== undefined && frac.length >= maxDecimals) return value;
  if (value === "0") return key;
  return value + key;
}
