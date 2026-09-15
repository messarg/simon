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

Checks F-K cover the second failure mode, found by six more review rounds:
a member is added to an enumerated set and the other lists enumerating that
set are not re-walked. A blind return was audited in two places and missing
from the list that enumerates auditing; a repayment reversal was added to
that list and not to the one requiring a reason; a correction pay-out was
added to the cash ledger and not to its source rule. Each was invisible to
a reader and is one line to a script. Sets that live in prose declare their
membership in a <!-- prd-check: key = ... --> marker beside the argument for
them, for the reason the PRD gives about an exception a tool cannot see.

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


def norm(s):
    """Lowercase, hyphens and backticks to spaces, whitespace collapsed."""
    return re.sub(r"\s+", " ", re.sub(r"[-`*_]", " ", s.lower()))


def declared(text, key):
    """The comma-separated members of a <!-- prd-check: key = a, b, c --> marker."""
    m = re.search(r"<!--\s*prd-check:\s*" + key + r"\s*=\s*([^>]*?)-->", text)
    if not m:
        return None
    return [x.strip() for x in m.group(1).split(",") if x.strip()]


def model_row(text, name):
    m = re.search(r"^\|\s*\*\*" + name + r"\*\*\s*\|(.*)$", text, re.M)
    return m.group(1) if m else ""


def enum_after(row, field):
    """The (A/B/C) enum following `field` in a model row."""
    m = re.search(r"`" + field + r"\??`\s*\(([A-Z_/ ]+)\)", row)
    return [v.strip() for v in m.group(1).split("/")] if m else []


def enumeration(blob, after, before, label, failures):
    """The slice of `blob` that is the list itself, not the prose explaining it.

    These rows carry arguments that mention the very terms being checked — the
    AuditLog row explains *why* a repayment reversal is in its list, using the
    words "repayment reversal" — so a naive substring test over the whole row
    passes on text that is not the enumeration. Scope it, or the check has a
    false negative exactly where the document is most discursive. If the
    delimiters have moved, say so rather than silently checking nothing.
    """
    n = norm(blob)
    i, j = n.find(norm(after)), n.find(norm(before))
    if i < 0 or j < 0 or j <= i:
        failures.append(f"could not locate the enumeration in {label} "
                        f"(looked between {after!r} and {before!r}) — has the wording changed?")
        return ""
    return n[i + len(norm(after)):j]


def members(span):
    """The list items in a scoped enumeration.

    Parentheticals are removed first: these lists carry arguments inside them
    ("blind return (§6.5 — the one return with no original, which ...)") and the
    commas in those arguments are not separators. Leading conjunctions go too.
    """
    prev = None
    while prev != span:
        prev = span
        span = re.sub(r"\([^()]*\)", " ", span)
    out = []
    for chunk in re.split(r"[,;:]| and ", span):
        chunk = re.sub(r"^\s*(?:and|every|a|an|the)\s+", "", chunk.strip()).strip(" .")
        if len(chunk) > 3:
            out.append(chunk)
    return out


def both_ways(declared_stems, canonical_span, label, failures):
    """Declared members appear in the list, AND the list holds nothing undeclared.

    The one-way version of this check passed while §10.7 gained a member the
    declaration had never heard of — which is the direction the defect actually
    travels, since a term is always added to some list first. A declaration
    nothing checks against reality is the second source of truth it was meant
    to remove.
    """
    for item in members(canonical_span):
        if not any(d in item or item in d for d in (norm(x) for x in declared_stems)):
            failures.append(f"{label} names {item!r}, which no prd-check declaration lists — "
                            "add it to the declaration, or the other lists will not be checked "
                            "for it")


