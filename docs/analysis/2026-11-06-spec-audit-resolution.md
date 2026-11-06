# Spec audit resolution
Date: 2026-11-06 · Task 0.8 · Resolves every item in `2026-11-01-spec-audit.md`

Status key: **Fixed** (the docs now agree; where it says so), **Decision** (settled by a decision record, docs updated), **Linked** (the docs now say which later task settles the detail). Nothing is left open.

## The 6 biggest problems

| Item | Status | Where |
| --- | --- | --- |
| A. `if` in the MVP? | Decision 0004 | `if` / `switch` are MVP: `data-model.md` §1, §6 (`decision` kind is MVP), seed row `stp_…09`; `api-spec.md` §4.2, §11.1 |
| B. Success can't be measured | Decision 0006 | `prd.md` success metrics use own weekly use, npm and GitHub stats; opt-in stats are Future (FR-52, task 8.3) |
| C. CLAUDE.md forbids printing the token | Fixed | `CLAUDE.md` → Do's and don'ts: never in log files; printing the link once and keeping it in `.pathlight-tracker/` and `sessionStorage` is allowed. `user-flows.md` T1 prints the link with the token |
| D. Watching nothing (`src/` vs `dist/`) | Decision 0009 | `architecture.md` §11 #18, plan 1.1 / 3.6 |
| E. Swallowed errors have no plan | Decision 0010 | `data-model.md` §6 `error_handling`; `api-spec.md` §11.1 (`step.throw` has no `caught` flag; the collector decides) |
| F. Deleted data stays in the file | Decision 0011 · Fixed | `data-model.md` §2 and §9: `PRAGMA auto_vacuum = INCREMENTAL` before the first table |

## 1. PRD items the plan or screens forgot

| Item | Status | Where |
| --- | --- | --- |
| 1.1 Prisma | Decision 0007 | `fixtures/express-app` (task 0.6), task 3.11 |
| 1.2 Object IDs saved | Decision 0011 · Fixed | `data-model.md` §3.4 (path format, request-level `request` role, nullable `step_id`); plan 2.9 writes the rows |
| 1.3 Copy link to a step | Fixed | `design.md` §5 `Inspector`; `user-flows.md` S5; plan 4.9 |
| 1.4 Editor choice | Decision 0014 · Fixed | `PATHLIGHT_TRACKER_EDITOR` and `editorUrl` removed; API sends `absolutePath`; the browser builds the link (`architecture.md` §3c, `tech-stack.md`, `user-flows.md`) |
| 1.5 Example curl port | Fixed | `user-flows.md` S2 shows a `<your-app-port>` placeholder; port detection is not in the MVP |
| 1.6 Pin | Fixed | `design.md` §6.1 (placement and rules with Follow latest); `user-flows.md` S4 header actions |
| 1.7 Function types | Fixed | Plan 3.6 lists static methods and arrow class fields; `prd.md`: getters are **never** tracked |
| 1.8 Interceptor and filter details | Decision 0011 · Fixed | `data-model.md` §6 `detail_json` shapes for `interceptor`, `filter`, Express `middleware` |
| 1.9 Unhandled error lost | Decision 0011 · Fixed | `requests.unhandled_error_json` |
| 1.10 CSP | Fixed | Plan 2.7 sends a Content-Security-Policy header (5.5 still reviews it) |
| 1.11 `clear` never finished | Fixed | Plan 2.6 finishes `clear` and `clear --purge` |

## 2. Scope creep

| Item | Status | Where |
| --- | --- | --- |
| 2.1 `doctor` | Decision 0008 | PRD FR-41, task 5.3 |
| 2.2 `clear` | Decision 0008 | PRD FR-42 |
| 2.3 Search box in MVP | Decision 0008 · Fixed | Hidden until v1 (`design.md` header and navigation, plan 4.5); search is task 6.9 |
| 2.4 Extra filters | Decision 0008 · Fixed | MVP: path + "Errors only" (`user-flows.md` S3); the rest in task 6.14 |
| 2.5 Extra settings, `/config` | Decision 0008 · Fixed | `user-flows.md` S7 split into MVP (theme, editor, follow-latest default, setup warnings) and v1; `/config` is v1 |
| 2.6 Sessions menu, folder button | Decision 0008 | Sessions are MVP (FR-43); "Open folder" dropped (plan 4.5) |
| 2.7 Tablet and phone | Decision 0008 · Fixed | MVP is 1100 px and up (`design.md` §7, plan 4.15); phone and tablet in task 8.4 |
| 2.8 "Coming soon" tabs | Decision 0008 · Fixed | Hidden until v1 (`design.md` §5, §6.1, §6.3; `user-flows.md` S4) |
| 2.9 Small extras | Decision 0008 · Fixed | v1 (task 6.14): in-memory fallback, trash size limit, `o + Enter`, `--quiet`, truncation header; client logs in 6.13 (`api-spec.md` §5.1, §6.5; `user-flows.md` T1 and edge cases) |

## 3. Same thing, different names

