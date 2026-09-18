/**
 * How a typed name finds a person at sign-in (PRD §16.2). There is no list to tap any more, so the
 * name someone types has to land on the same key as the name the owner saved — whichever keyboard
 * layout, spacing or capitalisation either of them used.
 *
 * - NFC first: an Armenian letter typed on one keyboard and pasted from another can differ in
 *   composition while looking identical.
 * - Whitespace collapses and trims, because «Գոռ » and «Գոռ» are one person.
 * - Case folds with the Armenian locale, so «ԳՈՌ» is «գոռ».
 *
 * Two active people may not share a key (§6.17): otherwise a name would not say who is signing in.
 */
export function nameKey(name: string): string {
  return name.normalize("NFC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("hy");
}
