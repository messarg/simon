# PRD Builder

**Complete PRD generation and refinement system with 13 specialized skills for product requirements documentation**

Version: 1.0.0 | License: MIT | Category: Productivity

## Overview

PRD Builder is a comprehensive Claude Code plugin that transforms the tedious process of writing Product Requirements Documents into a structured, quality-driven workflow. Whether you're documenting a new feature, planning a product launch, or pitching an idea, PRD Builder provides the templates, tools, and guidance to create professional, actionable PRDs.

### Why PRD Builder?

- **Structured Process**: Guided discovery ensures you gather the right context before writing
- **Multiple Formats**: 5 template types for different use cases (Full PRD, 1-Pager, Pitch, AI PRD, Feature Doc)
- **Quality-Driven**: 54-point rubric automatically scores PRDs and identifies gaps
- **Iterative Refinement**: Interactive improvement process with targeted questions
- **Complete Workflow**: From discovery to stakeholder summary to engineering tasks
- **Production-Ready**: Battle-tested templates with proven workflows

### What's Included?

- **13 Skills** organized into logical workflow stages
- **5 Templates** covering different documentation needs
- **Comprehensive Guides** with 400+ example prompts
- **Quality Rubrics** with severity-based issue identification
- **Best Practices** baked into every template and skill

## Features

### Core Workflow Skills

#### 1. **prd-discover** - Context Gathering
Start every PRD with structured discovery. Asks 8 targeted questions to gather comprehensive context before writing.

**When to use**: Beginning a new PRD
**Output**: `prd/<feature-name>/prd-context-<feature-name>.md`

```bash
/prd-discover mobile-notifications
```

#### 2. **prd-draft** - PRD Generation
Generate complete first-draft PRD from context file or inline brief. Auto-detects template type.

**When to use**: After discovery, or when you have clear requirements
**Output**: `prd/<feature-name>/prd.md`
**Formats**: `--format full` (default), `--format 1pager`, `--format pitch`, `--format ai`

```bash
/prd-draft prd/mobile-notifications/prd-context-mobile-notifications.md
/prd-draft "Add dark mode support" --format 1pager
```

#### 3. **prd-analyze** - Quality Analysis
Analyze PRD for completeness, consistency, and quality using template-specific rubric.

**When to use**: After drafting, before sharing
**Output**: Terminal report (read-only, no modifications)
**Rubrics**: 54 points (Full PRD), 20 points (1-Pager), 16 points (Pitch), 64 points (AI PRD)

```bash
/prd-analyze prd/mobile-notifications/prd.md
```

#### 4. **prd-refine** - Interactive Improvement
Iteratively improve PRD based on analysis findings. Guides section-by-section fixes with targeted questions.

**When to use**: When analysis shows quality < 65% or CRITICAL issues
**Output**: Updated PRD (in-place) + final quality score
**Goal**: Score ≥65% with no CRITICAL findings

```bash
/prd-refine prd/mobile-notifications/prd.md
```

#### 5. **prd-add-feature** - Feature Addition
Add new features to existing PRD. Hub-and-spoke model: create separate feature docs or update parent in-place.

**When to use**: Extending an existing product PRD
**Output**: `prd/<parent-folder>/prd-<feature-name>.md` OR updated parent PRD

```bash
/prd-add-feature prd/mobile-app/prd.md push-notifications
```

### Post-Pipeline Skills

#### 6. **prd-export** - Executive Summary
Generate condensed stakeholder-friendly summary from PRD (1-2 pages).

**When to use**: PRD is refined and ready to share
**Output**: `prd/<feature-name>/prd-summary.md`

```bash
/prd-export prd/mobile-notifications/prd.md
```

#### 7. **prd-tasks** - Task Breakdown
Extract implementation task breakdown from PRD functional requirements.

**When to use**: PRD is finalized and ready for implementation planning
**Output**: `prd/<feature-name>/tasks.md`
**Format**: Tasks grouped by priority (P0/P1/P2) with complexity (S/M/L), dependencies, acceptance criteria

```bash
/prd-tasks prd/mobile-notifications/prd.md
```

#### 8. **prd-diagram** - Diagram Generation
Generate Mermaid diagrams from structured PRD sections.

**When to use**: Need visual aids for presentations or developer onboarding
**Output**: `prd/<feature-name>/diagrams/<type>.mmd`
**Types**: `state-machine`, `user-flow`, `data-model`

```bash
/prd-diagram prd/mobile-notifications/prd.md state-machine
/prd-diagram prd/mobile-notifications/prd.md user-flow
```

#### 9. **prd-ui-prototype** - UI Prototype Generation
Generate interactive UI prototypes from PRD using frontend-design skill integration.

