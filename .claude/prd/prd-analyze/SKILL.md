---
name: prd-analyze
description: Analyze a PRD for completeness, consistency, ambiguity, and quality
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

Perform a non-destructive quality and consistency analysis of a single PRD document. Identify missing sections, ambiguities, duplications, underspecification, internal inconsistencies, and quality gaps. Output a structured Markdown report. Never modify the PRD.

## Reference Templates

Before analyzing, detect the PRD type from the document metadata and read the corresponding template:

| Type | Template | Sections | Rubric |
|------|----------|----------|--------|
| Full PRD (default) | `.claude/prd/templates/prd-template.md` | 22 | 54 points (27 criteria) |
| 1-Pager | `.claude/prd/templates/prd-template-1pager.md` | 7 | 20 points (10 criteria) |
| Shape Up Pitch | `.claude/prd/templates/prd-template-pitch.md` | 6 | 16 points (8 criteria) |
| AI Product PRD | `.claude/prd/templates/prd-template-ai.md` | 27 | 64 points (32 criteria) |

Use the detected template's section structure and rubric as your evaluation framework.

## Operating Constraints

**STRICTLY READ-ONLY**: Do **not** modify any files. Output a structured analysis report only. Offer an optional remediation plan (user must explicitly approve before any edits would be made in a separate step).

## Execution Steps

### 1. Resolve PRD Path & Detect Type

The user argument (`$ARGUMENTS`) should be a file path to a PRD Markdown file.

- If `$ARGUMENTS` is empty, ask the user for the path and stop.
- Read the file. If it does not exist, abort with a clear error message.
- **Detect PRD type**: Scan the first 50 lines for a `Type:` or `**Type:**` metadata field.
  - "Full PRD" → Full PRD
  - "1-Pager" → 1-Pager
  - "Shape Up Pitch" → Shape Up Pitch
  - "AI Product PRD" → AI Product PRD
  - If not found → default to Full PRD and flag as MEDIUM finding (metadata incomplete)
- Read the corresponding reference template.

### 2. Parse PRD Structure

Identify all top-level `##` headings and map them to the detected template's section inventory. Use fuzzy matching on heading text.

#### Section Inventory by Type

**Full PRD (22 Sections)**

| #  | Section                              | Level       |
|----|--------------------------------------|-------------|
| 1  | Metadata & Revision History          | Required    |
| 2  | Executive Summary                    | Required    |
| 3  | Problem Statement & Evidence         | Required    |
| 3b | Competitive Landscape                | Recommended |
| 4  | Goals, Non-Goals & KPIs             | Required    |
| 5  | Target Users & Personas             | Required    |
| 6  | User Stories & Flows                | Required    |
| 7  | Functional Requirements             | Required    |
| 8  | Data Model & Validation Rules       | Required    |
| 9  | API & Integration Contracts         | Conditional |
| 10 | State Machines & Lifecycle          | Conditional |
| 11 | UI/UX Specifications                | Recommended |
| 12 | Error States & Edge Cases           | Required    |
| 13 | Non-Functional Requirements         | Required    |
| 14 | Assumptions, Hypotheses & Constraints| Required    |
| 15 | Dependencies & Third-Party SLAs    | Conditional |
| 16 | Risks & Mitigations                 | Recommended |
| 17 | Scope & Prioritization              | Required    |
| 18 | Release Phases & Launch Plan        | Recommended |
| 19 | Acceptance Criteria                  | Required    |
| 20 | Observability & Configuration       | Conditional |
| 21 | Glossary                             | Conditional |
| 22 | Open Questions, Decisions Log & FAQ | Recommended |

**1-Pager (7 Sections — all Required)**

| # | Section | Level |
|---|---------|-------|
| 1 | Metadata | Required |
| 2 | Problem | Required |
| 3 | Hypothesis | Required |
| 4 | Goals | Required |
| 5 | Solution Overview | Required |
| 6 | Key Risks | Required |
| 7 | Timeline | Required |