def numbered_item(crit_body, n):
    m = re.search(r"^%d\.\s(.*?)(?=^\d+\.\s|\Z)" % n, crit_body, re.M | re.S)
    return m.group(1) if m else ""


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


    # ---- F. every movement type is covered by §10.4's per-type table ---------
    s104 = section(text, r"^### 10\.4", r"^### 10\.5")
    fence = re.search(r"```\n(SALE[^`]*?)\n\n", s104, re.S)
    if fence:
        stock_types = re.findall(r"\b([A-Z][A-Z_]{3,})\b", fence.group(1))
        typed = set(re.findall(r"^\|\s*`([A-Z_]+)`", s104, re.M))
        missing = [t for t in stock_types if t not in typed]
        if missing:
            failures.append(
                "§11 movement types with no row in §10.4's per-type table (what "
                "`unitCostMdram` holds, whether it moves the average): " + ", ".join(missing)
            )

    # ---- G. every cash type and PAY_OUT reason is classified by the source rule
    cm = model_row(text, "CashMovement")
    src_row = re.search(r"^\|\s*`CashMovement\.sourceId`\s*\|(.*)$", text, re.M)
    if cm and src_row:
        rule = norm(src_row.group(1))
        unclassified = [v for v in enum_after(cm, "type") + enum_after(cm, "reasonCode")
                        if norm(v.replace("_", " ")) not in rule]
        if unclassified:
            failures.append(
                "`CashMovement` values not classified as sourced or self-sourced by "
                "§11's `sourceId` rule: " + ", ".join(unclassified)
            )

    # ---- H. every ReviewFlag type mirrors an §8.5 warning type ---------------
    rf = model_row(text, "ReviewFlag")
    s85 = section(text, r"^### 8\.5", r"^## \d+\.")
    if rf and s85:
        catalogue = set(re.findall(r"^\|\s*~?~?`([a-z-]+)`", s85, re.M))
        exempt_flags = set(declared(text, "flags-without-warning") or [])
        orphans = [v for v in enum_after(rf, "type")
                   if v.lower().replace("_", "-") not in catalogue
                   and v not in exempt_flags]
        if orphans:
            failures.append(
                "`ReviewFlag` types with no matching §8.5 warning type: " + ", ".join(orphans)
            )

    # ---- I/J. the audit lists agree, and reason-required implies audited -----
    audited = declared(text, "audited-actions")
    reasoned = declared(text, "reason-required")
    if audited:
        s107 = enumeration(section(text, r"^### 10\.7", r"^### 10\.8"),
                           "AuditLog records every", "actor, timestamp, before",
                           "§10.7", failures)
        frsec = enumeration(re.search(r"^\|\s*\*\*FR-SEC-05\*\*.*$", text, re.M).group(0),
                            "Audit log for", "with the reason the person typed",
                            "FR-SEC-05", failures)
        c41 = enumeration(numbered_item(crit_body, 41),
                          "actor, time and record:", "For the actions a person had to",
                          "§27.41", failures)
        for label, blob in (("§10.7", s107), ("FR-SEC-05", frsec), ("§27.41", c41)):
            gone = [a for a in audited if norm(a) not in blob]
            if gone:
                failures.append(
                    f"audited actions declared but not named in {label}: " + ", ".join(gone)
                )
        both_ways(audited, s107, "§10.7", failures)
    if reasoned and audited:
        al = enumeration(model_row(text, "AuditLog"),
                         "justify an override", "It is required for those actions",
                         "§11 `AuditLog.reason`", failures)
        both_ways(reasoned, al, "§11 `AuditLog.reason`", failures)
        for a in (reasoned if al else []):
            if norm(a) not in al:
                failures.append(f"`reason` declared required for {a!r}, "
                                "but §11's `AuditLog.reason` rule does not name it")
            if not any(norm(a) in norm(x) or norm(x) in norm(a) for x in audited):
                failures.append(f"`reason` required for {a!r}, which is not an audited action")

    # ---- K. every re-auth operation says what it does offline ---------------
    reauth = declared(text, "reauth-operations")
    if reauth:
        s163 = enumeration(section(text, r"^### 16\.3", r"^### 16\.4"),
                           "Re-authentication (admin PIN) is required for",
                           "no sale, no return, no repayment",
                           "§16.3", failures)
        both_ways(reauth, s163, "§16.3", failures)
        for a in (reauth if s163 else []):
            if norm(a) not in s163:
                failures.append(f"{a!r} is declared as needing admin re-auth but §16.3 "
                                "does not list it")
        s145 = norm(section(text, r"^### 14\.5", r"^### 14\.6"))
        gone = [a for a in reauth if norm(a) not in s145]
        if gone:
            failures.append(
                "operations needing admin re-auth with no row in §14.5's offline table "
                "(neither permitted nor refused): " + ", ".join(gone)
            )

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
    print("  ok    enumerated sets agree: movement types, cash sources, review")
    print("        flags, the three audit lists, re-auth offline coverage")
    return 0


if __name__ == "__main__":
    sys.exit(main())
