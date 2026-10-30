# Tracer: Implementation Plan

Tracer is a local developer debug visualizer: it draws a live map of each request as it hits your local Node/TypeScript server, showing every function it passed through and the real data at each step.

This plan turns the docs into buildable work. Each task is sized for **one focused AI coding session** (roughly 1–3 hours of work, one pull request). Tasks are listed in dependency order; do them top to bottom unless a task says it can run in parallel.

Source docs (keep them in `docs/` in the repo and give the relevant ones to every session): PRD, `tech-stack.md`, `architecture.md`, `data-model.md`, `user-flows.md`, `design.md`, `ui-reference.png`, `api-spec.md`.

---

## 0. Checklist at a glance

| Checkpoint | Where |
| --- | --- |
| Project broken into phases | §1 |
| Each phase broken into small tasks | §3–§10 |
| Tasks in dependency order | Every task has **Depends on** |
| "Done when…" for each task | Every task has **Done when** |
| Setup tasks first (repo, env, DB, auth) | Phase 0 and Phase 2 |
| Testing / review checkpoint after each phase | End of every phase |
| MVP line clearly marked | §8 |

---

## 1. Phases

| Phase | Name | Goal | Tasks |
| --- | --- | --- | --- |
| 0 | Setup and validation | Repo, tooling, CI, fixtures, and proof the market gap is real | 0.1–0.7 |
| 1 | Capture spike | Prove the riskiest part works: wrap functions in a real NestJS app without changing behaviour | 1.1–1.4 |
| 2 | Protocol and collector | Shared contract, database, local server with auth, ingest, live hub, REST API | 2.1–2.13 |
| 3 | Runtime agent | Production-quality capture: context, values, frameworks, DB/HTTP, errors, safety | 3.1–3.14 |
| 4 | Map UI | Browser UI from the design: shell, list, step tree, inspector, trash, settings, states | 4.1–4.16 |
| 5 | Integration and MVP release | End-to-end tests, CLI polish, packaging, docs, release `0.1.0` | 5.1–5.8 |
| ═══ | **MVP LINE** | Everything above ships as the MVP | — |
| 6 | v1: daily debugging tool | Conditions, loops, Logs, search, compare, graph, timeline | 6.1–6.14 |
| 7 | Phase 2 product: VS Code extension and v2 | Extension, ESM, data journey, more frameworks, export | 7.1–7.10 |
| 8 | Future | MCP server, AI explanation | 8.1–8.2 |

```
Phase 0 ──▶ Phase 1 (spike) ──▶ Phase 2 (collector) ──▶ Phase 3 (agent) ──▶ Phase 5 ══ MVP ══▶ Phase 6 ──▶ Phase 7
                                      │                                          ▲
                                      └──▶ Phase 4 (UI, from seed data) ─────────┘
```

Phase 4 can start as soon as the REST API and seed data exist (task 2.10), in parallel with Phase 3.

---

## 2. How to run each task (AI session rules)

| Rule | Detail |
| --- | --- |
| One task = one session = one PR | Don't combine tasks; small PRs are easy to review |
| Start every session with context | Paste the task row plus the doc sections it names; say "follow `docs/…`" |
| Tests in the same session | A task isn't done until its tests pass in CI |
| Definition of done (every task) | Code + tests + lint/typecheck pass + docs updated if behaviour changed + PR merged |
| If a task grows | Split it; add the new task right after, with its own "Done when" |
| Never skip a checkpoint | Each phase ends with a review checkpoint; fix findings before moving on |

---

## 3. Phase 0: Setup and validation

