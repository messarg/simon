---
name: responsive
description: Responsive design with Container Queries, fluid typography, cqi/cqb units, subgrid, intrinsic layouts, foldable devices, and mobile-first patterns for React applications. Use when building responsive layouts or container queries.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Responsive Patterns

Modern responsive design patterns using Container Queries, fluid typography, and mobile-first strategies for React applications (2026 best practices).

## Overview

- Building reusable components that adapt to their container
- Implementing fluid typography that scales smoothly
- Creating responsive layouts without media query overload
- Building design system components for multiple contexts
- Optimizing for variable container sizes (sidebars, modals, grids)

## Project layout pattern (Simon)

There is no page wrapper component. Each page sets its own column in `app/pages/*` or its feature:

```tsx
<div className="mx-auto w-full max-w-3xl space-y-4 p-4 md:p-6">
```

— `max-w-*` sized to the content (`lg` for a keypad screen, `2xl`–`3xl` for forms, `5xl` for
tables), `p-4` on a phone and `md:p-6` from `md` up. Master–detail screens (stock, debts,
suppliers, reports) are a fixed-width list column beside a `flex-1` detail pane instead; when
nothing is selected, the pane shows an `EmptyState`, not a blank area.

The shell (`components/common/AppShell.tsx`) switches layout at **`lg`**, not `md`: below it a
status strip on top and a tab bar at the bottom (phones *and* tablets); from `lg` a left rail for
every role. It publishes three CSS variables on its root, measured rather than assumed, because the
text-size setting and the safe area change them:

| Variable | Is |
|---|---|
| `--strip-h` | the status strip's height — use `top-(--strip-h)` for a sticky header inside a page |
| `--tabbar-h` | the tab bar's height, `0px` from `lg` — use `bottom-(--tabbar-h)` for a bottom bar |
| `--rail-w` | the rail's width, `0px` below `lg` — use `left-(--rail-w)` for a fixed bar |

Never hard-code `bottom-16`, `md:left-60` or `top-0` for these: a bar placed by breakpoint drifts
out of step with the shell. A screen's single main action at the bottom goes in
`<ActionBar width="…">` (`components/shared`), which places itself with these variables, reserves
its own measured height in the flow, and pads to match `p-4 md:p-6`.

Two padding utilities on one element fight: `safe-bottom` and `pb-5` both set `padding-bottom`, and
which wins depends on utility order. Combine them in one value instead:
`pb-[max(1.25rem,env(safe-area-inset-bottom))]`.

