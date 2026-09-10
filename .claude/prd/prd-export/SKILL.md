---
name: prd-export
description: Generate a condensed stakeholder-friendly summary from a PRD
argument-hint: <path-to-prd.md>
user-invocable: true
disable-model-invocation: true
allowed-tools: [Read, Write]
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Generate a concise 1-2 page executive summary from a full PRD. The output is a stakeholder-friendly markdown document that captures the essential information without requiring readers to parse the full 22-section PRD.

## Execution Steps

### 1. Resolve PRD Path

- If `$ARGUMENTS` is empty, abort with: "Please provide a path to a PRD file. Example: `/prd-export prd/my-feature/prd.md`"
- Read the file. If it does not exist, abort with a clear error message.

### 2. Extract Feature Name and Output Path

- Determine the feature name from the PRD's parent directory (e.g., `prd/my-feature/prd.md` → `my-feature`).
- Output path: `prd/<feature-name>/prd-summary.md`
- If the summary file already exists, warn and append `-v2`, `-v3`, etc.

### 3. Extract Key Sections

Read the PRD and extract content from these sections (in order):

1. **Metadata** — Title, version, status, author, last updated
2. **Executive Summary** — Product vision, problem statement, solution overview, target users
3. **Goals & KPIs** — Goals list and KPI table
4. **Scope** — In-scope and out-of-scope features
5. **Release Phases** — Phase breakdown (if present)
6. **Risks** — Top risks with mitigations (if present)
7. **Open Questions** — Unresolved decisions (if present)

### 4. Generate Summary Document

Write a structured summary using this format:

```markdown
# <PRD Title> — Executive Summary

> **Version:** <version> | **Status:** <status> | **Author:** <author> | **Date:** <date>
>
> Generated from: `<source-prd-path>`

---

## Overview

<2-3 paragraph synthesis of the executive summary — product vision, problem, and solution>

## Goals & Success Metrics

<Bulleted goals list + KPI table (copied or condensed from source)>

## Scope

### In Scope
<Bulleted list>

### Out of Scope
<Bulleted list with rationale>

## Release Plan

<Phase summary — one paragraph or table per phase>

## Key Risks

<Top 3-5 risks with mitigations — table format>

## Open Questions

<Unresolved items requiring stakeholder input>

---

*Full PRD: `<source-prd-path>`*
```

### 5. Writing Rules

- **Condense, don't copy-paste** — Summarize verbose sections into clear, scannable content
- **Preserve specifics** — Keep numeric targets, dates, priorities, and KPI values exact
- **Omit implementation details** — No data models, API contracts, acceptance criteria, or error states
- **Keep it under 300 lines** — If the summary exceeds this, tighten further
- **Include the source path** — Always link back to the full PRD

### 6. Save & Report

1. Write the summary to the output path.
2. Tell the user the file path.
3. Report: word count, sections included, and any sections that were missing from the source PRD.

## Operating Principles

- Do not ask questions — this is a generator skill
- If a section is missing from the source PRD, omit it from the summary and note it in the report
- Preserve the author's voice and framing — summarize, don't rewrite
- Never modify the source PRD
- Keep the summary readable by non-technical stakeholders