| ID | Task | Depends on | Done when |
| --- | --- | --- | --- |
| 0.1 | **Validate against AppMap.** Install AppMap on a real NestJS project, record a few requests, write down what it does well and what's missing (live, data-first, NestJS layer) | — | `docs/decisions/0001-appmap-validation.md` exists with a go / adjust decision |
| 0.2 | **Create the monorepo.** pnpm workspaces, Turborepo, TypeScript strict base config, packages `protocol`, `agent`, `collector`, `ui` (empty), `.nvmrc` (Node 24), `packageManager` field | 0.1 | `pnpm install && pnpm build` succeeds on a clean clone |
| 0.3 | **Linting and formatting.** ESLint flat config + typescript-eslint, Prettier, lefthook pre-commit, `pnpm lint` / `pnpm format` scripts | 0.2 | `pnpm lint` passes; a badly formatted file is fixed on commit |
| 0.4 | **Testing setup.** Vitest workspace config, one sample test per package, coverage report | 0.2 | `pnpm test` runs all packages and passes |
| 0.5 | **CI.** GitHub Actions: install (frozen lockfile), lint, typecheck, test on Ubuntu, macOS, Windows with Node 20 and 24; Changesets set up | 0.3, 0.4 | A PR shows all checks green on all three OSes |
| 0.6 | **Fixture apps.** `fixtures/nestjs-app` (controller, service, repository, guard, pipe, interceptor, exception filter, Mongoose and TypeORM, the `POST /orders` bug from the PRD) and `fixtures/express-app` (middleware chain, error middleware, axios call) | 0.2 | Both apps start with one command; a script hits their endpoints and gets the expected 200s and the deliberate 500 |
| 0.7 | **Docs and AI rules in repo.** Copy all spec docs, `ui-reference.png` and `progress.md` into `docs/` (drop the `tracer-` prefix); add `CLAUDE.md` and `.cursorrules` at the root; `README.md` with the project goal and how to run fixtures; `CONTRIBUTING.md` with the session rules from §2 | 0.2 | `docs/` contains every spec and `progress.md`; `CLAUDE.md` commands all work; README explains setup in under 10 steps |

**Checkpoint 0: Setup review**

- [ ] Clean clone → install → build → lint → test all pass locally and in CI on three OSes.
- [ ] Both fixture apps run and reproduce the `POST /orders` bug.
- [ ] AppMap validation decision recorded; if "adjust", PRD updated before continuing.

---

## 4. Phase 1: Capture spike (de-risk first)

Goal: prove, before building infrastructure, that load-time wrapping works on real NestJS code. Spike code may be thrown away, but its tests and findings are kept.

| ID | Task | Depends on | Done when |
| --- | --- | --- | --- |
| 1.1 | **Require hook + SWC transform spike.** `--require` entry that hooks CommonJS loading with `pirates`, transforms only `src/**` with SWC, wraps every function to log `enter`/`exit`/`throw` with name, file and line to stdout | 0.6 | Running the NestJS fixture with the hook prints an indented call tree for `POST /orders`, ending in the `TypeError` |
| 1.2 | **Request context spike.** `AsyncLocalStorage` started per incoming HTTP request; every log line tagged with a trace ID | 1.1 | Firing 20 concurrent requests produces 20 separate trees with no mixed lines |
| 1.3 | **Behaviour-preservation corpus v0.** `tests/behaviour-corpus/` with tricky cases (class methods, arrow functions, async/await, generators, getters/setters, decorators, `this`, `arguments`, default params, thrown errors, stack traces); runner compares output with and without the hook | 1.1 | Corpus runs in CI; every case gives identical results with and without the hook |
| 1.4 | **Performance spike.** autocannon benchmark of the fixture traced vs untraced; write findings | 1.2 | `docs/decisions/0002-capture-approach.md` records the approach, slowdown numbers (target under 5×) and known limits |

**Checkpoint 1: Go / no-go on the capture approach**

- [ ] Call tree correct for the PRD example; concurrent requests separated.
- [ ] Behaviour corpus fully green.
- [ ] Slowdown measured and acceptable (or a mitigation plan written).
- [ ] If any of these fail: stop and redesign the capture approach before Phase 2.

---

## 5. Phase 2: Protocol and collector (setup: env, DB, auth)

