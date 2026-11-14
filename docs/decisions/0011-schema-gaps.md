# 0011 · Schema gaps: accept the audit's fixes
Date: 2026-11-01 · Status: Accepted

## Context
The 2026-11-01 spec audit (`docs/analysis/2026-11-01-spec-audit.md`, items 1.2, 1.8, 1.9, 3.7, 4.2, 4.3, 4.4, 4.9, F) found data with nowhere to be stored.

## Decision
Accept the audit's suggested fixes:
- Object IDs saved in task 2.9, with a location format such as `args[0]`; a place for request-level objects (request body).
- Formats for interceptor before/after and filter error → response details.
- A column for the unhandled error.
- A "what started this" column on requests, so tests, queue messages and cron jobs fit later.
- Places for argument names, the "file couldn't be recorded" note, setup warnings and the app's exit code.
- `console.log` output stored as separate log entries, not steps (no step numbers, no 5,000-step limit, not in the tree).
- The collector assigns `seq`; duplicates are caught by step ID.
- `PRAGMA auto_vacuum = INCREMENTAL` set before tables are created, so deleted data is really wiped.

## Consequences
`data-model.md` is updated in task 0.8, before task 2.3 creates the schema. Exact column names are chosen there.
