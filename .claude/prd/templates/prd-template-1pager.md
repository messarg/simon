# PRD 1-Pager Reference Template

> **Purpose**: Lightweight template for small features, early-stage ideas, or quick alignment docs. Based on the Lenny Rachitsky 1-pager format.
>
> Use this when a full 22-section PRD would be overkill — the goal is to communicate problem, hypothesis, and success criteria in a single page.

---

## Section Structure

All 7 sections are **Required**.

| # | Section | Purpose |
|---|---------|---------|
| 1 | Metadata | Ownership, status, document type |
| 2 | Problem | What's broken and for whom |
| 3 | Hypothesis | What we believe will fix it and how we'll know |
| 4 | Goals | 2-3 measurable objectives |
| 5 | Solution Overview | What we're building (high level) |
| 6 | Key Risks | Top 3 things that could go wrong |
| 7 | Timeline | Milestones and go/no-go points |

---

## 1. Metadata — `Required`

**Must include**:
- Document title
- Type: 1-Pager
- Version, status, date, author

**Example**:

```markdown
# 1-Pager: Quick Search for Dashboard

> **Type:** 1-Pager
> **Version:** 1.0
> **Status:** Draft
> **Date:** 2026-02-13
> **Author:** [Name], Product Manager
```

---

## 2. Problem — `Required`

**Must include**:
- Who has the problem (specific user segment)
- What the pain is (observable, not inferred)
- At least one evidence point (data, quote, ticket count) — or mark `[NEEDS EVIDENCE]`
- Why now

**Quality signals**:
- Frames the problem as user pain, not absent feature
- Includes at least one data point or user quote
- Creates urgency

**Anti-pattern**: "Users can't search the dashboard" — that's a solution disguised as a problem. Better: "Power users with 200+ items spend 3-5 minutes scrolling to find recent entries."

**Example**:

```markdown
## Problem

Power users managing 200+ dashboard items report spending 3-5 minutes per session manually scrolling to find specific entries. Support tickets mentioning "can't find" have increased 40% quarter-over-quarter (Q3: 23 tickets → Q4: 32 tickets).

Without search, users either abandon the dashboard for raw database queries or maintain parallel spreadsheets — both fragile and time-consuming.

**Why now**: Dashboard adoption hit 500 daily active users last month. The "can't find items" complaint is now the #2 support category.
```

---

## 3. Hypothesis — `Required`

**Must include**:
- "We believe [intervention] will [outcome]."
- "We will know this is true when [measurable signal]."
- The hypothesis must be falsifiable

**Quality signals**:
- Links directly to the problem statement
- Validation criteria are measurable within a defined timeframe
- Acknowledges what would disprove the hypothesis

**Example**:

```markdown
## Hypothesis

We believe that adding a keyword search bar to the dashboard will reduce the time users spend finding specific items by 80%.

We will know this is true when:
- Average time-to-find drops from 3-5 minutes to under 30 seconds (measured via session analytics)
- "Can't find" support tickets decrease by 50% within 4 weeks of launch
```

---

## 4. Goals — `Required`

**Must include**:
- 2-3 specific, measurable objectives
- Target values with baselines where available
- What success looks like in concrete terms

**Quality signals**:
- Goals are outcomes, not outputs
- Each goal has a number attached

**Example**:

```markdown
## Goals

1. **Reduce item lookup time** from 3-5 min to <30 sec (P95)
2. **Decrease "can't find" support tickets** by 50% within 4 weeks
3. **Maintain dashboard load time** under 2 seconds (no performance regression)
```

---

## 5. Solution Overview — `Required`

**Must include**:
- High-level description of the solution (3-5 sentences)
- 3-5 key capabilities or features (bullet list)
- What this does NOT include (scope boundary)

**Quality signals**:
- Specific enough to estimate effort
- Clear scope boundaries prevent creep
- Differentiates from alternatives

**Example**:

