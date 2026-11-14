# 0016 · Suspicious values and missing keys
Date: 2026-11-01 · Status: Accepted

## Context
"Suspicious" meant a value is `undefined`. A key missing entirely (common with MongoDB, the PRD's main example) was not flagged.

## Decision
The agent cannot know a key is missing without the expected shape. Instead:
- Flag `undefined` arguments and return values as suspicious.
- `if` / `switch` condition probes (MVP) show the value read, e.g. `if (user.tier === 'gold') → false, user.tier = undefined`, which catches the missing-key case.

## Consequences
`data-model.md` gets the `suspicious` flag on the value format (audit 3.15) in task 0.8.
