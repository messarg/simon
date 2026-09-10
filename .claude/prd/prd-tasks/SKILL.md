---
name: prd-tasks
description: Extract an implementation task breakdown from PRD functional requirements
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

Extract functional requirements from a PRD and organize them into an actionable implementation task breakdown. Tasks are grouped by priority, include complexity estimates, and reference acceptance criteria from the source PRD.

## Execution Steps

### 1. Resolve PRD Path

- If `$ARGUMENTS` is empty, abort with: "Please provide a path to a PRD file. Example: `/prd-tasks prd/my-feature/prd.md`"
- Read the file. If it does not exist, abort with a clear error message.

### 2. Extract Feature Name and Output Path

- Determine the feature name from the PRD's parent directory (e.g., `prd/my-feature/prd.md` → `my-feature`).
- Output path: `prd/<feature-name>/tasks.md`
- If the file already exists, warn and append `-v2`, `-v3`, etc.

### 3. Extract Source Material

Read and extract from these PRD sections:

1. **Functional Requirements** (Section 7) — Primary source. Extract requirement IDs, descriptions, priorities, and details.
2. **Data Model & Validation Rules** (Section 8) — Identify schema/model setup tasks.
3. **API & Integration Contracts** (Section 9) — Identify API implementation tasks (if present).
4. **Acceptance Criteria** (Section 19) — Map criteria to their parent requirements.
5. **Release Phases** (Section 18) — Use phase boundaries to group tasks (if present).
6. **Scope & Prioritization** (Section 17) — Confirm priority assignments.

### 4. Generate Task Breakdown

Organize tasks using this structure:

```markdown
# Implementation Tasks: <Feature Name>

> Generated from: `<source-prd-path>`
> Date: <current date>

## Summary

- **Total tasks**: X
- **By priority**: P0: X · P1: X · P2: X
- **By complexity**: S: X · M: X · L: X

---

## P0 — Must Have

### Setup & Infrastructure

| # | Task | Source | Complexity | Dependencies | Acceptance Criteria |
|---|------|--------|-----------|--------------|---------------------|
| 1 | <task description> | FR-XXX | S/M/L | — | <AC reference or summary> |

### <Feature Area 1>

| # | Task | Source | Complexity | Dependencies | Acceptance Criteria |
|---|------|--------|-----------|--------------|---------------------|
| 2 | <task description> | FR-XXX | S/M/L | #1 | <AC reference or summary> |

---

## P1 — Should Have

### <Feature Area>

| # | Task | Source | Complexity | Dependencies | Acceptance Criteria |
|---|------|--------|-----------|--------------|---------------------|

---

## P2 — Could Have

### <Feature Area>

| # | Task | Source | Complexity | Dependencies | Acceptance Criteria |
|---|------|--------|-----------|--------------|---------------------|

---

## Implementation Notes

- <Any cross-cutting concerns, shared dependencies, or sequencing notes>
```

### 5. Task Generation Rules

- **One task per requirement** — Each functional requirement becomes one or more tasks
- **Group by feature area** — Use the requirement groupings from the PRD
- **Complexity estimates**:
  - **S** (Small) — Single function, simple CRUD, config change. < 2 hours estimated effort.
  - **M** (Medium) — Multiple functions, validation logic, state management. 2-8 hours.
  - **L** (Large) — Cross-cutting feature, complex business logic, integration work. > 8 hours.
- **Dependencies** — Reference task numbers that must complete first (e.g., `#1, #3`)
- **Acceptance criteria** — Reference the PRD's acceptance criteria by ID (e.g., `AC: FR-FIX-03`) or summarize the key pass/fail condition
- **Setup tasks** — Always include a "Setup & Infrastructure" group for data model creation, project scaffolding, and configuration
- **Preserve requirement IDs** — Always include the source requirement ID (e.g., `FR-FIX-03`) in the Source column

### 6. Save & Report

1. Write the task breakdown to the output path.
2. Tell the user the file path.
3. Report: total task count, breakdown by priority, breakdown by complexity, and any requirements that could not be mapped to tasks (with reasons).

## Operating Principles

- Do not ask questions — this is a generator skill
- If a requirement is too vague to create a task, include it with a note: `[NEEDS CLARIFICATION]`
- Preserve the PRD's priority assignments — do not re-prioritize
- Keep task descriptions actionable — start with a verb (Create, Implement, Add, Configure, Validate)
- Never modify the source PRD
- If the PRD lacks functional requirements, abort with: "No functional requirements found. Run `/prd-analyze` to check PRD completeness."
