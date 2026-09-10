---
name: prd-refine
description: Iteratively refine a PRD section-by-section using analysis findings, then run a final quality gate
argument-hint: <path-to-prd.md>
user-invocable: true
disable-model-invocation: true
allowed-tools: [Read, Write, AskUserQuestion, Skill]
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Refine an existing PRD by walking through it section-by-section, guided by `prd-analyze` findings. Fix issues by severity, ask the user targeted questions to fill gaps, then re-run analysis as a final quality gate.

## Execution Steps

### 1. Resolve PRD Path

- If `$ARGUMENTS` is empty, ask the user for the path and stop.
- Read the PRD file. If it does not exist, abort with a clear error.

### 2. Run Initial Analysis

Invoke `prd-analyze` on the PRD:
- Use the Skill tool with `skill: "prd-analyze"` and `args: "<path-to-prd>"`
- Note the quality score, section completeness, and findings by severity

Present a summary to the user: quality score, count of findings by severity, and the top 3–5 issues.

### 3. Iterative Section Refinement

Walk through the PRD section by section, prioritized by analysis findings:

**Priority order** (address CRITICAL first, then HIGH, MEDIUM, LOW):
1. Missing required sections
2. Underspecified requirements (no validation, no side effects)
3. Missing acceptance criteria
4. Missing error states
5. Ambiguities and terminology drift
6. Missing recommended/conditional sections

For each section needing work:
1. Present the current content (or note it's missing)
2. Ask the user if the content is accurate and complete
3. Ask targeted follow-up questions to surface:
   - Missing edge cases or error states
   - Unclear validation rules or business logic
   - Unspecified acceptance criteria
   - Assumptions that should be made explicit
4. Update the section based on their answers
5. Save the updated PRD after each section change

### 4. Final Quality Gate

After all sections are refined:
1. Save the updated PRD
2. Re-run `prd-analyze` by invoking the Skill tool with `skill: "prd-analyze"` and `args: "<path-to-prd>"`
3. Check score against the type-specific quality threshold (≥65% of max):
   - Full PRD: ≥ 35/54
   - 1-Pager: ≥ 13/20
   - Shape Up Pitch: ≥ 10/16
   - AI Product PRD: ≥ 42/64
4. If below threshold, flag the weakest areas and suggest one more refinement pass
5. If at or above threshold and no CRITICAL findings remain, declare the PRD ready

Present the final score and any remaining recommendations.

### 5. Finalize

Ask the user if they want the PRD saved to a different path. If so, write to the new location.

## Operating Principles

- Always run `prd-analyze` before and after refinement
- Address issues by severity — CRITICAL before cosmetic
- Ask specific questions, not open-ended ones
- Update the file incrementally — don't wait until the end
- Keep language concise — no filler
- Acknowledge trade-offs honestly
