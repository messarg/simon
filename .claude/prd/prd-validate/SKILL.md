---
name: prd-validate
description: Lightweight lint and consistency check for a PRD (faster than full analysis)
argument-hint: <path-to-prd.md>
user-invocable: true
disable-model-invocation: true
allowed-tools: [Read, Glob, Grep]
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Perform a fast, mechanical lint check on a PRD file. Unlike `/prd-analyze` (which does deep semantic analysis), this checks structural and formatting issues only. Output is a pass/fail report displayed in the terminal — no files are modified.

## Execution Steps

### 1. Resolve PRD Path & Detect Type

- If `$ARGUMENTS` is empty, abort with: "Please provide a path to a PRD file. Example: `/prd-validate prd/my-feature/prd.md`"
- Read the file. If it does not exist, abort with a clear error message.
- **Detect PRD type** by scanning the first 50 lines for a `Type:` or `**Type:**` metadata field using Grep:
  - Pattern: `Type:\s*(Full PRD|1-Pager|Shape Up Pitch|AI Product PRD)`
  - Match against these exact values:
    - "Full PRD" → Full PRD template (22 sections, 54-point rubric)
    - "1-Pager" → 1-Pager template (7 sections, 20-point rubric)
    - "Shape Up Pitch" → Shape Up Pitch template (6 sections, 16-point rubric)
    - "AI Product PRD" → AI Product PRD template (27 sections, 64-point rubric)
  - If no match found: Default to "Full PRD" and add a WARNING finding: "No Type metadata found, defaulting to Full PRD validation"
- Store the detected type for use in subsequent checks

### 2. Run Lint Checks

Perform these mechanical checks (no semantic analysis):

#### A. Section Structure
- [ ] Has a top-level `#` heading (document title)
- [ ] All required section headings are present based on detected type (fuzzy match against template names):
  - **Full PRD**: 11 required of 22 total sections (Metadata, Executive Summary, Problem Statement, Goals/KPIs, Target Users, User Stories, Functional Requirements, Data Model, Error States, Non-Functional Requirements, Acceptance Criteria)
  - **1-Pager**: 7 required of 7 total (ALL sections: Metadata, Problem, Hypothesis, Goals, Solution Overview, Key Risks, Timeline)
  - **Shape Up Pitch**: 6 required of 6 total (ALL sections: Metadata, Problem, Appetite, Solution, Rabbit Holes, No-Gos)
  - **AI Product PRD**: 18 required of 27 total (all Full PRD required + 5 AI-specific: Model Performance Requirements, Data Dependencies & Pipeline, Failure Modes & Fallbacks, Ethical Considerations & Bias, Monitoring & Drift Detection)
- [ ] Section headings use `##` level (not `###` or deeper for top-level sections)
- [ ] Sections appear in template order (note any out-of-order sections, but this is non-critical)

#### B. Metadata Completeness
- [ ] Has **Version** field
- [ ] Has **Status** field (one of: Draft, In Review, Approved, Active Development)
- [ ] Has **Last Updated** date
- [ ] Has **Author** field
- [ ] Has a Revision History table

#### C. Placeholder Detection
- [ ] No `[NEEDS INPUT]` markers
- [ ] No `TODO` or `TBD` markers
- [ ] No `???` or `TKTK` markers
- [ ] No `<placeholder>` style markers
- [ ] No "to be determined" / "to be decided" phrases

#### D. Requirement Formatting (Conditional based on type)
- [ ] Functional requirements have IDs (e.g., `FR-XXX-##`) — **Full PRD and AI PRD only**
- [ ] Requirements have priority labels (P0/P1/P2 or Must/Should/Could) — **Full PRD and AI PRD only**
- [ ] Acceptance criteria use Given/When/Then format (or equivalent structured format) — **Full PRD and AI PRD only**
- **Note**: For 1-Pager and Shape Up Pitch, these checks are marked as N/A (automatically PASS) since those templates use different formats

#### E. Table Integrity
- [ ] All markdown tables have header rows
- [ ] Tables are not broken (consistent column counts)
- [ ] KPI table exists with numeric targets

#### F. Content Indicators
- [ ] Document is not a stub (> 200 lines)
- [ ] No empty sections (heading followed immediately by another heading)
- [ ] Enumeration values are explicit (no "e.g." or "such as" in enum definitions)

### 3. Produce Validation Report

Output a Markdown report with type-aware formatting:

```
## PRD Validation Report

**File**: <path>
**Detected Type**: <Full PRD | 1-Pager | Shape Up Pitch | AI Product PRD>
**Template**: <prd-template.md | prd-template-1pager.md | prd-template-pitch.md | prd-template-ai.md>
**Expected Sections**: <22 | 7 | 6 | 27> (<required count> required)
**Date**: <current date>
**Result**: PASS / FAIL (X issues)

---

### Checks

| # | Check | Result | Details |
|---|-------|--------|---------|
| 1 | Document title present | PASS | — |
| 2 | Required sections present | FAIL | Missing: Acceptance Criteria, Error States |
| 3 | Metadata: Version | PASS | v1.0 |
| 4 | Metadata: Status | PASS | Draft |
| 5 | Metadata: Date | PASS | 2026-01-31 |
| 6 | Metadata: Author | FAIL | Not found |
| 7 | Revision history | PASS | — |
| 8 | No placeholders | FAIL | 3 found: L42, L88, L156 |
| 9 | Requirement IDs | PASS / N/A | (N/A for 1-Pager, Pitch) |
| 10 | Priority labels | PASS / N/A | (N/A for 1-Pager, Pitch) |
| 11 | Acceptance criteria format | PASS / N/A | (N/A for 1-Pager, Pitch) |
| 12 | Table integrity | PASS | — |
| 13 | KPI table with targets | PASS | — |
| 14 | Not a stub (> 200 lines) | PASS | 1,329 lines |
| 15 | No empty sections | PASS | — |
| 16 | Enum completeness | PASS | — |

---

### Summary

- **Passed**: X / 16 (including N/A checks)
- **Failed**: X / 16
- **N/A**: X / 16 (checks not applicable to this template type)
- **Result**: PASS — PRD structure is valid / FAIL — X issues need attention

### Suggested Actions

- <For each FAIL, suggest the specific fix or relevant skill to run>
- <If type was defaulted, suggest: "Add Type metadata field to explicitly declare template type">
```

### 4. Pass/Fail Criteria (Type-Specific)

**Full PRD & AI Product PRD:**
- **PASS** — All required sections present, no placeholders, metadata complete, requirement IDs present. Non-critical checks (section order, enum completeness) may fail.
- **FAIL** — Any of these fail: missing required sections, missing metadata fields, placeholders present, no requirement IDs or priority labels

**1-Pager:**
- **PASS** — All 7 sections present (no tolerance since all required), no placeholders, metadata complete. Requirement ID/format checks are N/A.
- **FAIL** — Any section missing, missing metadata fields, or placeholders present

**Shape Up Pitch:**
- **PASS** — All 6 sections present (no tolerance since all required), Appetite field present, no placeholders, metadata complete. Requirement ID/format checks are N/A.
- **FAIL** — Any section missing, Appetite field missing, missing metadata fields, or placeholders present

**General principle:** Required section checks adapt based on detected type. Recommendation: Run `/prd-analyze` for deeper semantic quality analysis.

## Operating Principles

- **NEVER modify files** — this is strictly read-only
- Keep it fast — use Grep for pattern matching, avoid reading the entire file line-by-line when possible
- This is a structural check, not a semantic one — do not evaluate content quality
- For deep quality analysis, recommend `/prd-analyze` instead
- Report line numbers for all issues so the user can navigate directly to problems
