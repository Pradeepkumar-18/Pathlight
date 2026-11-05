# 0019 · CI runs on Node 24 only
Date: 2026-11-05 · Status: Accepted

## Context
Task 0.5 originally specified CI matrix testing on both Node 20 and Node 24 across Ubuntu, macOS, and Windows. However, core monorepo tooling including Vitest 5 and Changesets 3 requires Node ≥22, and the root `package.json` specifies `"engines": { "node": ">=24 <25" }`.

## Decision
CI matrix workflow runs on Node 24 only across Ubuntu, macOS, and Windows. Support for Node 20 in target traced apps will be verified in later phases via fixtures and the behaviour corpus (`tests/behaviour-corpus/`), where the target app can run under Node 20 while tooling runs on Node 24.

## Alternatives considered
- Matrix test on Node 20 and 24: Rejected because developer dependencies (Vitest 5, Changesets 3) fail to execute on Node 20.
- Downgrade test tooling to older majors: Rejected because modern tooling is pinned for the monorepo.

## Consequences
- `.github/workflows/ci.yml` sets `node-version: [24]`.
- Task 0.5 plan in `Docs/tracer-implementation-plan.md` updated to reflect Node 24 only.
- CI runtime is faster and matrix focuses on OS compatibility (Ubuntu, macOS, Windows).