| ID | Task | Depends on | Done when |
| --- | --- | --- | --- |
| 2.1 | **Protocol package: types and schemas.** Shared types and Zod schemas for `CapturedValue`, agent events, `/live` messages, REST types and error envelope, protocol version constant (`api-spec.md` §4, §11) | Checkpoint 1 | Schemas exported; unit tests accept valid examples from `api-spec.md` and reject invalid ones |
| 2.2 | **Collector CLI skeleton.** `commander` with `tracer dev -- <cmd>`, `tracer doctor`, `tracer clear [--purge]` stubs; config loading (defaults → `tracer.config.json` → env `TRACER_*` → CLI flags) with source tracking | 2.1 | `tracer --help` lists commands; config unit tests prove precedence and invalid-value fallback |
| 2.3 | **Database setup.** Drizzle schema for `sessions`, `requests`, `steps`, `object_refs`, `meta` exactly as `data-model.md` §9; `drizzle-kit` migrations applied at startup; WAL and foreign keys on; `.tracer/` created with `0700`, DB `0600`; `.gitignore` entry added; in-memory fallback if not writable | 2.2 | Fresh start creates the DB; migration test runs; schema test inserts the seed data and passes all constraints |
| 2.4 | **Seed data.** `fixtures/seed/sample.sql` from `data-model.md` §10 and `pnpm seed` script | 2.3 | `pnpm seed` loads 3 requests and 14 steps; a test checks the error path and the trashed request |
| 2.5 | **Store layer.** Typed query functions: insert/update sessions, requests, steps, object refs in batched transactions; `activeRequests` helper; list with filters, sorting and cursor pagination (`api-spec.md` §9) | 2.3 | Unit tests cover every filter, sort and cursor case, including "trashed requests never appear" |
| 2.6 | **Soft delete, retention and purge.** Soft delete, restore, permanent delete, empty trash, retention (oldest active → trash), purge job (startup + hourly, TTL 72 h), trash size guard, session cleanup, incremental vacuum (`data-model.md` §7) | 2.5 | Tests prove: in-progress can't be deleted; restore keeps steps; purge removes steps and object refs; retention never purges active requests directly |
| 2.7 | **Server + auth.** Fastify on `127.0.0.1`, random port, token generation, Bearer check on `/api`, subprotocol token check on WebSockets, origin and host checks, error envelope, `X-Tracer-Version`, `Cache-Control: no-store`, rate limits, size limits, static UI serving (`architecture.md` §4, `api-spec.md` §3, §8, §10) | 2.2 | Tests: missing token → 401, wrong token → 401, foreign origin → 403, wrong host → 403, burst → 429 with headers; static files served without a token |
| 2.8 | **Ingest (`/agent`).** WebSocket endpoint: handshake (`hello` → `welcome`), protocol version check (close 4009), batch validation, `ack`, partial rejection with `error`, max size (close 4013), backpressure (`slow_down` / `resume`) | 2.5, 2.7 | Integration test sends recorded batches from a file and sees them acknowledged; invalid events are dropped without losing valid ones |
| 2.9 | **Trace builder.** Turn events into request trees: link parents, pair enter/exit/throw, depth and `seq`, boundary steps, `error_handling` (propagated / swallowed / converted / unhandled), error path marking, `has_error`, `error_step_id`, step limit and truncation, incomplete requests after app exit, layer derivation | 2.8 | Feeding the recorded `POST /orders` event stream produces rows identical to the seed data (except IDs and times) |
| 2.10 | **REST API (MVP endpoints).** `health`, `config`, `sessions`, `requests` (list, detail with `errorPath`), `steps` (tree and lazy children), `steps/:id`, `curl`, delete / restore / trash endpoints, `sample` (`api-spec.md` §5–§7) | 2.6, 2.9 | Contract tests check every endpoint against the Zod schemas and the examples in `api-spec.md`, including every listed error code |
| 2.11 | **Live hub (`/live`).** Subscriptions (`requests`, `request:<id>`), started / steps appended / steps updated / completed / deleted / restored / purged / agent messages, ~100 ms batching, ping/pong, max connections | 2.9, 2.7 | Integration test: an agent batch produces the expected `/live` messages in order; a UI subscribed to one request gets only its steps |
| 2.12 | **Launcher.** Spawn the user's command with `NODE_OPTIONS` appended, `TRACER_COLLECTOR_URL`, `TRACER_TOKEN`; forward stdout/stderr and exit code; forward Ctrl+C; print banner with UI URL; open the browser; `o` + Enter reopens it | 2.7 | Running `tracer dev -- node fixtures/express-app` starts the app, prints the URL with the token, and stops cleanly on Ctrl+C with the app's exit code |
| 2.13 | **Collector logging and errors.** pino to console and `.tracer/logs/collector.log` (rotated), never logging values or tokens; uncaught errors logged without crashing; `STORE_UNAVAILABLE` handling | 2.7 | Tests show a forced DB lock returns 503 and logs an entry with a `logId`; grep of logs in tests finds no token or captured values |

