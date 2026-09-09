---
name: forms
description: Build forms using react-hook-form + Zod + FormField covering all field types, create/edit patterns, mutations, and advanced scenarios
argument-hint: "[form-name or scenario]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Forms

Build all forms using `react-hook-form` + `zodResolver` + the shared `FormField` component. All mutations go through React Query hooks → service. Critical mutations (sale, return, repayment) go through the outbox — see the `offline-sync` skill.

---

## Quick Reference

| Layer | Tool |
|-------|------|
| Schema | Zod (`src/features/<name>/schema.ts`) |
| State | `useForm` + `zodResolver` |
| Fields | `<FormField>` from `@/components/shared` |
| Mutations | `useMutation` hook from `src/features/<name>/hooks.ts` |
| Feedback | `toast.success/error` from `sonner` (inside hooks, NOT pages) |

---

## 1. Zod Schema Patterns

### Field type conventions

```typescript
// Text
name: z.string().min(1, "Required").max(255)

// Optional text
description: z.string().max(1000).nullable().optional()

// Number — use z.coerce only for API-facing schemas; use plain z.number() for form schemas
year: z.coerce.number().int().nullable().optional()

// Boolean (checkbox/switch) — always provide .default()
isActive: z.boolean().default(false)

// Enum select
status: z.enum(["Active", "Inactive", "Draft"])

// Optional enum
category: z.enum(["A", "B", "C"]).nullable().optional()

// URL
url: z.string().url("Invalid URL").max(2000)

// Email
email: z.string().min(1, "Required").email("Invalid email")

// Tags array
labels: z.array(z.string().max(50)).max(20).default([])
```

### Cross-field validation (`.refine`)

```typescript
export const changePasswordSchema = z.object({
  password: z.string().min(8, "At least 8 characters"),
  confirmPassword: z.string().min(1, "Required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],   // attaches error to the second field
});
```

### Type exports — always at bottom

```typescript
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
```

### Enums — use the `z.enum` pattern from `src/types/enums.ts`

Shared enums are declared as a Zod schema + inferred type (no `as const` arrays, no `*Labels` records):

```typescript
// enums.ts
export const ItemStatus = z.enum(["Active", "Draft", "Archived"]);
export type ItemStatus = z.infer<typeof ItemStatus>;

// schema.ts — reuse the shared schema directly
import { ItemStatus } from "@/types/enums";
status: ItemStatus                     // already a z.enum(...)

// or, for a feature-local enum, inline it
status: z.enum(["Active", "Draft", "Archived"])
```

