# Feature Document Reference Template

> **Purpose**: This template defines the structure for feature-level documents in a hub-and-spoke PRD architecture. Feature documents are lightweight — they capture what's needed to build one feature without repeating the parent PRD's strategic context.
>
> Used by the `prd-add-feature` skill when creating separate feature documents.

---

## Section Structure

All sections are **Required** unless marked otherwise.

---

## 1. Feature Metadata — `Required`

**Must include**:
- Feature title
- Parent PRD link (relative path)
- Version number
- Status (Draft / In Review / Approved / Active Development)
- Last updated date
- Author
- One-sentence strategic context (why this feature matters to the parent product)

**Example**:

```markdown
# Feature: Player Statistics

> **Parent PRD:** [FixtureFlow PRD](prd.md)
> **Version:** 1.0
> **Status:** Draft
> **Last Updated:** 2026-02-13
> **Author:** [Name], Product Manager

Player statistics complement FixtureFlow's core match management by giving organizers and players visibility into individual performance trends.
```

---

## 2. Problem Statement — `Required`

**Must include**:
- The specific user or business problem this feature solves
- Who experiences it and how painful it is
- Evidence supporting the problem (data, quotes, tickets — or "None yet")
- Why this feature is needed now (not later)

**Quality signals**:
- Problem is distinct from the parent PRD's problem statement
- Framed as user pain, not as "users can't [feature]"

---

## 3. Target Users — `Required`

**Must include**:
- Which personas from the parent PRD are affected
- Any new personas introduced by this feature
- Changed permissions or access levels

**Example**:

```markdown
## Target Users

| Persona | Impact | New Permissions |
|---------|--------|-----------------|
| Organizer | Can view and export player stats | Read/export stats |
| Player | Can view own stats and leaderboards | Read-only stats |
| Team Manager | No change | — |
```

---

## 4. User Stories & Acceptance Criteria — `Required`

**Must include**:
- User stories in "As a [role], I want [action] so that [benefit]" format
- Acceptance criteria in Given/When/Then format for key stories
- Happy path and at least one error/edge case

---

## 5. Proposed Solution — `Required`

**Must include**:
- High-level approach without dictating implementation
- Key capabilities this feature provides
- Priority tiers (P0/P1/P2) for each capability

**Quality signals**:
- Specific enough for engineering to estimate
- Abstract enough to leave room for creative solutions

---

## 6. Non-Goals — `Required`

**Must include**:
- What this feature explicitly does NOT address
- Brief rationale for each exclusion

---

## 7. Success Metrics — `Required`

**Must include**:
- Feature-specific KPIs with target values
- Baseline values where known
- Measurement method
- Timeframe for evaluation

---

## 8. Dependencies — `Required`

**Must include**:
- Dependencies on existing parent PRD features
- Dependencies on other teams or external services
- Data or API dependencies

---

## 9. Impact on Existing Features — `Required`

**Must include**:
- What changes in existing features (if anything)
- What might break or need modification
- What stays the same (explicit confirmation)

**Example**:

```markdown
## Impact on Existing Features

| Existing Feature | Impact | Details |
|-----------------|--------|---------|
| Match Result Entry | Modified | Now also records goal scorers (optional field) |
| Standings | No change | Standings calculation unaffected |
| Fixture Generation | No change | — |
```

---

## 10. Edge Cases & Error States — `Required`

**Must include**:
- Error scenarios specific to this feature
- Each with: trigger, behavior, user-facing message, recovery path
- Boundary conditions (0 items, max items, missing data)

---

## 11. Open Questions — `Recommended`

**Must include**:
- Unresolved decisions with owner and target resolution date
- Items marked [TBD] with clear ownership

---

## Quality Evaluation (Lightweight)

Feature documents are evaluated on a simplified rubric:

| # | Criterion | Weight |
|---|-----------|--------|
| 1 | Problem statement is distinct and evidence-backed | 2 |
| 2 | User stories have acceptance criteria | 2 |
| 3 | Non-goals are explicit | 2 |
| 4 | Success metrics are specific and measurable | 2 |
| 5 | Impact on existing features is documented | 2 |
| 6 | Edge cases and error states covered | 2 |
| 7 | Dependencies identified | 1 |
| 8 | Parent PRD link present | 1 |

**Total: 14 points**

| Score Range | Rating |
|-------------|--------|
| 11-14 | Good — ready for review |
| 7-10 | Fair — needs another pass |
| 0-6 | Incomplete — needs more discovery |
