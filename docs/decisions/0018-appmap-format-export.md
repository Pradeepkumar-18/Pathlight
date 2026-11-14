# 0018 · Export to AppMap's file format (v2)
Date: 2026-11-01 · Status: Accepted

## Context
AppMap has an established recording format and viewers (decision 0001). Exporting to it lets people use both tools.

## Decision
Task 7.10 (export, v2) also exports a map in AppMap's file format, alongside JSON and the shareable report (FR-30).

## Consequences
Pathlight Tracker becomes a complement to AppMap rather than only a rival. Data AppMap's format can't hold (branch outcomes, swallowed errors, full values) is dropped or summarised in that export.
