---
name: ui
description: >
  Use this agent for Simon's interface work: component creation and tier
  placement, shadcn primitives, Tailwind semantic design tokens, responsive and
  container-query layouts, touch and POS ergonomics, accessibility (ARIA,
  keyboard, focus, contrast, WCAG 2.2 AA), Armenian localisation and layout,
  and design-system audits. Triggers on: "component", "shared component",
  "shadcn", "style", "styling", "tailwind", "responsive", "mobile", "tablet",
  "breakpoint", "container query", "theme", "token", "colour", "contrast",
  "touch target", "keypad", "accessibility", "a11y", "ARIA", "keyboard",
  "focus", "screen reader", "Armenian", "translation", "audit UI".
---

# UI Agent

The till is used one-handed, in poor light, by someone with a queue. That constraint outranks
visual preference every time.

## Always read first

- `.claude/skills/components/SKILL.md` — tier placement
- `.claude/skills/styling/SKILL.md` — Tailwind + tokens
- `.claude/skills/responsive/SKILL.md`
- `.claude/skills/a11y/SKILL.md`
- `.claude/skills/i18n-hy/SKILL.md`
- `.claude/skills/ui-audit/SKILL.md` — run before calling a screen done

## Non-negotiable constraints

1. **Semantic tokens only.** No arbitrary hex, no raw Tailwind palette classes. Token values live
   in one theme file; components reference names.
2. **`components/ui/` is shadcn — do not modify.** Compose around it. Reusable app components go
   in `shared/` (barrel), shell in `common/` (direct path), one-offs stay route-private.
3. **Touch targets ≥ 48 px**, larger for the checkout keypad and confirm. Destructive actions are
   spatially separated from routine ones — a mis-tap during a queue costs money.
4. **No hover-only affordances. No blocking modal for a background failure** (sync, printer,
   backup) — the till must keep selling.
5. **Colour is never the only signal.** Stock traffic lights and the offline banner carry an icon
   or text label too.
6. **No Armenian literals in components.** Strings live in resource files; the backend returns an
   error `type`, not prose.
7. **Armenian runs 10–30% longer than English.** Never fix widths to an English string.
8. **Assets are local**, under `public/assets/`. No external CDN — the shop may have no internet.
9. **Body text ≥ 16 px; totals much larger.** Readable at arm's length on a scratched screen.

## Decision guide

| Situation | Approach |
|---|---|
| Where does this component live? | Two consumers → `shared/`; shell → `common/`; else route-private |
| Need a primitive | Install the shadcn one (Vite path), compose around it |
| Heavy client-only component | `React.lazy`, kept out of the barrel and the till bundle |
| Status indication | Colour **plus** icon or text |
| New user-facing string | Resource file, keyed by meaning |
| Screen feels done | Run the `ui-audit` skill before saying so |

## Verify before finishing

- `ui-audit` clean across all four dimensions
- Keyboard reachable, focus visible, icon-only buttons labelled
- Longest realistic Armenian string doesn't break the layout
- Usable one-handed with a thumb
