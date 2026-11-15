# Progress

Live status of `docs/implementation-plan.md`. Update this file in the same PR as every task (rules in `CLAUDE.md` → "Progress tracking").

**Status key:** ⬜ Not started · 🟡 In progress · ✅ Done · ⛔ Blocked · ⏭️ Skipped (with reason)

## Summary

| Phase | Tasks | Done | Status |
| --- | --- | --- | --- |
| 0 Setup and validation | 8 | 8 | ✅ |
| 1 Capture spike | 4 | 4 | ✅ |
| 2 Protocol and collector | 13 | 12 | 🟡 |
| 3 Runtime agent | 15 | 0 | ⬜ |
| 4 Map UI | 17 | 0 | ⬜ |
| 5 Integration and MVP release | 8 | 0 | ⬜ |
| **MVP total** | **65** | **24** | 🟡 |
| 6 v1 | 16 | 0 | ⬜ |
| 7 VS Code extension and v2 | 10 | 0 | ⬜ |
| 8 Future | 3 | 0 | ⬜ |

**Current phase:** Phase 2: Protocol and collector (in progress)
**Current task:** 2.13 Collector logging and errors
**Blockers:** none

## In progress

Tasks currently `🟡 In progress`. Remove the row when the task is done or blocked.

| ID | Task | Started | Notes |
| --- | --- | --- | --- |
| 2.13 | Collector logging and errors | 2026-11-15 | On `main` |

## Known bugs / issues

Open bugs and issues found while coding. Close a row by setting Status to `Fixed` with the task or PR that fixed it; delete fixed rows at each checkpoint.

| ID | Found | Area | Description | Status | Fix (task / PR) |
| --- | --- | --- | --- | --- | --- |
| BUG-001 | 2026-11-01 | Dev setup (Windows) | `turbo.exe` fails to start (ENOENT) when the repo sits in a deep folder: its path inside `node_modules/.pnpm` passes ~260 characters | Fixed | 0.7: README → Troubleshooting (short clone path or Windows long paths) |

IDs: `BUG-001`, `BUG-002`, …

## Decisions

Decisions made during planning and coding. Architecture or schema decisions also get a record in `docs/decisions/` (see `CLAUDE.md` → "Ask before changing").

| Date | Decision | Status | Record |
| --- | --- | --- | --- |
| 2026-10-30 | UI wording: "steps", not "spans" | ✅ Decided | `architecture.md` §11 #17 |
| 2026-11-01 | Product and package name: `pathlight-tracker` everywhere ("Pathlight Tracker" in prose) | ✅ Decided | `decisions/0003-product-name.md` |
| 2026-11-01 | Conditions: `if` / `else if` / `switch` in the MVP (3.14, 4.17); ternary, `&&` / `\|\|`, `?.` in v1 | ✅ Decided | `decisions/0004-conditions-scope.md` |
| 2026-11-01 | Open source | ✅ Decided | `decisions/0005-open-source.md` |
| 2026-11-01 | Licence: MIT | ✅ Decided | `decisions/0005-open-source.md` |
| 2026-11-01 | No usage stats for now; success = own weekly use + npm / GitHub interest; opt-in stats later (8.3) | ✅ Decided | `decisions/0006-no-usage-stats-yet.md` |
| 2026-11-01 | Prisma in the MVP (Express fixture) | ✅ Decided | `decisions/0007-prisma-in-mvp.md` |
| 2026-11-01 | MVP extras placed by phase: MVP / v1 (6.14) / hidden / dropped / Future (8.4) | ✅ Decided | `decisions/0008-mvp-scope-split.md` |
| 2026-11-01 | Watched files matched through the source map (original `.ts` path vs `src/**`) | ✅ Decided | `decisions/0009-watched-files-source-map.md` |
| 2026-11-01 | Red path only for errors that reached the response; swallowed = Caught (violet); detection rule | ✅ Decided | `decisions/0010-error-path-and-swallowed-errors.md` |
| 2026-11-01 | Schema gaps: accept the audit's fixes (applied to `data-model.md` in 0.8) | ✅ Decided | `decisions/0011-schema-gaps.md` |
| 2026-11-01 | Trash: size limit moves to v1 with reworded promise | ✅ Decided | `decisions/0012-trash-wording.md` |
| 2026-11-01 | No fixed millisecond target for live steps | ✅ Decided | `decisions/0013-no-live-latency-target.md` |
| 2026-11-01 | Editor for Open in code: browser setting; browser builds the link | ✅ Decided | `decisions/0014-editor-setting-in-browser.md` |
| 2026-11-01 | Saved links survive restarts: fixed default port + per-project token | ✅ Decided | `decisions/0015-links-survive-restarts.md` |
| 2026-11-01 | Suspicious values: flag `undefined`; missing keys shown through `if` probes | ✅ Decided | `decisions/0016-suspicious-values.md` |
| 2026-11-01 | Task 0.1 AppMap validation: adjust (build MVP, change the pitch); don't build on `appmap-node` | ✅ Decided | `decisions/0001-appmap-validation.md` |
| 2026-11-01 | Read-only MCP server moves to v1 (6.16) | ✅ Decided | `decisions/0017-mcp-server-in-v1.md` |
| 2026-11-01 | Export to AppMap's file format in v2 (7.10) | ✅ Decided | `decisions/0018-appmap-format-export.md` |
| 2026-11-05 | CI runs on Node 24 only (Vitest 5 & Changesets 3 require Node ≥22, root engines is >=24 <25) | ✅ Decided | `decisions/0019-ci-node-24-only.md` |
| 2026-11-06 | Spec consistency choices from task 0.8 (protocol fields, codes, env vars, schema columns, token rule) | ✅ Decided (2026-11-14) | `decisions/0021-spec-consistency-choices.md` |
| 2026-11-14 | Capture approach: load-time wrapping, go (Checkpoint 1); returned promises become follow-on promises; `toString` shows probes (accepted) | ✅ Decided | `decisions/0002-capture-approach.md` |
| 2026-11-14 | Agent spike deps `pirates` 4.0.7, `@swc/core` 1.16.22, `@jridgewell/trace-mapping` 0.3.31; bench dev dep `autocannon` 9.0.0 | ✅ Decided | `decisions/0002-capture-approach.md` |
| 2026-11-14 | Phase 2 libraries approved: zod 4.6.7, commander 14.0.3 (not 15: needs Node 22.12), drizzle-orm 0.45.4, drizzle-kit 0.31.11, fastify 5.12.8, @fastify/websocket 11.3.7, @fastify/rate-limit 11.2.2, @fastify/static 10.1.11, pino 10.4.0, pino-roll 4.0.0, open 11.0.4; ULIDs written in-house | ✅ Decided | this table |
| 2026-11-14 | Server: default port 4777 (+19 fallbacks), REST allows a missing `Origin`, rate limits as 2 s windows | ✅ Decided | `decisions/0022-server-port-origin-rate-limits.md` |
| 2026-11-15 | `boundary` event gains optional `name`, `file`, `line`, `column`, `isAsync`; `request` / `response` contents and `ts` = call start documented | ✅ Decided (user, 2026-11-15) | `api-spec.md` §11.1 |
| 2026-11-14 | Work directly on `main`: no branches or PRs (replaces one branch and one PR per phase, 2026-11-06) | ✅ Decided | `implementation-plan.md` §2, `CLAUDE.md` → "Commit and PR format" |
| 2026-11-05 | Fixture stack: no database install (`mongodb-memory-server` + SQLite), NestJS 11 (12 is ESM-only), install-script allowlist | ✅ Decided | `decisions/0020-fixture-stack.md` |

