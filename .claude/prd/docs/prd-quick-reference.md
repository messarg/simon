# PRD Builder Quick Reference

**One-page cheat sheet for the PRD Builder system**

---

## Command Syntax

| Command | Syntax | Output | Time |
|---------|--------|--------|------|
| **Core Pipeline** |
| discover | `/prd-discover <feature-name>` | `prd/<name>/prd-context-<name>.md` | 10-30m |
| draft | `/prd-draft [--format TYPE] <context-or-brief>` | `prd/<name>/prd.md` | 5-15m |
| analyze | `/prd-analyze <prd-file>` | Terminal report | 3-5m |
| refine | `/prd-refine <prd-file>` | Updated PRD | 15-45m |
| add-feature | `/prd-add-feature <parent-prd> [feature-name]` | Feature doc or updated PRD | 15-30m |
| **Post-Pipeline** |
| export | `/prd-export <prd-file>` | `prd/<name>/prd-summary.md` | 3-5m |
| tasks | `/prd-tasks <prd-file>` | `prd/<name>/tasks.md` | 5-10m |
| diagram | `/prd-diagram <prd-file> [TYPE]` | `prd/<name>/diagrams/*.mmd` | 5-10m |
| **Analysis & Navigation** |
| status | `/prd-status [filter]` | Terminal dashboard | 2-5m |
| validate | `/prd-validate <prd-file>` | Terminal pass/fail | 1-2m |
| diff | `/prd-diff <prd-file> [file2]` | Terminal diff report | 2-3m |
| search | `/prd-search <query>` | Terminal search results | 2-5m |

---

## Template Selection

```
┌─ Is this an AI/ML feature? ──YES→ --format ai (AI Product PRD)
│
└─ NO
   ┌─ Is this a quick proposal? ──YES→ --format pitch (Shape Up Pitch)
   │
   └─ NO
      ┌─ Is this a small feature (<2 weeks)? ──YES→ --format 1pager (1-Pager)
      │
      └─ NO → (default) Full PRD
```

| Template | Flag | Sections | Max Score | Threshold |
|----------|------|----------|-----------|-----------|
| Full PRD | (default) | 22 | 54 | ≥43 (80%) |
| 1-Pager | `--format 1pager` | 7 | 20 | ≥16 (80%) |
| Shape Up Pitch | `--format pitch` | 6 | 16 | ≥13 (81%) |
| AI Product PRD | `--format ai` | 27 | 64 | ≥52 (81%) |
| Feature Document | (via `add-feature`) | 11 | 14 | ≥9 (64%) |

---

## Quality Thresholds

### Scoring

- **Excellent**: ≥80% (ready for implementation)
- **Good**: 65-79% (minor fixes needed)
- **Fair**: 50-64% (needs refinement)
- **Weak**: 30-49% (major issues)
- **Incomplete**: <30% (restart recommended)

### Severity Levels

- **CRITICAL**: Missing required section, conflicting requirements, data model gaps → **MUST FIX**
- **HIGH**: Vague NFRs, untestable criteria, duplicates → **SHOULD FIX**
- **MEDIUM**: Terminology drift, missing recommended section → **CONSIDER FIXING**
- **LOW**: Style/wording improvements → **OPTIONAL**

### Quality Gates

**Before implementation:**
- Score ≥ threshold (80-81%)
- Zero CRITICAL findings
- Preferably zero HIGH findings

---

## File Organization

```
prd/
└── <feature-name>/              ← lowercase-hyphenated
    ├── prd.md                   ← ALWAYS this exact name
    ├── prd-context-<name>.md    ← Discovery output
    ├── prd-<sub-feature>.md     ← Feature documents (hub-and-spoke)
    ├── prd-summary.md           ← Export output (stakeholders)
    ├── tasks.md                 ← Implementation tasks
    └── diagrams/
        ├── state-machine.mmd
        ├── user-flow.mmd
        └── data-model.mmd
```

---

## Common Workflows

### Fast Path (1-Pager)
```bash
/prd-discover dark-mode                                    # 10m
/prd-draft prd/dark-mode/prd-context-dark-mode.md --format 1pager  # 5m
/prd-validate prd/dark-mode/prd.md                         # 2m
# Total: ~20 minutes
```

