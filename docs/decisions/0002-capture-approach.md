# 0002 · Capture approach: load-time wrapping
Date: 2026-11-14 · Status: Accepted (Phase 1 capture spike, tasks 1.1–1.4)

## Context
Phase 1 had to prove, before building the collector and UI, that Pathlight Tracker can record every call in a real NestJS app without changing the app: correct step trees, requests kept apart under concurrency, unchanged behaviour, and an acceptable slowdown (target under 5×).

## Decision
**Go.** Capture works by wrapping functions at load time:

1. `node --require <agent>` installs a CommonJS require hook (`pirates`).
2. For each loaded file outside `node_modules`, the hook reads its source map once and finds the original `.ts` file (decision 0009). Only files under `src/` (minus tests) are wrapped; without a map the compiled path stands in.
3. The code is parsed with SWC, and enter / `try` / `catch` / `finally` probes are spliced into each function body at byte offsets. The probe records the name and the original `.ts` line from the source map. Getters, setters, constructors, generators and compiler-generated helpers (no source position) are left alone.
4. Each incoming request gets an `AsyncLocalStorage` trace, started from Node's `http.server.request.start` diagnostics channel, so no `http` patching is needed.
5. Everything fails open: a file that can't be parsed or wrapped loads unchanged, and runtime helpers never throw into, or run, user code.

The spike code (`packages/agent/src/spike/`) proved the approach. The production agent (tasks 3.1–3.8) rebuilds it with events and transport instead of printed lines, keeping these tests and findings.

## Evidence
- **Step tree** (`pnpm spike:trace`): `POST /orders` prints guard → interceptor → `OrdersController.create` → `OrdersService.create` → `UserService.findById` → `CartService.total` → `PricingService.calculateDiscount (src/pricing/pricing.service.ts:22)`, ending in the `TypeError`.
- **Concurrency** (`pnpm spike:context`): 20 concurrent `POST /orders` (10 failing, 10 succeeding) give 20 separate, well-formed trees; the output switched between requests 40 times with no mixed lines.
- **Behaviour** (`pnpm test:corpus`): 14 cases run with and without the hook; 12 are identical (stdout, stderr, exit code), 2 are accepted known differences (below). The corpus found and fixed one load-time crash.
- **Speed** (`pnpm bench`): NestJS fixture, autocannon, 10 connections, 10 s per scenario after a 2 s warm-up, trace output sent to the null device. Windows 10, Node 24.13, 2026-11-14:

| Scenario | Steps per request | Slowdown (3 runs) | Untraced → traced req/s (last run) | p99 ms (last run) |
| --- | --- | --- | --- | --- |
| `GET /health` | 3 | 1.14× · 1.21× · 1.14× | 7774 → 6814 | 3 → 6 |
| `GET /orders/42` | 6 | 1.13× · 1.12× · 1.16× | 5063 → 4356 | 5 → 6 |
| `POST /orders` (gold user) | 12 | 1.22× · 1.17× · 1.12× | 2153 → 1914 | 9 → 9 |

Start-up to the first `/health` (median of 5): 2784 ms untraced, 2795 ms traced, so wrapping the fixture's files at load time costs nothing measurable.

**Result: about 1.1–1.2×, far under the 5× target.**

## Accepted known differences (chosen by the user, 2026-11-14)
- **Returned promises:** a function that returns a native promise hands back a follow-on promise that settles the same way, so its step ends when the work does. This keeps unhandled rejections crashing exactly as before (the same choice OpenTelemetry makes). Cost: `promise === stored` identity checks and custom properties on that promise change. The alternative (returning the original) could silently swallow unhandled rejections and was rejected.
- **`Function.prototype.toString`:** returns the wrapped source. Fixing it would need patching a global, which the agent rules forbid. To be listed in the user docs (task 5.7).

## Known limits to solve in later tasks
- **Stack-trace columns** shift on lines where probes are inserted (line numbers stay right). Production needs a chained source map so `--enable-source-maps` reports the original columns (tasks 3.6 / 3.7).
- **Early errors:** the re-parse safety net catches syntax errors but not duplicate declarations, so generated names must stay collision-free by construction (they now are).
- **Steps in parallel within one request** (`Promise.all`) share one indent; production links steps by parent ID instead (task 3.8).
- **Not wrapped yet:** arrows in default parameters and parameter decorators; generators (task 3.6); constructors (v1).
- **Project root** is the working directory; starting the app from another folder instruments nothing. Production uses the config and `doctor` warns (tasks 3.1, 5.3).
- **Numbers above exclude transport:** the production agent adds batching and a WebSocket (task 3.2); task 3.15 re-runs `pnpm bench` against the real agent, keeping the 5× target.

## Alternatives considered
- **Babel instead of SWC:** slower at load time (tech-stack §12).
- **SWC's own transform with a plugin:** needs a Rust / Wasm plugin; parsing with SWC and splicing text was enough for the spike and keeps lines intact. Revisit in task 3.6 if chained source maps are easier that way.
- **Patching `http.Server` for request context:** the diagnostics channel does the same without monkey-patching.

## Consequences
- Phase 2 can start. Tasks 3.6–3.8 and 3.15 build on this record.
- `tests/behaviour-corpus/known-differences.json` points here; `pnpm test:corpus` fails if either difference disappears, so a later fix gets noticed.