To build `<FormField kind="select">` options, map over `ItemStatus.options` (the enum's string members):

```typescript
options={ItemStatus.options.map((v) => ({ value: v, label: v }))}
```

---

## 2. FormField — Complete Field Type Reference

Import: `import { FormField } from "@/components/shared";`

Always pass `form={form}` (the whole `UseFormReturn`) and a typed `name`. The component wires up react-hook-form's `Controller` internally via `form.control` — no manual `register()` and no `control=` prop. The field variant is chosen by the discriminant **`kind`**, not `type`.

There are exactly **five** kinds: `text`, `email`, `password`, `textarea`, `select`. There is **no** `number`, `checkbox`, `switch`, `tags`, or `richText` kind — see the escape hatch below for booleans/toggles.

### text / email

```tsx
<FormField form={form} name="title" kind="text" label="Title" placeholder="Enter title" />

<FormField form={form} name="email" kind="email" label="Email" />
```

`kind` defaults to `"text"`, so `kind` may be omitted for a plain text field. A `type` prop (`"text" | "email"`) is also accepted for the input's HTML type; prefer `kind` for consistency.

**An email field also renders domain shortcuts.** Whenever `kind` (or `type`) resolves to `"email"` and the field is not disabled, `FormField` renders `<EmailDomainSuggestions>` below the input — a row of `@gmail.com` / `@outlook.com` / … chips that complete the address in one tap. Nothing to opt into; it is part of `kind="email"`.

To suppress it for a whole subtree, provide `SuggestEmailDomainsContext` as `false`:

```tsx
import { SuggestEmailDomainsContext } from "@/components/shared";

<SuggestEmailDomainsContext.Provider value={false}>
  {children}
</SuggestEmailDomainsContext.Provider>
```

`AuthCard` already does this, so every login / signup / reset surface renders a plain email input.

### password

```tsx
// showToggle (default true) renders the show/hide eye button; set false to hide it
<FormField form={form} name="password" kind="password" label="Password"
  autoComplete="new-password" showToggle />
```

### textarea

```tsx
// rows defaults to 4
<FormField form={form} name="description" kind="textarea" label="Description"
  rows={4} placeholder="Write something..." />
```

### select

```tsx
// options is required: { label: string; value: string }[]
<FormField
  form={form}
  name="status"
  kind="select"
  label="Status"
  placeholder="Choose a status"
  options={ItemStatus.options.map((v) => ({ value: v, label: v }))}
/>
```

### Checkbox / switch — raw Controller escape hatch

`FormField` has no boolean kind. For a checkbox or switch, drop to a raw react-hook-form `<Controller>` with the shadcn `<Checkbox>` / `<Switch>` primitive (pattern from `src/app/(public)/signup/page.tsx`):

```tsx
import { Controller } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

<Controller
  control={form.control}
  name="acceptedTerms"
  render={({ field, fieldState }) => (
    <div className="flex items-start gap-2.5">
      <Checkbox
        id="accepted-terms"
        checked={field.value === true}
        onCheckedChange={(value) => field.onChange(value === true)}
        onBlur={field.onBlur}
        aria-invalid={fieldState.invalid}
      />
      <Label htmlFor="accepted-terms">I agree to the Terms</Label>
    </div>
  )}
/>
```

### Shared optional props (all kinds)

```tsx
label="Field label"                           // string — omit for no label
description="Helper text shown below field"   // string — muted caption under the input
helper={<PasswordStrengthMeter value={pw} />} // ReactNode — rendered below description
placeholder="Enter a value"                   // string
autoComplete="email"                          // string — maps to the input's autocomplete
autoFocus                                      // focus on mount (text/email/password)
className="mb-5"                               // extra classes on the FormItem wrapper
disabled={mutation.isPending}                 // disables input during submit
```

There is **no** `required` prop — required-ness comes from the Zod schema and the resulting `<FormMessage>` error, not an asterisk prop.

---

## 3. Create Form (Standard Pattern)

```tsx
"use client";

import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { FormField } from "@/components/shared";
import { createItemSchema, type CreateItemInput, useCreateItem } from "@/features/<feature>";

export default function CreateItemPage() {
  const navigate = useNavigate();
  const createItem = useCreateItem();

  const form = useForm<CreateItemInput>({
    resolver: zodResolver(createItemSchema),
    defaultValues: {
      name: "",
      status: undefined,      // enum: undefined, never ""
      isActive: false,        // boolean (Controller + Checkbox): explicit default
    },
  });

  function onSubmit(data: CreateItemInput) {
    createItem.mutate(data, {
      onSuccess: (result) => navigate(`/<feature>/${result.id}`),
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Create Item" />
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField form={form} name="name" kind="text" label="Name" />
              <FormField form={form} name="status" kind="select" label="Status"
                options={[{ value: "Active", label: "Active" }, { value: "Draft", label: "Draft" }]} />
              <div className="flex justify-end">
                <Button type="submit" disabled={createItem.isPending}>
                  {createItem.isPending ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Rules:**
- `defaultValues` must include ALL schema keys — missing keys create uncontrolled inputs
- Enum defaults: `undefined` (never `""`)
- Nullable numbers: `null`
- Booleans: explicit `false`
- Arrays: `[]`
- Toast + invalidation happen inside the hook — do not duplicate in `onSubmit`
- Post-create navigation: pass `onSuccess` callback to `mutate(data, { onSuccess })`

---

## 4. Edit Form (Pre-populated Pattern)

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared";
import { updateItemSchema, type UpdateItemInput, useUpdateItem } from "@/features/<feature>";
import type { ItemDetail } from "@/features/<feature>";

interface Props {
  item: ItemDetail;
}

export function ItemEditForm({ item }: Props) {
  const updateItem = useUpdateItem(item.id);

  const form = useForm<UpdateItemInput>({
    resolver: zodResolver(updateItemSchema),
    // Use `values` (not `defaultValues`) when data is loaded asynchronously —
    // it resets the form whenever the prop changes
    values: {
      name: item.name,
      status: item.status,
      isActive: item.isActive,
    },
  });

  function onSubmit(data: UpdateItemInput) {
    updateItem.mutate(data);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField form={form} name="name" kind="text" label="Name" />
        <FormField form={form} name="status" kind="select" label="Status"
          options={[{ value: "Active", label: "Active" }, { value: "Draft", label: "Draft" }]} />
        <div className="flex justify-end">
          <Button type="submit" disabled={updateItem.isPending}>
            {updateItem.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

**`defaultValues` vs `values`:**
- `defaultValues` — for new forms with static defaults (computed once on mount)
- `values` — for edit forms where data arrives from props/query; resets form when value changes

---

## 5. Multi-Section Form (Grouped Fields)

For long forms, group related fields in cards with section headings:

```tsx
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

    {/* Section 1 */}
    <Card>
      <CardHeader>
        <CardTitle>Basic Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField form={form} name="name" kind="text" label="Name" />
        <FormField form={form} name="status" kind="select" label="Status" options={...} />
      </CardContent>
    </Card>

    {/* Section 2 */}
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField form={form} name="description" kind="textarea" label="Description" rows={4} />
        <FormField form={form} name="notes" kind="textarea" label="Notes" />
      </CardContent>
    </Card>

    {/* Submit — sticky or inline */}
    <div className="flex justify-end">
      <Button type="submit" disabled={mutation.isPending}>Save</Button>
    </div>
  </form>
</Form>
```

---

## 6. Tab-Based Forms (Detail Page Pattern)

When a detail page has multiple form sections on tabs, each tab gets its own `useForm` instance:

```tsx
// ItemDetailPage.tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ItemGeneralTab } from "./_components/ItemGeneralTab";
import { ItemLocalizationTab } from "./_components/ItemLocalizationTab";

export default function ItemDetailPage({ params }: { params: { id: string } }) {
  const { data: item } = useItemDetail(params.id);
  if (!item) return <ItemDetailSkeleton />;

  return (
    <Tabs defaultValue="general">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="localization">Localization</TabsTrigger>
      </TabsList>
      <TabsContent value="general"><ItemGeneralTab item={item} /></TabsContent>
      <TabsContent value="localization"><ItemLocalizationTab item={item} /></TabsContent>
    </Tabs>
  );
}

// ItemGeneralTab.tsx — isolated form, uses `values` to sync with parent data
export function ItemGeneralTab({ item }: { item: ItemDetail }) {
  const updateItem = useUpdateItem(item.id);
  const form = useForm<UpdateItemInput>({
    resolver: zodResolver(updateItemSchema),
    values: { name: item.name, ... },
  });
  // ...
}
```

**Rule:** Never share a single `useForm` instance across tabs — each tab manages its own form state.

---

## 7. Dynamic Fields

### Conditional field visibility

```tsx
const category = form.watch("category");

{category === "TypeA" && (
  <FormField form={form} name="subType" kind="select"
    label="Sub Type" options={...} />
)}
```

### Derived / auto-generated field (e.g. slug from name)

```tsx
const name = form.watch("name");

// Debounce slug generation
useEffect(() => {
  if (!name) return;
  const timer = setTimeout(() => {
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    form.setValue("slug", slug, { shouldValidate: true });
  }, 500);
  return () => clearTimeout(timer);
}, [name, form]);
```

### Dependent async validation (e.g. slug availability)

```tsx
const slug = form.watch("slug");
const { data: slugCheck } = useCheckSlug(slug);   // enabled: slug.length >= 1

{slugCheck && (
  <p className={`text-sm ${slugCheck.available ? "text-success" : "text-destructive"}`}>
    {slugCheck.available ? "Slug is available" : "Slug is already taken"}
  </p>
)}
```

---

## 8. Quantity & money inputs (POS-specific)

The two field types Simon uses constantly, and the two most likely to be got wrong.

**Never bind a money or quantity field to a float.** The form value is an **integer** —
milli-units for quantity, milli-drams for unit price, whole drams for totals (see the `money`
skill). Parse at the input edge, keep it integer through the schema, the hook, and the wire.

```ts
// schema — integers, with the product's precision enforced
qty: z.number().int().positive()
       .refine(v => v % step === 0, "too many decimal places"),
unitPriceMdram: z.number().int().nonnegative(),
```

```tsx
<QuantityField
  value={field.value}              // MilliUnit
  onChange={field.onChange}
  decimalPlaces={product.decimalPlaces}   // 0 for pieces, 2-3 for kg / m
/>
```

Rules:

- **Large touch keypad**, not a native number spinner. Workers use a thumb, sometimes gloved.
- `inputMode="decimal"` so mobile shows the right keyboard; never `type="number"` — it silently
  accepts `e`, `+`, and locale decimal separators, and its spinner is unusable on a phone.
- Respect `decimalPlaces`: a piece count must not accept `2.5`, and a weight must.
- Discount fields are **basis points**, gated by role, and capped — above the cap they require an
  admin PIN and a reason (see the `auth` skill).
- Show the running line total as the worker types; it is the number they are checking against
  the customer's expectation.


## 9. Inline Add Form (List + Quick-Add)

For adding child items to a parent without navigating away:

```tsx
export function RelatedItemsSection({ parentId }: { parentId: string }) {
  const addItem = useAddRelatedItem(parentId);
  const form = useForm<AddRelatedItemInput>({
    resolver: zodResolver(addRelatedItemSchema),
    defaultValues: { url: "", type: undefined },
  });

  function onSubmit(data: AddRelatedItemInput) {
    addItem.mutate(data, {
      onSuccess: () => form.reset(),    // clear form after success
    });
  }

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2 items-end">
          <div className="flex-1">
            <FormField form={form} name="url" kind="text" label="URL" />
          </div>
          <div className="w-40">
            <FormField form={form} name="type" kind="select" label="Type"
              options={[...]} />
          </div>
          <Button type="submit" disabled={addItem.isPending}>Add</Button>
        </form>
      </Form>
      {/* Existing list rendered below */}
    </div>
  );
}
```

---

## 10. Mutation Hook Pattern (inside `hooks.ts`)

`httpClient` throws `ApiRequestError` (from `@/types/common`), not a bare `Error`. Each feature's `hooks.ts` defines a local `messageFromError(error, fallback)` helper that flattens field-level `errors` (422) and falls back to `detail` / `payload.title`:

```typescript
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiRequestError } from "@/types/common";
import type { CreateItemInput, UpdateItemInput } from "./schema";
import { itemService } from "./service";

