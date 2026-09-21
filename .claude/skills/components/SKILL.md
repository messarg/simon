---
name: components
description: Guide component creation with correct tier placement and design system usage
argument-hint: "[component-name]"
allowed-tools: Read, Write, Bash, Glob, Grep
---

# Components

Simon's React SPA (Vite, React 19, Tailwind v4). This file describes what exists in
`frontend/src`; check it before adding a component, and update it when you add one.

## Tiers

| Tier | Location | Rule |
|---|---|---|
| Primitives | `components/ui/` | Hand-written in the shadcn style on Radix (`button.tsx`, `input.tsx`, `sheet.tsx`). Change deliberately; everything builds on them |
| Shared | `components/shared/` | Reusable across features; exported from the barrel `@/components/shared` |
| Shell | `components/common/` | `AppShell` (status strip and bottom tabs below `lg`, a side rail for every role from `lg`) and `StatusStrip`. Publishes `--strip-h`, `--tabbar-h`, `--rail-w` — see the `responsive` skill |
| Feature | `features/<name>/` | Components that own one feature's data. **No cross-feature imports** |
| Route | `app/pages/` | Pages compose features — the till page composes `features/till` and `features/returns` |

Shared hooks that more than one feature needs (current shift, client settings) live in `app/`
(`app/shift.ts`, `app/settings.ts`), not inside a feature.

## Existing shared components

- `Keypad` — the large numeric keypad (§6.1). Edits a digit string; callers parse with `parseQty`.
  Editing rules are in `lib/keypad.ts`.
- `PinPad` — dots, keypad, the server's message in a reserved line (it never pushes the keypad),
  and a submit button that says what it does (`submitLabel`, «Հաստատել» by default). `label` is
  optional where the screen already asks for the PIN. Parent clears it by remounting with a new `key`.
- `QuantitySheet` — quantity on the keypad with a live line total; decimals only where the unit allows.
- `ReauthSheet` — admin PIN (+ reason) for one action; returns a single-use grant. Sits over the
  basket, never replaces it (§16.3). Blocked offline with a plain message.
- `MoneyText` — tabular, grouped money; `signed` for variances.
- `EmptyState` — icon, title, *teaching* hint (§8.4), optional action.
- `ActionBar` — a screen's one main action pinned above the tab bar and beside the rail
  (receiving, stocktake, the cash count). `width` matches the page's `max-w-*`.
- `Toggle` — an on/off row: label left and wrapping, switch on the right edge.
- `Avatar` — a person as a square tile: their photograph when `avatarUpdatedAt` is set, otherwise
  the first letter of their name. Fetched by `<img src>` (no auth header) because the sign-in
  tiles are drawn before anyone has signed in; a broken image falls back to the initial. It is
  `aria-hidden` — the name is always beside it.
- `ConfirmSheet`, `ScreenHelp`, `Barcode` — confirmation, contextual help, Code128 rendering.

## Design system — "calm utilitarian"

Tokens in `src/styles/theme.css` (`@theme inline`). Use names, never values:

- surfaces `bg-background`, `bg-card`, `bg-muted`, `border-border`
- action buttons `bg-action text-action-foreground` (#699870 for the owner; an employee's palette swaps in cornflower #668DC1, a manager's lavender #937EB9) — the `Button` default variant; don't paint one by hand
- brand `bg-primary` / `text-primary` (deep teal-green #14544A) for links, focus and the active destination, `bg-primary-soft` (leaf #DCEDC8), `text-accent-foreground`
- **four palettes**, set as `data-tier` on the root by `Palette` in `App.tsx`: the owner's dark rail (`owner`), a manager's lavender (`manager`), an employee's pastel blue (`employee`), and `guest` — dark navy with powder-blue accents — on the two signed-out screens. `guest` is chosen **by route** (`/sign-in`, `/setup`), not by session, because the wizard signs the owner in at Q2 and the screen must not change colour underneath him mid-setup. They swap tokens only — never branch a component on role for colour
- **`--action` is a recorded contrast exception** (white on it is 3.32:1, chosen by the owner) — don't "fix" it without asking. The `guest` palette is the one that takes no exception: dark navy text on a pastel fill, 7.4:1
- attention `bg-attention` (amber #F0A43C), `bg-attention-soft`, `text-attention-foreground` — offline, stale, recount
- `bg-destructive` (brick #6E1610) only for irreversible actions; **variance uses `text-money-neutral`**,
  never red or green (§6.6) — colour marks state (in stock, overdue), never the sign of a number
- **the `rounded-*` step carries meaning**, so choose it by what the thing is, not by how it looks:
  `xs` (6px) a checkbox or dot, `md` (10px) a control, `lg` (12px) a row, `xl` (16px) a card,
  `2xl` and up a sheet or panel. There is no cap — see ADR 0008
- **an avatar is a circle** (`components/shared/Avatar.tsx`, PRD §6.17). A face in a rounded
  rectangle reads as a product tile. `rounded-full` there is correct; elsewhere, prefer a step
- a card is `rounded-xl bg-card ring-1 ring-border shadow-sm` — the shadow is what lifts it off
  the tinted page, so a card without one looks unfinished
- sizes `h-touch` (48 px floor), `h-touch-lg`, `h-touch-xl`; `tabular` for every number
- text scale follows the text-size setting via `data-text-size` on `<html>`

Buttons wrap rather than overflow: Armenian runs 10–30% longer than English (§20.3).

## Patterns

- **Sheets, not dialogs.** `Sheet` is a bottom sheet on phones and a centred dialog on ≥ md.
  One without a `description` gets no `aria-describedby`. Only the top sheet is visible: a sheet
  opened from inside another (the customer picker over payment) hides the one beneath until it
  closes, so two headers never stack. Opening a sheet focuses the sheet, not its close button.
- **Buttons side by side must fit the narrowest phone (390 px) on one line.** When labels are long,
  stack them — main action full width first, the secondary one beneath — or put the icon over the
  label (`flex-col gap-1`), as the till's action row, the tenders and the shift's cash buttons do.
  Never a grid column sized `auto` beside `1fr`: the long label wraps and the pair looks broken.
- **Chips wrap, they don't squeeze.** A row of choices is `flex flex-wrap` with `flex-auto
  whitespace-nowrap` items; `flex-1` gives them a zero basis and shrinks them past their text.
- **Reset by remounting.** A sheet that must start empty each time is given a `key` by its parent
  and initialises state from props — not a `useEffect` that calls `setState` (oxlint flags it).
- **Gestures always have a visible alternative.** Basket lines: tap → keypad, swipe → remove with a
  5-second undo toast, long-press → price override. The keypad sheet offers the same actions.
- **Strings** come from `t()` (`i18n/t.ts`); no Armenian literals in components.
- **Camera scanning** (`features/till/CameraSheet.tsx`) lazy-imports `@zxing/browser` so it stays out
  of the till bundle.

## Checklist

- [ ] Correct tier; no cross-feature import
- [ ] Semantic tokens only; ≥ 48 px touch targets; numbers `tabular`
- [ ] Every string through `t()`
- [ ] Status never signalled by colour alone
- [ ] Icon-only buttons have `aria-label`