**Checkpoint 2: Collector review**

- [ ] Full API contract test suite green; every endpoint in `api-spec.md` (MVP) implemented.
- [ ] Security tests green: token, origin, host, rate and size limits.
- [ ] Recorded event stream → database → REST output matches the seed example.
- [ ] Soft delete / retention / purge behaviour matches `data-model.md` §7.
- [ ] Manual review: run `tracer dev` with the Express fixture; `GET /api/v1/health` works with the token and fails without it.

---

## 6. Phase 3: Runtime agent

Rebuild the spike as the real `agent` package, following `architecture.md` §5 (agent modules).

| ID | Task | Depends on | Done when |
| --- | --- | --- | --- |
| 3.1 | **Register, config and safety.** `@tracer/register` entry; reads `TRACER_*`; kill switch; production guard (`NODE_ENV=production`); fail-open wrapper; internal error counter with auto-disable and one clear warning; `[tracer]` stderr logger | 2.1 | Tests: forced internal errors never reach user code; after N errors the agent disables itself and sends `agent.disabled` |
| 3.2 | **Transport.** WebSocket client with subprotocol token, `hello`, batching (~50 ms or full), `ack` handling, bounded buffer (drop oldest), reconnect with backoff, respects `slow_down` | 3.1, 2.8 | Integration test against a real collector: events arrive in order; killing the collector never blocks or crashes the app |
| 3.3 | **Safe value capture.** Serializer producing `CapturedValue`: depth/array/string caps, circular refs, special types (Map, Set, Date, Buffer, Error, Promise, BigInt, Symbol, class instances, Mongoose docs), never calls getters or `toJSON`, `suspicious` flag for `undefined`/`NaN` in objects | 3.1 | Unit tests for every type; a getter with side effects is never triggered; a 50 MB buffer is summarized |
| 3.4 | **Redaction.** Built-in key list + `TRACER_REDACT_KEYS`; headers and nested keys; applied before anything is buffered | 3.3 | Tests: `password`, `authorization`, nested `apiKey` all become `[REDACTED]`; nothing secret reaches the transport |
| 3.5 | **Object IDs.** `WeakMap` IDs for objects and arrays in captured values; emitted for `object_refs` | 3.3 | Same object passed to two functions gets the same `objectId`; no memory growth after 10,000 requests (heap test) |
| 3.6 | **Loader + transform (production).** `pirates` hook for user files (include/exclude globs, skip `node_modules`), SWC transform wrapping functions, methods, arrows, async functions; failed transform → load original file; never writes to disk | 3.1 | Behaviour corpus (1.3) fully green against the real agent; a deliberately broken file still loads |
| 3.7 | **Runtime helpers + source maps.** `__tracer.enter/exit/throw`, step IDs, parent tracking, async completion timing, `.ts` file/line/column via `@jridgewell/trace-mapping`, argument names when available | 3.6, 3.5 | NestJS fixture events show `.ts` lines matching the source; async durations include awaited time |
| 3.8 | **Request context + HTTP patch.** `AsyncLocalStorage` per request; `request.start` / `request.end` with redacted request and response, route pattern, status code, duration; unhandled rejections linked to the request | 3.2, 3.7 | 50 concurrent fixture requests produce 50 correct, separate traces in the collector |
| 3.9 | **Express patch.** Middleware chain, route handler and error middleware as framework steps | 3.8 | Express fixture map shows middleware in order and the error middleware when a route throws |
| 3.10 | **NestJS patch.** Middleware, guards (allowed / blocked), interceptors (before / after), pipes (input vs output), handler, exception filters (which error became which response), framework detection for `hello` | 3.8 | NestJS fixture map shows every framework step with the correct kind, matching the PRD example |
| 3.11 | **DB boundaries.** Mongoose, TypeORM and Prisma patches emitting `boundary` (`db`) with operation, target, query and result summary | 3.8 | Fixture DB calls appear as leaf steps with correct query text; no driver internals in the tree |
| 3.12 | **Outbound HTTP boundaries.** `axios`, `fetch` (via `diagnostics_channel` / undici) and Node `http.request` as `boundary` (`http`) | 3.8 | Express fixture's external call appears with URL, method, status and redacted payloads |
| 3.13 | **Error handling classification.** Detect swallowed errors (caught and not rethrown), propagated, converted to HTTP response, unhandled | 3.10 | Fixture cases for each type are labelled correctly in the collector |
| 3.14 | **Agent performance and safety pass.** Benchmarks traced vs untraced on both fixtures; memory test over 10,000 requests; zero overhead when `TRACER_DISABLED=1` | 3.1–3.13 | Benchmark results recorded in CI artifacts; slowdown under 5× on typical endpoints; no memory leak |

