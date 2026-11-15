# Learning notebook

## Learner profile
- Owner of Pathlight Tracker, building it with AI help. Makes the product decisions themselves.
- Writes short, informal English. Keep words simple.
- Prefers practical explanations. Often asks "what is the use of X?" (e.g. pnpm, the AppMap check), so every lesson starts with the use.
- Asked about pnpm (answered in lesson 02). Likes real-world bugs tied to the task.
- Still unknown: how comfortable they are with Node internals (async, hooks) and TypeScript. Lesson 09 (Task 1.1) is the first deep Node lesson; watch how the quiz goes.

## Lessons
1. [Validate against AppMap](01-validate-against-appmap.md) (Task 0.1)
2. [The monorepo: pnpm, Turborepo and strict TypeScript](02-monorepo-pnpm-turborepo.md) (Task 0.2)
3. [Linting and formatting: ESLint 9, Prettier and Lefthook](03-linting-and-formatting.md) (Task 0.3)
4. [Unit testing: Vitest and coverage](04-testing-setup-vitest.md) (Task 0.4)
5. [Continuous Integration: GitHub Actions and Changesets](05-ci-github-actions-changesets.md) (Task 0.5)
6. [Fixture apps: real apps with deliberate bugs](06-fixture-apps.md) (Task 0.6)
7. [Docs in the repo: one place, one name](07-docs-in-repo.md) (Task 0.7)
8. [Spec consistency pass: fix the docs before coding](08-spec-consistency-pass.md) (Task 0.8)
9. [Require hook + SWC transform spike](09-require-hook-swc-spike.md) (Task 1.1)
10. [Request context: one trace per request](10-request-context-async-local-storage.md) (Task 1.2)
11. [Behaviour-preservation corpus: observe, never change](11-behaviour-preservation-corpus.md) (Task 1.3)
12. [Performance spike: how much slower does tracing make the app?](12-performance-spike-go-no-go.md) (Task 1.4)
13. [The protocol package: one contract, written once](13-protocol-package-zod-schemas.md) (Task 2.1)
14. [The CLI and config loading](14-cli-and-config-loading.md) (Task 2.2)
15. [The database: SQLite, Drizzle and migrations](15-sqlite-drizzle-store.md) (Task 2.3)
16. [Seed data and the drift guard](16-seed-data.md) (Task 2.4)
17. [The store layer: filters, sorts and cursors](17-store-layer-filters-cursors.md) (Task 2.5)
18. [Soft delete, retention and purge](18-soft-delete-retention-purge.md) (Task 2.6)
19. [The server and its guards: token, origin, host](19-server-auth-dns-rebinding.md) (Task 2.7)
20. [Ingest: receiving events from the agent](20-ingest-websocket-agent.md) (Task 2.8)
21. [The trace builder: events become rows](21-trace-builder.md) (Task 2.9)
22. [The REST API and contract tests](22-rest-api-contract-tests.md) (Task 2.10)
23. [The live hub and startCollector](23-live-hub-websocket.md) (Task 2.11)
24. [The launcher: dev and Windows spawn](24-dev-launcher-windows-spawn.md) (Task 2.12)
25. [Logging and store errors](25-logging-and-store-errors.md) (Task 2.13)

