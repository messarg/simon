# 5. Import takes the file as JSON, not multipart

Date: 2026-09-16 · Status: accepted · PRD: §19.1, §15.4, §7.3

## Context

§15.4 sketches `POST /imports` as multipart. Multipart means a body parser for a second encoding
(`multer` or equivalent), a temporary-file path on the host, and a second code path for size limits
and cleanup — for one screen that an owner uses a handful of times in the shop's life.

## Decision

The client reads the file (`File.text()`) and posts `{ id, kind, fileName, content, dryRun }` as
JSON. The id is client-generated, so a retried request is the same batch rather than a second one.

## Consequences

One body parser, one size limit (6 MB, which is far more than §19.3's volumes imply), no temporary
files to clean up, and no upload that can half-arrive. `dryRun` — the preview §7.3 asks for — is the
same call with a flag, so what the owner previewed is exactly what gets applied.

The cost is that the file crosses as UTF-8 text in JSON: a spreadsheet saved as `.xlsx` must be
exported to CSV first, which is what §19.1's format list already implies. A binary upload path can
be added later without changing this contract.