**When to use**: PRD is refined and you need visual mockups
**Output**: `prd/<feature-name>/prototype-ui/*.html` (components, design spec, navigation index)

```bash
/prd-ui-prototype prd/mobile-notifications/prd.md
```

### Analysis & Navigation Skills

#### 10. **prd-status** - Dashboard Overview
Dashboard showing all PRDs with status and quality assessment.

**When to use**: Starting a session to see what needs attention
**Output**: Terminal report (read-only)

```bash
/prd-status
/prd-status notifications  # Filter by keyword
```

#### 11. **prd-validate** - Structural Lint Check
Lightweight structural lint check (faster than full analysis).

**When to use**: Quick check during editing
**Output**: Terminal report (pass/fail with issues)
**Checks**: Section headers, metadata, placeholders, requirement formatting, table integrity

```bash
/prd-validate prd/mobile-notifications/prd.md
```

#### 12. **prd-diff** - Version Comparison
Compare PRD versions showing section-by-section changes.

**When to use**: Reviewing changes before committing or after a refine session
**Output**: Terminal report with sections added/removed/modified

```bash
/prd-diff prd/mobile-notifications/prd.md           # Compare vs git HEAD
/prd-diff prd/mobile-notifications/prd.md prd/mobile-notifications/prd-v2.md  # Compare two files
```

#### 13. **prd-search** - Full-Text Search
Full-text search across all PRDs.

**When to use**: Finding content across multiple PRDs
**Output**: Terminal report with matching PRDs, sections, and context

```bash
/prd-search "push notification"
/prd-search "authentication"
```

## Installation

### Prerequisites

- Claude Code CLI installed
- Git

### Install via Marketplace

```bash
# Add marketplace to known marketplaces (one-time setup)
# Edit ~/.claude/plugins/known_marketplaces.json to include:
# "tato-plugins": {"source": {"source": "github", "repo": "tato/tato-claude-plugins"}}

# Install plugin
/plugin install prd-builder@tato-plugins

# Verify installation
/help | grep prd-
```

### Verify Installation

Test that the plugin is working:

```bash
# Check status (should show no PRDs if this is your first time)
/prd-status

# Verify skills are available
/help | grep prd-

# You should see all 13 skills listed
```

## Quick Start

### Your First PRD in 5 Commands

```bash
# 1. Start a discovery session
/prd-discover user-authentication

# Answer the 8 discovery questions...
# Output: prd/user-authentication/prd-context-user-authentication.md

# 2. Generate the PRD
/prd-draft prd/user-authentication/prd-context-user-authentication.md

# Output: prd/user-authentication/prd.md

# 3. Analyze quality
/prd-analyze prd/user-authentication/prd.md

# Review quality score and findings...

# 4. Refine iteratively
/prd-refine prd/user-authentication/prd.md

# Answer improvement questions...
# Output: Updated prd/user-authentication/prd.md

# 5. Export for stakeholders
/prd-export prd/user-authentication/prd.md

# Output: prd/user-authentication/prd-summary.md
```

### Skip Discovery (Quick Draft)

If you already know what you want:

```bash
# Draft from inline brief
/prd-draft "Add password reset functionality via email with magic links. Users should receive a time-limited link that expires after 1 hour. Support rate limiting to prevent abuse."

# Draft a 1-pager
/prd-draft "Implement dark mode" --format 1pager

# Draft a Shape Up pitch
/prd-draft "Add collaborative editing" --format pitch
```

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    CORE WORKFLOW                        │
└─────────────────────────────────────────────────────────┘

  START
    │
    ▼
┌─────────────────┐
│  prd-discover   │ ── Gather context via 8 questions
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   prd-draft     │ ── Generate first draft from context
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  prd-validate   │ ── Quick structural check
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  prd-analyze    │ ── Full quality analysis (54-pt rubric)
└────────┬────────┘
         │
         ├──── Quality < 65%? ──► prd-refine ──┐
         │                                     │
         ▼                                     │
    Quality ≥ 65% ◄───────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│          POST-PIPELINE OUTPUTS              │
├─────────────────────────────────────────────┤
│  prd-export       → Executive summary       │
│  prd-tasks        → Engineering tasks       │
│  prd-diagram      → Visual diagrams         │
│  prd-ui-prototype → Interactive mockups     │
└─────────────────────────────────────────────┘
         │
         ▼
      COMPLETE