**Checkpoint 3: Agent review**

- [ ] Behaviour corpus 100% green on Node 20 and 24, three OSes.
- [ ] Both fixtures produce complete, correct maps (framework steps, DB, HTTP, errors) with zero code changes.
- [ ] Redaction verified; no secrets in the DB after running fixtures (automated grep test).
- [ ] Performance and memory targets met.
- [ ] Manual review: debug the `POST /orders` bug using only the REST API output.

---

## 7. Phase 4: Map UI

Build against the seed data and REST API first; connect live streaming once Phase 3 lands. Follow `design.md` and `ui-reference.png`.

| ID | Task | Depends on | Done when |
| --- | --- | --- | --- |
| 4.1 | **UI project setup.** Vite + React + TypeScript strict, Tailwind with design tokens (`design.md` §2–§4) as CSS variables for light and dark, Fontsource Inter + JetBrains Mono, shadcn/ui init, Lucide, routing; build output served by the collector | 2.7 | `tracer dev` serves the built UI; a token test page shows every color token in both themes |
| 4.2 | **Host adapter + connect flow.** `host` interface (`connectLive`, `fetchApi`, `openSource`); browser implementation; token from URL fragment → `sessionStorage`, fragment removed; S1 Connect screen; invalid / expired token states | 4.1, 2.10 | Opening the URL with a token connects; without a token shows S1; a wrong token shows the error message |
| 4.3 | **Data layer.** TanStack Query hooks for every MVP endpoint; typed API client with the error envelope; Zustand stores (live trees capped at 20, selection, expanded nodes, preferences in `localStorage`) | 4.2 | Hooks tested with mocked responses taken from `api-spec.md` examples |
| 4.4 | **Live client.** `/live` WebSocket with subprotocol token, subscribe/unsubscribe, reconnect with backoff, resubscribe and refetch on reconnect, ~100 ms render batching, de-duplication by step ID | 4.3, 2.11 | Test with a fake server: dropped connection reconnects; no duplicate steps after reconnect |
| 4.5 | **App shell and layout.** Header (logo, project name + sessions menu, connection pill, agent info, search trigger, trash, settings), three resizable/collapsible panels with remembered sizes, `[` / `]` shortcuts (`design.md` §6) | 4.1 | Layout matches the reference at 1440 px; panel sizes persist after reload |
| 4.6 | **Request list.** Virtualized rows (method chip, path, status, duration · steps, time), filter input + filter menu, Follow latest, Pin, restart dividers, in-progress and incomplete states, count footer, row `⋯` delete | 4.5, 4.4 | Seed data renders like the reference; new live requests appear at the top; Follow latest auto-opens them |
| 4.7 | **Request header + tabs.** Method, path, status badge, duration · steps · time, Copy link, Open in code, `⋯` (Copy as cURL, Delete); tabs (Trace active; Graph, Timeline, Logs disabled with "coming soon"); legend | 4.6 | Header matches the reference; cURL copies the `/curl` output |
| 4.8 | **Step tree.** Virtualized treegrid with Step / Status / Duration / ⋯ columns, indent guides, chevrons, kind/layer badges, inline return values with suspicious highlight, ✓ / ✕ / spinner / caught, error path auto-expanded, lazy children, truncation note, live streaming of running steps, keyboard navigation | 4.7 | Seed `POST /orders` renders like the reference; a 5,000-step request scrolls smoothly and opens in under 1 s; arrow keys work |
| 4.9 | **Inspector.** Details / Error / Raw JSON tabs; `ValueView` (expand, syntax colours, redacted / truncated / suspicious markers); argument blocks with names; result hidden when threw; error card with `.ts` stack and collapsed internals; source location with Open in code (editor URL, Copy path fallback); info list with copyable IDs; framework, boundary detail views | 4.8 | Selecting `calculateDiscount` shows exactly the reference inspector content (with the agreed spec changes) |
| 4.10 | **Delete, undo and trash.** Delete with Undo toast; Clear all with confirm; Trash screen (restore, preview, delete permanently, empty trash) with live updates | 4.6, 2.10 | Full J6 journey from `user-flows.md` works, including undo and a second tab staying in sync |
| 4.11 | **Settings screen.** Read-only effective config with sources; theme (system / light / dark), density, follow-latest default, show framework steps, editor link pattern; copy config as JSON | 4.5 | Theme switch updates instantly and persists; config view matches `GET /config` |
| 4.12 | **Onboarding and empty states.** S2 waiting screen (agent status, example curl, Load sample data via `/sample`, tips); all empty states from `user-flows.md` §6 | 4.6 | First run with no requests shows S2; sample data opens a labelled read-only map |
| 4.13 | **Loading and error states.** Skeletons, S8 disconnected / collector stopped overlay with read-only browsing, S9 version mismatch, S10 not found / in trash (with Restore), agent-disabled banner, incomplete and truncated banners, per-panel error boundaries | 4.4, 4.9 | Each state from `user-flows.md` §6 can be triggered in a test and shows the specified message and action |
| 4.14 | **Keyboard and accessibility.** All shortcuts from `design.md` §10, focus rings, ARIA treegrid/listbox, live-region announcements, labels on icon buttons, reduced motion; axe checks | 4.8, 4.9 | Playwright + axe report no serious violations; the whole J2 journey can be done keyboard-only |
| 4.15 | **Responsive layout.** Breakpoints from `design.md` §7: inspector drawer, list drawer, single-column phone flow with back navigation | 4.9 | Screenshots at 1440, 1100, 900 and 390 px match the spec; no horizontal page scroll |
| 4.16 | **Dark theme pass.** Every screen checked in dark mode against tokens; contrast checks automated for token pairs | 4.15 | Visual review done; automated contrast test passes for every text token pair |

