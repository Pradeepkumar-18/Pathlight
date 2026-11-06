# 0021 · Spec consistency choices (task 0.8)
Date: 2026-11-06 · Status: Proposed (approve or change in the Phase 0 PR review)

## Context
Task 0.8 resolved every item of the 2026-11-01 spec audit. Most fixes follow decisions 0003–0016. Some needed a concrete choice those decisions did not make, and they touch areas `CLAUDE.md` lists under "Ask before changing". This record collects them in one place so they can be approved together. Item numbers refer to the audit; where each change lives is in `docs/analysis/2026-11-06-spec-audit-resolution.md`.

## Decision
- **Event protocol** (`api-spec.md` §11.1 becomes the master copy): `framework` sent on `request.start` (7.12); new `warning` event (5.1, 7.9); `argNames` on `step.enter`, `detail` on `step.exit`, `column` in errors, `responseHeaders` on `request.end` (3.6, 4.3); `boundaryType` / `decisionType` / `loopType` instead of a reused `kind` (3.4); `ts` = wall-clock nanoseconds (6.2).
- **WebSocket**: close code `4008` for repeated invalid messages (3.11); `error` codes `INVALID_MESSAGE` and `PROTOCOL_MISMATCH` (3.10).
- **REST**: `/health` `agents[].warnings` (5.1); step detail `absolutePath` and `fileChangedSince` replace `editorUrl` (decision 0014, 7.11); cURL address from the captured `host` header (5.5).
- **Env vars**: `PATHLIGHT_TRACKER_AGENT_LOG_LEVEL` for the agent (3.17); `PATHLIGHT_TRACKER_ALLOW_PRODUCTION` (7.5); `PATHLIGHT_TRACKER_EDITOR` removed (decision 0014).
- **Schema** (decision 0011 approved the gaps; these are the exact columns): `requests.entry_type`, nullable `method` / `path`, `requests.unhandled_error_json`, `sessions.exit_code`, `sessions.warnings_json`, `steps.arg_names_json`, nullable `object_refs.step_id` with role `request`, `logs` table (v1), retention keys removed from `meta`.
- **Security rule in `CLAUDE.md`** (C): tokens never go into log files; printing the UI link with the token once in the terminal, keeping it in `.pathlight-tracker/` and in the browser's `sessionStorage` is allowed.
- **IDs** (3.16): object IDs are agent-issued counters (`obj_17`), not ULIDs.
- **Behaviour**: `clear --purge` deletes everything permanently (4.10); `clear` goes through a running collector found via `.pathlight-tracker/collector.json` (5.3); a Content-Security-Policy header in task 2.7 (1.10); starting values for limits in `architecture.md` §10 (7.1).

## Alternatives considered
- Leave these items open for the tasks that implement them: rejected, because the audit's point was that an AI building those tasks would have to guess.
- One decision per item: rejected as noise; they are small and reviewed together.

## Consequences
- Tasks 2.1 (protocol), 2.3 (schema), 2.7, 2.8, 3.x build to these shapes.
- If any choice is changed in review, update the spec and this record before Phase 1 starts.
