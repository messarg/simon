---
name: a11y
description: Accessibility patterns for Simon's React SPA — ARIA roles, semantic HTML, keyboard navigation, focus management, screen reader UX, color contrast, form a11y, dialog/modal traps, landmarks, skip links, prefers-reduced-motion, and WCAG 2.2 AA compliance. Audit existing components and bake a11y into new ones.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Accessibility Skill

Accessibility is non-negotiable in a consumer app. WCAG 2.2 AA is the floor, not the ceiling. Most a11y bugs are cheap to prevent, expensive to retrofit.

## The measurement stack

| Tool | Purpose |
|---|---|
| **axe DevTools** (Chrome/Firefox extension) | One-shot audit of a rendered page; categorizes by severity |
| **Chrome DevTools Issues panel** | Built-in a11y warnings (color contrast, ARIA misuse) |
| **Keyboard test** | Tab through every interactive element; can you reach + activate everything without a mouse? |
| **Screen reader** | macOS VoiceOver (Cmd+F5), NVDA on Windows. Walk a flow. |
| **Lighthouse Accessibility audit** | Scored summary; useful as a regression check |
| **oxlint a11y rules** | Enabled via `.oxlintrc.json`; catches static issues at lint time |

Always start a feature with: "How does this work with keyboard only? How does VoiceOver announce it?"

## Core principles

### 1. Semantic HTML first

Use `<button>` for actions, `<a>` for navigation, `<nav>` / `<main>` / `<header>` / `<footer>` / `<section>` / `<article>` for structure. ARIA is the *patch* — semantic HTML is the *fix*. Forbidden:
- `<div onClick={...}>` — not focusable, not keyboard-activatable, not announced
- `<span role="button">` — only acceptable if you also handle Tab, Enter, Space, focus styles, and disabled states (just use `<button>`)

### 2. Every interactive element has