## Concepts learned
- Desk research vs hands-on test: [01](01-validate-against-appmap.md)
- Go / adjust / stop validation: [01](01-validate-against-appmap.md)
- How runtime recording tools work (instrument, record, show): [01](01-validate-against-appmap.md)
- Record-then-open vs live: [01](01-validate-against-appmap.md)
- MCP server (what it is, why it moved to v1): [01](01-validate-against-appmap.md)
- Decision records and why we keep them: [01](01-validate-against-appmap.md)
- What pnpm is for (workspaces, shared store, strictness, Corepack pinning): [02](02-monorepo-pnpm-turborepo.md)
- Monorepo and the protocol-only dependency rule: [02](02-monorepo-pnpm-turborepo.md)
- Turborepo: `^build`, outputs, caching: [02](02-monorepo-pnpm-turborepo.md)
- Strict TS base config, CommonJS for `--require`, ES2023, source maps: [02](02-monorepo-pnpm-turborepo.md)
- Why `engines` Node 24 is root-only; why pinned TS 5.9.3: [02](02-monorepo-pnpm-turborepo.md)
- Verify on a fresh clone; Windows 260-char path (BUG-001): [02](02-monorepo-pnpm-turborepo.md)
- ESLint 9 flat config + typescript-eslint v8 (`projectService`): [03](03-linting-and-formatting.md)
- Prettier 3 code formatting vs documentation preservation (`.prettierignore`): [03](03-linting-and-formatting.md)
- Lefthook git pre-commit hooks + auto re-staging (`stage_fixed: true`): [03](03-linting-and-formatting.md)
- PostToolUse formatting hook for automated token-free cleanup: [03](03-linting-and-formatting.md)
- Vitest root config + per-package `--dir src`, tests kept out of `dist/`: [04](04-testing-setup-vitest.md)
- Colocated unit tests (`foo.ts` → `foo.test.ts`): [04](04-testing-setup-vitest.md)
- V8 code coverage reports (`@vitest/coverage-v8`): [04](04-testing-setup-vitest.md)
- GitHub Actions CI matrix (`[ubuntu, macos, windows]` x Node 24, decision 0019): [05](05-ci-github-actions-changesets.md)
- Frozen lockfile verification in CI (`--frozen-lockfile`): [05](05-ci-github-actions-changesets.md)
- Monorepo package versioning & automated changelogs with Changesets: [05](05-ci-github-actions-changesets.md)
- Fixture apps and deliberate bugs (the PRD user-7 bug): [06](06-fixture-apps.md)
- In-memory databases instead of installs (mongodb-memory-server, SQLite): [06](06-fixture-apps.md)
- NestJS 11 vs 12 (ESM-only risk for the CommonJS MVP): [06](06-fixture-apps.md)
- pnpm `onlyBuiltDependencies` install-script allowlist: [06](06-fixture-apps.md)
- Decorator metadata and value imports: [06](06-fixture-apps.md)
- `--enable-source-maps` and the smoke-script pattern (PORT=0, parse URL, kill child): [06](06-fixture-apps.md)
- Case-insensitive file systems and the two-step `git mv`: [07](07-docs-in-repo.md)
- Single source of truth for rules (`.cursorrules` points at `CLAUDE.md`): [07](07-docs-in-repo.md)
- One branch and one PR per phase: [07](07-docs-in-repo.md)
- Why specs drift and why to fix them before coding: [08](08-spec-consistency-pass.md)
- Master copy (`api-spec.md` §11.1) and decision status Proposed vs accepted (0021): [08](08-spec-consistency-pass.md)
- SQLite `auto_vacuum` before the first table; 26-char ULIDs; red error path rule; validating a seed in real SQLite: [08](08-spec-consistency-pass.md)
- `node --require` and require hooks (`pirates`): [09](09-require-hook-swc-spike.md)
- Source maps to find the original `.ts` file and line (decision 0009): [09](09-require-hook-swc-spike.md)
- SWC parsing, inserting text at byte offsets, keeping `"use strict"` first: [09](09-require-hook-swc-spike.md)
- Async functions, `ret`, follow-on promises and unhandled rejections: [09](09-require-hook-swc-spike.md)
- Fail open ("the user's app always wins"): [09](09-require-hook-swc-spike.md)
- Spike findings: shifted stack columns, `FunctionBody`, skipped tsc helpers: [09](09-require-hook-swc-spike.md)
- Why concurrency mixes output (one global counter vs per-request state): [10](10-request-context-async-local-storage.md)
- `AsyncLocalStorage`, `enterWith`, context across `await`: [10](10-request-context-async-local-storage.md)
- `diagnostics_channel` (`http.server.request.start`) instead of patching `http`: [10](10-request-context-async-local-storage.md)
- Checking tree well-formedness (`treeProblems`) and the `Promise.all` limit: [10](10-request-context-async-local-storage.md)
- "Observe, never change" and behaviour-preservation testing (with vs without hook): [11](11-behaviour-preservation-corpus.md)
- Known differences must still be detected (list that cannot rot): [11](11-behaviour-preservation-corpus.md)
- Early errors vs syntax errors; collision-free generated names (`__pt$` bug): [11](11-behaviour-preservation-corpus.md)
- Load tests: req/s, p50 / p99 latency, slowdown ratio: [12](12-performance-spike-go-no-go.md)
- Warm-up, null device for output, median of alternating runs: [12](12-performance-spike-go-no-go.md)
- Go / no-go checkpoint and Phase 1 summary (1.1 to 1.4): [12](12-performance-spike-go-no-go.md)
- Your two decisions: keep follow-on promises, accept the `toString` difference: [12](12-performance-spike-go-no-go.md)
- Protocol as a contract; why the package depends on nothing: [13](13-protocol-package-zod-schemas.md)
- Zod schema as source of truth, types via `z.infer`; `z.strictObject`: [13](13-protocol-package-zod-schemas.md)
- Discriminated unions (`e` / `type`) and recursive `z.lazy` (CapturedValue): [13](13-protocol-package-zod-schemas.md)
- Durations as digit strings; prefixed 26-char ULID checks: [13](13-protocol-package-zod-schemas.md)
- Testing with the spec's own examples; ask-first guard on `packages/protocol`: [13](13-protocol-package-zod-schemas.md)
- CLI, commander, `--` separator, stub commands that name their task: [14](14-cli-and-config-loading.md)
- Config precedence (defaults < file < env < flags) with source tracking: [14](14-cli-and-config-loading.md)
- Strict schemas (`z.coerce.boolean` trap) and invalid values falling back with warnings: [14](14-cli-and-config-loading.md)
- SQLite, Drizzle schema-as-code, generated migrations: [15](15-sqlite-drizzle-store.md)
- CHECK constraints, cascades, partial indexes: [15](15-sqlite-drizzle-store.md)
- PRAGMAs (WAL, foreign_keys, auto_vacuum first), 0700/0600, `.gitignore` entry: [15](15-sqlite-drizzle-store.md)
- `STORE_UNAVAILABLE` instead of an in-memory fallback (decision 0008): [15](15-sqlite-drizzle-store.md)
- Seed data, drift-guard test, all-or-nothing transaction, `INSERT OR REPLACE`: [16](16-seed-data.md)
- Keyset pagination, opaque cursors, filter fingerprint: [17](17-store-layer-filters-cursors.md)
- Soft delete, retention, TTL purge, vacuum: [18](18-soft-delete-retention-purge.md)
- Host / Origin / token checks, DNS rebinding, constant-time compare: [19](19-server-auth-dns-rebinding.md)
- Ingest protocol: ack, per-event validation, backpressure, close codes: [20](20-ingest-websocket-agent.md)
- Event-to-row building, error path, finalize; tests that expose seed bugs: [21](21-trace-builder.md)
- Contract tests, 404 vs 405, idempotent delete: [22](22-rest-api-contract-tests.md)
- Live topics, batching, `startCollector` wiring: [23](23-live-hub-websocket.md)
- Windows `cmd.exe` quoting, `taskkill /T`, ready-before-handler race: [24](24-dev-launcher-windows-spawn.md)
- Correlation `logId`, 503 for locked SQLite, no secrets in logs, uncaught handlers: [25](25-logging-and-store-errors.md)

## Open questions
- Answered in task 1.4: you chose to keep follow-on promises and accept the `toString` difference (lesson 12).
- Bench numbers exclude transport (WebSocket, batching); task 3.15 must re-run them with the real agent.
- Parallel steps in one request (`Promise.all`) share one indent; planned fix in task 3.8.
- Is there real demand for a Node runtime tracer? The research found little public evidence of AppMap users on Node (demand unproven).
- Hands-on AppMap checklist is pending until `fixtures/nestjs-app` exists (after task 0.6). Decision 0001 may change.
- BUG-001 (Windows long paths): README note added in task 0.7; confirm it can be closed.
- Spike risk: stack-trace columns shift where probes are inserted (task 3.6 / 3.7 chained source map). The `(anonymous)` arrow steps in `CartService.total` are noisy; naming policy is undecided.
- `pnpm seed` deletes all data in the target store before loading; consider a guard or warning if the store is not a seed one (task 2.5 or later).
- The 0700/0600 permission test is skipped on Windows, where you develop; it only runs on the Linux/macOS CI jobs.
- Decision 0021 is Proposed and needs your approval or changes in the Phase 0 PR review.
