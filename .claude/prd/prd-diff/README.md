# PRD Diff Skill

Compares the current working copy of a PRD against its last committed version in git. Produces a section-by-section change summary showing additions, removals, and modifications with word count deltas.

## Usage

```
/prd-diff <path-to-prd.md>                    # Compare vs git HEAD
/prd-diff <path-to-v1.md> <path-to-v2.md>     # Compare two files
```

## Output

Terminal report (read-only, no files modified).