**Shape Up Pitch (6 Sections — all Required)**

| # | Section | Level |
|---|---------|-------|
| 1 | Metadata | Required |
| 2 | Problem | Required |
| 3 | Appetite | Required |
| 4 | Solution | Required |
| 5 | Rabbit Holes | Required |
| 6 | No-Gos | Required |

**AI Product PRD (27 Sections)**

All Full PRD sections plus 5 AI-specific Required sections (14-18):
- 14: Model Performance Requirements (Required)
- 15: Data Dependencies & Pipeline (Required)
- 16: Failure Modes & Fallbacks (Required)
- 17: Ethical Considerations & Bias (Required)
- 18: Monitoring & Drift Detection (Required)

Standard sections 14-22 renumbered to 19-27.

### 3. Build Internal Model

Create internal representations (do not output raw artifacts):

- **Section inventory**: Each detected section with line range and completeness assessment (empty, partial, complete)
- **Requirements inventory**: Extract explicit requirements, constraints, and rules with stable slugs (e.g., "visitor can view card" → `visitor-can-view-card`)
- **Data entity inventory**: All named data fields, models, or entities referenced anywhere in the PRD
- **User flow inventory**: Discrete user flows or stories with their steps

_Note: For 1-Pager and Shape Up Pitch, the requirements and data entity inventories may be minimal — this is expected. Focus on the sections that exist._

### 4. Detection Passes

Focus on high-signal findings. **Limit to 50 findings total**; summarize overflow.

#### A. Completeness

- Check each section from the detected template's inventory: present, missing, or partial (heading exists but content is thin/placeholder)
- Missing **Required** section = CRITICAL
- Missing **Recommended** section = MEDIUM (suggestion)
- Missing **Conditional** section = no penalty (note only if context clearly warrants it)

#### B. Duplication

- Near-duplicate requirements, goals, or constraints across different sections
- Same rule stated in different words in multiple places
- Mark lower-quality phrasing for consolidation

#### C. Ambiguity

- Vague adjectives without measurable criteria: fast, scalable, secure, intuitive, robust, clean, modern, simple, seamless
- Unresolved placeholders: TODO, TBD, TKTK, ???, `<placeholder>`, "to be determined"
- Conditional language without defined conditions: "if applicable", "as needed", "when appropriate"
- **Solution-as-problem framing**: Problem statements that follow the pattern "Users can't [feature]", "There is no [feature]", or "Users need a way to [feature]" — these disguise solutions as problems. Flag and suggest reframing to the underlying user pain (e.g., "Users can't filter by date" → "Users waste 15 minutes manually scanning results to find recent entries")

#### D. Underspecification

- Requirements with action verbs but no measurable outcome or acceptance criterion
- Data model fields missing type, constraints, or validation rules
- NFRs (performance, security, accessibility) missing numeric targets
- User flows missing error/edge case handling
- Success criteria that are not testable
- Error states that say "show appropriate error" without specifying the message

#### E. Internal Consistency

- **Terminology drift**: Same concept named differently across sections (e.g., "card" vs "profile" vs "page" for the same thing)
- **Data model ↔ Flow mismatch**: Fields referenced in user flows but absent from data model (or vice versa)
- **Scope conflicts**: Feature described in detail but listed under "Out of Scope"
- **Contradictions**: Requirements that conflict with each other
- **Requirement ↔ Acceptance criteria mismatch**: Requirements without matching acceptance criteria (or vice versa)

#### F. Quality Signals

- Missing version, status, or last-updated metadata
- Missing PRD type in metadata
- Empty or stub sections (heading with no meaningful content)
- Goals/objectives with no corresponding success criteria
- Error states referencing features not described elsewhere
- Sections disproportionately thin relative to their complexity
- Assumptions disguised as facts (stated as truth without evidence)
- No evidence in problem statement (assertions without data)

### 5. Score with Rubric

