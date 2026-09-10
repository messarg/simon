---
name: prd-diff
description: Compare a PRD against its last committed version showing section-by-section changes
argument-hint: <path-to-prd.md>
user-invocable: true
disable-model-invocation: true
allowed-tools: [Read, Glob, Grep, Bash]
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Compare the current working copy of a PRD against its last committed version in git. Produce a section-by-section change summary that highlights what was added, removed, or modified. Output is displayed in the terminal only — no files are modified.

## Execution Steps

### 1. Resolve PRD Path

- If `$ARGUMENTS` is empty, abort with: "Please provide a path to a PRD file. Example: `/prd-diff prd/my-feature/prd.md`"
- If `$ARGUMENTS` contains two paths separated by a space, treat them as two files to compare directly.
- Read the current file. If it does not exist, abort with a clear error message.

### 2. Get Previous Version

**Single file mode** (default):
- Run `git show HEAD:<path>` to get the last committed version.
- If the file is not tracked by git (new file), report: "This is a new PRD — no previous version to compare."
- If git is not initialized, abort with: "No git repository found. `/prd-diff` requires git for version comparison."

**Two-file mode** (when two paths provided):
- Read both files directly. No git needed.

### 3. Parse Both Versions

For each version (current and previous):
- Extract all `##` headings and their content
- Map headings to the 22-section template using fuzzy matching
- Calculate word count per section

### 4. Section-by-Section Comparison

For each of the 22 template sections, determine:

- **Added** — Section exists in current but not in previous
- **Removed** — Section exists in previous but not in current
- **Modified** — Section exists in both but content differs (note word count change)
- **Unchanged** — Section exists in both with identical content

### 5. Produce Diff Report

Output a Markdown report:

```
## PRD Diff Report

**File**: <path>
**Compared**: Working copy vs HEAD (or file1 vs file2)
**Date**: <current date>

---

### Change Summary

| Metric | Value |
|--------|-------|
| Sections added | X |
| Sections removed | X |
| Sections modified | X |
| Sections unchanged | X |
| Net word count change | +/- X words |

---

### Section Changes

| # | Section | Status | Details |
|---|---------|--------|---------|
| 1 | Metadata & Revision History | Modified | +45 words (version bump, new revision entry) |
| 2 | Executive Summary | Unchanged | — |
| 7 | Functional Requirements | Modified | +120 words (3 new requirements added) |
| 19 | Acceptance Criteria | Added | New section (85 words) |

---

### Key Changes

- <Narrative summary of the most significant changes — 3-5 bullet points>

### Recommendations

- <Any quality concerns raised by the changes — e.g., "New requirements added without matching acceptance criteria">
```

### 6. Change Detail Rules

- For **Modified** sections: describe what changed in plain language (e.g., "Added 3 new functional requirements", "Updated KPI targets", "Revised user flow steps 4-7")
- For **Added** sections: note the word count and a brief content summary
- For **Removed** sections: flag as a potential concern and note what was lost
- Keep the narrative summary to the most impactful changes, not every minor edit

## Operating Principles

- **NEVER modify files** — this is strictly read-only
- Use Bash only for `git show` and `git diff` commands — no other git operations
- If git operations fail, provide a clear error and suggest alternatives
- Focus on semantic changes (what was added/removed/modified) not line-level diffs
- Keep the report concise — highlight important changes, skip trivial ones
