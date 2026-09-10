# PRD Builder Recommended Prompts

**Contextual prompt library organized by scenario**

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Discovery Sessions](#discovery-sessions)
3. [Drafting PRDs](#drafting-prds)
4. [Quality Analysis](#quality-analysis)
5. [Refinement & Improvement](#refinement--improvement)
6. [Generating Artifacts](#generating-artifacts)
7. [Portfolio Management](#portfolio-management)
8. [Maintenance & Updates](#maintenance--updates)
9. [Navigation & Search](#navigation--search)
10. [Troubleshooting](#troubleshooting)

---

## Getting Started

### First Time Using PRD Builder

**Scenario**: New to the system, want to see what's possible

**Prompt**:
```
Show me all available PRD skills
```

**Expected Output**: List of 11 skills with descriptions

**Follow-up**:
```
/prd-status
```
Shows current portfolio state (empty if first time)

---

**Scenario**: Want to create first PRD

**Prompt**:
```
I want to create a PRD for a user authentication feature
```

**Expected Action**: Claude will guide you to use `/prd-discover`

**Follow-up**:
```
/prd-discover user-authentication
```

---

**Scenario**: Checking if system is set up correctly

**Prompt**:
```
Verify my PRD builder setup
```

**Expected Action**: Claude checks for `.claude/skills/` and `.claude/templates/`

**Follow-up**: If issues found, Claude will help fix them

---

## Discovery Sessions

### Starting Discovery for New Feature

**Scenario**: Complex feature needing comprehensive context

**Prompt**:
```
/prd-discover user-authentication
```

**Expected Output**: Interactive session, 8 questions
**Time**: 15-20 minutes
**Output File**: `prd/user-authentication/prd-context-user-authentication.md`

---

**Scenario**: Small feature, want lightweight discovery

**Prompt**:
```
/prd-discover dark-mode-toggle
```

**Tips**:
- In question 8 (Detail Level), answer: "1-Pager - Small feature, quick alignment"
- This auto-selects 1-Pager template for draft

---

**Scenario**: AI/ML feature requiring ethical considerations

**Prompt**:
```
/prd-discover content-moderation-ai
```

**Tips**:
- In question 8 (Detail Level), answer: "AI Product PRD - Need model performance, data pipelines, ethical considerations"
- Provide extra detail on data sources, fairness concerns in relevant questions

---

**Scenario**: Shape Up methodology, fixed-timeboxed work

**Prompt**:
```
/prd-discover notification-ux-improvement
```

**Tips**:
- In question 8 (Detail Level), answer: "Shape Up Pitch - Fixed 2-week appetite"
- Be explicit about appetite (time budget) in scope question

---

### Discovery Best Practices

**Before starting discovery**:
```
Prepare for PRD discovery session - what should I gather first?
```

**Expected Guidance**:
- Existing research, user feedback
- Competitive analysis
- Stakeholder input
- Problem statement draft

---

## Drafting PRDs

### From Context File (Recommended)

**Scenario**: Just completed discovery, ready to draft

**Prompt**:
```
/prd-draft prd/user-authentication/prd-context-user-authentication.md
```

**Expected Output**: Full 22-section PRD (auto-detected from "Detail Level")
**Time**: 10 minutes
**Output File**: `prd/user-authentication/prd.md`

---

**Scenario**: Force specific template type

**Prompt**:
```
/prd-draft --format 1pager prd/user-authentication/prd-context-user-authentication.md
```

**Use When**: Context suggests Full PRD but you want condensed version

---

**Prompt**:
```
/prd-draft --format ai prd/recommendation-engine/prd-context-recommendation-engine.md
```

**Use When**: AI feature needs 27-section AI Product PRD

---

### From Inline Brief (Fast)

**Scenario**: Small feature, well-understood, no discovery needed

**Prompt**:
```
/prd-draft --format 1pager "Add dark mode toggle to user preferences. Users report eye strain from bright interface during evening use (35% of support tickets)."
```

**Expected Output**: 7-section 1-Pager
**Time**: 5 minutes

---

**Scenario**: Quick iteration on known pattern

**Prompt**:
```
/prd-draft --format 1pager "Add export to CSV button on reports page. Power users requested batch export (12 user interviews). Must support files up to 10MB."
```

---

**Scenario**: Standard feature with inline context

**Prompt**:
```
/prd-draft "Build user profile page with avatar upload, bio editing, and privacy settings. Target completion: 3 weeks. Integrates with existing auth system."
```

**Expected Output**: Full PRD (default when no format specified)

---

### Advanced Drafting

**Scenario**: Drafting AI Product PRD from inline brief

**Prompt**:
```
/prd-draft --format ai "Build spam classification model for user comments using GPT-4 fine-tuned on our comment dataset. Must achieve 95% precision, <500ms latency. Handle hate speech, spam, and off-topic content."
```

**Expected Output**: 27-section AI Product PRD with model performance, data pipeline, ethics sections

---

## Quality Analysis

### Basic Analysis

**Scenario**: Just drafted PRD, want to check quality

**Prompt**:
```
/prd-analyze prd/user-authentication/prd.md
```

**Expected Output**: Quality score (0-54), findings by severity, recommendations
**Time**: 3-5 minutes

---

**Scenario**: Before stakeholder review

**Prompt**:
```
Analyze my PRD quality before I share with stakeholders
```

**Expected Action**: Claude runs `/prd-analyze`, reviews score
**Follow-up**: If score <80%, Claude suggests `/prd-refine`

---

**Scenario**: After major edits, verify quality maintained

**Prompt**:
```
I've updated the functional requirements section. Re-analyze quality.
```

**Expected Action**: Claude runs `/prd-analyze`, compares to previous score if known

---

### Understanding Analysis Results

**Scenario**: Analysis report is confusing

**Prompt**:
```
Explain my PRD analysis results. What does the score mean?
```

**Expected Output**: Explanation of score, severity levels, next actions

---

**Scenario**: Want to know if ready for implementation

**Prompt**:
```
Is my PRD ready for implementation based on the analysis?
```

**Expected Response**:
- Score ≥43/54 + no CRITICAL findings → YES
- Score <43 or CRITICAL findings → NO, run `/prd-refine`

---

## Refinement & Improvement

### Basic Refinement

**Scenario**: Analysis shows score <80%, need systematic improvement

**Prompt**:
```
/prd-refine prd/user-authentication/prd.md
```

**Expected Behavior**: Interactive session, walks through issues by severity
**Time**: 15-45 minutes depending on complexity

---

**Scenario**: CRITICAL findings blocking implementation

**Prompt**:
```
Help me fix the CRITICAL issues in my PRD
```

**Expected Action**: Claude runs `/prd-refine`, prioritizes CRITICAL findings first

---

### Targeted Refinement

**Scenario**: Only want to improve specific section

**Prompt**:
```
The analysis says my "Goals & KPIs" section is weak. How do I improve it?
```

**Expected Guidance**: Claude explains what's missing, suggests running `/prd-refine`

---

**Scenario**: Multiple PRDs need refinement

**Prompt**:
```
Which of my PRDs need refinement most urgently?
```

**Expected Action**: Claude runs `/prd-status`, identifies PRDs with "Needs Work" health

**Follow-up**:
```
/prd-refine prd/<lowest-score-prd>/prd.md
```

---

### Post-Refinement Validation

**Scenario**: Completed refinement, verify improvement

**Prompt**:
```
Re-analyze my PRD after refinement
```

**Expected Action**: Claude runs `/prd-analyze`, shows improved score

---

## Generating Artifacts

### Executive Summary

**Scenario**: PRD is refined, need stakeholder-friendly summary

**Prompt**:
```
/prd-export prd/user-authentication/prd.md
```

**Expected Output**: 1-2 page executive summary
**Time**: 3-5 minutes
**Output File**: `prd/user-authentication/prd-summary.md`

---

**Scenario**: Before leadership review

**Prompt**:
```
Generate executive summary for leadership review
```

**Expected Action**: Claude runs `/prd-export`, confirms output location

---

### Implementation Tasks

**Scenario**: PRD approved, ready to plan implementation

**Prompt**:
```
/prd-tasks prd/user-authentication/prd.md
```

**Expected Output**: Task breakdown by priority (P0/P1/P2) with complexity estimates
**Time**: 5-10 minutes
**Output File**: `prd/user-authentication/tasks.md`

---

**Scenario**: Sprint planning

**Prompt**:
```
Generate implementation tasks for sprint planning
```

**Expected Action**: Claude runs `/prd-tasks`, notes P0 tasks as sprint candidates

---

### Diagrams

**Scenario**: Need visual aids for developer onboarding

**Prompt**:
```
/prd-diagram prd/user-authentication/prd.md all
```

**Expected Output**: State machine, user flow, and data model diagrams (if applicable)
**Time**: 5-10 minutes
**Output Files**: `prd/user-authentication/diagrams/*.mmd`

---

**Scenario**: Only need state machine diagram

**Prompt**:
```
/prd-diagram prd/order-processing/prd.md state-machine
```

---

**Scenario**: Generate diagrams for presentation

**Prompt**:
```
Generate all diagrams from my PRD for tomorrow's architecture review
```

**Expected Action**: Claude runs `/prd-diagram ... all`, confirms output

---

### Batch Artifact Generation

**Scenario**: PRD finalized, generate all artifacts at once

**Prompt**:
```
My PRD is approved. Generate all artifacts (summary, tasks, diagrams).
```

**Expected Action**: Claude runs:
1. `/prd-export prd/my-feature/prd.md`
2. `/prd-tasks prd/my-feature/prd.md`
3. `/prd-diagram prd/my-feature/prd.md all`

---

## Portfolio Management

### Viewing Portfolio

**Scenario**: Start of session, want overview of all PRDs

**Prompt**:
```
/prd-status
```

**Expected Output**: Dashboard with PRD health, status, artifacts, word counts
**Time**: 2-5 minutes

---

**Scenario**: Check what needs attention

**Prompt**:
```
Which PRDs need my attention?
```

**Expected Action**: Claude runs `/prd-status`, highlights:
- PRDs with "Needs Work" or "Incomplete" health
- PRDs with placeholders
- PRDs missing artifacts

---

### Filtering

**Scenario**: Only show draft PRDs

**Prompt**:
```
/prd-status draft
```

**Expected Output**: Filtered dashboard showing only Draft status PRDs

---

**Scenario**: Find all PRDs related to authentication

**Prompt**:
```
/prd-status auth
```

**Expected Output**: PRDs with "auth" in feature name

---

### Portfolio Insights

**Scenario**: Understanding portfolio health

**Prompt**:
```
Give me insights on my PRD portfolio health
```

**Expected Action**: Claude runs `/prd-status`, analyzes:
- Percentage of PRDs ready vs. incomplete
- Common missing artifacts
- Average health score

---

## Maintenance & Updates

### After Manual Edits

**Scenario**: Made manual edits to PRD, want to validate structure

**Prompt**:
```
/prd-validate prd/user-authentication/prd.md
```

**Expected Output**: Pass/fail report on 16 structural checks
**Time**: 1-2 minutes

---

**Scenario**: Quick check during editing

**Prompt**:
```
I'm editing my PRD. Quick check if structure is still valid.
```

**Expected Action**: Claude runs `/prd-validate` for fast feedback

---

### Reviewing Changes

**Scenario**: Before committing changes to git

**Prompt**:
```
/prd-diff prd/user-authentication/prd.md
```

**Expected Output**: Section-by-section comparison vs. git HEAD
**Time**: 2-3 minutes

---

**Scenario**: After refine session, see what changed

**Prompt**:
```
Show me what changed in my PRD after refinement
```

**Expected Action**: Claude runs `/prd-diff`, highlights added/modified sections

---

**Scenario**: Compare two specific versions

**Prompt**:
```
/prd-diff prd/user-authentication/prd-v1.md prd/user-authentication/prd.md
```

---

### Re-analyzing After Changes

**Scenario**: Made significant updates, verify quality

**Prompt**:
```
I've updated several sections. Re-analyze quality.
```

**Expected Action**: Claude runs `/prd-analyze`, compares to previous score

---

### Regenerating Artifacts

**Scenario**: PRD updated, need to regenerate summary

**Prompt**:
```
I updated the Goals section. Regenerate the executive summary.
```

**Expected Action**: Claude runs `/prd-export`, notes `-v2` if file exists

---

**Scenario**: Requirements changed, update tasks

**Prompt**:
```
I added 5 new functional requirements. Update the task breakdown.
```

**Expected Action**: Claude runs `/prd-tasks`, generates updated task list

---

## Navigation & Search

### Finding Content

**Scenario**: Search for concept across all PRDs

**Prompt**:
```
/prd-search authentication
```

**Expected Output**: Matches grouped by PRD, with section context
**Time**: 2-5 minutes

---

**Scenario**: Find specific requirement

**Prompt**:
```
/prd-search "FR-AUTH-05"
```

**Expected Output**: Exact matches with file and line number

---

**Scenario**: Search for technology or dependency

**Prompt**:
```
/prd-search OAuth
```

**Expected Output**: All PRDs mentioning OAuth

---

### Cross-PRD Research

**Scenario**: Finding patterns across PRDs

**Prompt**:
```
Find all PRDs that mention data privacy
```

**Expected Action**: Claude runs `/prd-search "data privacy"`, shows results

---

**Scenario**: Identifying dependencies

**Prompt**:
```
Which PRDs depend on the authentication service?
```

**Expected Action**: Claude runs `/prd-search authentication`, filters for Dependencies sections

---

## Troubleshooting

### Skill Issues

**Scenario**: Skill not recognized

**Prompt**:
```
Why isn't /prd-discover working?
```

**Expected Diagnosis**: Claude checks:
- `.claude/skills/` directory exists
- `prd-discover/SKILL.md` exists
- Suggests restart if needed

---

### Generation Failures

**Scenario**: Draft command failed

**Prompt**:
```
/prd-draft failed with an error. What's wrong?
```

**Expected Diagnosis**: Claude checks:
- Template file exists
- Context file path is valid
- Format flag is valid

---

**Scenario**: Analysis produces unexpected results

**Prompt**:
```
The analysis says my PRD has 0 sections. That can't be right.
```

**Expected Diagnosis**: Claude checks:
- File exists and is not empty
- Sections use correct heading level (`##`)
- Metadata includes `Type:` field

---

### Quality Issues

**Scenario**: Score unexpectedly low

**Prompt**:
```
My PRD scored 20/54 but it looks complete. Why so low?
```

**Expected Action**: Claude reviews:
- Findings table (what's missing)
- Scorecard (which criteria failed)
- Explains scoring rubric

---

**Scenario**: Too many placeholders

**Prompt**:
```
Validate says I have 15 placeholders. Where are they?
```

**Expected Action**: Claude searches for placeholder markers:
```
grep -r "NEEDS INPUT" prd/my-feature/prd.md
grep -r "TODO" prd/my-feature/prd.md
```

---

### Git Issues

**Scenario**: Diff command fails

**Prompt**:
```
/prd-diff says git repository not found
```

**Expected Solution**:
```bash
# Initialize git if needed
git init
git add prd/my-feature/prd.md
git commit -m "Initial commit"

# Or use two-file mode
/prd-diff <old-file> <new-file>
```

---

### Artifact Issues

**Scenario**: Tasks file has no content

**Prompt**:
```
/prd-tasks generated an empty file. Why?
```

**Expected Diagnosis**: Claude checks:
- Functional Requirements section exists
- Requirements have IDs (FR-XXX-##)
- Section is not empty

---

**Scenario**: Diagrams not generating

**Prompt**:
```
/prd-diagram didn't create any files
```

**Expected Diagnosis**: Claude checks:
- Source sections exist (Section 6, 8, 10)
- Sections have structured content (tables, numbered steps)
- Notes which diagram types were skipped

---

## Adding Features to Existing PRDs

### Separate Feature Document

**Scenario**: Adding a significant new feature to an existing product

**Prompt**:
```
/prd-add-feature prd/fixtureflow/prd.md player-stats
```

**Expected Behavior**: Reads parent PRD, asks 5 discovery questions, creates feature document
**Time**: 15-30 minutes
**Output**: `prd/fixtureflow/prd-player-stats.md` + updated parent PRD

---

**Scenario**: Adding a feature without knowing the name yet

**Prompt**:
```
/prd-add-feature prd/my-product/prd.md
```

**Expected Behavior**: Prompts for feature name, then proceeds with discovery

---

### In-Place Update

**Scenario**: Small enhancement that doesn't warrant a separate document

**Prompt**:
```
/prd-add-feature prd/user-auth/prd.md password-reset
```

**Tips**:
- When asked about approach, choose "in-place update"
- Best for small enhancements (adding a filter, extending an API)
- Content will be tagged with `[Added v<version>]`

---

### Post-Feature Validation

**Scenario**: Verify feature document quality after creation

**Prompt**:
```
/prd-validate prd/my-product/prd-notifications.md
/prd-analyze prd/my-product/prd-notifications.md
```

---

## Advanced Scenarios

### Template Migration

**Scenario**: Convert Full PRD to AI Product PRD

**Prompt**:
```
I need to convert my Full PRD to an AI Product PRD. How?
```

**Expected Guidance**:
1. Read current PRD
2. Generate AI Product PRD from same context with `--format ai`
3. Manually merge content
4. Update metadata `Type:` field

---

### Multi-PRD Workflows

**Scenario**: Creating related PRDs

**Prompt**:
```
I'm creating 3 related PRDs for a feature suite. Best approach?
```

**Expected Guidance**:
- Create separate PRD for each
- Use consistent terminology (define in glossary)
- Cross-reference in Dependencies sections
- Use `/prd-search` to ensure consistency

---

### Custom Quality Thresholds

**Scenario**: Want higher quality bar for critical features

**Prompt**:
```
This is a security-critical feature. What quality score should I target?
```

**Expected Guidance**:
- Minimum: ≥43/54 (80%)
- Recommended for security: ≥48/54 (89%)
- Aim for "Excellent" rating
- Zero HIGH findings (not just CRITICAL)

---

### Batch Operations

**Scenario**: Analyze all PRDs

**Prompt**:
```
Analyze quality of all my PRDs and summarize
```

**Expected Action**: Claude runs `/prd-status`, then offers to analyze specific PRDs

---

**Scenario**: Generate summaries for all approved PRDs

**Prompt**:
```
Generate executive summaries for all approved PRDs
```

**Expected Action**: Claude filters by status, runs `/prd-export` for each

---

## Context-Aware Prompts

### When Starting Work

**Prompt**:
```
I'm starting work on the PRD builder today. What should I do first?
```

**Expected Response**:
```
/prd-status
```
Shows portfolio state, identifies next actions

---

### When Stuck

**Prompt**:
```
I'm stuck on the Goals & KPIs section. Help me write measurable goals.
```

**Expected Guidance**:
- Explain SMART criteria
- Show examples
- Suggest running `/prd-refine` for interactive help

---

### When Unsure About Workflow

**Prompt**:
```
I have a context file. What's next?
```

**Expected Guidance**:
```
/prd-draft prd/<feature>/prd-context-<feature>.md
```

---

**Prompt**:
```
I just ran analyze and got a low score. What now?
```

**Expected Guidance**:
```
/prd-refine prd/<feature>/prd.md
```

---

## Quick Wins

**Scenario**: Fastest path to complete PRD

**Prompt**:
```
Fastest way to create a simple PRD for a dark mode toggle?
```

**Expected Guidance**:
```bash
/prd-draft --format 1pager "Add dark mode toggle to settings"
# Skip discovery, skip analysis, ~5 minutes total
```

---

**Scenario**: Portfolio cleanup

**Prompt**:
```
Quick wins: what PRDs are ready for artifacts but don't have them?
```

**Expected Action**: Claude runs `/prd-status`, filters for:
- Health: "Ready" or "Good"
- Missing: summary, tasks, or diagrams

---

## Learning & Improvement

**Scenario**: Want to understand best practices

**Prompt**:
```
What makes a high-quality PRD according to the rubric?
```

**Expected Output**: Explanation of scoring criteria, examples

---

**Scenario**: Understanding anti-patterns

**Prompt**:
```
What are common mistakes in PRDs?
```

**Expected Output**: List of anti-patterns (solution-as-problem, vague criteria, etc.)

---

**Scenario**: Template selection help

**Prompt**:
```
When should I use 1-Pager vs Full PRD?
```

**Expected Output**: Decision criteria, examples

---

## Custom Workflows

**Scenario**: Agile team, need user stories

**Prompt**:
```
Convert my PRD to user stories format
```

**Expected Guidance**: Use `/prd-tasks` as starting point, reformat as user stories

---

**Scenario**: Need API documentation

**Prompt**:
```
Extract API contracts from my PRD
```

**Expected Guidance**: Read Section 9 (API & Integration Contracts) directly

---

## Summary

Total prompt categories: **10**
Total example prompts: **100+**

**Most Common Prompts (Top 12):**
1. `/prd-status` - Check portfolio
2. `/prd-discover <name>` - Start new PRD
3. `/prd-draft <context>` - Generate PRD
4. `/prd-analyze <prd>` - Check quality
5. `/prd-refine <prd>` - Improve PRD
6. `/prd-add-feature <prd> <name>` - Add feature to existing PRD
7. `/prd-export <prd>` - Stakeholder summary
8. `/prd-tasks <prd>` - Implementation tasks
9. `/prd-validate <prd>` - Quick check
10. `/prd-diff <prd>` - Review changes
11. `/prd-search <query>` - Find content
12. `/prd-diagram <prd>` - Generate diagrams

---

**Related Documentation:**
- [Complete Usage Guide](./prd-skills-complete-guide.md) - Comprehensive reference
- [Quick Reference](./prd-quick-reference.md) - One-page cheat sheet
