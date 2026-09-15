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
| Shell | `components/common/` | `AppShell` (bottom tabs on phones, side rail for the owner on ≥ md) and `StatusStrip` |
| Feature | `features/<name>/` | Components that own one feature's data. **No cross-feature imports** |
| Route | `app/pages/` | Pages compose features — the till page composes `features/till` and `features/returns` |

Shared hooks that more than one feature needs (current shift, client settings) live in `app/`
(`app/shift.ts`, `app/settings.ts`), not inside a feature.

## Existing shared components

- `Keypad` — the large numeric keypad (§6.1). Edits a digit string; callers parse with `parseQty`.
  Editing rules are in `lib/keypad.ts`.
- `PinPad` — dots, keypad, server message. Parent clears it by remounting with a new `key`.
- `QuantitySheet` — quantity on the keypad with a live line total; decimals only where the unit allows.
- `ReauthSheet` — admin PIN (+ reason) for one action; returns a single-use grant. Sits over the
  basket, never replaces it (§16.3). Blocked offline with a plain message.
- `MoneyText` — tabular, grouped money; `signed` for variances.
- `EmptyState` — icon, title, *teaching* hint (§8.4), optional action.

## Design system — "calm utilitarian"

Tokens in `src/styles/theme.css` (`@theme inline`). Use names, never values:

- surfaces `bg-background`, `bg-card`, `bg-muted`, `border-border`
- action `bg-primary` (teal), `bg-primary-soft`, `text-accent-foreground`
- attention `bg-attention`, `bg-attention-soft`, `text-attention-foreground` (amber — offline, stale, recount)
- `bg-destructive` only for irreversible actions; **variance uses `text-money-neutral`**, never red (§6.6)
- sizes `h-touch` (48 px floor), `h-touch-lg`, `h-touch-xl`; `tabular` for every number
- text scale follows the text-size setting via `data-text-size` on `<html>`

Buttons wrap rather than overflow: Armenian runs 10–30% longer than English (§20.3).

## Patterns

- **Sheets, not dialogs.** `Sheet` is a bottom sheet on phones and a centred dialog on ≥ md.
  One without a `description` gets no `aria-describedby`.
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
