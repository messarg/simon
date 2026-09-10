---
name: prd-add-feature
description: Add a new feature to an existing PRD — creates a feature document or updates the parent in-place
argument-hint: "<parent-prd-path> [feature-name]"
user-invocable: true
disable-model-invocation: true
allowed-tools: [Read, Write, AskUserQuestion]
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Add a new feature to an existing PRD following the hub-and-spoke model. Read the parent PRD to understand current scope, run a scoped discovery for the new feature, then either create a separate feature document or update the parent PRD in-place. Maintain version history and bidirectional linking.

## Reference

- Feature document template: `.claude/prd/templates/prd-feature-template.md`
- Parent PRD template: `.claude/prd/templates/prd-template.md`

## Execution Steps

### 1. Resolve Input

- If `$ARGUMENTS` is empty, abort with: "Please provide the parent PRD path and optionally a feature name. Example: `/prd-add-feature prd/my-product/prd.md notifications`"
- Parse the first argument as the parent PRD path. Read it to understand: product scope, existing personas, goals, current features, and version number.
- If a second argument is provided, use it as the feature name. Otherwise, ask the user for a short feature name.

### 2. Feature Discovery

Ask the user the following questions (batch where possible using AskUserQuestion). Do not proceed until you have substantive answers for at least questions 1–2.

1. **Problem** — What specific user or business problem does this feature solve? Who experiences it?
2. **Scope** — What's in scope for this feature? What's explicitly out?
3. **Success criteria** — How will you measure whether this feature is successful?
4. **Impact on existing features** — Does this change, extend, or conflict with anything already in the parent PRD?
5. **Users** — Which existing personas are affected? Any new personas needed?

Follow up on vague or incomplete answers. Reference the parent PRD's existing content to ask informed questions (e.g., "The parent PRD lists personas X, Y, Z — which are affected?").

### 3. Decide: Separate Document vs. In-Place Update

Ask the user which approach to take, with a recommendation:

**Recommend separate feature document when:**
- The feature has its own problem statement (a distinct user pain point)
- It needs its own success metrics
- It can be understood independently of other features
- It will go through its own design/engineering review cycle
- It's complex enough to warrant dedicated stakeholder alignment

**Recommend in-place update when:**
- The change is a small enhancement to an existing feature (e.g., adding a filter option, extending an API endpoint)
- A separate document would be overhead that no one benefits from
- The change fundamentally alters the product's scope or vision

### 4A. Create Separate Feature Document

If the user chose a separate document:

1. Read the feature document template at `.claude/prd/templates/prd-feature-template.md`.
2. Generate a feature document at `prd/<parent-folder>/prd-<feature-name>.md` (kebab-case).
3. Populate all sections from the template using discovery answers and parent PRD context.
4. Include a "Link to Parent PRD" at the top referencing the parent PRD path.
5. Update the parent PRD:
   a. Find or create a `## Feature Index` section (place it after the Scope & Prioritization section if creating new).
   b. Add a row: `| <Feature Name> | Draft | [prd-<feature-name>.md](prd-<feature-name>.md) | <one-line summary> |`
   c. Add a revision history entry: `| <next-version> | <today's date> | Added feature document: <feature-name> |`
   d. Bump the version number (minor increment: v1.0 → v1.1).

### 4B. Update Parent PRD In-Place

If the user chose an in-place update:

1. Bump the version number in metadata (minor increment for additive changes).
2. Add a revision history entry: `| <next-version> | <today's date> | Added <feature-name>: <one-line summary> |`
3. Add new functional requirements, user stories, and acceptance criteria for the feature. Tag all new content with `[Added v<new-version>]`.
4. Review and update ripple-effect sections:
   - **Goals & KPIs** — New success metrics needed?
   - **Non-Goals** — Does the new feature change what's explicitly excluded?
   - **Scope & Prioritization** — Add to in-scope list with priority tier.
   - **Target Users** — New personas or changed permissions?
   - **Data Model** — New entities or fields?
   - **Error States** — New error scenarios?
   - **Dependencies & Risks** — New technical or cross-team dependencies?
   - **Timeline & Phases** — Adjusted delivery dates or new phase?
5. For each ripple-effect section updated, tag the changes with `[Updated v<new-version>]`.

### 5. Summary

Tell the user what was created or modified:

- For separate documents: file path of new feature doc + which parent PRD sections were updated
- For in-place updates: list of sections modified with change tags
- Suggest next steps:
  - Run `/prd-validate <path>` to check structural integrity
  - Run `/prd-analyze <path>` to check quality
  - Run `/prd-refine <path>` to improve the feature document or updated PRD

## Operating Principles

- Always read the parent PRD first — feature additions must be contextually aware
- Recommend separate documents for anything with its own problem statement
- Never delete or overwrite existing content — only add or annotate
- Tag all new content with version markers for reviewer visibility
- Keep feature documents lightweight — they're not full PRDs
- Maintain bidirectional linking between parent and feature documents