| Item | Status | Where |
| --- | --- | --- |
| 3.1 "Phase 2" | Fixed | Releases are MVP / v1 / v2 in every spec; "Phase N" only inside the plan (note at the top of `implementation-plan.md`) |
| 3.2 Step tree names | Fixed | "step tree" in `architecture.md` (diagram, `features/step-tree`), `user-flows.md` S4, plan 1.1 |
| 3.3 Agent package name | Decision 0003 | `@pathlight-tracker/agent` |
| 3.4 `method` kind, reused `kind` fields | Fixed | `architecture.md` §3d naming rules; `boundaryType`, `decisionType`, `loopType` in `api-spec.md` §11.1 and `data-model.md` §6 |
| 3.5 Decision types and badges | Fixed | `DecisionType` in `api-spec.md` §4.2; `TERNARY`, `LOGIC`, `OPTIONAL` badges (v1) in `design.md` §2.5 |
| 3.6 Agent messages differ | Fixed | `api-spec.md` §11.1 is the master copy (event table with every field; `v` and `pid` per batch; `responseHeaders` on `request.end`); `architecture.md` §3d points to it |
| 3.7 `console.log` | Decision 0011 · Fixed | A `log` event (v1) stored in the `logs` table, not a step |
| 3.8 caught / swallowed / Caught | Fixed | Stated as one idea in `architecture.md` §3d and `data-model.md` §6 |
| 3.9 Missing messages in architecture | Fixed | `architecture.md` §3d summarises and links instead of copying |
| 3.10 Unknown error codes | Fixed | `PROTOCOL_MISMATCH`, `INVALID_MESSAGE` added as WebSocket `error` codes (`api-spec.md` §11); `user-flows.md` shows the real code instead of `COLLECTOR_ERROR` |
| 3.11 Close code 4003 twice | Fixed | New `4008` for repeated invalid messages (`api-spec.md` §8, §11) |
| 3.12 `127.0.0.1` vs `localhost` | Fixed | Both allowed, in `architecture.md` §4 and `api-spec.md` |
| 3.13 Sessions "ended" | Fixed | `disconnected` (`user-flows.md` §7) |
| 3.14 Who sets the layer badge | Fixed | The collector (`api-spec.md` `Layer`, `design.md` layer rule) |
| 3.15 `suspicious` flag | Fixed | `data-model.md` §3.6 `CapturedValue` |
| 3.16 Object IDs are not ULIDs | Fixed | `CLAUDE.md`, `data-model.md` §2 |
| 3.17 Shared log-level variable | Fixed | Agent reads `PATHLIGHT_TRACKER_AGENT_LOG_LEVEL`; the collector keeps `PATHLIGHT_TRACKER_LOG_LEVEL` (`architecture.md` env tables) |
| 3.18 File names | Fixed | Task 0.7 dropped the `tracer-` prefix |
| 3.19 Three folder layouts | Fixed | `architecture.md` §2 is the official one; `tech-stack.md` links to it |
| 3.20 "Two tables" | Fixed | `tech-stack.md` §12 |

## 4. Database

| Item | Status | Where |
| --- | --- | --- |
| 4.1 Settings in `meta` | Fixed | Removed from `meta` and the seed; config is the only source |
| 4.2 "What started this" | Decision 0011 · Fixed | `requests.entry_type` (`http` in the MVP); `method` and `path` required only for `http` |
| 4.3 Missing places | Decision 0011 · Fixed | `steps.arg_names_json`, `sessions.warnings_json` (setup warnings and files not recorded), `sessions.exit_code`; changed arguments (v1) in `detail_json.argChanges` |
| 4.4 Logs as steps | Decision 0011 | Separate `logs` table (v1) |
| 4.5 24-character IDs | Fixed | Seed and API examples use 26-character ULIDs |
| 4.6 `{}` vs `null` | Fixed | Empty params and query stored as `null` (`data-model.md` §3.2 and seed) |
| 4.7 2025 vs 2026 times | Fixed | Seed times now match the API examples (2026-10-30, 06:35 UTC); agent example `ts` updated |
| 4.8 `if` on the red path | Decision 0010 · Fixed | Seed `stp_…09` has `on_error_path = 0`; the path ends at the step that threw |
| 4.9 Who assigns `seq` | Decision 0011 · Fixed | The collector; duplicates caught by step ID (`data-model.md` §3.3, §5) |
| 4.10 `clear --purge` | Fixed | Deletes **everything** permanently (active and trashed), with confirmation; "Empty trash" is the UI / API action (`data-model.md` §7, §8; `user-flows.md` §8) |
| 4.11 Trash size limit vs 72 h | Decision 0012 · Fixed | Size guard marked v1 in `data-model.md` §7 and §8 |

## 5. API vs screens

