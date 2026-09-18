---
name: i18n-hy
description: Armenian localisation for Simon — resource-file discipline, Latin-typed Armenian search and transliteration, AMD currency and number formatting, Armenian pluralisation and dates, and text-layout pitfalls. Use whenever adding user-facing text, building a search input, or formatting a number or date.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Armenian localisation

**UI is Armenian. Code, schema, API, comments, and commit messages are English.** (PRD §19.3)

## Strings

- Every user-facing string lives in a resource file. **No Armenian literals in components** —
  a hardcoded string cannot be reviewed by the shop owner, corrected, or reused on a receipt.
- Key by meaning, not by text: `checkout.confirmDebtSale`, not `areYouSure`.
- The API returns machine-readable error `type` values; the **client** maps them to Armenian.
  Never return Armenian prose from the backend — it cannot be tested or reused.

Core vocabulary (keep consistent — inconsistent terminology is the fastest way to confuse a
worker):

| English | Armenian |
|---|---|
| Sell / Sale | Վաճառել / Վաճառք |
| Scan | Սկանավորել |
| Debt (Nisya) | Պարտք / Նիսյա |
| Repayment | Մարում |
| Stock / Warehouse | Պահեստ |
| Supplier | Մատակարար |
| Goods receipt | Ընդունում |
| Shift | Հերթափոխ |
| Cash | Կանխիկ |
| Discount | Զեղչ |
| Return | Վերադարձ |
| Quantity | Քանակ |
| Price | Գին |

## Search — the pitfall that matters

**Workers frequently type on a Latin keyboard layout.** Searching for `մալուխ` by typing
`malukh` must find it. If search only matches Armenian codepoints, it will feel broken to
the people using it every day, and they will blame the product.

Store a normalised `Product.nameSearch` alongside the display name and match against both:

```ts
normalizeForSearch(name)  // lowercase → fold Armenian → transliterate to Latin
// "Մալուխ 3x2.5" → "malukh 3x2.5"
```

Match the query in both directions: transliterate a Latin query to compare against Armenian,
and compare a normalised query against the stored Latin form. Substring match, not prefix —
workers search by the distinctive middle of a name.

Also handle:
- **Armenian casing** — `toLowerCase()` works for Armenian in modern JS, but normalise with
  `String.prototype.normalize("NFC")` first; composed vs. decomposed forms will not match.
- **Homoglyphs** — Armenian `օ`/`о`, `ա`/`a` confusions from mixed-layout typing.
- The Armenian question mark `՞`, emphasis `՛`, and abbreviation `՟` marks should be stripped
  in the normalised form.

## Numbers & currency

```ts
formatDram(12500)   // "12 500 ֏" — no-break spaces, from @simon/shared
groupDigits(-1500)  // "−1 500"
```

**Verified, not assumed (2026-09-15): Chromium's `hy-AM` locale is wrong for this shop in three ways.**
`Intl.NumberFormat("hy-AM")` groups with commas (`3,100`), `Intl.DateTimeFormat("hy-AM")` defaults to a
12-hour clock (`08:48 PM`), and short month names come out as `M09`. So:

- money and quantities go through `groupDigits` / `formatDram` in `packages/shared/src/money.ts`, and
  `money`, `moneyPlain`, `qty` in `frontend/src/lib/format.ts` — never `Intl.NumberFormat` directly;
- times go through `time()` (24-hour) and dates through `dateTime()`, which takes month names from
  `hy.dates.months` in the resource file;
- numbers interpolated into strings by `t()` are grouped the same way.

A test that locates a money value by accessible name must match `\s`, not a literal no-break space:
Playwright normalises whitespace in accessible names.

- Symbol is **֏** (U+058F), conventionally after the amount with a space.
- Thousands separator is a space, not a comma. Use `Intl.NumberFormat("hy-AM")` and verify
  the output rather than assuming.
- Decimal separator differs by locale — never parse user numeric input with `parseFloat` on a
  localised string. Parse from the keypad's raw digits (see the `money` skill).
- Quantities display with the product's `decimalPlaces`; a piece count never shows `.000`.

## Pluralisation

Armenian has two plural categories (`one`, `other`) but the rules differ from English —
notably, a noun after a numeral often stays singular. Do not concatenate `count + " " + word`.
Use `Intl.PluralRules("hy")` with resource keys per category, and have a native speaker check
the result. Getting this subtly wrong makes the UI read as machine-translated.

## Dates

- Display in Armenian format via `Intl.DateTimeFormat("hy-AM")`; store and transmit ISO 8601
  UTC.
- The shop's day is not the UTC day. **Shift and report boundaries use local shop time** —
  a Z-report that splits a shift at midnight UTC is wrong for Yerevan (UTC+4).

## Layout

- Armenian text runs **10–30% longer** than English. Buttons, table headers, and tab labels
  must not be fixed-width; test the longest realistic string, not a placeholder.
- Armenian is LTR — no RTL work needed.
- The font is **Mardoto** (Apache-2.0), self-hosted in `frontend/src/assets/fonts/` and declared
  in `theme.css` — one family for Armenian and Latin, covering the full block including `֏`, with
  digits that are already one width so money columns align. Never load a font from a CDN: a shop
  may have no internet.
- **Mardoto has no 600 weight.** The four faces are remapped onto the four steps the UI uses, so
  `font-semibold` renders Bold and `font-bold` renders Black. Replacing the family means redoing
  that mapping.
- Verify any new font renders the full Armenian block, including `֏`. Many otherwise good
  UI fonts have incomplete or poorly-hinted Armenian glyphs; check at real device sizes.
- Uppercase Armenian is unusual in UI — avoid `text-transform: uppercase` on labels.

## Testing

- Unit: `normalizeForSearch` round-trips, Latin→Armenian query matching, homoglyph folding,
  `formatDram` output, pluralisation categories.
- Component: a search test with a Latin-typed Armenian query (this is the regression that
  will otherwise recur).
- Adversarial: mixed-script input, combining marks, emoji in a product name.
- A lint check for Armenian codepoints in `.tsx` files catches hardcoded strings.

## Checklist

- [ ] No Armenian literals in components
- [ ] Search matches Latin-typed Armenian
- [ ] `nameSearch` maintained on write
- [ ] `֏` formatting via a shared helper
- [ ] Shift/report boundaries in shop-local time
- [ ] Longest-string layout checked
- [ ] Backend returns error `type`, not Armenian prose


---

## Simon additions (phase 5)

- **A shop's spreadsheet has Armenian headers.** `packages/shared/src/csv-import.ts` maps column
  names in both languages (`անուն`/`name`, `գին`/`price`, `շտրիխկոդ`/`barcode`, …) and accepts the
  number and date forms people actually type: spaces and non-breaking spaces group thousands, a comma
  is a decimal point, and `14.03.2026` is a date. Add an alias there, never a second parser.
- **Import errors are codes, not sentences**: `not-whole:price` is rendered by the screen as
  «գին»՝ պետք է լինի ամբողջ թիվ. The server never sends Armenian prose (§15.2).
- **Coach marks and the `?` are two sentences per screen**, in `hy.help.screens`, keyed by the route
  (`lib/screens.ts`). Per person, not per device (`User.coachMarksSeen`).
