# 4. CSV export is built on the client

Date: 2026-09-16 · Status: accepted · PRD: §6.10, FR-DAT-03, §4.2

## Context

Every report exports in one tap. The export must carry Armenian column headings, and headings live
in `frontend/src/i18n/hy.ts` — the rule that no Armenian string exists anywhere else.

## Decision

The server returns a report as columns, rows and totals, with codes rather than words. The screen
translates and renders; the same translation builds the CSV, with a UTF-8 BOM so Excel reads
Armenian, and with money and quantities as plain integers a spreadsheet can add.

## Consequences

One set of strings, and the file always says exactly what the screen said. Export works offline for
a report already on screen. A server-side export would need a second Armenian resource file on the
backend — the thing §4.2 exists to prevent.