// Local per-feature helper (currently duplicated across features — there is no global getProblemDetail)
function messageFromError(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    if (error.errors) {
      const lines = Object.values(error.errors).flat();
      if (lines.length > 0) return lines.join(" ");
    }
    return error.detail ?? error.payload.title ?? fallback;
  }
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateItemInput) => itemService.create(data),
    onSuccess: () => {
      toast.success("Item created successfully");
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
    onError: (error) => toast.error(messageFromError(error, "Failed to create item")),
  });
}

export function useUpdateItem(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateItemInput) => itemService.update(id, data),
    onSuccess: () => {
      toast.success("Changes saved");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["item", id] });
    },
    onError: (error) => toast.error(messageFromError(error, "Failed to save changes")),
  });
}
```

**Mapping 422 validation errors back onto fields.** When you want per-field messages instead of a toast, read `ApiRequestError.errors` (a `Record<string, string[]>`) in the component's inline `onError` and call `form.setError`:

```typescript
createItem.mutate(data, {
  onError: (error) => {
    if (error instanceof ApiRequestError && error.errors) {
      for (const [field, messages] of Object.entries(error.errors)) {
        form.setError(field as keyof CreateItemInput, { message: messages[0] });
      }
    }
  },
});
```

**Rules:**
- `toast` calls live in hooks, never in page `onSubmit`
- `queryClient.invalidateQueries` lives in hooks
- Pass `onSuccess` / `onError` callbacks into `mutate(data, { onSuccess })` only for navigation, form reset, or field-error mapping — not for toast
- Error type: `ApiRequestError` — narrow with `instanceof ApiRequestError` to reach `.detail` / `.errors`, never assume a plain `.message`

---

## 11. Loading Skeleton for Edit Forms

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function ItemFormSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="h-9 w-24 ml-auto" />
      </CardContent>
    </Card>
  );
}

// Usage in page
if (!item) return <ItemFormSkeleton />;
```

