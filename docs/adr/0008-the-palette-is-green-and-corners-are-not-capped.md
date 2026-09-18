# 8. The palette is green, and corners are no longer capped at 4px

Date: 2026-09-18 · Status: accepted · PRD: §6.17, §6.6, §0's 3.80 entry, `frontend/src/styles/theme.css`

## Context

The theme was built as "calm utilitarian": a modern paper ledger in beige (#E1D4C1), slate
(#45575D), gold (#EDC03B), sage (#A4AD75) and oxblood (#490905), with every `rounded-*` step
clamped to 4px — *"a ledger is ruled, not rounded"*. §6.17 and §0's 3.80 entry both lean on that
cap, naming the avatar's circle as "the one exception" to it.

The owner supplied a reference design (a green retail-admin system) and asked for its palette and
its shape language. That is a product decision about how Simon should look, not a finding about
how it works, so it is taken here rather than argued against.

## Decision

**The palette is green.** A sage-tinted page (#EDF0DE) that white cards sit on, deep teal-green
(#14544A) for the primary action, leaf (#DCEDC8) behind the current selection, amber (#F0A43C) for
attention, deep brick (#6E1610) for what cannot be undone.

**Corners are no longer capped.** `--radius` is 10px, and the steps run 6 / 8 / 10 / 12 / 16 / 20 /
24 / 28. The step names were already used meaningfully at the call sites — `xs` on a checkbox,
`lg` on a control, `xl` on a card — so un-clamping them landed the intended shape with no component
edited. Cards additionally carry `shadow-sm`, tinted with the page's hue rather than grey.

**Two rules from the PRD survive the change unaltered**, because they are about meaning rather
than taste:

- **§6.6's neutral money.** Variance and money deltas stay `--money-neutral` in both directions —
  a shift close must not read as an accusation. The reference design colours deltas green up and
  red down; Simon does not. Green and red mark *state* (in stock, overdue), never the sign of a
  number. This was put to the owner explicitly and kept.
- **The avatar is still a circle** (§6.17). Its justification — a face in a rounded rectangle reads
  as a product tile — never depended on the surrounding corners being square, only on the face
  being rounder than they are, and at 16px versus a full circle it still is.

Every pairing in the new palette is verified against WCAG 2.2 AA rather than eyeballed: body text
≥ 4.5:1 on each surface it can land on, and a field boundary ≥ 3:1 (1.4.11). Two candidates
sampled straight off the reference failed and were darkened — `--success` (4.32:1 on the page) and
`--input` (2.92:1 on the page).

## Consequences

**§6.17 and §0's 3.80 entry now describe a cap that does not exist.** Both should be amended: the
avatar's circle is still right and still worth stating, but it is no longer *"the one exception to
the 4px corner cap"*, because there is no cap. This is a PRD finding of the kind §9 describes, left
for the document's next pass rather than edited in from here.

The swap itself was cheap and stays cheap, and the reason is worth recording: **every component
uses semantic tokens**, so the whole change is one token block. An audit of the frontend before
starting found three stray palette utilities in total and two raw hex values, both of them in
`Barcode.tsx`, where pure black on pure white is a scanner requirement and not a colour choice.
The `ui-audit` skill's grep is what keeps that true, and it is the reason a redesign of this size
did not touch a single screen.

The PWA chrome moves with the palette — `theme-color`, the manifest's colours, the favicon and the
three PNG icons. An installed home-screen Simon will keep its old icon until the manifest is
re-read.
