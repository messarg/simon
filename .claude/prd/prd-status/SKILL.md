---
name: prd-status
description: Show a dashboard of all PRDs with status, quality assessment, and metadata
argument-hint:
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

Scan the `prd/` directory and produce a dashboard report showing all PRDs with their status, metadata, section coverage, and a quick quality assessment. Output is displayed in the terminal only — no files are modified.

## Execution Steps

### 1. Scan PRD Directory

- Use Glob to find all `prd/*/prd.md` files.
- If no PRDs are found, report: "No PRDs found in `prd/` directory."
- If `$ARGUMENTS` is not empty, treat it as a filter (e.g., `draft` filters to PRDs with Draft status, or a feature name substring).

### 2. Extract Metadata per PRD

For each PRD file found, read and extract:

1. **Feature name** — From the parent directory name
2. **Title** — From the first `#` heading
3. **Status** — From metadata section (Draft / In Review / Approved / Active Development)
4. **Version** — From metadata section
5. **Last updated** — From metadata section
6. **Author** — From metadata section
7. **Word count** — Total words in the document
8. **Section count** — Number of `##` headings that map to the 22-section template
9. **Required sections present** — Count of the 12 required sections found (out of 12)
10. **Has context file** — Check if `prd/<name>/prd-context-*.md` exists
11. **Has summary** — Check if `prd/<name>/prd-summary.md` exists
12. **Has tasks** — Check if `prd/<name>/tasks.md` exists
13. **Placeholder count** — Count of `[NEEDS INPUT]`, `TODO`, `TBD`, `???` markers

### 3. Quick Quality Assessment

For each PRD, assign a quick health indicator based on:

- **Ready** — All 12 required sections present, no placeholders
- **Good** — 10-11 required sections present, ≤ 2 placeholders
- **Needs Work** — 7-9 required sections present, or > 2 placeholders
- **Incomplete** — < 7 required sections present

This is NOT a full analysis (use `/prd-analyze` for that). It's a fast heuristic.

### 4. Produce Dashboard Report

Output a Markdown report with the following structure:

```
## PRD Dashboard

**Date**: <current date>
**PRDs found**: X

---

### Overview

| PRD | Status | Version | Health | Sections | Words | Updated |
|-----|--------|---------|--------|----------|-------|---------|
| <name> | Draft | 1.0 | Ready | 12/12 | 1,329 | 2026-01-31 |
| <name> | Active | 2.0 | Good | 11/12 | 749 | 2026-01-23 |

---

### Artifacts

| PRD | Context File | Summary | Tasks | Placeholders |
|-----|-------------|---------|-------|-------------|
| <name> | Yes | No | No | 0 |

---

### Quick Actions

- PRDs needing attention: <list any with "Needs Work" or "Incomplete" health>
- PRDs without summaries: <list> → Run `/prd-export <path>`
- PRDs without tasks: <list> → Run `/prd-tasks <path>`
- PRDs with placeholders: <list> → Run `/prd-refine <path>`
```

### 5. Optional Filtering

If `$ARGUMENTS` is provided:
- Filter by status keyword (e.g., `draft`, `approved`)
- Filter by feature name substring (e.g., `todo`)
- Show only matching PRDs in the dashboard

## Operating Principles

- **NEVER modify files** — this is strictly read-only
- Keep the scan fast — read only the first 100 lines of each PRD for metadata extraction
- Use Grep for counting placeholders (faster than reading entire files)
- If a metadata field is missing, show `—` in the table
- Sort PRDs by last updated date (most recent first)
