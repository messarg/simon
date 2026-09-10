# PRD Draft Skill

Generates a complete first-draft PRD from a context file or inline brief. This is step 2 of the PRD pipeline.

## What It Does

Detects the desired PRD type (from `--format` flag, context file, or default) and generates a draft using the matching template. Applies writing rules for specificity, measurability, and testability. Marks gaps with `[NEEDS INPUT]` when context is thin.

**This skill generates content — it does not ask questions.**

## Usage

```
/prd-draft <path-to-context.md>
/prd-draft "Brief description of the feature"
/prd-draft <path-or-brief> --format 1pager|pitch|ai|full
```

## PRD Types

| Format | Template | Sections | Max Score |
|--------|----------|----------|-----------|
| `full` (default) | `prd-template.md` | 22 | 54 |
| `1pager` | `prd-template-1pager.md` | 7 | 20 |
| `pitch` | `prd-template-pitch.md` | 6 | 16 |
| `ai` | `prd-template-ai.md` | 27 | 64 |

## Format Detection Priority

1. Explicit `--format` flag in arguments
2. `## Detail Level` section in context file
3. Default: `full`

## Inputs / Outputs

| Input | Output |
|-------|--------|
| Context file path or inline brief | `prd/<feature-name>/prd.md` |

## Workflow Context

```
Discover → [Draft] → Analyze → Refine
```

## Tools Used

`Read`, `Write`
