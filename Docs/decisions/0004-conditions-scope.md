# 0004 · `if` / `switch` conditions in the MVP, expression conditions in v1
Date: 2026-11-01 · Status: Accepted

## Context
The plan had all conditions in v1, but MVP seed data and `ui-reference.png` already show an `if` row, so MVP "match exactly" tasks could not pass.

## Decision
MVP records `if`, `else if` and `switch` (task 3.14, UI task 4.17). Ternary, `&&` / `||` and `?.` stay in v1 (tasks 6.1, 6.2). Loops stay in v1.

## Alternatives considered
All conditions in v1 (MVP examples can't pass); all conditions in the MVP (expression probes are the riskiest transform work: short-circuit and evaluate-once must hold).

## Consequences
PRD FR-16 / FR-48, plan (3.14, 3.15 renumbered, 4.17, 6.1, 6.2), architecture §11 #21, data model and design updated. MVP grows by two tasks.
