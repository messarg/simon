---
name: prd-search
description: Full-text search across all PRDs in the project
argument-hint: <search-query>
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

Search across all PRD files in the `prd/` directory for a given query. Return matching PRDs, the sections where matches occur, and surrounding context. Output is displayed in the terminal only — no files are modified.

## Execution Steps

### 1. Resolve Search Query

- If `$ARGUMENTS` is empty, abort with: "Please provide a search query. Example: `/prd-search authentication`"
- Treat the entire `$ARGUMENTS` string as the search query.

### 2. Search All PRDs

- Use Glob to find all `prd/**/*.md` files (PRDs, context files, summaries, tasks).
- Use Grep to search for the query across all found files.
- Collect matches with file path, line number, and matching line content.

### 3. Organize Results

Group results by PRD folder, then by file type:

1. **PRD documents** (`prd.md`) — primary results
2. **Context files** (`prd-context-*.md`) — supporting context
3. **Summaries** (`prd-summary.md`) — if present
4. **Task files** (`tasks.md`) — if present

For each match, identify which `##` section it falls under by finding the nearest preceding `##` heading.

### 4. Produce Search Report

Output a Markdown report:

```
## PRD Search Results

**Query**: "<search-query>"
**Date**: <current date>
**Matches**: X matches across Y files in Z PRDs

---

### <prd-name-1>

**File**: `prd/<name>/prd.md`

| # | Section | Line | Match |
|---|---------|------|-------|
| 1 | Functional Requirements | L142 | ...context around **match**... |
| 2 | Acceptance Criteria | L305 | ...context around **match**... |

---

### <prd-name-2>

**File**: `prd/<name>/prd.md`

| # | Section | Line | Match |
|---|---------|------|-------|
| 1 | Data Model | L88 | ...context around **match**... |

---

### Summary

- **PRDs with matches**: <list>
- **Most matches in**: <prd-name> (<count> matches)
- **Sections with most matches**: <section-name> (<count> matches)
```

### 5. Result Formatting Rules

- Bold the matched text within context snippets
- Show up to 80 characters of context around each match
- Limit to 20 matches per PRD (note overflow count)
- Limit to 100 total matches (note overflow count)
- Sort PRDs by match count (most matches first)

## Operating Principles

- **NEVER modify files** — this is strictly read-only
- Search is case-insensitive by default
- If no matches are found, report: "No matches found for '<query>' across X PRD files."
- Keep the report scannable — use tables, not prose