**Checkpoint 4: UI review**

- [ ] Side-by-side comparison with `ui-reference.png` (light) at 1440 px; differences limited to the agreed list in `design.md` §9.
- [ ] Every screen and state in `user-flows.md` reachable and correct.
- [ ] Accessibility (axe, keyboard-only J2) and responsive screenshots pass.
- [ ] Manual review: debug the seed bug using only the UI.

---

## 8. Phase 5: Integration and MVP release

| ID | Task | Depends on | Done when |
| --- | --- | --- | --- |
| 5.1 | **End-to-end tests.** Playwright drives `tracer dev` on both fixtures: hit endpoints, watch the live map, open the inspector, delete and restore, collector restart, app restart (watch mode) | Checkpoints 3 and 4 | E2E suite green in CI on three OSes |
| 5.2 | **Edge-case pass.** Walk `user-flows.md` §7 (invalid input, no permission, network fail); add a test or fix for each | 5.1 | Every edge case has a test or an explicit "won't fix in MVP" note |
| 5.3 | **`tracer doctor` and pre-checks.** Node version, CommonJS vs ESM, `sourceMap`, framework detection, port, `.tracer/` writable; clear fixes; exit codes | 2.2, 3.10 | Doctor output matches `user-flows.md` J8 on an ESM project and a project without source maps |
| 5.4 | **Performance acceptance.** Re-run benchmarks: time to first map, map latency (under ~300 ms after response), 5,000-step render, slowdown | 5.1 | Numbers recorded against PRD targets; all met or tracked as issues |
| 5.5 | **Security review.** Token, origin, host, DNS rebinding, redaction, file permissions, log hygiene, CSP on the UI, dependency audit | 5.1 | Checklist in `docs/security-review.md` complete; no open high-severity items |
| 5.6 | **Packaging.** Publish `tracer` (CLI + collector + built UI) and `@tracer/register` (agent) to npm; `npx tracer dev` works without install; agent package has minimal dependencies | 5.4 | Fresh machine: `npx tracer dev -- npm run start:dev` on a new NestJS app shows a map in under 2 minutes |
| 5.7 | **User docs.** README quick start, GIF of the live map, configuration reference, troubleshooting (from doctor messages), known limitations (ESM, bundlers, Docker) | 5.6 | A developer who has never seen Tracer follows the README to a first map without help |
| 5.8 | **Release `0.1.0`.** Changesets version, changelog, GitHub release, tag | 5.7 | Release published; install from npm verified on three OSes |

