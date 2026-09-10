# PRD Refine Skill

Iteratively refines a PRD section-by-section using analysis findings, then runs a final quality gate. This is step 4 of the PRD pipeline.

## What It Does

1. Runs `prd-analyze` to identify issues
2. Walks through the PRD section by section, prioritized by severity (CRITICAL first)
3. Asks targeted questions to fill gaps and clarify ambiguities
4. Updates the file incrementally after each section
5. Re-runs `prd-analyze` as a final quality gate
6. Declares the PRD ready if score meets type-specific threshold (≥65%) with no CRITICAL findings

## Usage

```
/prd-refine <path-to-prd.md>
```

## Priority Order

1. Missing required sections
2. Underspecified requirements
3. Missing acceptance criteria
4. Missing error states
5. Ambiguities and terminology drift
6. Missing recommended/conditional sections

## Inputs / Outputs

| Input | Output |
|-------|--------|
| Path to a PRD `.md` file | Updated PRD file (in-place) + final quality score |

## Workflow Context

```
Discover → Draft → Analyze → [Refine]
```

## Tools Used

`Read`, `Write`, `AskUserQuestion`, `Skill` (invokes `prd-analyze`)
