# 0006 · No usage stats for now; measure success without telemetry
Date: 2026-11-01 · Status: Accepted

## Context
The PRD measured success with opt-in telemetry, but sending data off the machine is forbidden and no task built it. The v1 → v2 gate depended on week-4 retention.

## Decision
No usage stats now: this starts as a personal open-source project. Success is measured by the author's weekly use on real projects, plus npm downloads, GitHub stars and issues. Opt-in usage stats (off by default) come only after the product proves useful (task 8.3, FR-52).

## Consequences
PRD success metrics, release gates and plan checkpoints 6 updated. Rule "nothing leaves the machine" stays unchanged.