**Checkpoint 5: MVP release review**

- [ ] All PRD MVP functional requirements (FR-1 to FR-15, FR-32 to FR-38) demonstrably work.
- [ ] Non-functional targets from the PRD met (correctness, performance, privacy, reliability).
- [ ] 3–5 developers try it on their own NestJS/Express projects; feedback logged.
- [ ] Release gate from the PRD: first map in under 2 minutes.

---

## ═══════════════ MVP LINE ═══════════════

Everything above this line is the MVP (`0.1.0`). Everything below is planned, but starts only after the MVP is released and the PRD gate (first map in under 2 minutes) is met. Phase 6 starts when MVP feedback confirms the core loop; the PRD's v1 → v2 gate is 25% week-4 retention.

---

## 9. Phase 6: v1, daily debugging tool

| ID | Task | Depends on | Done when |
| --- | --- | --- | --- |
| 6.1 | **Condition probes.** Transform adds probes for `if`, `else if`, `switch`, ternary, `&&` / `\|\|`, `?.`; records branch and condition values; short-circuit preserved, each expression evaluated once | MVP | Corpus extended with condition cases, all green; fixture `if (user.tier === 'gold')` recorded as `false` with `user.tier = undefined` |
| 6.2 | **Decision rows in UI.** `IF` / `SWITCH` badges, expression and values in the tree and inspector, toggle to show/hide decisions | 6.1 | Reference example shows the decision row exactly as in `design.md` |
| 6.3 | **Loop summaries.** Probes for `for`, `while`, `for…of`, array methods; count, time, first / last / failing / unusual samples; never per-iteration storage | 6.1 | 10,000-iteration loop stores one summary; a failing iteration is identified |
| 6.4 | **Callback collapsing and constructors.** Repeated callbacks collapsed with count; constructors as steps | 6.3 | `items.map(fn)` over 500 items shows one row "×500" |
| 6.5 | **Argument mutation detection.** Before/after snapshots for arguments changed inside a function | MVP | Fixture that mutates a DTO shows "changed" with both values |
| 6.6 | **Test runs as entry points.** Trace one Jest/Vitest test as a "request" | MVP | `tracer test -- vitest run orders.spec.ts` produces a map per test |
| 6.7 | **Redis, queue publish and log boundaries.** Patches for `ioredis`/`redis`, Kafka/queue publish, `console.*` capture as `log` boundary | MVP | Fixture Redis and Kafka calls and logs appear at the right steps |
| 6.8 | **Logs tab.** `GET /requests/:id/logs` + UI tab with levels and jump to step | 6.7 | Logs tab shows fixture logs with links to their steps |
| 6.9 | **Search.** `GET /search` + `Ctrl K` palette results across names, files and values | MVP | Searching `tier` finds the suspicious value in the seed request |
| 6.10 | **Compare two requests.** `GET /compare` + S12 screen with aligned trees and differences | MVP | Broken vs fixed `POST /orders` shows the `tier` difference and the missing error |
| 6.11 | **Flow graph view.** React Flow + elkjs; linked selection with the tree | MVP | Graph of the seed request matches the tree; clicking a box selects the step |
| 6.12 | **Timeline view.** Canvas waterfall with zoom and pan; parallel work side by side | MVP | `Promise.all` fixture shows parallel bars |
| 6.13 | **Custom config rules and client logs.** Include/exclude and redaction rules in config UI notes; `POST /client-logs` | MVP | Custom redaction key works end to end; UI panel crash appears in the collector log |
| 6.14 | **v1 hardening and release `0.2.0`.** Corpus, E2E, performance re-run, docs | 6.1–6.13 | Same gates as Checkpoint 5 for the v1 features |