┌─────────────────────────────────────────────────────────┐
│              ANALYSIS & NAVIGATION                      │
├─────────────────────────────────────────────────────────┤
│  prd-status    → Dashboard overview                     │
│  prd-diff      → Version comparison                     │
│  prd-search    → Full-text search                       │
│  prd-add-feature → Extend existing PRD                  │
└─────────────────────────────────────────────────────────┘
```

## Templates

PRD Builder includes 5 production-ready templates:

| Template | Sections | Rubric | Use Case |
|----------|----------|--------|----------|
| **Full PRD** | 22 | 54 pts | Comprehensive product specifications, major features, new products |
| **1-Pager** | 7 | 20 pts | Quick feature proposals, early-stage ideas, rapid validation |
| **Shape Up Pitch** | 6 | 16 pts | Basecamp Shape Up methodology, appetite-driven planning |
| **AI Product PRD** | 27 | 64 pts | AI/ML products with model performance, data pipelines, drift detection |
| **Feature Document** | 11 | 14 pts | Individual features within hub-and-spoke model |

### Template Selection

Templates are auto-detected based on:
1. Explicit `--format` flag in `/prd-draft`
2. "Detail Level" section in context file from `/prd-discover`
3. Default: Full PRD

### Quality Thresholds

| Template | Max Score | Threshold (65%) | Critical Sections |
|----------|-----------|-----------------|-------------------|
| Full PRD | 54 | ≥35 | 12 required sections |
| 1-Pager | 20 | ≥13 | All 7 sections |
| Pitch | 16 | ≥10 | All 6 sections |
| AI PRD | 64 | ≥42 | 17 required sections |
| Feature Doc | 14 | ≥9 | 8 required sections |

## Configuration

### Output Paths

All PRDs are created in the `prd/` directory relative to your current working directory:

```
your-project/
├── prd/
│   ├── feature-a/
│   │   ├── prd.md                    # Main PRD
│   │   ├── prd-context-feature-a.md # Discovery context
│   │   ├── prd-summary.md            # Executive summary
│   │   ├── tasks.md                  # Task breakdown
│   │   ├── diagrams/                 # Mermaid diagrams
│   │   │   ├── state-machine.mmd
│   │   │   ├── user-flow.mmd
│   │   │   └── data-model.mmd
│   │   └── prototype-ui/             # UI prototypes
│   │       ├── component-name.html
│   │       ├── design-spec.md
│   │       └── index.html
│   └── feature-b/
│       └── ...
```

### Template Customization

Templates are included with the plugin. To customize:

1. Copy a template to your project
2. Modify sections, rubrics, or examples
3. Reference custom template in skill arguments (future feature)

Current templates are located at:
- `${CLAUDE_PLUGIN_ROOT}/templates/prd-template.md`
- `${CLAUDE_PLUGIN_ROOT}/templates/prd-template-1pager.md`
- `${CLAUDE_PLUGIN_ROOT}/templates/prd-template-pitch.md`
- `${CLAUDE_PLUGIN_ROOT}/templates/prd-template-ai.md`
- `${CLAUDE_PLUGIN_ROOT}/templates/prd-feature-template.md`

## Best Practices

### When to Use Each Skill

**Start with discovery** (`/prd-discover`) unless:
- You have a very clear, simple feature in mind
- You're documenting something that's already fully specified elsewhere

**Use 1-Pager** for:
- Early-stage ideas that need validation
- Quick feature proposals for internal discussion
- Rapid experiments or MVPs

**Use Shape Up Pitch** for:
- Basecamp-style appetite-driven planning
- Projects with hard time constraints (Small Batch = 1-2 weeks, Big Batch = 6 weeks)
- Teams familiar with Shape Up methodology

**Use AI Product PRD** for:
- Products with ML/AI components
- Features requiring model training or inference
- Systems with data pipelines or drift concerns

**Use Feature Document** for:
- Individual features within a larger product
- Extending existing PRDs via `/prd-add-feature`
- Hub-and-spoke documentation model

### Quality Gates

Before sharing a PRD:
1. Run `/prd-validate` for quick structural check
2. Run `/prd-analyze` for comprehensive quality analysis
3. Aim for score ≥65% of template maximum with no CRITICAL findings
4. Use `/prd-refine` to systematically address gaps

### Version Control

Add to your `.gitignore`:
```
# Generated PRDs (optional - depends on team workflow)
prd/*/prd.md
prd/*/prd-summary.md
prd/*/tasks.md
prd/*/diagrams/
prd/*/prototype-ui/

# Always ignore context files (working documents)
prd/*/prd-context-*.md
```

Commit templates and skill configurations:
```bash
git add .claude-plugin/
git add templates/
git commit -m "Add PRD Builder plugin"
```

## Troubleshooting

### Common Issues

**Problem**: Skills not found after installation
**Solution**: Restart Claude session or run `/help` to force reload

**Problem**: Templates not found (template path errors)
**Solution**: Verify plugin installed correctly with `/plugin list`. Templates should be at `${CLAUDE_PLUGIN_ROOT}/templates/`

**Problem**: Quality score seems too low
**Solution**: Different template types have different max scores. Check which template type your PRD uses (metadata at top). Full PRD = 54 pts max, 1-Pager = 20 pts max

**Problem**: `/prd-status` shows no PRDs
**Solution**: PRDs must be in `prd/<feature-name>/prd.md` format relative to your current directory. Run from project root or `cd` to the directory containing the `prd/` folder

**Problem**: `/prd-refine` isn't asking questions
**Solution**: The skill only asks questions for sections with identified gaps. If your PRD is already high-quality, there may be no questions to ask. Check `/prd-analyze` output first

### Getting Help

- [Comprehensive Guide](./docs/prd-skills-complete-guide.md) - 68KB detailed documentation
- [Quick Reference](./docs/prd-quick-reference.md) - Cheat sheet and command reference
- [Example Prompts](./docs/prd-recommended-prompts.md) - 400+ scenario-based prompts
- [GitHub Issues](https://github.com/tato/tato-claude-plugins/issues) - Report bugs or request features

## Advanced Usage

### Parallel Workflows

Generate multiple PRDs simultaneously:

```bash
# In separate Claude sessions or sequentially
/prd-discover user-onboarding
/prd-discover payment-processing
/prd-discover analytics-dashboard

