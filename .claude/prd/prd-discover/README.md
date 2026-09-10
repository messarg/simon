# PRD Discover Skill

Runs a structured discovery session to gather context before writing a PRD. This is step 1 of the PRD pipeline.

## What It Does

Asks targeted questions to understand the problem, users, scope, constraints, and success criteria. Saves the structured output as a context file ready for the drafting step.

**This skill gathers context only — it does not write a PRD.**

## Usage

```
/prd-discover <feature-name>
```

## Questions Asked

1. **Problem** — What problem are we solving? What evidence exists?
2. **Users** — Who are the target users? Roles and permissions?
3. **Scope** — What's in scope for this version? What's out?
4. **Constraints** — Technical constraints (platform, language, database, etc.)?
5. **Success criteria** — Measurable KPIs?

## Inputs / Outputs

| Input | Output |
|-------|--------|
| Feature name (e.g. `user-auth`) | `prd/<feature-name>/prd-context-<feature-name>.md` |

## Workflow Context

```
[Discover] → Draft → Analyze → Refine
```

## Tools Used

`AskUserQuestion`, `Write`