**Checkpoint 6: v1 review**

- [ ] Condition and loop probes pass the extended behaviour corpus with no regressions.
- [ ] Performance still within targets with decisions and loops on.
- [ ] Week-4 retention measured; go / no-go for Phase 7.

---

## 10. Phase 7: VS Code extension and v2

| ID | Task | Depends on | Done when |
| --- | --- | --- | --- |
| 7.1 | **Extension skeleton.** VS Code extension package, esbuild, activation, "Start with Tracer" command that spawns the collector as a child Node process | v1 | Command starts the collector and the user's app from VS Code |
| 7.2 | **Webview host adapter.** Same UI build in a webview; `postMessage` host implementation; token passed directly; CSP for webviews | 7.1 | Full map works inside VS Code with no UI code changes outside `host/` |
| 7.3 | **Theme mapping.** Tokens mapped to VS Code theme variables; status colours kept | 7.2 | UI follows light, dark and high-contrast VS Code themes |
| 7.4 | **Editor integration.** Open in code via editor API, inline value decorations, CodeLens ("called 3× · 2 errors") | 7.2 | After a request, values appear next to the code lines that ran |
| 7.5 | **Publish extension.** VS Code Marketplace + Open VSX | 7.4 | Installs and works in VS Code and Cursor |
| 7.6 | **ESM and bundlers.** `module.register()` loader hooks; Vite/esbuild-bundled apps | v1 | ESM fixture traced with the same corpus results |
| 7.7 | **Data journey.** `GET /requests/:id/objects/:objectId` + UI "Follow this object" | v1 | Following the seed `User` object shows `findById` → `calculateDiscount` |
| 7.8 | **Queue consumers and cron entry points.** Kafka/queue consumer messages and scheduled jobs start maps | 6.7 | Kafka fixture consumer produces its own map, linked to the publishing request |
| 7.9 | **More frameworks.** Fastify and Next.js API routes | 7.6 | Fixture apps for both produce correct maps |
| 7.10 | **Export and share.** Export a map as JSON and a shareable report (redacted) | v1 | Exported file re-opens in Tracer and shows the same map |

**Checkpoint 7: Phase 2 product review**

- [ ] Extension works on Windows, macOS, Linux in VS Code and Cursor.
- [ ] ESM and new frameworks pass the behaviour corpus.
- [ ] No regressions in the web version.

---

## 11. Phase 8: Future

| ID | Task | Depends on | Done when |
| --- | --- | --- | --- |
| 8.1 | **MCP server.** Expose requests, steps and error paths to AI assistants (Claude Code, Cursor) via `@modelcontextprotocol/sdk`, read-only, local token | v1 | An assistant can answer "why did POST /orders fail?" using Tracer data |
| 8.2 | **AI explanation layer.** "Explain" a map or step with the user's own API key; compressed and redacted traces only | 8.1 | Explanations rated helpful in ≥70% of in-panel feedback |

---

## 12. Summary

| Phase | Tasks | Ends with |
| --- | --- | --- |
| 0 Setup and validation | 7 | Repo, CI, fixtures, AppMap decision |
| 1 Capture spike | 4 | Go / no-go on capture approach |
| 2 Protocol and collector | 13 | Working local server, DB, auth, API |
| 3 Runtime agent | 14 | Correct maps from real apps, safely |
| 4 Map UI | 16 | UI matching the reference design |
| 5 Integration and release | 8 | **MVP `0.1.0` released** |
| 6 v1 | 14 | `0.2.0`: conditions, loops, search, compare, views |
| 7 Extension and v2 | 10 | VS Code extension, ESM, data journey |
| 8 Future | 2 | MCP, AI |

**MVP total: 62 tasks across Phases 0–5.**
