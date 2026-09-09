---
name: components
description: Guide component creation with correct tier placement and design system usage
argument-hint: "[component-name]"
allowed-tools: Read, Write, Bash, Glob, Grep
---

# Component Design

Design and implement UI components following this consumer app's conventions.

## Tier Decision

| Tier | Location | When | Import Style |
|------|----------|------|-------------|
| `ui/` | `components/ui/` | Shadcn primitive (DO NOT modify) | Direct path |
| `shared/` | `components/shared/` | Reusable across pages | Barrel (`@/components/shared`) |
| `common/` | `components/common/` | Layout/shell | Direct path |
| Route-private | `app/<route>/_components/` | Page-specific | Local |

## Existing Shared Components

Check before creating — everything exported from `@/components/shared` (`src/components/shared/index.ts`):

- `FormField` (+ `FormFieldProps`, `baseControl`) — Discriminated union by `kind`: text, email, password, textarea, select (checkbox/switch use a raw `<Controller>` + shadcn `<Checkbox>`)
- `ConfirmDialog` — Confirmation with action
- `ConsentDeletionDialog` (+ `ConsentDeletionSectionRow`) — Consent-withdrawal / deletion confirmation
- `QuantityField` / `MoneyField` — integer-backed touch keypads (see the `money` skill)
- `DatePicker` (+ `DatePickerProps`) — Calendar date picker
- `PhoneField` (+ `formatPhoneNumber`) — E.164 phone input with country select; the formatter renders a stored number the way a person reads it
- `PhoneTextField` — Phone input for fields the backend types `ShortText`; stores the *display* string, not E.164
- `EmailField` (+ `EmailDomainSuggestions`, `SuggestEmailDomainsContext`, `emailDomainSuggestions`, `applyEmailDomain`, `EMAIL_DOMAINS`) — Email input with domain-completion chips. `FormField kind="email"` renders the chips automatically; provide the context as `false` to suppress them (`AuthCard` does)
- `OptionFlag` (+ `countryForOption`) — Country flag for a schema option that names a country
- `MultiSelectFilter` (+ `MultiSelectOption`) — Multi-select filter control
- `EmptyState` — Empty-state placeholder
- `ComingSoonPage` — Placeholder page for unbuilt routes
- `RequestAccessAction` — Access-request control (promoted out of `onboarding/_components`)
- `ProvideConsentButton` / `GrantConsentDialog` — Consent capture at the gate
- `PasswordStrengthMeter` (+ `passwordScore`) / `PasswordRequirementsChecklist` — Password UX
- `useMeasuredHeight` — Hook for measuring element height

> Heavy, client-only components (the **camera barcode scanner**, any charting used by the owner dashboard) are **deliberately not** barrel-exported: they are reached through `React.lazy` so their dependency graph stays out of the till bundle. Import those by direct path; everything else in `shared/` goes through the barrel. See the `perf` skill.

## Design System

### Colors (semantic design tokens)

```tsx
text-foreground          // Primary text
text-muted-foreground    // Secondary text
bg-background            // Page bg
bg-card                  // Card surface
bg-muted                 // Subtle bg
bg-primary text-primary-foreground    // Primary buttons
bg-destructive text-destructive-foreground  // Danger
```

### Typography (Google Sans for sans + headings, Geist Mono for mono — applied globally)

```tsx
text-2xl font-semibold   // Page title
text-lg font-medium      // Section heading
text-sm text-muted-foreground  // Description
```

### Layout Patterns

```tsx
// Card
<div className="rounded-lg border bg-card p-6">{/* ... */}</div>

// Page layout
<div className="space-y-6">
  <PageHeader title="Title" description="Desc" />
  {/* Content */}
</div>
```

### Tailwind classnames — prefer builtins over arbitrary values

The spacing scale is **`0.25rem` = 4px per step**. For any pixel value that's a multiple of 4, use the scale class — never the arbitrary form.

| Wrong | Right |
|---|---|
| `min-h-[140px]` | `min-h-35` (140 ÷ 4 = 35) |
| `h-[40px]` | `h-10` |
| `w-[200px]` | `w-50` |
| `p-[16px]` `gap-[8px]` `mt-[24px]` | `p-4` `gap-2` `mt-6` |
| `text-[14px]` `text-[16px]` `text-[18px]` | `text-sm` `text-base` `text-lg` |
| `rounded-[8px]` `rounded-[12px]` | `rounded-lg` `rounded-xl` |
| `border-[1px]` | `border` |

Arbitrary values (`min-h-[140px]`, `text-[0.65rem]`) are an escape hatch for *off-scale* numbers copied from a prototype — not the default. If `Npx ÷ 4` is a whole number, the builtin exists. Same applies to color tokens with `@theme inline` aliases — use `bg-card`, not `bg-[var(--card)]`.

See `.claude/skills/tailwind-audit/SKILL.md` for the full taxonomy.

For form patterns, see `.claude/skills/forms/SKILL.md`.

## Component Template

```tsx
"use client";

import { Button } from "@/components/ui/button";

interface MyComponentProps {
  title: string;
  onAction?: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      {onAction && (
        <Button onClick={onAction} size="sm">Action</Button>
      )}
    </div>
  );
}
```

## State

- Local UI → `useState`
- Forms → `react-hook-form` + `zodResolver`
- Server data → React Query hooks from `features/`
- No Zustand, no Redux

## After Creating

1. Add to `shared/index.ts` barrel if shared component
2. `npm run lint` (oxlint)
3. `npm run build`