---

## 12. Two-Column Layout for Related Fields

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
  <FormField form={form} name="firstName" kind="text" label="First Name" />
  <FormField form={form} name="lastName" kind="text" label="Last Name" />
</div>
```

---

## 13. Confirm Before Destructive Action

For delete buttons on forms, always use `ConfirmDialog`:

```tsx
import { ConfirmDialog } from "@/components/shared";

<ConfirmDialog
  title="Delete Item"
  description="This action cannot be undone."
  onConfirm={() => deleteItem.mutate(item.id)}
  trigger={
    <Button variant="destructive" size="sm">Delete</Button>
  }
/>
```

---

## 14. Performance Checklist

- Use `form.watch("field")` only for fields that drive conditional rendering — watching unused fields causes needless re-renders
- For expensive conditional queries (slug check, availability), guard with `enabled: value.length >= 1`
- Pass `shouldValidate: true` to `form.setValue` only when you need immediate error feedback
- Use `values` (not `defaultValues`) for edit forms to avoid stale data after re-fetches
- Never call `form.reset()` on every render — only in `onSuccess` callbacks
- `useForm` is called once at page level; do not call it inside loops or conditionally

---

## Anti-Patterns to Avoid

| Wrong | Right |
|-------|-------|
| `<FormField control={form.control} type="text" .../>` | `<FormField form={form} kind="text" .../>` |
| `<FormField kind="checkbox">` / `kind="number"` / `kind="tags"` | No such kind — raw `<Controller>` for checkbox/switch; only 5 kinds exist |
| `required` prop on `FormField` | No such prop — required-ness comes from the Zod schema |
| `defaultValues: { status: "" }` | `defaultValues: { status: undefined }` |
| `toast.success(...)` in `onSubmit` | Inside `useMutation` `onSuccess` |
| `queryClient.invalidate` in component | Inside `useMutation` `onSuccess` |
| `z.coerce.number()` in form schemas | `z.number()` in form schemas (coerce only for API-facing) |
| Missing keys in `defaultValues` | Include ALL schema keys |
| `defaultValues` for edit form with async data | `values` prop |
| Sharing one `useForm` across tabs | Separate `useForm` per tab |
| Calling `router.push` after login/logout | `window.location.href` (hard redirect) |