### Standard Path (Full PRD)
```bash
/prd-discover user-auth                                    # 15m
/prd-draft prd/user-auth/prd-context-user-auth.md          # 10m
/prd-analyze prd/user-auth/prd.md                          # 5m
/prd-refine prd/user-auth/prd.md                           # 20m
/prd-export prd/user-auth/prd.md                           # 3m
/prd-tasks prd/user-auth/prd.md                            # 5m
# Total: ~60 minutes
```

### Adding Features to Existing PRDs
```bash
/prd-add-feature prd/my-product/prd.md notifications       # 15-30m
/prd-validate prd/my-product/prd-notifications.md           # 2m
/prd-analyze prd/my-product/prd-notifications.md            # 5m
# Total: ~30-45 minutes
```

### Maintenance
```bash
/prd-status                                                # Check portfolio
/prd-validate prd/my-feature/prd.md                        # After edits
/prd-diff prd/my-feature/prd.md                            # Review changes
/prd-analyze prd/my-feature/prd.md                         # Quality check
```

---

## Common Prompts

### Getting Started
```bash
# Start new PRD with discovery
/prd-discover <feature-name>

# Quick 1-pager from inline brief
/prd-draft --format 1pager "Feature description here"

# Check all PRDs
/prd-status
```

### Quality & Refinement
```bash
# Full quality analysis
/prd-analyze prd/my-feature/prd.md

# Improve PRD interactively
/prd-refine prd/my-feature/prd.md

# Quick structural check
/prd-validate prd/my-feature/prd.md
```

### Generating Artifacts
```bash
# Stakeholder summary
/prd-export prd/my-feature/prd.md

# Implementation tasks
/prd-tasks prd/my-feature/prd.md

# All diagrams
/prd-diagram prd/my-feature/prd.md all
```

### Adding Features
```bash
# Add feature to existing PRD
/prd-add-feature prd/my-product/prd.md new-capability

# Add feature (will prompt for name)
/prd-add-feature prd/my-product/prd.md
```

### Navigation & Search
```bash
# View all PRDs with health status
/prd-status

# Find PRDs needing work
/prd-status "needs work"

# Search across all PRDs
/prd-search authentication

# Compare versions
/prd-diff prd/my-feature/prd.md
```

---

## Format Flags

```bash
# Explicit format override
/prd-draft --format 1pager <context-file>
/prd-draft --format pitch <context-file>
/prd-draft --format ai <context-file>

# Auto-detect from context "Detail Level"
/prd-draft <context-file>

# Inline brief (always specify format)
/prd-draft --format 1pager "Feature description"
```

---

## Diagram Types

```bash
# All applicable diagrams (default)
/prd-diagram prd/my-feature/prd.md
/prd-diagram prd/my-feature/prd.md all

# Specific diagram only
/prd-diagram prd/my-feature/prd.md state-machine
/prd-diagram prd/my-feature/prd.md user-flow
/prd-diagram prd/my-feature/prd.md data-model
```

---

## Troubleshooting

| Issue | Quick Fix |
|-------|-----------|
| Skill not found | Restart Claude session, check `.claude/skills/` |
| Draft fails | Verify template exists in `.claude/templates/` |
| Low quality score | Run `/prd-refine` to improve systematically |
| Git diff fails | Use two-file mode: `/prd-diff <file1> <file2>` |
| Placeholders found | Run `/prd-refine` or replace manually |
| Empty sections | Delete or populate via `/prd-refine` |

---

## Key Anti-Patterns

❌ **Solution-as-problem**: "Users can't [feature]"
✅ **Better**: "Users abandon at step 3 (40% drop-off rate)"

❌ **Vague criteria**: "Improve user satisfaction"
✅ **Better**: "Increase NPS from 42 to 55 within 3 months"

❌ **Missing evidence**: "Users are frustrated"
✅ **Better**: "15 user interviews, 80% cited confusion at payment step"

❌ **Hollow language**: "Intuitive, seamless, modern"
✅ **Better**: "Reduce clicks from 8 to 3"

---

## Best Practices

✓ Use discovery for complex features (better results than inline briefs)
✓ Run analyze after draft to catch issues early
✓ Address CRITICAL findings before implementation
✓ Run diff before committing to review changes
✓ Use strict file naming: `prd/<name>/prd.md`
✓ Generate artifacts (export/tasks/diagrams) after refinement
✓ Update revision history in PRD metadata

---

**Full Guide**: [docs/prd-skills-complete-guide.md](./prd-skills-complete-guide.md)
**Recommended Prompts**: [docs/prd-recommended-prompts.md](./prd-recommended-prompts.md)
