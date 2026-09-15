/** Units offered when a product is created in a hurry (§7.4); decimals follow what each unit is sold in. */
import type { StringKey } from "@/i18n/t.ts";

export const UNITS: Array<{ key: StringKey; decimals: number }> = [
  { key: "units.piece", decimals: 0 }, { key: "units.metre", decimals: 2 }, { key: "units.kg", decimals: 3 },
  { key: "units.litre", decimals: 2 }, { key: "units.pack", decimals: 0 }, { key: "units.sqm", decimals: 2 },
];
