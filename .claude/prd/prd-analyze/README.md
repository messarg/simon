# PRD Analyze Skill

Performs a non-destructive quality and consistency analysis of a PRD document. This is step 3 of the PRD pipeline.

## What It Does

Auto-detects the PRD type from metadata and evaluates it against the matching template and rubric. Detects:

- **Completeness** — missing required/recommended sections
- **Duplication** — near-duplicate requirements or rules across sections
- **Ambiguity** — vague adjectives, unresolved placeholders, conditional language
- **Underspecification** — requirements missing validation, acceptance criteria, or numeric targets
- **Internal consistency** — terminology drift, data model/flow mismatches, scope conflicts
- **Quality signals** — missing metadata, stub sections, assumptions disguised as facts

**Strictly read-only — never modifies any files.**

## Usage

```
/prd-analyze <path-to-prd.md>
```

## PRD Type Detection

Scans the first 50 lines for a `Type:` metadata field and selects the matching rubric:

| Type | Template | Criteria | Max Score |
|------|----------|----------|-----------|
| Full PRD (default) | `prd-template.md` | 27 | 54 |
| 1-Pager | `prd-template-1pager.md` | 10 | 20 |
| Shape Up Pitch | `prd-template-pitch.md` | 8 | 16 |
| AI Product PRD | `prd-template-ai.md` | 32 | 64 |

## Output

A structured markdown report containing:

- Quality score with type-specific max and percentage-based rating
- Rubric scorecard (criteria count varies by type)
- Findings table (up to 50 items, severity-ranked: CRITICAL → HIGH → MEDIUM → LOW)
- Section completeness matrix
- Quality metrics summary
- Recommended next actions

## Inputs / Outputs

| Input | Output |
|-------|--------|
| Path to a PRD `.md` file | Analysis report (displayed, not saved to file) |

## Workflow Context

```
Discover → Draft → [Analyze] → Refine
```

## Tools Used

`Read`, `Glob`, `Grep`