Components that appear both full-width and in a narrow side panel (the till's quick tiles) size
their columns with a container query (`@container` + `@md:grid-cols-3`), not a viewport breakpoint.

## Core Concepts

### Container Queries vs Media Queries

| Feature | Media Queries | Container Queries |
|---------|---------------|-------------------|
| Responds to | Viewport size | Container size |
| Component reuse | Context-dependent | Truly portable |
| Browser support | Universal | Baseline 2023+ |
| Use case | Page layouts | Component layouts |

## Modern CSS Layout

> Load `Read("${CLAUDE_SKILL_DIR}/rules/css-subgrid.md")` for CSS Subgrid patterns: nested grid alignment, card layouts with aligned titles/content/actions, two-dimensional subgrid.

> Load `Read("${CLAUDE_SKILL_DIR}/rules/css-intrinsic-responsive.md")` for intrinsically responsive layouts: auto-fit/minmax grids, clamp() for fluid everything, container queries for component logic, zero media query patterns.

> Load `Read("${CLAUDE_SKILL_DIR}/rules/responsive-foldables.md")` for foldable/multi-screen device support: env(safe-area-inset-*), viewport segment queries, dual-screen layouts, progressive enhancement.

**Key patterns covered:** CSS Subgrid alignment, intrinsic responsive grids (auto-fit + minmax), fluid clamp() scales, foldable device layouts, safe area insets, viewport segment queries.

## CSS Patterns

> Load `Read("${CLAUDE_SKILL_DIR}/rules/css-patterns.md")` for complete CSS examples: container queries, cqi/cqb units, fluid typography with clamp(), mobile-first breakpoints, CSS Grid patterns, and scroll-queries.

**Key patterns covered:** Container Query basics, Container Query Units (cqi/cqb), Fluid Typography with clamp(), Container-Based Fluid Typography, Mobile-First Breakpoints, CSS Grid Responsive Patterns, Container Scroll-Queries (Chrome 126+).

## React Patterns

> Load `Read("${CLAUDE_SKILL_DIR}/rules/react-patterns.md")` for complete React examples: ResponsiveCard component, Tailwind container queries, useContainerQuery hook, and responsive images.

**Key patterns covered:** Responsive Component with Container Queries, Tailwind CSS Container Queries, useContainerQuery Hook, Responsive Images Pattern.

## Accessibility Considerations

```css
/* IMPORTANT: Always include rem in fluid typography */
/* This ensures user font preferences are respected */

/* ❌ WRONG: Viewport-only ignores user preferences */
font-size: 5vw;

/* ✅ CORRECT: Include rem to respect user settings */
font-size: clamp(1rem, 0.5rem + 2vw, 2rem);

/* User zooming must still work */
@media (min-width: 768px) {
  /* Use em/rem, not px, for breakpoints in ideal world */
  /* (browsers still use px, but consider user zoom) */
}
```

## Anti-Patterns (FORBIDDEN)

```css
/* ❌ NEVER: Use only viewport units for text */
.title {
  font-size: 5vw; /* Ignores user font preferences! */
}

/* ❌ NEVER: Use cqw/cqh (use cqi/cqb instead) */
.card {
  padding: 5cqw; /* cqw = container width, not logical */
}
/* ✅ CORRECT: Use logical units */
.card {
  padding: 5cqi; /* Container inline = logical direction */
}

/* ❌ NEVER: Container queries without container-type */
@container (min-width: 400px) {
  /* Won't work without container-type on parent! */
}

/* ❌ NEVER: Desktop-first media queries */
.element {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
}
@media (max-width: 768px) {
  .element {
    grid-template-columns: 1fr; /* Overriding = more CSS */
  }
}

/* ❌ NEVER: Fixed pixel breakpoints for text */
@media (min-width: 768px) {
  body { font-size: 18px; } /* Use rem! */
}

/* ❌ NEVER: Over-nesting container queries */
@container a {
  @container b {
    @container c {
      /* Too complex, reconsider architecture */
    }
  }
}
```

## Browser Support

| Feature | Chrome | Safari | Firefox | Edge |
|---------|--------|--------|---------|------|
| Container Size Queries | 105+ | 16+ | 110+ | 105+ |
| Container Style Queries | 111+ | ❌ | ❌ | 111+ |
| Container Scroll-State | 126+ | ❌ | ❌ | 126+ |
| cqi/cqb units | 105+ | 16+ | 110+ | 105+ |
| clamp() | 79+ | 13.1+ | 75+ | 79+ |
| Subgrid | 117+ | 16+ | 71+ | 117+ |

## Rules

Each category has individual rule files in `rules/` loaded on-demand:

| Category | Rule | Impact | Key Pattern |
|----------|------|--------|-------------|
| Modern CSS Layout | `rules/css-subgrid.md` | HIGH | CSS Subgrid for nested grid alignment, card layouts |
| Modern CSS Layout | `rules/css-intrinsic-responsive.md` | HIGH | Intrinsic responsive layouts, auto-fit/minmax, clamp(), zero breakpoints |
| Modern CSS Layout | `rules/responsive-foldables.md` | MEDIUM | Foldable devices, safe area insets, viewport segments |
| CSS | `rules/css-patterns.md` | HIGH | Container queries, cqi/cqb, fluid typography, grid, scroll-queries |
| React | `rules/react-patterns.md` | HIGH | Container query components, Tailwind, useContainerQuery, responsive images |
| PWA | `rules/pwa-service-worker.md` | HIGH | Workbox caching strategies, VitePWA, update management |
| PWA | `rules/pwa-offline.md` | HIGH | Offline hooks, background sync, install prompts |
| Animation | `rules/animation-motion.md` | HIGH | Motion presets, AnimatePresence, View Transitions |
| Animation | `rules/animation-scroll.md` | MEDIUM | CSS scroll-driven animations, parallax, progressive enhancement |
| Touch & Mobile | `rules/touch-interaction.md` | HIGH | Touch targets (44px min), thumb zones, pinch-to-zoom, safe areas, gestures |

**Total: 10 rules across 6 categories**

## Key Decisions

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| Query type | Media queries | Container queries | **Container** for components, **Media** for layout |
| Container units | cqw/cqh | cqi/cqb | **cqi/cqb** (logical, i18n-ready) |
| Fluid type base | vw only | rem + vw | **rem + vw** (accessibility) |
| Mobile-first | Yes | Desktop-first | **Mobile-first** (less CSS, progressive) |
| Grid pattern | auto-fit | auto-fill | **auto-fit** for cards, **auto-fill** for icons |

## Related Skills

- `tailwind-css-patterns` - Utility-first responsive styling, spacing, layout
- `tailwind-audit` - Auditing responsive/spacing/token compliance
- `perf` - CLS, responsive images, and bundle/latency budgets
- `a11y` - Touch targets, focus management, `prefers-reduced-motion`

## Capability Details

### container-queries
**Keywords**: @container, container-type, inline-size, container-name
**Solves**: Component-level responsive design

### fluid-typography
**Keywords**: clamp(), fluid, vw, rem, scale, typography
**Solves**: Smooth font scaling without breakpoints

### responsive-images
**Keywords**: srcset, sizes, picture, art direction
**Solves**: Responsive images for different viewports

### mobile-first-strategy
**Keywords**: min-width, mobile, progressive, breakpoints
**Solves**: Efficient responsive CSS architecture

### grid-flexbox-patterns
**Keywords**: auto-fit, auto-fill, subgrid, minmax
**Solves**: Responsive grid and flexbox layouts

### container-units
**Keywords**: cqi, cqb, container width, container height
**Solves**: Sizing relative to container dimensions

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:
| File | Content |
|------|---------|
| `container-queries.md` | Container query patterns |
| `fluid-typography.md` | Accessible fluid type scales |
