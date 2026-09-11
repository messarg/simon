#!/usr/bin/env python3
"""Structural consistency checks for docs/prd.md.

The PRD is the authoritative spec, and its three indexes must agree:

  §9  FR index      every requirement, and which criterion verifies it
  §23.1 build order every criterion, and which layer proves it
  §27 criteria      the criteria themselves

Editing §11 or §27 without updating the sections that index them is the
failure mode this exists to catch: it happened five times across three
review rounds in September 2026, each time silently, each time found only
by reading the whole document again.

Run: npm run check:prd
"""

import re
import sys
from pathlib import Path

PRD = Path(__file__).resolve().parent.parent / "docs" / "prd.md"
DASHES = "–—-"  # en dash, em dash, hyphen — the PRD uses all three


def section(text, start_pat, end_pat):
    """Return the slice of text between two heading patterns."""
    start = re.search(start_pat, text, re.M)
    if not start:
        return ""
    rest = text[start.end():]
    end = re.search(end_pat, rest, re.M)
    return rest[: end.start()] if end else rest


def criterion_refs(blob):
    """Every §27.N mentioned, expanding §27.A–§27.B spans."""
    found = set()
    span = re.compile(r"§27\.(\d+)\s*[" + DASHES + r"]\s*§?27\.(\d+)")
    for a, b in span.findall(blob):
        found.update(range(int(a), int(b) + 1))
    found.update(int(n) for n in re.findall(r"§27\.(\d+)", blob))
    return found


def main():
    if not PRD.exists():
        print(f"FAIL  cannot find {PRD}")
        return 1

    text = PRD.read_text(encoding="utf-8")
    failures = []
    notes = []

    # ---- the three indexes -------------------------------------------------
    crit_body = section(text, r"^## 27\.", r"^## \d+\.")
    criteria = {int(m) for m in re.findall(r"^(\d+)\.\s", crit_body, re.M)}

    fr_rows = re.findall(r"^\|\s*\*\*(FR-[A-Z]+-\d+)\*\*\s*\|(.*)$", text, re.M)
    fr_ids = {fid for fid, _ in fr_rows}
    fr_verifies = {}
    for fid, row in fr_rows:
        fr_verifies[fid] = criterion_refs(row)

    layers_body = section(text, r"^### 23\.1", r"^###? ")
    # layer rows look like: | **2 — Services** | ... |
    layer_rows = [
        r for r in layers_body.splitlines()
        if re.match(r"^\|\s*\*\*\d+\s*[" + DASHES + r"]", r)
    ]
    layered = set()
    for row in layer_rows:
        layered |= criterion_refs(row)

    if not criteria:
        failures.append("could not parse any §27 criteria — has the format changed?")
    if not fr_ids:
        failures.append("could not parse the FR index — has the format changed?")
    if not layer_rows:
        failures.append("could not parse §23.1's layer table — has the format changed?")

    # ---- A. every criterion is verified by a requirement --------------------
    verified = set()
    for refs in fr_verifies.values():
        verified |= refs
    # The PRD declares its own deliberate orphans, beside the prose that
    # justifies them. An exception a tool cannot see is one somebody deletes.
    exempt = set()
    marker = re.search(
        r"<!--\s*prd-check:\s*criteria-without-requirement\s*=\s*([^>]*?)-->", text
    )
    if marker:
        exempt = {int(n) for n in re.findall(r"27\.(\d+)", marker.group(1))}

    orphan_criteria = sorted(criteria - verified - exempt)
    if orphan_criteria:
        failures.append(
            "criteria with no FR row pointing at them: "
            + ", ".join(f"§27.{n}" for n in orphan_criteria)
        )

    # ---- B. every criterion is proved in a build layer ----------------------
    unlayered = sorted(criteria - layered)
    if unlayered:
        failures.append(
            "criteria assigned to no §23.1 layer: "
            + ", ".join(f"§27.{n}" for n in unlayered)
        )

    # ---- C. no index points at a criterion that does not exist -------------
    for label, refs in (("FR index", verified), ("§23.1", layered)):
        ghosts = sorted(refs - criteria)
        if ghosts:
            failures.append(
                f"{label} cites criteria that do not exist: "
                + ", ".join(f"§27.{n}" for n in ghosts)
            )

    # ---- D. every FR id used in prose exists in the index -------------------
    used = set(re.findall(r"\b(FR-[A-Z]+-\d+)\b", text))
    missing_fr = sorted(used - fr_ids)
    if missing_fr:
        failures.append("FR ids referenced but not defined: " + ", ".join(missing_fr))

    # ---- E. counts that rot --------------------------------------------------
    # §23.1 warns that "a claim with a count in it is a claim that rots quietly",
    # and it was right: layer 1 said "All 37 models" long after there were 41.
    models_body = section(text, r"^## 11\.", r"^## \d+\.")
    model_names = set(
        re.findall(r"^\|\s*\*\*([A-Z][A-Za-z]+)\*\*[^|]*\|", models_body, re.M)
    )
    for claim, n in re.findall(r"\b(?:All|all)\s+(\d+)\s+(models)\b", text):
        notes.append(
            f"§23.1 states a model count ({claim}); §11 currently defines "
            f"{len(model_names)}. Prefer no count at all."
        )
    for span in re.findall(r"\b(twenty|thirty|forty)[" + DASHES + r"]?\w*\s+(?:models|criteria)\b", text):
        notes.append(f"a spelled-out count of models/criteria appears ('{span}') — counts rot")

    # ---- report -------------------------------------------------------------
    print(f"PRD consistency — {PRD.relative_to(PRD.parents[1])}")
    print(f"  {len(criteria)} criteria · {len(fr_ids)} requirements · "
          f"{len(layer_rows)} layers · {len(model_names)} models")
    if exempt:
        print("  note  declared exempt from needing a requirement: "
              + ", ".join(f"§27.{n}" for n in sorted(exempt)))

    for n in notes:
        print(f"  note  {n}")

    if failures:
        print()
        for f in failures:
            print(f"  FAIL  {f}")
        print(f"\n{len(failures)} check(s) failed.")
        return 1

    print("  ok    every criterion has a requirement and a layer")
    print("  ok    no index cites a criterion or FR id that does not exist")
    return 0


if __name__ == "__main__":
    sys.exit(main())
