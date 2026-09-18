---
name: ui-audit
description: Single consolidated design-system audit for Simon — semantic colour tokens, Tailwind utility hygiene, icon and image usage, and touch/POS ergonomics. Replaces the separate color-audit, icon-audit, tailwind-audit, and ui-validate skills. Use when reviewing UI for design-system compliance or before shipping a screen.
allowed-tools: Read, Glob, Grep, Bash
---

# UI audit

One pass, four dimensions. Run it on a screen before calling it done.

## 1. Colour tokens

Semantic classes only. Raw palette values and arbitrary hex defeat theming and make a
later palette change a repo-wide rewrite.

```bash
# arbitrary hex in components
grep -rnE '(text|bg|border|fill|stroke)-\[#' frontend/src --include=*.tsx
# raw Tailwind palette
grep -rnE '(text|bg|border)-(gray|slate|zinc|red|green|blue|amber|yellow)-[0-9]{2,3}' frontend/src --include=*.tsx
# inline style colours
grep -rn 'style={{[^}]*color' frontend/src --include=*.tsx
```

Allowed: `bg-primary`, `text-foreground`, `text-muted-foreground`, `bg-card`, `bg-muted`,
`border-border`, `bg-destructive`, and the project token family. Token **values** live in one
theme file; components reference names only.

**POS-specific:** status colour must never be the *only* signal. Stock traffic lights
(green/yellow/red) and the offline banner need an icon or text label too — ~8% of men have a
colour-vision deficiency, and a hardware-store owner is disproportionately likely to be one.

## 2. Tailwind hygiene

```bash
grep -rnE 'className="[^"]{160,}"' frontend/src --include=*.tsx   # extract a component
grep -rn '!important\|!\[' frontend/src --include=*.tsx           # specificity escape hatch
grep -rnE '\b(w|h|p|m|gap)-\[[0-9]' frontend/src --include=*.tsx  # arbitrary sizing
grep -rn 'rounded-full' frontend/src --include=*.tsx              # should be an avatar or a pill
grep -rn 'bg-card' frontend/src --include=*.tsx | grep -v shadow   # a card that does not lift
```

Corners are no longer capped (ADR 0008), so **the step name is now a choice that carries meaning**:
`xs` (6px) a checkbox or dot, `md` (10px) a control, `lg` (12px) a row, `xl` (16px) a card, `2xl`
and up a sheet or panel. A card at `rounded-md`, or a checkbox at `rounded-xl`, is the finding.

**`rounded-full` is legitimate on exactly two things**: the avatar
(`components/shared/Avatar.tsx`, PRD §6.17 and §26.2 — a face in a rounded rectangle reads as a
product tile) and a shape with no content to square off, such as the sheet's drag handle. The grep
above hits both; anything else it finds is a panel or a control that should carry a step instead.

- Long class strings are a component boundary, not a formatting problem.
- Conditional classes go through the project's `cn()`; never string-concatenate, which breaks
  Tailwind's static extraction and silently drops the class from the bundle.
- Arbitrary values are acceptable for genuine one-offs, suspicious in threes.
- Spacing comes from the scale. `p-[13px]` means the design or the scale is wrong.

## 3. Icons & images

```bash
grep -rn '<img ' frontend/src --include=*.tsx        # prefer the project image component
grep -rn '<svg' frontend/src --include=*.tsx | head  # inline SVG that should be an icon
```

- One icon set, consistently sized via tokens — not per-instance `w-[18px]`.
- **Decorative** icons: `aria-hidden="true"`. **Meaningful** icons: an accessible label. An
  icon-only button always needs `aria-label`.
- Every raster asset lives under `public/assets/<subfolder>/`, never at `public/` root or
  inside `src/`.
- Assets ship with the app and load from the LAN — no external CDN. A self-hosted store may
  have no internet at all; an icon font or remote sprite sheet will simply not render.

## 4. Touch & POS ergonomics

The dimension a generic audit misses, and the one that decides adoption.

- **Touch targets ≥ 48×48 px** for anything a worker taps during a sale. Checkout keypad and
  confirm buttons should be considerably larger.
- **Spacing between destructive and routine actions.** "Void line" must not sit next to
  "add quantity" — a mis-tap during a queue costs money and trust.
- **Readable in poor light**, at arm's length, on a cheap phone with a scratched screen.
  Body text ≥ 16 px; totals much larger.
- **One-handed reach** — primary actions in the lower half of the screen, not the top bar.
- **No hover-only affordances.** Nothing may require a mouse.
- **No blocking modal for a background problem** (sync, printer). The till must keep selling.
- Confirm-before-destructive on void, discount above threshold, and shift close.

## Report format

Group by dimension, cite `file:line`, state the fix. Distinguish:

- **Violation** — breaks a documented rule; fix it.
- **Smell** — likely wrong, needs a judgement call.

Do not auto-fix during an audit unless asked; report first, so the user decides scope.

## Checklist

- [ ] No arbitrary hex or raw palette classes
- [ ] Colour never the sole signal
- [ ] `cn()` for conditional classes
- [ ] Icon-only buttons labelled; decorative icons hidden
- [ ] Assets local, under `public/assets/`
- [ ] Touch targets ≥ 48 px; destructive actions separated
- [ ] No hover-only interaction, no blocking modals for background failures
