# PRD UI Prototype Skill

Generates interactive visual UI prototypes from a PRD using **frontend-design principles**. Creates distinctive, production-grade HTML/CSS/JS prototypes with bold aesthetic choices that avoid generic AI-generated interfaces.

## Design Methodology

This skill applies the exact **frontend-design principles** (from claude-plugins-official/frontend-design) to create distinctive, production-grade prototypes:

**Design Thinking:**
- Purpose: What problem does this solve?
- Tone: Pick an extreme aesthetic direction
- Constraints: Respect technical requirements
- Differentiation: Make it unforgettable

**Aesthetics Guidelines:**
- Typography: Beautiful, unique fonts (avoid Arial, Inter, Roboto)
- Color & Theme: Dominant colors with sharp accents
- Motion: High-impact animations with staggered reveals
- Spatial Composition: Unexpected layouts, asymmetry, generous spacing
- Backgrounds & Details: Atmosphere over solid colors

Each prototype is context-specific and intentionally designed to avoid cookie-cutter AI aesthetics.

## Usage

```
/prd-ui-prototype <path-to-prd.md>
```

Example:
```
/prd-ui-prototype prd/user-authentication/prd.md
```

## Output

Creates `prd/<feature-name>/prototype-ui/` folder containing:

- `*.html` — Component prototypes (one per selected component)
- `design-spec.md` — Design decisions and rationale
- `index.html` — Navigation index for all prototypes

## How It Works

1. Reads the PRD to extract UI requirements and context
2. **Checks for existing prototypes** and preserves design choices if found
3. Asks interactive questions about:
   - Which components to prototype
   - Fidelity level (wireframes, styled mockups, production-ready)
   - Aesthetic direction (minimal, bold, professional, etc.)
   - Interactivity level (static, basic, full)
4. Applies frontend-design methodology to generate each prototype
5. Saves HTML files with consistent kebab-case naming
6. Creates design specification and navigation index

## Handling Existing Prototypes

**Smart overwrite protection:**
- Automatically detects when prototypes already exist
- Warns you before overwriting with component count
- Offers timestamped backup: `prototype-ui-backup-YYYYMMDD-HHMMSS/`
- Preserves previous design choices (aesthetic, fidelity, interactivity)
- Previous choices shown in questions: "What fidelity? (Previous: medium)"

**Backup naming convention:**
```
prd/<feature-name>/prototype-ui-backup-20260213-143022/
```

Backups include all previous prototypes, design specs, and index files for safe comparison.

## Tips

- Run after `/prd-refine` when requirements are stable
- Select components strategically (don't prototype everything at once)
- Use high-fidelity mode for stakeholder presentations
- Share `index.html` with stakeholders for easy navigation
- Generated prototypes work in any browser, no build step required
- Re-run the skill to iterate—previous design choices are remembered
- Compare backups to see design evolution over time
