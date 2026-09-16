#!/usr/bin/env python3
"""Mutation tests for scripts/check-prd.py.

A checker nobody checks is a checker that quietly stops checking. Every mutation below
reintroduces a defect **this PRD actually shipped** — each one found by reading the whole
document again rather than by a tool, which is the expense the checker exists to remove —
and asserts the checker still catches it.

The mutations are applied to a copy in a temporary file; docs/prd.md is never written to.

Run: npm run check:prd:test
"""

import contextlib
import importlib.util
import io
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHECKER = ROOT / "scripts" / "check-prd.py"
PRD = ROOT / "docs" / "prd.md"


class MutationError(Exception):
    """The document no longer contains what a mutation edits — the test, not the PRD, is stale."""


def load_checker():
    spec = importlib.util.spec_from_file_location("check_prd", CHECKER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def once(text, old, new):
    """Replace exactly one occurrence. A mutation that changed nothing proves nothing."""
    found = text.count(old)
    if found != 1:
        raise MutationError(f"expected one occurrence of {old!r}, found {found}")
    return text.replace(old, new, 1)


def in_section(text, start_pat, end_pat, old, new):
    """Replace inside one section only — these terms recur all over the document."""
    start = re.search(start_pat, text, re.M)
    if not start:
        raise MutationError(f"cannot find section {start_pat!r}")
    rest = text[start.end():]
    end = re.search(end_pat, rest, re.M)
    body = rest[: end.start()] if end else rest
    return text[: start.end()] + once(body, old, new) + (rest[end.start():] if end else "")


# ── The defects, each as it was ────────────────────────────────────────────────

MUTATIONS = [
    (
        "a criterion nothing verifies",
        "§27 gains a criterion and §9's requirement index never points at it — the shape of the "
        "wizard's three promises, which had no test at all while the id existed",
        lambda t: once(t, "§27.13", "—"),
        r"criteria with no FR row pointing at them: §27\.13",
    ),
    (
        "a criterion no build layer proves",
        "§23.1 orders the code and lost a criterion on the way, so nothing said when it would be built",
        lambda t: in_section(t, r"^### 23\.1", r"^## \d+\.", "§27.5", "criterion five"),
        r"criteria assigned to no §23\.1 layer: §27\.5",
    ),
    (
        "an index citing a criterion that does not exist",
        "a renumbered criterion leaves the index pointing at a ghost, and the index still looks complete",
        lambda t: once(
            t,
            "| **FR-DAT-01** | Consistent snapshots hourly and at close; local plus USB; encrypted | §19.2 | §27.10 |",
            "| **FR-DAT-01** | Consistent snapshots hourly and at close; local plus USB; encrypted | §19.2 | §27.10, §27.99 |",
        ),
        r"cites criteria that do not exist: §27\.99",
    ),
    (
        "an FR id used in prose and defined nowhere",
        "prose cites a requirement that was renamed or never written; FR-SYN-07 arrived with no criterion",
        lambda t: once(t, "### 7.4 Quick-add sheet", "### 7.4 Quick-add sheet (FR-CAT-99)"),
        r"FR ids referenced but not defined: FR-CAT-99",
    ),
    (
        "a movement type with no row in §10.4's per-type table",
        "a type is added to §11 and the table saying what its `unitCostMdram` holds is not re-walked",
        lambda t: in_section(t, r"^### 10\.4", r"^### 10\.5", "SALE · SALE_RETURN", "SALE · LOAN_OUT · SALE_RETURN"),
        r"movement types with no row in §10\.4's per-type table.*LOAN_OUT",
    ),
    (
        "a cash movement type the source rule never classifies",
        "`REFUND` was added to the cash ledger while §11's `sourceId` rule still listed the old set",
        lambda t: once(t, "(PAY_IN/PAY_OUT/DROP/NO_SALE/REPAYMENT/REFUND)", "(PAY_IN/PAY_OUT/DROP/NO_SALE/REPAYMENT/REFUND/TIP)"),
        r"`CashMovement` values not classified .*TIP",
    ),
    (
        "a PAY_OUT reason the source rule never classifies",
        "a correction pay-out reached the ledger and not its source rule, so money left the drawer unexplained",
        lambda t: once(t, "(SUPPLIER_PAYMENT/WAGE/EXPENSE/OWNER_DRAW/CORRECTION)", "(SUPPLIER_PAYMENT/WAGE/EXPENSE/OWNER_DRAW/CORRECTION/RENT)"),
        r"`CashMovement` values not classified .*RENT",
    ),
    (
        "a ReviewFlag type with no §8.5 warning",
        "a flag is raised the till has no words for — a durable row nobody can render",
        lambda t: once(t, "INSUFFICIENT_STOCK/CREDIT_LIMIT_EXCEEDED_ON_SYNC", "INSUFFICIENT_STOCK/SUPPLIER_TERMS_CHANGED/CREDIT_LIMIT_EXCEEDED_ON_SYNC"),
        r"`ReviewFlag` types with no matching §8\.5 warning type.*SUPPLIER_TERMS_CHANGED",
    ),
    (
        "an audited action missing from the list that enumerates auditing",
        "exactly what happened to the blind return: audited in two places, absent from §10.7",
        lambda t: in_section(t, r"^### 10\.7", r"^### 10\.8", "(§6.3), basket void, ", "(§6.3), "),
        r"audited actions declared but not named in §10\.7.*basket void",
    ),
    (
        "§10.7 naming something no declaration lists",
        "the direction the defect actually travels — a term is added to a list first, and the "
        "declaration that drives every other check never hears about it",
        lambda t: in_section(t, r"^### 10\.7", r"^### 10\.8", "(§6.3), basket void, ", "(§6.3), basket void, supplier payment, "),
        r"§10\.7 names 'supplier payment', which no prd-check declaration lists",
    ),
    (
        "a reason-required action §11's rule does not name",
        "the repayment reversal was added to the audited list and not to the one requiring a reason",
        lambda t: in_section(t, r"^\| \*\*AuditLog\*\*", r"^\| \*\*", "repayment reversal", "repayment correction"),
        r"`reason` declared required for 'repayment revers'",
    ),
    (
        "a re-authenticated operation with no row in §14.5's offline table",
        "an operation needing an admin PIN, with nothing saying whether it is permitted or refused "
        "when the server is unreachable — neither the till nor the builder can decide that at the counter",
        lambda t: in_section(t, r"^### 14\.5", r"^### 14\.6", "stock adjustment, ", ""),
        r"no row in §14\.5's offline table.*stock adjustment",
    ),
]


def run_checker(module, text):
    """Run the checker over `text` and return (exit code, what it printed)."""
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "prd.md"
        path.write_text(text, encoding="utf-8")
        original = module.PRD
        module.PRD = path
        out = io.StringIO()
        try:
            with contextlib.redirect_stdout(out):
                code = module.main()
        finally:
            module.PRD = original
        return code, out.getvalue()


def main():
    if not CHECKER.exists() or not PRD.exists():
        print(f"FAIL  cannot find {CHECKER} or {PRD}")
        return 1

    module = load_checker()
    pristine = PRD.read_text(encoding="utf-8")

    print(f"check-prd mutation tests — {len(MUTATIONS)} defects reintroduced")

    code, output = run_checker(module, pristine)
    if code != 0:
        print("  FAIL  the document itself does not pass; fix that before trusting these tests")
        print("        " + output.strip().replace("\n", "\n        "))
        return 1
    print("  ok    the document as it stands passes")

    failures = []
    for name, why, mutate, expected in MUTATIONS:
        try:
            mutated = mutate(pristine)
        except MutationError as err:
            failures.append(f"{name}: the mutation no longer applies ({err}) — the PRD moved, so this test is stale")
            print(f"  FAIL  {name} — mutation stale")
            continue
        if mutated == pristine:
            failures.append(f"{name}: the mutation changed nothing")
            print(f"  FAIL  {name} — changed nothing")
            continue

        code, output = run_checker(module, mutated)
        if code == 0:
            failures.append(f"{name}: the checker passed a document carrying this defect ({why})")
            print(f"  FAIL  {name} — not caught")
        elif not re.search(expected, output, re.S):
            failures.append(
                f"{name}: caught, but not by the check that should have — expected {expected!r}"
            )
            print(f"  FAIL  {name} — caught by the wrong check")
        else:
            print(f"  ok    {name}")

    if failures:
        print()
        for f in failures:
            print(f"  FAIL  {f}")
        print(f"\n{len(failures)} mutation(s) survived.")
        return 1

    print(f"  ok    every defect was caught, and by the check written for it")
    return 0


if __name__ == "__main__":
    sys.exit(main())