| Item | Status | Where |
| --- | --- | --- |
| 5.1 Setup warnings endpoint | Fixed | `/health` → `agents[].warnings` (from the new `warning` event) |
| 5.2 "Open folder" | Decision 0008 | Dropped |
| 5.3 `clear` with open tabs | Fixed | Plan 2.6: through the running collector (`.pathlight-tracker/collector.json`) |
| 5.4 `doctor` uses `/health` | Fixed | Claim removed from `api-spec.md` §5.1 |
| 5.5 cURL port | Fixed | Built from the captured `host` header, with a placeholder fallback (`api-spec.md` §6.5) |
| 5.6 Sample page and bundling | Fixed | `/sample` page; `dist/sample.json` shipped in the collector (`api-spec.md` §6.10) |
| 5.7 Step count for running requests | Fixed | Running rows show elapsed time; the count appears when finished or for the open request (`user-flows.md` S3). No protocol change |
| 5.8 Unused endpoints and filters | Decision 0008 · Linked | Extra filters and `/config` belong to v1 (task 6.14); task 2.10 builds only the MVP endpoints |
| 5.9 POST routes not listed | Fixed | `architecture.md` §4 protected routes |

## 6. Tech stack vs architecture

| Item | Status | Where |
| --- | --- | --- |
| 6.1 Libraries not listed (router) | Linked | Plan 4.1 picks the router and adds it to `tech-stack.md` (asking first, as for every dependency) |
| 6.2 Clock | Fixed | `ts` is wall-clock nanoseconds: clock read once at request start plus high-resolution offsets (`api-spec.md` §11.1) |
| 6.3 ~100 ms promise | Decision 0013 | No fixed promise; `architecture.md` §3c updated |
| 6.4 Editor link column | Fixed | `{path}:{line}:{column}` everywhere |
| 6.5 "Sonner (shadcn Toast)" | Fixed | "Sonner" (`tech-stack.md`) |
| 6.6 SWC version clash | Fixed | The agent resolves its own `@swc/core` (`tech-stack.md` §5) |
| 6.7 "No backend server" | Fixed | "No remote server" (`tech-stack.md` principles) |

## 7. Unclear spots

| Item | Status | Where |
| --- | --- | --- |
| 7.1 Missing numbers | Fixed · Linked | Starting values in `architecture.md` §10: auto-disable after 20 internal errors in 60 s, 10,000-event / 8 MB buffer, 10 invalid messages → `4008`, `slow_down` above 5,000 queued events; tuned in 2.8, 3.1, 3.2, 3.15 |
| 7.2 What gets dropped | Fixed | Whole requests, never part of one; never an `exit` without its `enter` (`architecture.md` §10) |
| 7.3 How swallowed errors show | Decision 0010 | Caught (violet); red only for the error that reached the response |
| 7.4 Missing keys | Decision 0016 | `if` probes show the missing value; seed marks it `suspicious` |
| 7.5 Production force setting | Fixed | `PATHLIGHT_TRACKER_ALLOW_PRODUCTION=1` |
| 7.6 Config format and CLI flags | Fixed | camelCase keys without the prefix; MVP flags `--port`, `--no-open` (`architecture.md` §8) |
| 7.7 Redaction rules | Fixed · Linked | Built-in list, lower-case "contains" match ignoring `-` / `_`; exact list in task 3.4 |
| 7.8 Row height | Fixed | 32 px default; 40 px with the v1 density setting |
| 7.9 "All files excluded" message | Fixed | Driven by the `NO_FILES_INSTRUMENTED` warning |
| 7.10 Who maps the stack | Fixed | The agent, through source maps (task 3.7); seed now has a stack |
| 7.11 "File may have changed" | Fixed | API `fileChangedSince`, from the file's modification time |
| 7.12 Framework always "unknown" | Fixed | Sent with the first `request.start` |
| 7.13 Saved links break | Decision 0015 · Fixed | Fixed port and per-project token; remaining "per run" wording fixed in `architecture.md`, `user-flows.md`, `api-spec.md`, plan 2.7 |
| 7.14 Link with or without token | Fixed | The terminal prints the link with the token (`user-flows.md` T1) |
| 7.15 UI dev server data | Linked | Task 4.1 defines it; `CLAUDE.md` marks the command "from task 4.1" |
| 7.16 `better-sqlite3` install | Linked | Prebuilt binaries checked in task 5.6 (`tech-stack.md` §6) |

## Found after the audit (task 0.6 fixtures)

| Item | Status | Where |
| --- | --- | --- |
| PRD error text | Fixed | Node's text everywhere: "Cannot read properties of undefined (reading 'rate')" |
| `{ id: 7 }` vs `{ _id: 7 }` | Fixed | Numeric `id`, as in the PRD and the fixture (`data-model.md` seed) |
| PRD names vs the fixture (`JwtAuthGuard`, `items`, user name) | Fixed | `data-model.md` §10 says the seed follows the PRD and matches the fixture in shape and in the pricing lines (22 / 24 / 27) |
| `dev:nest` / `dev:express` vs `fixture:*` | Fixed | Task 0.7 (`CLAUDE.md` commands) |
| Fixtures need Node 20.19+ | No change | The fixtures' own dependencies need it; traced apps stay "Node 20+" |

## Spec changes to review

Choices made here beyond decisions 0003–0016 are collected in **decision 0021 (Proposed)**, to approve or change in the Phase 0 PR review: event protocol fields, WebSocket codes, REST fields, two env vars, the exact schema columns, the CLAUDE.md token rule, object ID format, `clear --purge`, `collector.json`, the CSP header and the starting limit values.
