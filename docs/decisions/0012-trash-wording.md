# 0012 · Trash promise reworded
Date: 2026-11-01 · Status: Accepted

## Context
A trash size limit can delete items before 72 hours, but the UI promised "restorable for 72 hours".

## Decision
The size limit moves to v1 (task 6.14). When it ships, the wording becomes "restorable for up to 72 hours; the oldest items may be removed early if the trash gets too large". The MVP keeps the plain 72-hour promise (no size limit).

## Consequences
Plan 2.6 no longer includes the trash size guard.