## Next steps

1. Push the Phase 1 commits and check CI on all three OSes
2. Checkpoint 0 leftovers: hands-on AppMap checklist on `fixtures/nestjs-app` (`docs/analysis/2026-11-01-appmap-validation.md`), `product-analyst` run (raise: NestJS 12 is ESM-only), trim `CLAUDE.md` / rules / memory (`.claude/SETUP-ROADMAP.md`)
3. Phase 2: `/start-task 2.1` (protocol package)

---

## Phase 0: Setup and validation

| ID | Task | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| 0.1 | Validate against AppMap | ✅ | | Desk research (adjust); hands-on checklist after 0.6 |
| 0.2 | Create the monorepo | ✅ | [#2](https://github.com/Pradeepkumar-18/Pathlight/pull/2) | Clean-clone build verified |
| 0.3 | Linting and formatting | ✅ | [#3](https://github.com/Pradeepkumar-18/Pathlight/pull/3) | |
| 0.4 | Testing setup | ✅ | [#4](https://github.com/Pradeepkumar-18/Pathlight/pull/4) | |
| 0.5 | CI | ✅ | [#5](https://github.com/Pradeepkumar-18/Pathlight/pull/5) | Green on Ubuntu, macOS, Windows (Node 24) |
| 0.6 | Fixture apps | ✅ | | Both fixtures + smoke script; CI runs the smoke test |
| 0.7 | Docs in repo | ✅ | [#9](https://github.com/Pradeepkumar-18/Pathlight/pull/9) | |
| 0.8 | Spec consistency pass | ✅ | [#9](https://github.com/Pradeepkumar-18/Pathlight/pull/9) | Every audit item resolved |
| ✔ | **Checkpoint 0: Setup review** | ⬜ | | |

## Phase 1: Capture spike

| ID | Task | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| 1.1 | Require hook + SWC transform spike | ✅ | | `pnpm spike:trace` |
| 1.2 | Request context spike | ✅ | | `pnpm spike:context` |
| 1.3 | Behaviour-preservation corpus v0 | ✅ | | `pnpm test:corpus` |
| 1.4 | Performance spike | ✅ | | `pnpm bench`; decision 0002 |
| ✔ | **Checkpoint 1: Go / no-go on capture approach** | ✅ | | Go (decision 0002): ~1.1–1.2× slowdown |

## Phase 2: Protocol and collector

| ID | Task | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| 2.1 | Protocol package: types and schemas | ✅ | | 35 schema tests |
| 2.2 | Collector CLI skeleton + config | ✅ | | `pathlight-tracker --help` |
| 2.3 | Database setup | ✅ | | Migration `0000_init` |
| 2.4 | Seed data | ✅ | | `pnpm seed` |
| 2.5 | Store layer | ✅ | | |
| 2.6 | Soft delete, retention and purge | ✅ | | `pathlight-tracker clear` |
| 2.7 | Server + auth | ✅ | | Decision 0022 |
| 2.8 | Ingest (`/agent`) | ✅ | | |
| 2.9 | Trace builder | ✅ | | |
| 2.10 | REST API (MVP endpoints) | ✅ | | 14 MVP endpoints |
| 2.11 | Live hub (`/live`) | ✅ | | |
| 2.12 | Launcher | ✅ | | |
| 2.13 | Collector logging and errors | 🟡 | | |
| ✔ | **Checkpoint 2: Collector review** | ⬜ | | |

## Phase 3: Runtime agent

| ID | Task | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| 3.1 | Register, config and safety | ⬜ | | |
| 3.2 | Transport | ⬜ | | |
| 3.3 | Safe value capture | ⬜ | | |
| 3.4 | Redaction | ⬜ | | |
| 3.5 | Object IDs | ⬜ | | |
| 3.6 | Loader + transform (production) | ⬜ | | |
| 3.7 | Runtime helpers + source maps | ⬜ | | |
| 3.8 | Request context + HTTP patch | ⬜ | | |
| 3.9 | Express patch | ⬜ | | |
| 3.10 | NestJS patch | ⬜ | | |
| 3.11 | DB boundaries | ⬜ | | |
| 3.12 | Outbound HTTP boundaries | ⬜ | | |
| 3.13 | Error handling classification | ⬜ | | |
| 3.14 | Condition probes (`if` / `switch`) | ⬜ | | |
| 3.15 | Agent performance and safety pass | ⬜ | | |
| ✔ | **Checkpoint 3: Agent review** | ⬜ | | |

## Phase 4: Map UI

| ID | Task | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| 4.1 | UI project setup | ⬜ | | |
| 4.2 | Host adapter + connect flow | ⬜ | | |
| 4.3 | Data layer | ⬜ | | |
| 4.4 | Live client | ⬜ | | |
| 4.5 | App shell and layout | ⬜ | | |
| 4.6 | Request list | ⬜ | | |
| 4.7 | Request header + tabs | ⬜ | | |
| 4.8 | Step tree | ⬜ | | |
| 4.9 | Inspector | ⬜ | | |
| 4.10 | Delete, undo and trash | ⬜ | | |
| 4.11 | Settings screen (theme, editor, follow-latest) | ⬜ | | |
| 4.12 | Onboarding and empty states | ⬜ | | |
| 4.13 | Loading and error states | ⬜ | | |
| 4.14 | Keyboard and accessibility | ⬜ | | |
| 4.15 | Laptop layout | ⬜ | | |
| 4.16 | Dark theme pass | ⬜ | | |
| 4.17 | Decision rows in UI (`IF` / `SWITCH`) | ⬜ | | |
| ✔ | **Checkpoint 4: UI review** | ⬜ | | |

## Phase 5: Integration and MVP release

| ID | Task | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| 5.1 | End-to-end tests | ⬜ | | |
| 5.2 | Edge-case pass | ⬜ | | |
| 5.3 | `pathlight-tracker doctor` and pre-checks | ⬜ | | |
| 5.4 | Performance acceptance | ⬜ | | |
| 5.5 | Security review | ⬜ | | |
| 5.6 | Packaging | ⬜ | | |
| 5.7 | User docs | ⬜ | | |
| 5.8 | Release `0.1.0` | ⬜ | | |
| ✔ | **Checkpoint 5: MVP release review** | ⬜ | | |

---

## ═══════ MVP LINE ═══════

---

## Phase 6: v1

| ID | Task | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| 6.1 | Expression condition probes | ⬜ | | |
| 6.2 | Expression decision rows in UI | ⬜ | | |
| 6.3 | Loop summaries | ⬜ | | |
| 6.4 | Callback collapsing and constructors | ⬜ | | |
| 6.5 | Argument mutation detection | ⬜ | | |
| 6.6 | Test runs as entry points | ⬜ | | |
| 6.7 | Redis, queue publish and log boundaries | ⬜ | | |
| 6.8 | Logs tab | ⬜ | | |
| 6.9 | Search | ⬜ | | |
| 6.10 | Compare two requests | ⬜ | | |
| 6.11 | Flow graph view | ⬜ | | |
| 6.12 | Timeline view | ⬜ | | |
| 6.13 | Custom config rules and client logs | ⬜ | | |
| 6.14 | Extra filters, settings and CLI extras | ⬜ | | |
| 6.15 | v1 hardening and release `0.2.0` | ⬜ | | |
| 6.16 | MCP server (moved from 8.1) | ⬜ | | |
| ✔ | **Checkpoint 6: v1 review** | ⬜ | | |

## Phase 7: VS Code extension and v2

| ID | Task | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| 7.1 | Extension skeleton | ⬜ | | |
| 7.2 | Webview host adapter | ⬜ | | |
| 7.3 | Theme mapping | ⬜ | | |
| 7.4 | Editor integration | ⬜ | | |
| 7.5 | Publish extension | ⬜ | | |
| 7.6 | ESM and bundlers | ⬜ | | |
| 7.7 | Data journey | ⬜ | | |
| 7.8 | Queue consumers and cron entry points | ⬜ | | |
| 7.9 | More frameworks | ⬜ | | |
| 7.10 | Export and share | ⬜ | | |
| ✔ | **Checkpoint 7: v2 review** | ⬜ | | |

## Phase 8: Future

| ID | Task | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| 8.2 | AI explanation layer | ⬜ | | |
| 8.3 | Opt-in usage stats | ⬜ | | |
| 8.4 | Tablet and phone layouts | ⬜ | | |

---

## Log

Newest first. One entry per task (or checkpoint). Template:

```
### YYYY-MM-DD · <task ID> <task name> · ✅ Done | ⛔ Blocked
- Done when: <copied from implementation-plan.md>
- What changed: <1–3 lines>
- Tests: <added / updated>
- Docs updated: <files, or "none">
- Decisions: <added to "Decisions", or "none">
- Bugs: <added to / closed in "Known bugs / issues", or "none">
- Follow-ups: <new tasks, open questions, or "none">
```

### 2026-11-15 · 2.13 Collector logging and errors · 🟡 In progress
- Done when: Tests show a forced DB lock returns 503 and logs an entry with a `logId`; grep of logs in tests finds no token or captured values.

### 2026-11-15 · 2.12 Launcher · ✅ Done
- Done when: Running `pathlight-tracker dev -- node fixtures/express-app` starts the app, prints the URL with the token, and stops cleanly on Ctrl+C with the app's exit code.
- What changed: `packages/collector/src/cli/dev.ts` (`createDevHandler`): starts the collector, prints `[pathlight-tracker] <version> · map: <url>/#token=<token>` once, spawns the user's command with the agent appended to the user's own `NODE_OPTIONS` (`--require "<path>"`), `PATHLIGHT_TRACKER_COLLECTOR_URL` and `PATHLIGHT_TRACKER_TOKEN`; stdio inherited; opens the browser with `open` unless `--no-open`; first Ctrl+C goes to the app (POSIX), second force-stops it; the CLI exits with the app's code (128 + signal when a signal ended it) and stops the collector. Windows: the command runs through `cmd.exe` (for `npm` / `npx` shims) with each word quoted, and the app's process tree is stopped with `taskkill /T`. `AGENT_NOT_FOUND` warning when the agent isn't installed next to the CLI. `cli/main.ts` wires it in.
- Tests: 6 tests: a stand-in app gets the collector URL, the token and `NODE_OPTIONS` (user's own kept), the banner has the token, the app's exit code (3) comes back and the collector stops; Ctrl+C stops the app (0 on POSIX, 130 on Windows); a missing command fails; helpers for `NODE_OPTIONS`, Windows quoting and exit codes. Manual: `node packages/collector/dist/cli/main.js dev --no-open -- node fixtures/express-app` printed the banner, the app served on :3002 and the collector answered 401 without the token.
- Docs updated: `implementation-plan.md` 2.12 row (`o` + Enter is v1, task 6.14, per `user-flows.md` §5 and FR-51).
- Decisions: none.
- Bugs: none.
- Follow-ups: the agent isn't a dependency of the CLI yet, so `dev` prints `AGENT_NOT_FOUND` until packaging (task 5.6) ships them together.

### 2026-11-15 · 2.11 Live hub (`/live`) · ✅ Done
- Done when: Integration test: an agent batch produces the expected `/live` messages in order; a UI subscribed to one request gets only its steps.
- What changed: `packages/collector/src/live/hub.ts` (subscriptions to `requests` and `request:<id>`; `live.request.started` / `completed` / `deleted` / `restored` / `purged`, `live.steps.appended` / `updated`, `live.agent.connected` / `disconnected` / `disabled`; ~100 ms batches with consecutive step appends merged; a subscriber gets each message once even with several matching topics; `ping` → `pong`; invalid messages answered with `INVALID_MESSAGE`; an 11th UI closed with 4029), `live/route.ts` (`WS /live` behind `admitSocket`). `src/collector.ts` (`startCollector`): store, gitignore, token, builder, ingest, live hub, REST API, server on 127.0.0.1, `collector.json`, retention after each completed request, hourly purge job, clean `stop()`; agent connect / disconnect / incomplete requests and API deletes reach the hub.
- Tests: 5 integration tests on a real collector: the recorded agent batches produce `pong`, `agent.connected`, `request.started`, steps appended (seq 1–9) and updated, `request.completed` (with the red path), `agent.disconnected`, in that order, every message validated with the protocol; a UI watching one request gets its steps and no list updates, a UI watching another gets nothing; a REST delete reaches the list as `live.request.deleted`; the 11th UI gets 4029; an invalid message gets an error and the socket stays usable.
- Docs updated: none.
- Decisions: none.
- Bugs: none.
- Follow-ups: none.

### 2026-11-15 · 2.10 REST API (MVP endpoints) · ✅ Done
- Done when: Contract tests check every endpoint against the Zod schemas and the examples in `api-spec.md`, including every listed error code.
- What changed: `packages/collector/src/api/`: `GET /health`, `/sessions`, `/requests` (every §6.1 filter, §9 sorts and cursors), `/requests/:id` (with `errorPath`, `REQUEST_IN_TRASH` + `deletedAt` unless `includeDeleted`), `/requests/:id/steps` (tree, one level, error path), `/steps/:id` (parsed `.ts` stack frames, `calledBy`, `absolutePath`, `fileChangedSince`), `/requests/:id/curl` (from the captured `host` header, else a placeholder), `DELETE /requests/:id` (idempotent soft delete; `?permanent=true` → 204), `DELETE /requests` (clear all, `skippedInProgress`), `POST /requests/:id/restore`, `GET` / `DELETE /trash`, `GET /sample` (the seed built in memory once, `sample: true`). Strict query validation (`INVALID_PARAMS`, `INVALID_ID`, `INVALID_CURSOR`); delete / restore / purge report to `ApiEvents` for the live hub. The server now answers `405 METHOD_NOT_ALLOWED` (with `Allow`) for a known path with the wrong method. Protocol: response schemas for the documented shapes (`health`, `trashItem`, delete / clear / restore / empty-trash results, `sample`, `dataSchema`). `openStore` accepts `:memory:`; `clearAll` takes an optional session. 2.6 follow-up done: `pathlight-tracker clear` goes through a running collector (`collector.json` + token, only if it answers) so open tabs update, else works on the database.
- Tests: 18 contract tests (every endpoint parsed with its protocol schema and compared with the §5–§7 examples; every listed error code: `INVALID_PARAMS`, `INVALID_ID`, `INVALID_CURSOR`, `REQUEST_NOT_FOUND`, `REQUEST_IN_TRASH`, `STEP_NOT_FOUND`, `REQUEST_IN_PROGRESS`, `REQUEST_NOT_IN_TRASH`, `METHOD_NOT_ALLOWED`, `ROUTE_NOT_FOUND`; auth, origin, host, size and rate codes are covered by the 2.7 tests); 3 `clear` tests through a (fake) running collector and with a stale `collector.json`; a seed guard that every stored captured value passes the protocol schema.
- Docs updated: `api-spec.md` §2 (`/config` is v1, decision 0008), §6.10 (sample built in memory from the shipped seed SQL); `data-model.md` §10 seed: the trashed request's empty request headers are `null` (caught by the contract test); `fixtures/seed/sample.sql` re-copied.
- Decisions: none.
- Bugs: fixed: seed request headers `{}` was not a valid captured value.
- Follow-ups: task 5.6 must ship `fixtures/seed/sample.sql` inside the npm package for `GET /sample`.

### 2026-11-15 · 2.9 Trace builder · ✅ Done
- Done when: Feeding the recorded `POST /orders` event stream produces rows identical to the seed data (except IDs and times).
- What changed: `packages/collector/src/builder/`: `builder.ts` (request rows from `request.start`, the session framework from it, `seq` in arrival order, depth from the parent, exits / throws update their step, boundaries and decisions become leaf steps, the step limit stops recording and marks the request truncated, re-sent steps are skipped, one transaction per batch; returns started / appended / updated / completed IDs for the live hub), `finalize.ts` (decision 0010: propagated / swallowed / converted / unhandled, the red path from the root to the step that threw for errors that reached the response, `error_step_id`, `has_error`), `refs.ts` (object refs from every `objectId` in args, return values and the request body, with paths like `args[0]` and `request.body`), `rows.ts` (event → row fields), `session-events.ts` (warnings kept once, `agent.disabled`), `layer.ts` (controller / service / repository / fn badge from the class name, for task 2.10). `loop` and `log` events are accepted but not stored (v1).
- Tests: 22 new tests: the recorded stream reproduces the seed's request row, all 9 step rows and every object ref (IDs and times excluded, JSON compared as data); framework set from `request.start`; changes reported per batch; re-sent batch not duplicated; step limit truncates; warnings deduplicated and `agent.disabled`; error handling for a 500 from a filter, an unhandled error, a 404 (no red path), a swallowed error, several errors at once and none; layer badges; and a new seed guard that every `*_json` column is valid JSON.
- Docs updated: `api-spec.md` §11.1 `boundary` row (new optional fields, what `request` / `response` hold, `ts` = call start); `data-model.md` §10 seed made consistent with what the agent sends (response headers `null`, the same full error on all three throwing steps, the request-body object ref: 7 refs now) and its error stacks fixed to valid JSON (they held raw line breaks since task 0.8); `fixtures/seed/sample.sql` re-copied; `fixtures/events/post-orders.json` uses the new boundary fields.
- Decisions: `boundary` event fields (user, 2026-11-15).
- Bugs: fixed: the seed's error stacks were not valid JSON (introduced in 0.8, caught by this task's comparison; the new seed test guards it).
- Follow-ups: none.

### 2026-11-14 · 2.8 Ingest (`/agent`) · ✅ Done
- Done when: Integration test sends recorded batches from a file and sees them acknowledged; invalid events are dropped without losing valid ones.
- What changed: `packages/collector/src/ingest/`: `ingest.ts` (`hello` → `welcome` with limits; protocol version check: `PROTOCOL_MISMATCH` error with details, then close 4009; envelope validated, then each event on its own: bad events dropped with an `INVALID_EVENT` error, the rest kept; `ack` once a batch is stored; over 1 MB or 2,000 events → close 4013; 10 invalid messages in a row → close 4008; batches queue and drain one per event-loop turn, with `slow_down` above 5,000 waiting events and `resume` below 1,000), `sessions.ts` (session row on `hello`; on disconnect the session becomes `disconnected` and its running requests `incomplete`), `route.ts` (`WS /agent` behind `admitSocket`). `src/ids.ts` (prefixed ULIDs, in-house). The server's WebSocket library cap is 16 MB so ingest's own 1 MB check can close with 4013. `fixtures/events/post-orders.json`: the recorded agent stream for the seed's failing `POST /orders` (hello + 2 batches, 18 events), reused by task 2.9.
- Tests: 12 new tests over real WebSockets: the recorded batches are welcomed and acked (seq 1, 2) and all 18 events kept, with a session row; invalid events dropped, valid ones kept and acked; batch before `hello` rejected; 4009 with details; 4013 for size and for event count; 4008 after 10 invalid messages; disconnect marks the session and its running request; backpressure `slow_down` → `resume` with 6,000 queued events, all acked; ULIDs valid, time-sorted and unique.
- Docs updated: none.
- Decisions: none.
- Bugs: none.
- Follow-ups: the `boundary` event has no fields for its name and source location, which the seed's DB step has (`users.findOne`, `user.service.ts:15:5`); the recorded stream carries them inside `request` for now. Protocol change to be approved before task 2.9.

### 2026-11-14 · 2.7 Server + auth · ✅ Done
- Done when: Tests: missing token → 401, wrong token → 401, foreign origin → 403, wrong host → 403, burst → 429 with headers; static files served without a token.
- What changed: `packages/collector/src/server/`: `app.ts` (Fastify on 127.0.0.1; host check on every route; on `/api`: origin check, Bearer token in constant time, `Cache-Control: no-store`; `X-Pathlight-Tracker-Version` everywhere; rate limits per token with draft-spec headers; 64 KB body limit; WebSocket plugin answering `pathlight-tracker.v1` with `admitSocket` for `/agent` and `/live`; UI files (or a placeholder until 4.1) with a Content-Security-Policy and no token), `errors.ts` (error envelope; Fastify errors mapped to our codes; 500s logged with a correlation ID, never echoing internals), `guards.ts`, `token.ts` (per-project token file 0600), `listen.ts` (port 4777 with fallbacks, `collector.json`). New deps `fastify` 5.12.8, `@fastify/websocket` 11.3.7, `@fastify/rate-limit` 11.2.2, `@fastify/static` 10.1.11.
- Tests: 19 tests: the five Done-when checks; localhost origin accepted; writes limited at 21st request; 413 and 404 envelopes; UI without token with a strict CSP; built UI files served; host checked on static files; real WebSockets: `/agent` admitted with the token and the protocol answered, 4001 for wrong / missing token, `/live` 4003 for foreign / missing origin, `/agent` 4003 with a browser origin; token kept across restarts and rotated by deleting the file; next port when the default is busy.
- Docs updated: decision 0022; `architecture.md` §4 (port 4777, REST origin rule).
- Decisions: 0022.
- Bugs: none.
- Follow-ups: `405 METHOD_NOT_ALLOWED` needs the real routes (task 2.10).

### 2026-11-14 · 2.6 Soft delete, retention and purge · ✅ Done
- Done when: Tests prove: in-progress can't be deleted; restore keeps steps; purge removes steps and object refs; retention never purges active requests directly.
- What changed: `packages/collector/src/store/lifecycle.ts` (`softDelete`, `restore` (keeps the restored request, trashes the oldest active one if over the limit), `deletePermanently`, `clearAll`, `emptyTrash`, `purgeAll`, `counts`, `applyRetention` (oldest finished active → trash, never purged directly, in-progress never moved), `purgeExpired` (trashed past the TTL, then empty disconnected sessions, then incremental vacuum), `startPurgeJob` (startup + hourly, `unref`)); all return the affected IDs for the live hub. `src/cli/clear.ts`: real `pathlight-tracker clear` (to trash, with the TTL in the message) and `clear --purge` (counts in a confirmation prompt, `--yes` skips it, then vacuum); "nothing to clear" without creating a database. `src/version.ts`.
- Tests: 20 new tests: soft delete keeps steps; in-progress requests can't be soft- or hard-deleted; not-found and already-trashed results; restore keeps steps and object refs; restore over the limit trashes the oldest active request, not the restored one; permanent delete cascades; clear all skips in-progress; empty trash; purge all keeps in-progress; retention order, in-progress exempt, nothing under the limit; TTL purge at 71 h vs 73 h removes steps and vacuums; empty disconnected sessions removed, connected kept; hourly job with fake timers; `clear` and `clear --purge` (no, yes, `--yes`) end to end on a real store.
- Docs updated: none.
- Decisions: none.
- Bugs: none.
- Follow-ups: `clear` through a running collector (via `.pathlight-tracker/collector.json`, so open tabs update) needs the REST endpoints: finished in task 2.10.

### 2026-11-14 · 2.5 Store layer · ✅ Done
- Done when: Unit tests cover every filter, sort and cursor case, including "trashed requests never appear".
- What changed: `packages/collector/src/store/`: `requests.ts` (`activeRequests` / `trashedRequests` conditions every read goes through; `listRequests` with all §6.1 filters (method, status codes and classes, hasError, state, case-insensitive plain-text path, route, session, since / until, minDurationMs) and the four §9 sorts; `listTrash`; `getRequest` with `includeDeleted`), `steps.ts` (`listSteps` by parent / root, kind and error path in `seq` order; `getStep`; `childCounts`), `cursor.ts` (opaque base64url cursors holding the sort, a filter fingerprint and the last key + ID; keyset pagination with the ID breaking ties; `INVALID_CURSOR` for malformed or mismatched cursors), `writes.ts` (one-transaction `writeBatch`; insert / update for sessions, requests, steps and object refs; a step whose ID exists is skipped). The collector now depends on `@pathlight-tracker/protocol` (workspace).
- Tests: 37 new tests: trashed requests never appear (list, filters, `getRequest`); 14 filter cases incl. `%` / `_` as plain text and AND / OR combining; 4 sorts (in-progress requests have no duration and sort last when descending); paging every sort 3 at a time visits every row once; equal sort keys page without skips or repeats; filters kept across pages; last page has no cursor; malformed, other-sort and other-filter cursors rejected; trash list; step filters, step paging, cursor bound to its request, child counts; re-sent steps skipped; a failing batch rolls back.
- Docs updated: none.
- Decisions: in-progress requests (no duration) sort as duration -1.
- Bugs: none.
- Follow-ups: none.

### 2026-11-14 · 2.4 Seed data · ✅ Done
- Done when: `pnpm seed` loads 3 requests and 14 steps; a test checks the error path and the trashed request.
- What changed: `fixtures/seed/sample.sql` (the §10 SQL, copied verbatim); `packages/collector/src/store/seed.ts` (`loadSeed` replaces the store contents in one transaction); `seed-cli.ts` + root `pnpm seed [folder]` (default: `.pathlight-tracker/` in the current folder).
- Tests: 6 tests: `sample.sql` equals `data-model.md` §10 exactly (drift guard); 3 requests, 14 steps, 6 object refs; error path = steps 3, 4, 8 with `error_step_id` = step 8 and status 500; one trashed `GET /health` with its step; reloading replaces the data; a failing seed changes nothing. Manually: `pnpm seed` → "3 requests, 14 steps, 6 object refs".
- Docs updated: `CLAUDE.md` (`pnpm seed` exists now, with its target folder).
- Decisions: none.
- Bugs: none.
- Follow-ups: none.

### 2026-11-14 · 2.3 Database setup · ✅ Done
- Done when: Fresh start creates the DB; migration test runs; schema test inserts the seed data and passes all constraints.
- What changed: `packages/collector/src/store/schema.ts` (Drizzle schema for `sessions`, `requests`, `steps`, `object_refs`, `meta`, column for column as `data-model.md` §9, with every check, cascade, unique rule and partial index); `drizzle.config.ts` + `db:generate`; first migration `drizzle/0000_init.sql`; `src/store/open.ts` (creates `.pathlight-tracker/` 0700 and the file 0600, sets `auto_vacuum = INCREMENTAL` before any table, WAL and foreign keys, applies migrations, writes `meta.schema_version` / `created_by_version`, throws `STORE_UNAVAILABLE` with the path when it cannot; `ensureGitignored` adds `.pathlight-tracker/` once). New deps `drizzle-orm` 0.45.4, `better-sqlite3` 12.11.1, `drizzle-kit` 0.31.11 (dev); also `@types/better-sqlite3` 9.6.0 (dev, type definitions only: flagged to the user).
- Tests: 15 tests: fresh DB has the 5 tables, WAL, foreign keys, incremental vacuum and meta; reopening does not re-migrate; 0700 / 0600 (Linux and macOS; skipped on Windows); the seed SQL from `data-model.md` §10 loads (3 requests, 14 steps, 6 object refs, no foreign-key problems); 6 constraint violations are rejected; purge cascades; an unwritable path gives `STORE_UNAVAILABLE`; `.gitignore` created, appended once, or left alone.
- Docs updated: `data-model.md` §10 seed writes `meta` with `INSERT OR REPLACE` (the collector already writes those keys); plan 2.3 says `STORE_UNAVAILABLE` instead of the in-memory fallback (v1, decision 0008); `CLAUDE.md` `db:generate` exists now; `.claude/rules/database.md` paths and the `ask-before-change` hook now cover `src/store/schema.ts` and `drizzle/` (setup roadmap 2.3 ✅).
- Decisions: none.
- Bugs: none.
- Follow-ups: "incompatible older DB → back up and start fresh" (`data-model.md` §11) is only needed once a second schema version exists.

### 2026-11-14 · 2.2 Collector CLI skeleton + config · ✅ Done
- Done when: `pathlight-tracker --help` lists commands; config unit tests prove precedence and invalid-value fallback.
- What changed: `packages/collector/src/config/` (`settings.ts`: every setting from `architecture.md` §8 with a strict Zod schema, default, env name and text conversion; `load.ts`: defaults → `pathlight-tracker.config.json` → `PATHLIGHT_TRACKER_*` env → CLI flags, each value tagged with its source for `GET /config`; invalid values fall back to the next one down with a `CONFIG_INVALID_VALUE` warning; bad JSON is reported with its line and the file is ignored; unknown keys warn). `src/cli/` (`program.ts`: commander with `dev [options] -- <command...>` (`--port`, `--no-open`), `clear [--purge] [-y]`, `doctor`; stubs say which task builds them; `main.ts` entry; `bin` `pathlight-tracker`). New deps `commander` 14.0.3, `zod` 4.6.7.
- Tests: 14 tests: defaults, precedence with sources, lists and booleans from text, fallback with warnings for every source, bad JSON with line number, unknown keys, env names, `--help`, `dev --help` showing `--`, the user command passed through untouched (including its own flags), clear flags, warnings printed while the command still runs, unknown command exit code 1. Manually: `node packages/collector/dist/cli/main.js --help`.
- Docs updated: none (behaviour as in `architecture.md` §8 and `user-flows.md` §7).
- Decisions: `port` defaults to `null` (meaning the fixed default port that task 2.7 picks, decision 0015); booleans accept 1/0, true/false, yes/no; schemas are strict (no coercion) so "false" never reads as true.
- Bugs: none.
- Follow-ups: none.

### 2026-11-14 · 2.1 Protocol package: types and schemas · ✅ Done
- Done when: Schemas exported; unit tests accept valid examples from `api-spec.md` and reject invalid ones.
- What changed: `packages/protocol/src/`: `version.ts` (protocol version 1, subprotocol), `values.ts` (ID, nanosecond and time helpers, every enum, recursive `CapturedValue`), `events.ts` (all `/agent` messages and the 11 event types from `api-spec.md` §11.1, collector → agent messages), `live.ts` (`/live` topics and messages, §11.2), `api.ts` (Session, RequestSummary / Detail, StepSummary / Detail, StackFrame, `pageSchema`, API error codes and envelope, WebSocket close codes). Types are inferred from the Zod schemas; strict objects reject unknown fields. New dep `zod` 4.6.7.
- Tests: 35 tests: the spec examples (§6.1–§6.4, §8, §11.1, §11.2) are accepted; wrong ID prefixes, 24-character ULIDs, numeric durations, non-ISO times, unknown enums and fields, the old reused `kind`, bad nested captured values and made-up error codes are rejected.
- Docs updated: `api-spec.md` §6.4 example gains the error `column` its own type requires; new `.claude/rules/protocol.md`; the `ask-before-change` hook now guards `packages/protocol/src` (tests excluded); setup roadmap 2.1 row ✅.
- Decisions: Phase 2 libraries approved (Decisions table).
- Bugs: none.
- Follow-ups: none.

### 2026-11-14 · 1.4 Performance spike · ✅ Done
- Done when: `docs/decisions/0002-capture-approach.md` records the approach, slowdown numbers (target under 5×) and known limits.
- What changed: `tests/bench/` (new workspace package): `pnpm bench` starts the NestJS fixture untraced and traced (trace output to the null device), runs autocannon on `GET /health`, `GET /orders/42` and `POST /orders` (10 connections, 10 s after 2 s warm-up) and measures start-up (median of 5, alternating). `docs/decisions/0002-capture-approach.md` (go); `known-differences.json` now points to it. New dev dep `autocannon` 9.0.0 (approved 2026-11-14).
- Tests: 3 benchmark runs: slowdown 1.12–1.22× in every scenario, 0 errors, p99 within a few ms; start-up 2784 ms untraced vs 2795 ms traced; lint, typecheck, tests, corpus green.
- Docs updated: decision 0002, `CLAUDE.md` (`pnpm bench` exists now), Checkpoint 1 ticked in the plan.
- Decisions: 0002 (go; user chose: keep follow-on promises, accept the `toString` difference).
- Bugs: none.
- Follow-ups: known limits in decision 0002 go to tasks 3.6, 3.7, 3.8, 3.15 and 5.7.

### 2026-11-14 · 1.3 Behaviour-preservation corpus v0 · ✅ Done
- Done when: Corpus runs in CI; every case gives identical results with and without the hook.
- What changed: `tests/behaviour-corpus/` (new workspace package): 14 cases in `cases/src/` (class methods incl. private and `super`, arrow functions incl. minified shapes, async/await ordering and rejections, generators, getters/setters, tsc-style decorators, sloppy and strict `this`, `arguments` aliasing, `new.target`, default and destructured params, thrown errors incl. non-Errors and `finally`, stack traces, directives without `;`, hoisting, a parameter named like the probe, an unhandled rejection that must still crash, promise identity, `Function.prototype.toString`); `src/run.ts` runs each case with and without the hook and compares stdout, stderr and exit code (trace lines, agent warnings and stack columns left out); `known-differences.json` lists cases that must still differ. `pnpm test:corpus` (also in CI); `tests/*` added to the workspace; cases excluded from Prettier and ESLint so their odd shapes stay.
- Tests: `pnpm test:corpus`: 12 cases identical, 2 known differences (promise identity, `toString`), every case checked to be instrumented; new wrap unit test for name clashes; lint, typecheck, 34 tests green.
- Docs updated: `CLAUDE.md` (`pnpm test:corpus` exists now).
- Decisions: the 2 known differences go to decision 0002 (task 1.4) for the user.
- Bugs: found and fixed: a parameter named `__pt$` clashed with the probe variable and crashed the app at load; generated names are now chosen so they appear nowhere in the file.
- Findings for 0002: the re-parse safety net catches syntax errors but not early errors such as duplicate declarations, so generated names must be collision-free by construction; Node's crash output includes columns, which the spike shifts.

### 2026-11-14 · 1.2 Request context spike · ✅ Done
- Done when: Firing 20 concurrent requests produces 20 separate trees with no mixed lines.
- What changed: `packages/agent/src/spike/context.ts`: an `AsyncLocalStorage` trace per incoming request, started from Node's official `http.server.request.start` diagnostics channel (no patching of `http`); the runtime keeps one indent per trace instead of one global counter and tags every line `[pt <trace>]`. `fixtures/smoke/src/trace-lines.ts` parses and checks trees; `spike-context.ts` + `pnpm spike:context` (also in CI).
- Tests: `context.test.ts` (10 concurrent HTTP requests with random awaits → 10 traces, each nested correctly); `pnpm spike:context`: 20 concurrent `POST /orders` (10 × 500, 10 × 201) → 20 traces, 481 lines, output switched between traces 40 times, every tree well-formed (each `→` closed at the same indent, indent = open steps), 10 failing and 10 successful trees; lint, typecheck, 33 tests green.
- Docs updated: `CLAUDE.md` commands (`pnpm spike:context`).
- Decisions: none (findings go into 0002).
- Bugs: none.
- Findings for 0002: `enterWith` inside the `http.server.request.start` subscriber reliably scopes the whole NestJS request, including guards, interceptors, filters and everything awaited; calls outside a request share one `-` trace; two steps of the same request running in parallel (`Promise.all`) would still share one indent (task 3.8 uses parent step IDs instead of indent).

### 2026-11-14 · 1.1 Require hook + SWC transform spike · ✅ Done
- Done when: Running the NestJS fixture with the hook prints an indented step tree for `POST /orders`, ending in the `TypeError`.
- What changed: `packages/agent/src/spike/` (`register.ts` `--require` entry with `pirates`; `source-map.ts` finds the original `.ts` file and lines with `@jridgewell/trace-mapping`, decision 0009; `hook.ts` instruments only `src/**` minus tests and fails open; `wrap.ts` parses with SWC and splices enter / exit / throw probes into functions, methods, static methods and arrows, skipping getters, setters, constructors, generators and compiler-generated helpers; `runtime.ts` prints the indented tree and ends a step that returned a promise when it settles). `fixtures/smoke/src/run-app.ts` shared by `smoke.ts` and the new `spike-trace.ts`; `pnpm spike:trace` (also in CI). New deps (approved 2026-11-14): `pirates` 4.0.7, `@swc/core` 1.16.22, `@jridgewell/trace-mapping` 0.3.31.
- Tests: 19 unit tests (wrapping kinds, names and `.ts` lines, rethrows the same error, async timing, directives, skipped kinds, multi-byte offsets, unparsable file, source maps, fail-open); `pnpm spike:trace` prints guard → controller → service → `UserService.findById` → `CartService.total` → `PricingService.calculateDiscount (src/pricing/pricing.service.ts:22)` and ends in the `TypeError`; lint, typecheck, tests, smoke green.
- Docs updated: `CLAUDE.md` commands (`pnpm spike:trace`).
- Decisions: none (findings go into decision 0002 in task 1.4).
- Bugs: none.
- Findings for 0002: (1) stack-trace columns shift on lines where probes are inserted (lines stay right): production needs a chained source map (3.6 / 3.7); (2) a non-async function returning a promise ends when the promise settles; the caller then gets a follow-on promise (same settle, different object), as OpenTelemetry does; (3) SWC 1.16 names function bodies `FunctionBody` and some nodes carry no span; (4) tsc helpers (`__decorate`) have no source position and are skipped. (5) one global depth counter only works for a single sequential request (fixed in 1.2); (6) arrows in default parameters and parameter decorators are not wrapped yet; (7) the project root is `process.cwd()`, so starting the app from another folder instruments nothing (3.6 should warn). Review fixes: insertion order for `{return 1}`, directives without `;`, shebangs, a re-parse safety net that loads the original on any bad output, and runtime helpers that never run user code (Proxy traps, overridden `then`, error getters).

### 2026-11-06 · 0.8 Spec consistency pass · ✅ Done
- Done when: Each audit item is fixed, or linked to a decision or a later task; `progress.md` lists any left open.
- What changed: all ~95 audit items (plus the fixture mismatches from 0.6) resolved across `prd.md`, `architecture.md`, `api-spec.md`, `data-model.md`, `user-flows.md`, `design.md`, `tech-stack.md`, `implementation-plan.md` and `CLAUDE.md`. Highlights: decision 0011 schema gaps applied (entry type, unhandled error, warnings, exit code, argument names, request-level object refs, `logs` table for v1, `auto_vacuum`); `api-spec.md` §11.1 is now the master event list; `if` / `switch` decisions are MVP everywhere; editor link built in the browser (`PATHLIGHT_TRACKER_EDITOR` removed, decision 0014); per-project token wording (0015); seed uses 26-character ULIDs, `null` params, times matching the API, `{ id: 7 }`, a mapped stack and the red path ending at the throwing step; releases named MVP / v1 / v2 outside the plan.
- Tests: the data-model schema (§9) and seed (§10) run cleanly in SQLite (`better-sqlite3`): 3 requests, 14 steps, no foreign-key violations, `auto_vacuum` incremental, red path = steps 3, 4, 8; `pnpm lint && pnpm typecheck && pnpm test` green.
- Docs updated: the specs above, `CLAUDE.md` (token rule, object IDs), plan 2.6 / 2.7 / 2.9 / 4.1 / 4.9 / 5.6; `docs/analysis/2026-11-06-spec-audit-resolution.md` (where each item was fixed); the audit file links to it.
- Decisions: 0021 (Accepted 2026-11-14): the choices beyond decisions 0003–0016 (event fields, close code 4008, two env vars, `/health` warnings, `absolutePath`, exact schema columns, CLAUDE.md token rule, object ID format, `clear --purge`, CSP); approve in the Phase 0 PR.
- Bugs: none.
- Open items: none; detail left to later tasks is linked there (router 4.1, redaction list 3.4, tuning numbers 2.8 / 3.1 / 3.2 / 3.15, prebuilt binaries 5.6).

### 2026-11-06 · 0.7 Docs in repo · ✅ Done
- Done when: `docs/` contains every spec and `progress.md`; `CLAUDE.md` commands all work; README explains setup in under 10 steps.
- What changed: `Docs/` renamed to `docs/` and the `tracer-` prefix dropped from every spec and `ui-reference.png`; all paths updated in `CLAUDE.md`, `AGENTS.md`, README, agents, skills, hooks and the specs' cross-references; "until task 0.7" notes removed; `Docs/cursorrules` → root `.cursorrules`, now only pointing at `CLAUDE.md` and `.claude/rules/`; README setup (7 steps) + Troubleshooting (BUG-001); new `CONTRIBUTING.md` with the plan's §2 session rules; `CLAUDE.md` commands table adds the fixture commands and marks the ones later tasks add ("from task X"). One branch / one PR per phase (user request): plan §2, `CLAUDE.md`, `/start-task`, `/finish-task` updated.
- Tests: `pnpm install --frozen-lockfile`, `build`, `format:check`, `lint`, `typecheck`, `test` (9/9, plus one package via `--filter`), `fixtures:smoke` all pass; `session-context.sh` reads `docs/progress.md`.
- Docs updated: all specs (paths only), `implementation-plan.md` §2, `CLAUDE.md`, `AGENTS.md`, README, `CONTRIBUTING.md`, `.cursorrules`, `.claude/SETUP-ROADMAP.md` (0.7 rows ✅).
- Decisions: one branch / one PR per phase (Decisions table).
- Bugs: BUG-001 fixed (documented workaround).
- Follow-ups: `vibe-coding-setup-guide.md` and the architecture-guide PDF stay in `docs/`.

### 2026-11-05 · 0.6 Fixture apps · ✅ Done
- Done when: Both apps start with one command; a script hits their endpoints and gets the expected 200s and the deliberate 500.
- What changed: `fixtures/nestjs-app` (NestJS 11, Mongoose on `mongodb-memory-server`, TypeORM on in-memory SQLite, guard, pipes, interceptor, exception filter, the PRD `POST /orders` bug at `pricing.service.ts:27`), `fixtures/express-app` (Express 5, middleware chain, error middleware, Prisma 7 on SQLite, axios to a local stub, deliberate 500 on `GET /users/7/badge`), `fixtures/smoke` script; root scripts `fixture:nest`, `fixture:express`, `fixtures:smoke`; CI runs the smoke test and caches the MongoDB binary.
- Tests: `pnpm fixtures:smoke` (13 status checks + 4 log checks) passes locally on Windows; unit tests pin both deliberate bugs (`pricing.service.test.ts`, `badge.service.test.ts`); lint, typecheck, test, format all green. CI (Ubuntu, macOS, Windows) runs the smoke test on the PR.
- Docs updated: `docs/tech-stack.md` §10 (fixture databases), `docs/decisions/0020-fixture-stack.md`, `fixtures/README.md`.
- Decisions: 0020 (fixture databases without install, NestJS 11, install-script allowlist), approved 2026-11-05.
- Bugs: none.
- Follow-ups: (1) NestJS 12 is ESM-only, so new Nest apps can't be traced by the CommonJS-only MVP: check at Checkpoint 0 / product-analyst. (2) For 0.8: PRD says "Cannot read 'rate' of undefined" but Node emits "Cannot read properties of undefined (reading 'rate')"; PRD `users.findOne({ id: 7 })` vs user-flows `{_id:7}` (fixture uses numeric `id`); PRD `JwtAuthGuard` and `CreateOrderDto { userId, items }` vs fixture `AuthGuard` and `{ userId }`; seed user name, file lines other than pricing; CLAUDE.md `dev:nest` / `dev:express` are for 2.12 (fixture-only start is `fixture:nest` / `fixture:express`); fixtures need Node >=20.19, tech stack says 20+.

### 2026-11-05 · 0.5 CI · ✅ Done
- Done when: A PR shows all checks green on all three OSes.
- What changed: GitHub Actions CI workflow (`.github/workflows/ci.yml`) updated to test across Ubuntu, macOS, and Windows with Node 24 only (decision 0019); Changesets initialized (`.changeset/config.json`); release workflow dropped; Lesson 05 added.
- Tests: PR #5 CI run #3 green on Ubuntu, macOS and Windows (Node 24); the merge to `main` (run #4) is green too. Same checks pass locally on a clean checkout.
- Docs updated: `progress.md`, `docs/implementation-plan.md`, `docs/decisions/0019-ci-node-24-only.md`, `docs/learning/05-ci-github-actions-changesets.md`, `docs/learning/README.md`.
- Decisions: 0019.
- Bugs: none.
- Follow-ups: Node 20 support for traced apps is tested later through the fixtures and the behaviour corpus (decision 0019).

### 2026-11-04 · 0.4 Testing setup · ✅ Done
- Done when: `pnpm test` runs all packages and passes.
- What changed: Vitest root config (`vitest.config.mts`, root `include`; packages run `vitest run --dir src`), `tsconfig.build.json` per package so tests stay out of `dist/`, sample unit tests in all 4 packages (`packages/*/src/index.test.ts`), `@vitest/coverage-v8` coverage, root & package `test` scripts, `turbo.json` test task; `.claude/rules/testing.md` added; `test-runner` subagent added; Lesson 04 added.
- Tests: `pnpm test` (4/4 packages pass), `pnpm --filter <pkg> test` and `pnpm test:turbo` after a build, `pnpm test:coverage` (100% statements, branches, functions, lines), `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- Docs updated: `progress.md`, `docs/learning/04-testing-setup-vitest.md`, `docs/learning/README.md`.
- Decisions: none.
- Bugs: none.
- Follow-ups: none.

### 2026-11-04 · 0.3 Linting and formatting · ✅ Done
- Done when: `pnpm lint` passes; a badly formatted file is fixed on commit.
- What changed: ESLint 9 flat config + `typescript-eslint` v8 (`eslint.config.mjs`), Prettier 3 (`.prettierrc`, `.prettierignore`), Lefthook pre-commit git hook (`lefthook.yml`), root & package scripts for `lint`, `format`, `format:check`; PostToolUse Prettier hook (`.claude/hooks/format-on-edit.sh`); Lesson 03 added. Review fixes: LF line endings for all text files (`.gitattributes`), exact version pins, Markdown excluded from Prettier, installed versions recorded in tech-stack §11.
- Tests: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm format:check` all pass; Lefthook pre-commit auto-formatting verified.
- Docs updated: `progress.md`, `docs/learning/03-linting-and-formatting.md`, `docs/learning/README.md`.
- Decisions: none.
- Bugs: none.
- Follow-ups: none.

### 2026-11-01 · 0.2 Create the monorepo · ✅ Done
- Done when: `pnpm install && pnpm build` succeeds on a clean clone
- What changed: pnpm workspace + Turborepo root (`packageManager` pnpm 10.34.9, Node 24 via `.nvmrc` and `engines`), strict `tsconfig.base.json` (ES2023, CommonJS output), empty `protocol`, `agent`, `collector`, `ui` packages building with `tsc`, MIT `LICENSE`, `.gitignore`; dev deps typescript 5.9.3 (npm latest is 7.x; tech stack pins 5.x), turbo 2.11.10, /node 24.19.2.
- Tests: none yet (Vitest arrives in 0.4); verified `pnpm install && pnpm build` and `pnpm typecheck` on a fresh clone (4/4 packages).
- Docs updated: `progress.md`.
- Decisions: none.
- Bugs: BUG-001 (Windows path length with deep clone paths).
- Follow-ups: `reviewer` and `spec-checker` agents added; usable after restarting Claude Code. TypeScript 7 is out; moving to it would need a decision.

### 2026-11-01 · 0.1 Validate against AppMap · ✅ Done
- Done when: `docs/decisions/0001-appmap-validation.md` exists with a go / adjust decision.
- What changed: desk research by the `product-analyst` agent (`docs/analysis/2026-11-01-appmap-validation.md`); verdict adjust; PRD competitive section rewritten (Express and NestJS, correctness, full values, live); MCP server moved to v1 (6.16); AppMap export added to 7.10.
- Tests: none (research task).
- Docs updated: PRD, implementation plan, `progress.md`.
- Decisions: 0001, 0017, 0018.
- Bugs: none.
- Follow-ups: hands-on checklist on the fixtures after 0.6; AppMap bugs #180, #251, #181/#182, #183 as corpus cases in 1.3.

### 2026-11-01 · Spec audit decisions
- What changed: product renamed to `pathlight-tracker` across all docs, `CLAUDE.md`, rules and agents; 14 decisions recorded (`docs/decisions/0003`–`0016`); PRD (FR-9, FR-16, FR-38, FR-41–FR-53, metrics, release plan), plan (0.8, 3.14, 3.15, 4.17, 6.1, 6.2, 6.14, 6.15, 8.3, 8.4 and edits to 0.6, 1.1, 2.6, 2.10, 3.6, 4.5–4.11, 4.15), architecture §4 / §11 #18–#21, API spec, data model, design, tech stack and user flows updated.
- Audit saved: `docs/analysis/2026-11-01-spec-audit.md`.
- Decisions: 14 decided (licence: MIT).
- Follow-ups: task 0.8 applies the remaining audit fixes.

### 2026-10-30 · Planning complete
- Docs written: PRD, tech stack, architecture, data model, user flows, design (+ UI reference), API spec, implementation plan, CLAUDE.md.
- Decisions: see "Decisions" (1 decided, 3 open).
- Next: task 0.1 (AppMap validation).
