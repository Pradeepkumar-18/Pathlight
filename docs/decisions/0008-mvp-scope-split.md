# 0008 · MVP scope: extras added to the PRD and placed by phase
Date: 2026-11-01 · Status: Accepted

## Context
The design and plan contained features the PRD never asked for.

## Decision
- MVP: `pathlight-tracker doctor`, `pathlight-tracker clear`, sessions menu and restart dividers, path and "errors only" filters, settings for theme / editor / follow-latest default, laptop layout (1100 px and up) — FR-41 to FR-47.
- v1 (task 6.14): other filters, extra settings and `GET /config`, trash size limit, in-memory DB fallback, `o + Enter`, `--quiet`, truncation header; UI error logs stay in 6.13; search stays in 6.9 — FR-49 to FR-51.
- Hidden until v1: Graph, Timeline and Logs tabs (no "coming soon" tabs).
- Dropped: "Open .pathlight-tracker folder" (a web page cannot open a folder).
- Future: tablet and phone layouts (task 8.4, FR-53).

## Consequences
PRD and plan updated (2.6, 2.10, 4.5, 4.6, 4.7, 4.11, 4.15, 6.14, 8.4). Remaining mentions in design and user flows are cleaned up in task 0.8.
