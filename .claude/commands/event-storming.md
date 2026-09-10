---
name: event-storming
description: AI-simulated event storming workshop with multi-persona support. Use when discovering domain events, commands, actors, and bounded contexts. Supports three modes - full-simulation (5 persona agents debate), quick (single-pass analysis), and guided (interactive with user). Orchestrates persona agents and synthesizes results.
argument-hint: <domain-description> [--mode full|quick|guided] [--dir <path>]
allowed-tools: Read, Write, Glob, Grep, Skill, Task, AskUserQuestion
---

Read `.claude/event-storm/SKILL.md` and execute its full instructions with `$ARGUMENTS` as the domain description and optional mode/dir flags.