```markdown
## Solution Overview

Add a persistent search bar at the top of the dashboard that filters items in real-time as the user types.

**Key capabilities:**
- Full-text search across item title, description, and tags
- Results update as-you-type with debounced 200ms delay
- Search persists across pagination (filters the full dataset)
- Clear button resets to default view

**Not included:**
- Advanced filters (date range, status, owner) — deferred to Phase 2
- Saved searches or search history
- Fuzzy/typo-tolerant matching (exact substring match only for v1)
```

---

## 6. Key Risks — `Required`

**Must include**:
- Top 3 risks with probability, impact, and mitigation
- At least one technical risk and one product risk

**Example**:

```markdown
## Key Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Search degrades performance on large datasets (10k+ items) | Medium | High | Index title/description fields; load test with 50k items before launch |
| Users expect fuzzy matching and are frustrated by exact-only search | Medium | Medium | Clear placeholder text "Search by exact keyword"; track failed searches for Phase 2 |
| Low adoption if search bar isn't immediately visible | Low | Medium | Place above fold; A/B test placement in first week |
```

---

## 7. Timeline — `Required`

**Must include**:
- Key milestones with target dates
- Go/no-go decision point
- Total time estimate

**Example**:

```markdown
## Timeline

| Milestone | Target | Notes |
|-----------|--------|-------|
| Design review | Week 1 | Search bar placement, empty state design |
| Backend indexing complete | Week 2 | Full-text index on title, description, tags |
| Frontend implementation | Week 3 | Search bar component, debounced filtering |
| QA + load testing | Week 4 | Performance validation with 50k items |
| Launch | Week 4 | Feature flag rollout: 10% → 50% → 100% |

**Go/no-go**: If load testing shows >500ms P95 latency on 10k+ item datasets, defer launch and optimize indexing.
```

---

# Quality Evaluation Rubric

> Used by `prd-analyze` to score 1-Pager quality. Each criterion is scored 0 (absent), 1 (partial), or 2 (strong).

## Structure & Completeness (max 6 points)

| # | Criterion | 0 | 1 | 2 |
|---|-----------|---|---|---|
| 1 | All 7 sections present | ≥2 missing | 1 missing | All present |
| 2 | Metadata complete (type, version, status, date, author) | No metadata | Partial | Complete |
| 3 | Proportional content (no stubs, no bloat for a 1-pager) | Multiple stubs | Minor imbalance | Well-proportioned |

## Specificity & Precision (max 6 points)

| # | Criterion | 0 | 1 | 2 |
|---|-----------|---|---|---|
| 4 | Goals are measurable with numeric targets | Vague goals | Some numbers | All goals quantified |
| 5 | Hypothesis is falsifiable with validation criteria | No hypothesis | Vague validation | Measurable signal + timeframe |
| 6 | Solution scope boundaries are explicit | Open-ended | Some boundaries | Clear in/out scope |

## Evidence & Reasoning (max 4 points)

| # | Criterion | 0 | 1 | 2 |
|---|-----------|---|---|---|
| 7 | Problem cites real evidence (data, quotes, tickets) | No evidence | Assertions only | Concrete data points |
| 8 | Risks have probability, impact, and mitigation | No risks | Risks listed | Full risk analysis |

## Clarity & Conciseness (max 4 points)

| # | Criterion | 0 | 1 | 2 |
|---|-----------|---|---|---|
| 9 | Readable in under 5 minutes (concise, no filler) | Bloated | Some filler | Tight and scannable |
| 10 | Timeline has concrete milestones and go/no-go | No timeline | Vague dates | Specific milestones + decision point |

---

**Total: 20 points**

| Score Range | Rating | Interpretation |
|-------------|--------|---------------|
| 16-20 | Excellent | Ready to share; clear and complete |
| 12-15 | Good | Minor gaps; address before sharing |
| 8-11 | Fair | Needs another pass; key sections thin |
| 4-7 | Weak | Major gaps; needs substantial rework |
| 0-3 | Incomplete | Not yet a usable 1-pager |