# Then draft all
/prd-draft prd/user-onboarding/prd-context-user-onboarding.md
/prd-draft prd/payment-processing/prd-context-payment-processing.md
/prd-draft prd/analytics-dashboard/prd-context-analytics-dashboard.md
```

### Hub-and-Spoke Model

Organize complex products with a parent PRD and feature documents:

```bash
# Create parent PRD
/prd-discover mobile-app
/prd-draft prd/mobile-app/prd-context-mobile-app.md

# Add features to parent
/prd-add-feature prd/mobile-app/prd.md push-notifications
/prd-add-feature prd/mobile-app/prd.md offline-mode
/prd-add-feature prd/mobile-app/prd.md in-app-purchases

# Result:
# prd/mobile-app/
#   ├── prd.md                          # Parent PRD
#   ├── prd-push-notifications.md       # Feature doc
#   ├── prd-offline-mode.md             # Feature doc
#   └── prd-in-app-purchases.md         # Feature doc
```

### Custom Analysis Workflows

Combine skills for custom workflows:

```bash
# Quality gate for CI/CD
/prd-validate prd/my-feature/prd.md && /prd-analyze prd/my-feature/prd.md

# Full export package
/prd-export prd/my-feature/prd.md
/prd-tasks prd/my-feature/prd.md
/prd-diagram prd/my-feature/prd.md state-machine
/prd-diagram prd/my-feature/prd.md user-flow
/prd-ui-prototype prd/my-feature/prd.md

# Search and compare
/prd-search "authentication"
/prd-diff prd/feature-a/prd.md prd/feature-b/prd.md
```

## Documentation

### Included Documentation

- **[Complete Guide](./docs/prd-skills-complete-guide.md)** (68KB) - Comprehensive documentation with examples, workflows, and best practices
- **[Quick Reference](./docs/prd-quick-reference.md)** (7KB) - Command cheat sheet and quick lookup
- **[Recommended Prompts](./docs/prd-recommended-prompts.md)** (20KB) - 400+ scenario-based example prompts

### External Resources

- [Basecamp Shape Up](https://basecamp.com/shapeup) - Methodology behind the Pitch template
- [Product Management Templates](https://www.productplan.com/templates/) - Additional PM resources
- [Writing Great PRDs](https://svpg.com/assets/Files/goodprd.pdf) - Marty Cagan's classic guide

## Changelog

### v1.0.0 (February 2026)

**Initial release** with 13 production-ready skills:

- Core workflow: discover, draft, analyze, refine, add-feature
- Post-pipeline: export, tasks, diagram, ui-prototype
- Analysis & navigation: status, validate, diff, search
- 5 templates: Full PRD, 1-Pager, Pitch, AI PRD, Feature Doc
- Quality rubrics with automated scoring
- Comprehensive documentation

## License

MIT License - see [LICENSE](../../LICENSE) for details

## Support

- **Issues**: [GitHub Issues](https://github.com/tato/tato-claude-plugins/issues)
- **Discussions**: [GitHub Discussions](https://github.com/tato/tato-claude-plugins/discussions)
- **Documentation**: [Complete Guide](./docs/prd-skills-complete-guide.md)

## Contributing

Contributions welcome! Areas for contribution:
- New template types
- Additional skill workflows
- Quality rubric improvements
- Documentation and examples
- Bug fixes and improvements

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines. *(Coming soon)*

---

**Plugin**: PRD Builder v1.0.0
**Marketplace**: tato-plugins
**Author**: [tato](https://github.com/tato)
**License**: MIT
