# 0022 · Server: default port 4777, origin rule for REST, rate-limit windows
Date: 2026-11-14 · Status: Accepted (task 2.7; port number left to this task by decision 0015)

## Context
Decision 0015 chose a fixed default port and a per-project token but left the exact port to task 2.7. Implementing the server also needed two clarifications the specs leave implicit: browsers do not send `Origin` on same-origin `GET` requests, and the rate-limit plugin counts requests in fixed windows rather than a token bucket.

## Decision
- **Default port 4777**, on `127.0.0.1` only. If it's busy, the collector tries 4778–4796. An explicit `--port` / `PATHLIGHT_TRACKER_PORT` is used as given, with a clear error if it's busy.
- **Origin rule:** REST (`/api/*`) rejects a present `Origin` that isn't `http://127.0.0.1:<port>` or `http://localhost:<port>`, and allows a missing `Origin` (same-origin `GET`s), because the token is still required. `/live` requires a matching `Origin`; `/agent` requires none. Wrong host or origin on a WebSocket closes it with `4003`, a missing or wrong token with `4001`.
- **Rate limits** as fixed 2-second windows per token: 200 reads (≈100/s with a burst of 200) and 20 writes (≈10/s). Headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After`.
- The token lives in `.pathlight-tracker/token` (0600). `.pathlight-tracker/collector.json` (pid, port, version, start time; no token) tells other commands a collector is running.

## Alternatives considered
- A random port each run: rejected by decision 0015 (links break).
- Requiring `Origin` on every REST call: would break the UI's own `GET` requests.
- A custom token-bucket limiter: more code for a local tool; the plugin's windows are close enough.

## Consequences
- `architecture.md` §4 and `api-spec.md` §3 follow these rules; tasks 2.8 (`/agent`), 2.10 (REST) and 2.11 (`/live`) use `admitSocket` and the shared checks.
