# 7. The fiscal adapter is a seam, and a sale never waits for it

Date: 2026-09-16 · Status: accepted, pending §17 · PRD: §17, §19.4, §23 Phase 6

## Context

§23's Phase 6 lists "fiscal adapter (§17)" and its exit criterion is that fiscal receipts issue
from Simon. §17 says what must be established first — whether the shop is obliged, which devices
are certified, whether a third-party POS may drive one — and §26 Q1 is still open. A driver cannot
be written for a device nobody has named, under rules nobody has confirmed.

## Decision

Build the part that does not depend on those answers: the interface every driver will implement,
and everything around it.

- `FiscalDevice.issue(document) → receiptId`, selected by `SIMON_FISCAL` (`none` by default;
  `file` writes JSON documents with sequential development numbers).
- Issued **after** the sale commits, never inside its transaction (§13.1), and never in practice
  mode (§19.4). The sale request does not wait; the print route does, so the paper carries the
  number. Issuing is idempotent on `Sale.fiscalReceiptId`.
- A failure leaves the sale sold and the receipt pending. A job retries every minute, diagnostics
  count what is pending, and the owner sees an alert after ten minutes.
- `fiscal.since` is recorded the first time the server starts with a device, so switching one on
  never fiscalises the shop's history.

## Consequences

The checkout path already has the shape a real driver needs, so writing one is a new class behind
the interface, not a rewrite. **Returns are not fiscalised yet** — `SaleReturn` has no receipt field,
and whether a refund needs its own fiscal document is part of §17's question.

**The assumption that a sale may complete while the device is down is a legal question, not an
engineering one.** It follows rule 1 (a completed sale is never lost). If the answer is that a sale
must not complete without a fiscal receipt, the change is at the till — refuse to complete while
the device is unreachable — and this ADR is superseded.
