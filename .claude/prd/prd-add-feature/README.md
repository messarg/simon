# PRD Add Feature Skill

Adds a new feature to an existing PRD — either as a separate feature document (hub-and-spoke) or as an in-place update with version tracking.

## What It Does

Reads the parent PRD for context, runs a scoped discovery for the new feature, then creates a feature document or updates the parent PRD with proper versioning, change history, and content tagging.

**This skill modifies the parent PRD and may create new files.**

## Usage

```
/prd-add-feature <parent-prd-path> [feature-name]
```

## Examples

```
/prd-add-feature prd/my-product/prd.md notifications
/prd-add-feature prd/fixtureflow/prd.md player-stats
```

## Discovery Questions

1. **Problem** — What problem does this feature solve?
2. **Scope** — What's in scope? What's out?
3. **Success criteria** — How will you measure success?
4. **Impact** — Does this affect existing features?
5. **Users** — Which personas are affected?

## Two Modes

### Separate Feature Document (Recommended for most cases)
- Creates `prd/<parent-folder>/prd-<feature-name>.md`
- Updates parent PRD with Feature Index entry and revision history
- Best for features with their own problem statement and success metrics

### In-Place Update
- Modifies the parent PRD directly
- Tags new content with `[Added v<version>]`
- Updates ripple-effect sections (goals, scope, data model, risks, etc.)
- Best for small enhancements to existing features

## Inputs / Outputs

| Input | Output |
|-------|--------|
| Parent PRD path + feature name | Feature document OR updated parent PRD |

## Workflow Context

```
[Add Feature] → Validate → Analyze → Refine
```

## Tools Used

`Read`, `Write`, `AskUserQuestion`
