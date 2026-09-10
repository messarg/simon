---
name: prd-draft
description: Generate a complete first-draft PRD from a context file or inline brief
argument-hint: "<path-to-context.md or inline brief> [--format 1pager|pitch|ai]"
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

Generate a complete first-draft PRD using the appropriate template structure. The input is either a context file (from `prd-discover`) or an inline feature brief, optionally with a `--format` flag to select the PRD type.

## Reference Templates

Before writing, determine the PRD type (see step 2 below) and read the corresponding template:

| Type | Template | Sections | Rubric |
|------|----------|----------|--------|
| Full PRD (default) | `.claude/prd/templates/prd-template.md` | 22 | 54 points |
| 1-Pager | `.claude/prd/templates/prd-template-1pager.md` | 7 | 20 points |
| Shape Up Pitch | `.claude/prd/templates/prd-template-pitch.md` | 6 | 16 points |
| AI Product PRD | `.claude/prd/templates/prd-template-ai.md` | 27 | 64 points |

Each template defines the section structure, inclusion levels, inline examples, and quality rubric.

## Execution Steps

### 1. Resolve Input

- If `$ARGUMENTS` contains a `--format` flag, extract it and remove it from the arguments before processing.
- If the remaining argument looks like a file path, read it as the context source.
- If the remaining argument is inline text, treat it as a feature brief.
- If `$ARGUMENTS` is empty, abort with: "Please provide a context file path or feature brief."

### 2. Determine PRD Type

Resolve the PRD type in this priority order:

1. **Explicit flag**: If `--format <type>` was provided, use it:
   - `--format full` → Full PRD
   - `--format 1pager` → 1-Pager
   - `--format pitch` → Shape Up Pitch
   - `--format ai` → AI Product PRD
2. **Context file**: If the input is a context file, check for a `## Detail Level` section:
   - Contains "1-pager" → 1-Pager
   - Contains "pitch" or "shape up" → Shape Up Pitch
   - Contains "ai" or "AI Product" → AI Product PRD
   - Otherwise → Full PRD
3. **Default**: Full PRD

Read the corresponding template file.

### 3. Derive Output Path

- Extract a feature name from the context (use the heading or first meaningful phrase).
- Output path: `prd/<feature-name>/prd.md` (kebab-case folder).
- If the file already exists, warn and append `-v2`, `-v3`, etc.

### 4. Generate Draft

Write a complete PRD using the selected template. Apply the section rules for the detected type:

#### Full PRD (22 sections)

**Required sections (always include — 12 sections):**
1. Metadata & Revision History
2. Executive Summary
3. Problem Statement & Evidence
4. Goals, Non-Goals & KPIs
5. Target Users & Personas
6. User Stories & Flows
7. Functional Requirements
8. Data Model & Validation Rules
12. Error States & Edge Cases
13. Non-Functional Requirements
14. Assumptions, Hypotheses & Constraints
17. Scope & Prioritization
19. Acceptance Criteria

**Recommended sections (include for most PRDs — 4 sections):**
3b. Competitive Landscape
11. UI/UX Specifications
16. Risks & Mitigations
18. Release Phases & Launch Plan
22. Open Questions, Decisions Log & FAQ

**Conditional sections (include when context demands it):**
9. API & Integration Contracts — when the product has APIs or exports
10. State Machines & Lifecycle — when entities have status workflows
15. Dependencies & Third-Party SLAs — when relying on external services
20. Observability & Configuration — for production systems with ops concerns
21. Glossary — when domain has specialized or ambiguous terms

For conditional sections you skip, add a note at the end: "Sections omitted: [list] — [reason]."

#### 1-Pager (7 sections — all Required)

1. Metadata
2. Problem
3. Hypothesis
4. Goals
5. Solution Overview
6. Key Risks
7. Timeline

#### Shape Up Pitch (6 sections — all Required)

1. Metadata (including Appetite: Small Batch or Big Batch)
2. Problem
3. Appetite
4. Solution (fat-marker sketch + breadboard)
5. Rabbit Holes
6. No-Gos

#### AI Product PRD (27 sections)

All Full PRD sections plus 5 AI-specific Required sections inserted after section 13:
14. Model Performance Requirements
15. Data Dependencies & Pipeline
16. Failure Modes & Fallbacks
17. Ethical Considerations & Bias
18. Monitoring & Drift Detection

Remaining standard sections renumbered 19-27.

### 5. Writing Rules

- Include PRD type in metadata block (`Type: Full PRD` / `1-Pager` / `Shape Up Pitch` / `AI Product PRD`)
- Write requirements that are specific, measurable, and testable
- Distinguish must-haves from nice-to-haves (P0/P1/P2 or MoSCoW)
- Flag assumptions explicitly — separate from facts
- Keep language concise — no filler, no tautologies
- Use tables for structured data (requirements, field limits, KPIs, risks)
- Use numbered steps for user flows (not narrative paragraphs)
- Use Given/When/Then for acceptance criteria
- Include a revision history entry for the initial draft

**Evidence requirements:**
- Problem Statement must include at least one evidence type: user quote, metric, support data, or competitive gap. If none available, mark `[NEEDS EVIDENCE]`
- KPIs must include baseline values where known. If unavailable, mark `[NEEDS BASELINE]`
- Never frame the problem as "Users can't [feature]" — that's a solution masquerading as a problem. Frame as the underlying user pain
- Include a Competitive Landscape subsection if context mentions alternatives or competitors
- Build urgency — articulate "why now" in the problem statement

### 6. Save & Report

1. Write the draft to the output path.
2. Tell the user the file path, the PRD type used, and suggest next steps:
   - Run `/prd-analyze prd/<feature-name>/prd.md` to check quality
   - Run `/prd-refine prd/<feature-name>/prd.md` to iteratively improve it

## Operating Principles

- Generate substantive content based on available context — never pad with filler
- If context is thin for a section, write what you can and mark gaps with `[NEEDS INPUT]`
- Do not ask questions — this skill is a generator, not a discovery tool
- Match the depth and formality to the PRD type — a 1-pager should be concise, not a truncated full PRD
