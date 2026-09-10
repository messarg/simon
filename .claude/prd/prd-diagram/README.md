# PRD Diagram Skill

Generates Mermaid diagrams from structured PRD sections. Supports three diagram types: state machines (from Section 10), user flows (from Section 6), and data models (from Section 8). Output is `.mmd` files renderable in any Mermaid-compatible viewer.

## Usage

```
/prd-diagram <path-to-prd.md>                    # Generate all diagrams
/prd-diagram <path-to-prd.md> state-machine       # State machine only
/prd-diagram <path-to-prd.md> user-flow           # User flows only
/prd-diagram <path-to-prd.md> data-model          # Data model only
```

## Output

`prd/<feature-name>/diagrams/<type>.mmd`