Apply the quality rubric from the detected template. Each template defines its own criteria and scoring.

| Type | Max Score | Criteria Count |
|------|-----------|----------------|
| Full PRD | 54 | 27 |
| 1-Pager | 20 | 10 |
| Shape Up Pitch | 16 | 8 |
| AI Product PRD | 64 | 32 |

**Rating thresholds (percentage-based, consistent across all types):**

| Score Range | Rating |
|-------------|--------|
| ≥ 80% | Excellent |
| 60-79% | Good |
| 40-59% | Fair |
| 20-39% | Weak |
| < 20% | Incomplete |

_Concrete thresholds per type: Full PRD 43/32/22/11, 1-Pager 16/12/8/4, Pitch 13/10/7/4, AI PRD 52/39/26/13._

### 6. Severity Assignment

| Severity     | Criteria |
|-------------|----------|
| **CRITICAL** | Missing required section, conflicting requirements, data model gap that blocks implementation |
| **HIGH**     | Ambiguous security/performance NFR, untestable success criterion, duplicate requirement creating confusion |
| **MEDIUM**   | Terminology drift, missing recommended section, underspecified edge case |
| **LOW**      | Style/wording improvement, minor redundancy not affecting implementation |

### 7. Produce Analysis Report

Output a Markdown report with the following structure. Do **not** write to any file.

---

**Report structure:**

```
## PRD Analysis Report

**File**: {path}
**Type**: {detected type}
**Date**: {current date}
**Quality Score**: {score} / {max score} ({rating})

---

### Rubric Scorecard

| # | Criterion | Score | Notes |
|---|-----------|-------|-------|
| 1 | {criterion from detected template} | 0/1/2 | ... |
| ... | ... | ... | ... |

**Total: {score} / {max score}**

---

### Findings

| ID | Category       | Severity | Location       | Summary                  | Recommendation              |
|----|----------------|----------|----------------|--------------------------|-----------------------------|
| C1 | Completeness   | CRITICAL | (missing)      | No Acceptance Criteria   | Add Given/When/Then for ... |
| B1 | Duplication    | HIGH     | §3:L52, §6:L140| Username rules repeated  | Consolidate in §3, ref ...  |

_(Stable IDs: prefix = category initial. Max 50 rows; overflow summarized below table.)_

---

### Section Completeness

| #  | Section                              | Level       | Status  | Notes                    |
|----|--------------------------------------|-------------|---------|--------------------------|
| 1  | {section from detected template}     | Required    | Present | Complete                 |
| 2  | ...                                  | ...         | ...     | ...                      |

---

### Quality Metrics

- **PRD type**: {detected type}
- **Sections present**: X / {total for type}
- **Required sections present**: X / {required count for type}
- **Quality score**: X / {max score} ({rating})
- **Findings by severity**: CRITICAL: X · HIGH: X · MEDIUM: X · LOW: X
- **Ambiguity count**: X
- **Duplication count**: X

---

### Next Actions

- If CRITICAL issues: "Resolve these before implementation: ..."
- If HIGH only: "Recommended improvements: ..."
- If MEDIUM/LOW only: "PRD is implementation-ready. Optional improvements: ..."
```

### 8. Offer Remediation

After the report, ask:

> "Would you like me to suggest concrete edits for the top N issues?"

Do **NOT** apply edits automatically. Wait for explicit user approval.

## Operating Principles

- **NEVER modify files** — this is strictly read-only analysis
- **NEVER hallucinate missing sections** — if a section is absent, report it accurately; do not invent content
- **Progressive disclosure** — load and reference only what's needed; do not dump the full PRD into output
- **Token-efficient output** — limit findings to 50 rows; aggregate overflow
- **Deterministic** — rerunning on the same PRD without changes should produce consistent finding IDs and counts
- **Zero issues = success** — if the PRD has no issues, output a clean report with a full scorecard
- **Type-aware** — always evaluate against the correct template for the detected PRD type

## Context

$ARGUMENTS
