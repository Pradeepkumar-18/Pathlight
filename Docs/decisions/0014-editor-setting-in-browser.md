# 0014 · "Open in code" editor chosen in the browser
Date: 2026-11-01 · Status: Accepted

## Context
One doc said Settings shows the editor read-only, another that it can be changed there; the collector built the link, so a browser change did nothing.

## Decision
The editor is a Settings choice stored in the browser, and the browser builds the link from the absolute file path and line the collector sends.

## Consequences
PRD FR-38 and plan 4.9 / 4.11 updated. `PATHLIGHT_TRACKER_EDITOR` and the collector-built link are removed in task 0.8.
