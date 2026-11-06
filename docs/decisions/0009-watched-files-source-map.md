# 0009 · Watched files matched through the source map
Date: 2026-11-01 · Status: Accepted

## Context
The default `src/**` never matches a NestJS app, which runs compiled files from `dist/`. Line numbers also pass through two conversions (TypeScript, then the transform).

## Decision
For each loaded file, read its source map once, find the original `.ts` path, and match that against include / exclude globs (`src/**` by default). Without a map, fall back to the compiled path and have `doctor` warn. The same map, chained with the transform's map, gives the original `.ts` line.

## Alternatives considered
Default to `dist/**` (breaks ts-node / tsx setups); match compiled paths only (misses `dist/`).

## Consequences
Plan 1.1 and 3.6 updated; architecture §11 #18. Requires `"sourceMap": true`; spike 1.1 confirms it.
