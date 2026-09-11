# Persona reports — Phase 1 working record

These five documents are the raw Phase 1 ("chaotic exploration") output of the event storming
workshop run on 2026-09-10. Each persona read `docs/prd.md` independently and reported without
seeing the others' work. The synthesis — `../buy-sell-cycle-2026-09-10.md` — compresses them
heavily; these are kept because several sections are more directly usable than the summary:

| File | Kept for |
|:--|:--|
| `persona-business-analyst.md` | 11 Given/When/Then acceptance criteria, written to become Vitest/Supertest cases without further interpretation; the full command→event and actor→command tables |
| `persona-developer.md` | 18 named transaction boundaries (TB-1…TB-13 server-side, TB-C1…TB-C5 IndexedDB) — effectively a spec for the service layer; the replay-safety classes |
| `persona-devils-advocate.md` | All 25 hot spots with full reasoning and line references. The synthesis carries roughly the top half |
| `persona-domain-expert.md` | 52 edge cases from Armenian small-shop practice, and the Armenian/English glossary |
| `persona-product-owner.md` | The complete per-row MoSCoW table and the eight §23 roadmap disagreements with rationale |

**Provenance caveat.** These are Phase 1 only. Three conclusions in them were **overturned** by
the Phase 6 challenge round and should not be read as final — most importantly the treatment of
costing as a shared kernel, which the synthesis moves into the Stock Ledger context. Where a
persona report and the synthesis disagree, **the synthesis is the later and better-tested
position**.

Claims marked `[VERIFIED]` in the synthesis were checked directly against the PRD or by
arithmetic; claims in these reports were not independently checked except where the synthesis
says so.