- A visible name (text content or `aria-label` / `aria-labelledby`)
- A visible focus indicator (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` — already in shadcn primitives)
  - ⚠️ **Except when the control is `sr-only`.** This codebase draws several controls as a styled `<label>` wrapping a visually-hidden `<input>` / `RadioGroupItem` (planning option cells, `ChoiceList`, the family-share dialog). `sr-only` clips the real control to 1×1px, so the browser paints its ring *inside that clip* and nothing appears on screen. Put the ring on the **wrapper**: `has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring` (use `-outline-offset-2` when the wrapper sits inside an `overflow-hidden` list). `outline` rather than `ring` so it never collides with a selected row's `ring-1`.
  - A tri-state checkbox must also set the `indeterminate` **DOM property** via `ref` — React does not render it as an attribute, and without it a "select all" showing a dash announces as *"not checked"*.
- A keyboard handler (Enter + Space for buttons; arrows for menus/listboxes)
- A disabled state visible AND announced (`disabled` attribute, not `aria-disabled` unless you have a reason)

### 3. Color contrast

- Body text: **4.5:1** against background (WCAG AA)
- Large text (18pt+ or 14pt+ bold): **3:1**
- UI components (button borders, form inputs): **3:1**
- Decorative elements / disabled states: no requirement, but consider users who can't tell

Test with axe DevTools. The semantic tokens in `src/styles/theme.css` (hex values) should pass — verify after any token edit.

### 4. Focus management

- **Modals/dialogs:** trap focus inside (shadcn `<Dialog>` does this via Radix). Restore focus to the trigger on close.
- **Route changes:** the SPA router doesn't move focus on navigation. Move focus to `<main>` or the page heading after route changes — improves SR UX significantly.
- **Errors:** when a form fails, move focus to the first invalid field. `form.setFocus(fieldName)` from react-hook-form.
- **Skip link:** already implemented — `DashboardShell` (`src/components/common/DashboardShell.tsx`) renders a "Skip to main content" link (`href="#main-content"`) as the first focusable element, targeting `<main id="main-content">`. Verify it's present and still targets `<main>` when editing the shell; don't add a duplicate.

### 5. ARIA — the rules

1. **No ARIA is better than bad ARIA.** A wrong role breaks SR; a missing role degrades it gracefully.
2. **`role="button"` requires keyboard handlers.** Just use `<button>`.
3. **`aria-label` overrides text content for SRs.** Don't use it on elements with visible text unless it's a deliberate override.
4. **`aria-hidden="true"`** removes from a11y tree — never put it on focusable elements.
5. **`aria-live`** for dynamic updates (toast notifications, error summaries). Sonner toasts already announce; verify on custom UI.
6. **Form field associations:** `<label htmlFor>` + matching `<input id>`. The project's shared `<FormField>` (`src/components/shared/FormField.tsx`) handles this — don't bypass it.

## Component patterns

| Pattern | Implementation |
|---|---|
| Button | `<Button>` from `components/ui/button` (Radix Slot + `cn`) — has focus ring + disabled state baked in |
| Icon-only button | Add `aria-label="Close dialog"` — icons aren't announced |
| Link vs button | Navigates → `<a>` / `<Link>`. Performs action → `<button>`. Never `<a>` with `onClick` and no href. |
| Form field | `<FormField>` from `components/shared` — labels, descriptions, errors all wired |
| Required field | `aria-required="true"` on input, asterisk in label, also describe in `<FormDescription>` |
| Error message | `aria-describedby` pointing at the message — `<FormMessage>` already wires this |
| Dialog/Modal | `<Dialog>` from `components/ui/dialog` (Radix) — focus trap + Escape + initial focus |
| Tabs | `<Tabs>` from `components/ui/tabs` (Radix) — arrow keys + ARIA roles |
| Menu/Dropdown | `<DropdownMenu>` from `components/ui/dropdown-menu` (Radix) — arrow keys + Escape + focus |
| Tooltip | `<Tooltip>` from `components/ui/tooltip` — visible on focus, not just hover |
| Toast | `<Toaster>` from sonner — already `role="status"` for non-critical, `role="alert"` for errors |
| Skip link | Already in `DashboardShell` — `<a href="#main-content">Skip to main content</a>` first in the shell, targeting `<main id="main-content">`; hidden off-screen until focused. Reuse it, don't duplicate. |
| Loading state | `<Skeleton>` — add `aria-busy="true"` on the container, `aria-label="Loading"` |
| Empty state | `<EmptyState>` — clear text, not just an illustration |

## Forms a11y checklist

- [ ] Every input has a `<label>` (via `<FormField>`)
- [ ] Required fields marked in both visual + ARIA
- [ ] Errors associated via `aria-describedby` (auto via `<FormField>`)
- [ ] On submit failure, focus moves to first invalid field
- [ ] Field hints use `<FormDescription>` (not placeholder)
- [ ] Placeholders never replace labels
- [ ] Autocomplete attributes set (`autocomplete="email"` / `"current-password"` / `"name"` / `"tel"` / etc.)
- [ ] Submit button is `<button type="submit">`, not `<div role="button">`
- [ ] Loading state announces ("Saving…") via `aria-live` or sonner toast

## Keyboard navigation checklist

For every new page:
- [ ] Tab reaches every interactive element in logical order
- [ ] Shift+Tab works in reverse
- [ ] Enter activates buttons + links
- [ ] Space activates buttons (not links)
- [ ] Escape closes overlays (dialogs, menus, popovers)
- [ ] Arrow keys work where expected (tabs, menus, listboxes, radio groups)
- [ ] No focus trap *outside* a modal — focus shouldn't get stuck in a custom widget
- [ ] Focus visible at every step (the `ring` token)

## Reduced motion

Some users have vestibular disorders. Respect `prefers-reduced-motion: reduce`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Tailwind has the `motion-safe:` / `motion-reduce:` variants — prefer over global overrides for specific animations. The `motion` skill has more.

## Audit recipes

### Static audit

```bash
# Click handlers on non-button elements (forbidden)
grep -rn 'onClick' src/ --include='*.tsx' | grep -v '<button\|<Button\|<a \|<Link'

# Missing alt on Image
grep -rn '<img' src/ -A 3 | grep -B 3 -L 'alt='

# Icon-only buttons without aria-label
# Manual: open buttons that contain only <Icon />, verify aria-label
```

### Runtime audit (axe DevTools)

1. Open page in dev.
2. Open DevTools → axe DevTools tab → "Scan ALL of my page".
3. Group findings by severity (Critical → Serious → Moderate → Minor).
4. Fix Critical + Serious before shipping.

### Keyboard audit

Unplug your mouse. Walk the whole feature. Every interaction must be possible.

### Screen reader audit

macOS: Cmd+F5. Walk a key flow (login, create task, open dialog). Note:
- Are headings announced in order (h1 → h2 → h3)?
- Are buttons announced with their action ("Save changes button")?
- Are errors announced?
- Are dynamic updates (toasts, modal openings) announced?

## Anti-patterns

1. **`outline: none` without replacement** — strips focus indicator. Always provide one.
2. **Color as sole signal** — error states need text + icon, not just red.
3. **Tooltip-only labels** — invisible to keyboard users on hover-only interactions.
4. **Auto-playing media with sound** — disorienting; provide pause + caption.
5. **Heading levels that skip** — `<h1>` then `<h4>` confuses SR users.
6. **Disabled buttons that are unfocusable AND give no feedback** — user can't discover why an action is unavailable. Prefer `aria-disabled` + handle click with a message, OR keep enabled and show a validation message.
7. **Form errors only in toast** — user can't review or re-find them. Show inline AND optionally toast.
8. **Implementing custom focus rings inconsistently** — use the design token (`focus-visible:ring-ring`).

## WCAG 2.2 AA quick reference

The criteria most likely to bite you:
- **1.4.3 Contrast (Minimum)** — 4.5:1 text, 3:1 large
- **1.4.11 Non-text Contrast** — 3:1 for UI components and graphical objects
- **2.1.1 Keyboard** — everything reachable + operable
- **2.4.3 Focus Order** — logical sequence
- **2.4.7 Focus Visible** — focus indicator always visible
- **2.4.11 Focus Not Obscured (Min)** — sticky headers shouldn't hide focused element (new in 2.2)
- **3.3.7 Redundant Entry** — don't make users re-enter info already submitted (new in 2.2)
- **3.3.8 Accessible Authentication (Min)** — don't require cognitive function tests (e.g. transcribe text) for login (new in 2.2)
- **4.1.2 Name, Role, Value** — every UI control programmatically determinable
