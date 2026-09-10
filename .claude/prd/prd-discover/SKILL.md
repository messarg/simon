---
name: prd-discover
description: Run a structured discovery session to gather context before writing a PRD
argument-hint: <feature-name>
user-invocable: true
disable-model-invocation: true
allowed-tools: [AskUserQuestion, Write]
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Run a structured discovery session that produces a context file ready for PRD drafting. Ask targeted questions to understand the problem, users, scope, constraints, and success criteria. Save the output as a structured markdown file.

## Execution Steps

### 1. Resolve Feature Name

- If `$ARGUMENTS` is empty, ask the user for a short feature name and stop.
- Use the feature name to derive the output file path: `prd/<feature-name>/prd-context-<feature-name>.md` (kebab-case).

### 2. Discovery Questions

Ask the user the following questions (batch where possible using AskUserQuestion). Do not proceed to writing until you have substantive answers for at least questions 1–3.

1. **Problem** — What problem are we solving? Who experiences it and how painful is it?
2. **Evidence** — What data, research, or customer feedback supports this? (user research, support tickets, analytics, competitive gaps — "None yet" is fine)
3. **Users** — Who are the target users? What are their roles and permissions?
4. **Scope** — What's in scope for this version? What's explicitly out?
5. **Constraints** — Are there technical constraints? (platform, language, database, auth method, hosting)
6. **Success criteria** — What does success look like? Measurable KPIs?
7. **Competitive landscape** — What alternatives exist today? Where do they fall short?
8. **Detail level** — Do you need a full PRD, a concise 1-pager, a Shape Up pitch, or an AI product PRD?

Follow up on any answers that are vague or incomplete. It's better to ask good questions than to draft a hollow document.

### 3. Save Context File

Once you have enough context, write a structured markdown file to `prd/<feature-name>/prd-context-<feature-name>.md` with this format:

```markdown
# PRD Context: <Feature Name>

**Created:** <date>

## Problem Statement
<summarized from user answers>

## Evidence
<data, tickets, research cited by user — or "None provided">

## Competitive Landscape
<alternatives and their shortcomings — or "None identified">

## Target Users
<roles, permissions, personas>

## Scope
### In Scope
- ...
### Out of Scope
- ...

## Technical Constraints
<platform, language, infra constraints — or "None specified">

## Success Criteria & KPIs
- ...

## Detail Level
<full PRD / 1-pager / Shape Up pitch — default: full PRD>

## Additional Context
<anything else the user mentioned>
```

### 4. Confirm

Tell the user the context file has been saved and suggest next steps:
- Run `/prd-draft prd/<feature-name>/prd-context-<feature-name>.md` to generate a first draft
- Or continue refining context manually

## Operating Principles

- Do not write a PRD — only gather and structure context
- Ask follow-up questions when answers are vague
- Keep the context file concise and factual — no filler
