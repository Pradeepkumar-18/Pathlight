# Pathlight Tracker: Architecture

Pathlight Tracker is a local developer debug visualizer: it draws a live map of each request as it hits your local Node/TypeScript server, showing every function it passed through and the real data at each step.

This document describes how the system is built. The technology choices behind it are in `tracer-tech-stack.md`; the product scope is in the PRD.

---

## 0. Checklist at a glance

| Checkpoint | Where | Summary |
| --- | --- | --- |
| System overview | §1 | Three local processes: runtime agent, collector, map UI |
| Folder structure | §2 | pnpm monorepo: `agent`, `protocol`, `collector`, `ui`, `extension` |
| Request / data flow | §3 | Start → load and wrap → request → events → collector → live map |
| Auth and authorization | §4 | No users or roles; local-only token, origin check, `127.0.0.1` binding |
| Main modules | §5 | Responsibilities per package and module |
| API approach + naming | §6 | REST + WebSocket on Fastify; versioned `/api/v1`, typed events |
| Client vs server state, caching | §7 | Collector is the source of truth; UI holds live and cached views |
| Env variables | §8 | `PATHLIGHT_TRACKER_*` variables, no secrets |
| Security rules | §9 | Zod validation, redaction, localhost binding, limits; RLS not applicable |
| Error handling and logging | §10 | Agent fails open; collector logs with pino; UI error boundaries |
| Key decisions | §11 | Decision records with reasons |

---

## 1. System overview

Pathlight Tracker runs as **three processes on the developer's machine**. Nothing runs in the cloud.

```
                      npx pathlight-tracker dev -- npm run start:dev
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼ spawns with NODE_OPTIONS               ▼ starts
┌──────────────────────────────┐            ┌──────────────────────────────┐            ┌──────────────────────────────┐
│ 1. YOUR APP PROCESS          │            │ 2. COLLECTOR (Node CLI)      │            │ 3. MAP UI (browser tab)      │
│    runtime agent preloaded   │            │                              │            │                              │
│                              │  WebSocket │  ingest ─▶ trace builder     │  WebSocket │  request list                │
│  loader hook (wrap fns)      │ ─────────▶ │       ─▶ store (SQLite)      │ ─────────▶ │  live map (call tree)        │
│  library patches             │  /agent    │       ─▶ live hub            │  /live     │  inspector                   │
│  request context (ALS)       │  events    │  REST API /api/v1            │  + REST    │  jump links ─▶ VS Code       │
│  serializer + event buffer   │            │  static UI server            │            │                              │
└──────────────────────────────┘            └──────────────────────────────┘            └──────────────────────────────┘
       records                                      thinks                                       shows
```

| Process | Job | Rule |
| --- | --- | --- |
| **Your app + agent** | Record what happens: wrap functions, capture values, ship events | Do the minimum work; never change behaviour; never crash the app |
| **Collector** | Build request trees from events, store them, serve the UI and API | The source of truth; all heavy logic lives here |
| **Map UI** | Show the live map, values and errors; link to source | Knows nothing about instrumentation; host-agnostic |

**Phase 2 (VS Code extension):** the extension spawns the same collector as a child process and loads the same UI build in a webview. Only the host adapter changes (`vscode://` links become editor API calls; inline values and CodeLens are added).

---

## 2. Folder structure

```
pathlight-tracker/
├── packages/
│   ├── protocol/                  # Shared contract between all packages
│   │   └── src/
│   │       ├── events.ts          # Agent → collector event types
│   │       ├── live.ts            # Collector → UI live message types
│   │       ├── api.ts             # REST request/response types
│   │       ├── schemas.ts         # Zod schemas for all of the above
│   │       └── version.ts         # Protocol version constant
│   │
│   ├── agent/                     # Runtime agent, preloaded into the user's app
│   │   └── src/
│   │       ├── register.ts        # Entry point for --require @pathlight-tracker/agent
│   │       ├── config.ts          # Reads PATHLIGHT_TRACKER_* env vars and pathlight-tracker.config.json
│   │       ├── loader/            # Module hooks (CommonJS via pirates; ESM in v2)
│   │       ├── transform/         # SWC transform: wraps functions, adds probes
│   │       ├── runtime/           # __pathlightTracker.enter/exit/throw called by wrapped code
│   │       ├── context/           # AsyncLocalStorage request context, trace IDs
│   │       ├── patches/           # Library hooks
│   │       │   ├── http.ts        # Incoming requests, response capture
│   │       │   ├── nestjs.ts      # Guards, pipes, interceptors, filters
│   │       │   ├── express.ts     # Middleware chain, error middleware
│   │       │   ├── db/            # Mongoose, TypeORM, Prisma boundary nodes
│   │       │   └── outbound.ts    # axios, fetch boundary nodes
│   │       ├── capture/           # Safe serializer, redaction, object IDs
│   │       ├── transport/         # Event buffer, batching, WebSocket client
│   │       └── safety/            # Fail-open guards, kill switch, self-diagnostics
│   │
│   ├── collector/                 # Local CLI: npx pathlight-tracker dev
│   │   └── src/
│   │       ├── cli/               # commander commands: dev, clear, doctor
│   │       ├── launcher/          # Spawns the user's command with NODE_OPTIONS
│   │       ├── server/            # Fastify app, plugins, security hooks
│   │       ├── ingest/            # /agent WebSocket: validate, accept event batches
│   │       ├── builder/           # Turns events into request trees (step tree)
│   │       ├── store/             # Drizzle schema, queries, retention pruning
│   │       ├── live/              # /live WebSocket hub: pushes steps to UIs
│   │       ├── api/               # REST routes under /api/v1
│   │       └── logging/           # pino setup, log files
│   │
│   ├── ui/                        # React map UI (browser now, webview later)
│   │   └── src/
│   │       ├── app/               # App shell, routing, providers, error boundaries
│   │       ├── theme/             # Design tokens (CSS variables, light/dark), fonts
│   │       ├── host/              # Host adapter: browser (WebSocket, vscode:// links) / webview
│   │       ├── live/              # Live feed client, reconnect logic, batching
│   │       ├── stores/            # Zustand stores (live maps, selection, UI prefs)
│   │       ├── queries/           # TanStack Query hooks for /api/v1
│   │       ├── features/
│   │       │   ├── request-list/  # Recent requests panel
│   │       │   ├── call-tree/     # Live map (primary view)
│   │       │   ├── inspector/     # Args, return values, errors
│   │       │   ├── flow-graph/    # v1
│   │       │   └── timeline/      # v1
│   │       └── components/ui/     # shadcn/ui components
│   │
│   └── extension/                 # VS Code extension (Phase 2)
│       └── src/
│           ├── activate.ts        # Commands, lifecycle
│           ├── collector.ts       # Spawns and supervises the collector process
│           ├── webview.ts         # Hosts the UI build
│           ├── decorations.ts     # Inline values in the editor
│           └── codelens.ts        # "called 3× in last request"
│
├── fixtures/                      # Real apps used for tests and demos
│   ├── express-app/
│   └── nestjs-app/                # With Mongoose and TypeORM
├── tests/
│   ├── behaviour-corpus/          # Tricky code run with and without the agent
│   └── bench/                     # autocannon benchmarks, traced vs untraced
└── docs/
    ├── prd.md
    ├── tech-stack.md
    ├── architecture.md
    ├── data-model.md
    ├── user-flows.md
    ├── design.md
    ├── api-spec.md
    ├── implementation-plan.md
    ├── progress.md
    ├── ui-reference.png
    └── decisions/                 # One file per decision record (see §11)
```

**Dependency rule:** `protocol` depends on nothing. `agent`, `collector` and `ui` depend only on `protocol`, never on each other. `extension` depends on `protocol` and starts `collector` as a process (not as a library).

---

## 3. Request and data flow

### 3a. Startup

1. The developer runs `npx pathlight-tracker dev -- npm run start:dev`.
2. The collector creates `.pathlight-tracker/` in the project root, opens the SQLite file, takes the fixed default port (or the next free one if it is busy), loads the project's token (creating it on first run), and starts Fastify on `127.0.0.1`.
3. The collector spawns the user's command with:
   - `NODE_OPTIONS="--require @pathlight-tracker/agent"` (appended to any existing value)
   - `PATHLIGHT_TRACKER_COLLECTOR_URL` and `PATHLIGHT_TRACKER_TOKEN`
4. The collector opens the browser at `http://127.0.0.1:<port>/#token=<token>`.
5. Because `NODE_OPTIONS` is inherited, the agent loads in every Node process the command starts, including restarts from `nest start --watch` or nodemon.

### 3b. App load (the agent wraps your code)

1. `register.ts` loads first, reads config, and installs the module hook and library patches.
2. Every time a user file (not `node_modules`) is required, the loader hook passes its source through the SWC transform.
3. The transform wraps each function body so it calls `__pathlightTracker.enter(...)`, `__pathlightTracker.exit(...)` and `__pathlightTracker.throw(...)`. It also adds `if` / `else if` / `switch` condition probes (MVP); v1 adds expression conditions (ternary, `&&` / `||`, `?.`) and loop probes.
4. The transformed code is compiled in memory. Nothing is written to disk.
5. The agent connects to the collector over `/agent` WebSocket and sends a `hello` event (process id, Node version, protocol version).

### 3c. One request, end to end

```
Client        App + agent                 Collector                    UI
  │  POST /orders  │                          │                          │
  │──────────────▶│ http patch:              │                          │
  │               │ new traceId in ALS       │                          │
  │               │ request.start ──────────▶│ create request row       │
  │               │                          │ live.request.started ───▶│ row appears in list
  │               │ guard / pipe / handler   │                          │
  │               │ enter / exit events      │                          │
  │               │ (batched every ~50 ms) ─▶│ validate (Zod)           │
  │               │                          │ link to parent step      │
  │               │                          │ store steps              │
  │               │                          │ live.steps.appended ────▶│ map grows live
  │               │ db boundary: query ─────▶│                          │
  │               │ throw in calculateDiscount▶                         │
  │               │                          │ mark error path ────────▶│ path turns red
  │  500 ◀────────│ request.end ────────────▶│ finalize request         │
  │               │                          │ live.request.completed ─▶│ final status, duration
  │               │                          │                          │ click step ▶ vscode:// opens line
```

1. **Request arrives.** The HTTP patch creates a `traceId`, stores it in `AsyncLocalStorage`, captures method, path, params, query, body and headers (redacted), and emits `request.start`.
2. **Framework steps run.** NestJS patches emit steps for middleware, guards, pipes, interceptors and the handler; Express patches emit middleware steps.
3. **User code runs.** Each wrapped function emits `enter` (args, file, line, object IDs) and `exit` (return value, duration) or `throw` (error). The `traceId` from `AsyncLocalStorage` ties every event to the right request, across `await` and under concurrency.
4. **Boundaries.** DB and outbound HTTP patches emit `boundary` events with what was sent and returned, as leaf steps.
5. **Buffering.** Events are serialized and redacted immediately, held in a buffer, and flushed as a batch every ~50 ms (or sooner when the buffer is full).
6. **Collector ingest.** Each batch is validated, then the builder links each `enter` to its parent step, pairs it with its `exit`/`throw`, and writes the steps to SQLite.
7. **Live push.** The live hub sends `live.steps.appended` to every connected UI subscribed to that request.
8. **Request ends.** The HTTP patch emits `request.end` with status code, response body (truncated, redacted) and total duration. The builder marks the error path, and the hub sends `live.request.completed`.
9. **UI.** The live map appends steps as they arrive (rendered in ~100 ms batches). Clicking a step shows its values in the inspector; the jump link opens `vscode://file/<path>:<line>`.

### 3d. Event model (agent → collector)

All events carry `v` (protocol version), `pid` (process id), `traceId` and `ts` (high-resolution timestamp).

| Event | Key fields |
| --- | --- |
| `hello` | `nodeVersion`, `framework`, `agentVersion` |
| `request.start` | `method`, `path`, `route`, `params`, `query`, `body`, `headers` |
| `step.enter` | `stepId`, `parentStepId`, `kind` (`function`, `guard`, `pipe`, `interceptor`, `middleware`, `handler`, `filter`), `name`, `file`, `line`, `args`, `thisClass` |
| `step.exit` | `stepId`, `returnValue`, `durationNs` |
| `step.throw` | `stepId`, `error` (type, message, stack, file, line), `caught` (true if swallowed later) |
| `boundary` | `stepId`, `parentStepId`, `kind` (MVP: `db`, `http`; v1: `redis`, `queue`, `log` for `console.log` output shown in the Logs tab), `request`, `response`, `durationNs`, `error` |
| `decision` (MVP: `if`, `switch`; v1: `ternary`, `logical`, `optional`) | `stepId`, `kind`, `expression`, `values`, `result` |
| `loop` (v1) | `stepId`, `kind`, `iterations`, `durationNs`, `samples` (first, last, failing) |
| `request.end` | `status`, `responseBody`, `durationNs`, `unhandledError` |

Captured values use one shape: `{ type, preview, objectId?, truncated?, redacted?, children? }`.

### 3e. Data model (SQLite via Drizzle)

Summary only; the full schema, keys, indexes, enums and seed data are in `tracer-data-model.md`.

| Table | Purpose |
| --- | --- |
| `sessions` | One row per app process (each start or watch-mode restart) |
| `requests` | One row per traced request; soft-deletable (`deleted_at`) |
| `steps` | One row per step (function, framework step, boundary, decision, loop), a tree via `parent_id` |
| `object_refs` | Where each captured object appeared (for the v2 data journey) |
| `meta` | Schema version and settings |

---

## 4. Auth and authorization

Pathlight Tracker has **no users, no login and no roles**. It is a single-developer, local-only tool, so there is nothing to authorize between people. What it must prevent is **other programs or websites on the same machine** reading trace data.

| Control | How |
| --- | --- |
| Network binding | Collector listens on `127.0.0.1` only, never `0.0.0.0` |
| Fixed default port | Same port every run so saved links keep working; next free port if busy (override with `PATHLIGHT_TRACKER_PORT`) |
| Project token | Generated once per project with `crypto.randomBytes(32)` and kept in `.pathlight-tracker/`, so links survive restarts; required on every connection; deleting the file rotates it (details in task 2.7) |
| Agent connection | Agent sends the token from `PATHLIGHT_TRACKER_TOKEN` in the `/agent` WebSocket handshake; wrong or missing token → rejected |
| UI connection | Token arrives in the URL fragment (`#token=…`, never sent to servers or logs), is moved to `sessionStorage`, then sent as `Authorization: Bearer <token>` on REST and as the WebSocket subprotocol `bearer.<token>` on `/live` (browsers can't set WebSocket headers; the agent uses the same subprotocol on `/agent`) |
| Origin check | `/live` and `/api` accept only `Origin: http://127.0.0.1:<port>` (and the VS Code webview origin in Phase 2); blocks malicious websites and DNS rebinding |
| Host header check | Requests must have `Host: 127.0.0.1:<port>` or `localhost:<port>` |

**Protected routes:** every route except the static UI files requires the token.

| Route | Protected | Notes |
| --- | --- | --- |
| `GET /` and static assets | No | UI shell only; contains no data |
| `GET /api/v1/*` | Yes | Bearer token + origin check |
| `DELETE /api/v1/*` | Yes | Bearer token + origin check |
| `WS /agent` | Yes | Token in handshake |
| `WS /live` | Yes | Token in handshake + origin check |

**Roles:** none. If team sharing is ever added, roles and real auth become a new design, not an extension of this one.

---

## 5. Main modules and responsibilities

### Agent (`packages/agent`)

| Module | Responsibility | Must never |
| --- | --- | --- |
| `register` | Entry point; installs hooks and patches; checks kill switch | Throw during app startup |
| `config` | Reads env vars and optional `pathlight-tracker.config.json` | Block on I/O |
| `loader` | Intercepts user-file loading; skips `node_modules` and excluded paths | Write files to disk |
| `transform` | SWC transform that wraps functions (and v1 decisions/loops) | Change semantics (`this`, `arguments`, async ordering, errors) |
| `runtime` | `enter` / `exit` / `throw` helpers called by wrapped code | Throw into user code |
| `context` | Creates and propagates `traceId` with `AsyncLocalStorage` | Leak context between requests |
| `patches` | Hooks HTTP, NestJS, Express, DB drivers, outbound HTTP | Alter return values or timing beyond capture |
| `capture` | Safe serialization, redaction, truncation, object IDs | Call getters, `toJSON`, or follow infinite cycles |
| `transport` | Buffers, batches and sends events; handles collector downtime | Block the event loop |
| `safety` | Fail-open guards, error counters, auto-disable after repeated internal errors | Let an internal error reach the user's app |

### Protocol (`packages/protocol`)

Owns every message type and Zod schema shared by agent, collector and UI, plus the protocol version. Any change to a message starts here.

### Collector (`packages/collector`)

| Module | Responsibility |
| --- | --- |
| `cli` | Commands: `pathlight-tracker dev -- <cmd>`, `pathlight-tracker clear`, `pathlight-tracker doctor` (checks Node version, source maps, module type) |
| `launcher` | Spawns the user's command with `NODE_OPTIONS`, forwards output, propagates exit codes and signals |
| `server` | Fastify instance, security hooks (token, origin, host), static UI, rate limits |
| `ingest` | Accepts agent batches, validates with Zod, applies backpressure |
| `builder` | Links steps into trees, pairs enter/exit, marks error paths, detects swallowed errors |
| `store` | Drizzle schema and queries, batched writes in transactions, retention pruning |
| `live` | Tracks UI subscriptions, pushes started / appended / completed messages |
| `api` | REST routes for history, single request, steps, search, clear |
| `logging` | pino logger to console (pretty) and `.pathlight-tracker/logs/collector.log` |

### UI (`packages/ui`)

| Module | Responsibility |
| --- | --- |
| `host` | Adapter interface: `connectLive()`, `fetchApi()`, `openSource(file, line)`; browser and webview implementations |
| `live` | WebSocket client, reconnect with backoff, resubscribe, 100 ms render batching |
| `stores` | Zustand: live request trees, selection, expanded nodes, UI preferences |
| `queries` | TanStack Query hooks for `/api/v1` |
| `features/request-list` | Recent requests, status, duration, filters |
| `features/call-tree` | Primary live map: virtualized tree, duration bars, error path |
| `features/inspector` | Details / Error / Raw JSON tabs: args, return values, errors, source location, IDs; redacted, truncated and suspicious-value markers; jump link |
| `features/trash` | Trash list, restore, delete permanently, empty trash |
| `features/logs` (v1) | Logs tab: captured `console.log` output for the request |
| `features/flow-graph`, `features/timeline` | v1 secondary views, linked by selection |

### Extension (`packages/extension`, Phase 2)

Spawns and supervises the collector, hosts the UI in a webview, adds inline value decorations, CodeLens and a one-click "Start with Pathlight Tracker" command.

---

## 6. API approach and naming conventions

**Approach:** **REST + WebSocket** on Fastify.

- REST for history, lookups and actions (request list, a single request, search, clear).
- WebSocket for anything live (agent events in, live map updates out).
- Not tRPC or server actions: the agent is not a browser or React client, and a plain, versioned REST + WebSocket contract keeps the agent, UI and future extension or MCP server equally simple.

### REST endpoints (`/api/v1`)

Main endpoints below. The complete list (including config, sessions, cURL, sample data, logs, compare and client logs), with params, response shapes, errors and limits, is in `tracer-api-spec.md`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Collector status, version, connected agents |
| `GET` | `/api/v1/requests` | Recent requests (filters: `status`, `method`, `path`, `hasError`; cursor pagination) |
| `GET` | `/api/v1/requests/:requestId` | One request with summary and response |
| `GET` | `/api/v1/requests/:requestId/steps` | Steps of a request (supports `parentId` for lazy loading) |
| `GET` | `/api/v1/steps/:stepId` | One step with full captured values |
| `GET` | `/api/v1/search` | Search steps by function name, file or value (v1) |
| `DELETE` | `/api/v1/requests/:requestId` | Move one finished request to the trash (soft delete) |
| `DELETE` | `/api/v1/requests/:requestId?permanent=true` | Delete one request permanently (hard delete) |
| `DELETE` | `/api/v1/requests` | Move all finished requests to the trash ("Clear all") |
| `POST` | `/api/v1/requests/:requestId/restore` | Restore a request from the trash |
| `GET` | `/api/v1/trash` | List trashed requests with time left before purge |
| `DELETE` | `/api/v1/trash` | Empty the trash (hard delete) |

Requests in the trash are excluded from every other endpoint; their steps are returned only with `includeDeleted=true` (trash preview). Rules for soft delete, retention and purge are in `tracer-data-model.md` §7.

### WebSocket channels

| Channel | Direction | Messages |
| --- | --- | --- |
| `/agent` | Agent → collector | `hello`, batches of events (§3d); collector replies `ack` and `slow_down` |
| `/live` | Collector → UI | `live.request.started`, `live.steps.appended`, `live.request.completed`, `live.request.deleted`, `live.request.restored`, `live.request.purged`, `live.agent.connected`, `live.agent.disconnected`; UI sends `subscribe` / `unsubscribe` |

### Naming conventions

| Thing | Convention | Example |
| --- | --- | --- |
| REST paths | Plural nouns, kebab-case, versioned | `/api/v1/requests/:requestId/steps` |
| Path and query params | camelCase | `requestId`, `hasError` |
| JSON fields | camelCase | `durationNs`, `parentStepId` |
| Event and message types | `domain.action`, lowercase, past tense for facts | `request.start`, `step.exit`, `live.steps.appended` |
| IDs | Prefixed, sortable (ULID) | `ses_01J…`, `req_01J…`, `stp_01J…` |
| Time | Nanoseconds as strings for precision; ISO 8601 for wall-clock times | `"durationNs": "1834000"`, `"startedAt": "2026-10-30T11:42:05.120Z"` |
| Errors | One envelope everywhere | `{ "error": { "code": "REQUEST_NOT_FOUND", "message": "…" } }` |
| Error codes | UPPER_SNAKE_CASE | `INVALID_TOKEN`, `PROTOCOL_MISMATCH` |
| Database | snake_case tables and columns | `requests.started_at` |
| Files and folders | kebab-case | `call-tree/`, `event-buffer.ts` |
| Env variables | `PATHLIGHT_TRACKER_` prefix, UPPER_SNAKE_CASE | `PATHLIGHT_TRACKER_PORT` |

**Versioning:** REST under `/api/v1`; every event carries `v`. The collector rejects agents with an incompatible protocol major version and tells the user to update.

---

## 7. Client vs server state and caching

The **collector is the source of truth**. The UI never invents data; it holds a live view and a cache.

| State | Lives in | Rules |
| --- | --- | --- |
| Requests and steps (persistent) | Collector, SQLite | Written in batched transactions; last 100 requests kept (configurable) |
| In-progress requests | Collector memory (builder) + SQLite | Steps written as they arrive; request finalized on `request.end` or timeout |
| Live maps being watched | UI, Zustand | Built from `/live` messages; capped to the 20 most recent requests in memory |
| History and details | UI, TanStack Query cache | Fetched over REST on demand |
| Selection, expanded nodes, active view | UI, Zustand | Pure UI state, never sent to the collector |
| UI preferences (theme, panel sizes and collapsed state, row density, follow latest) | UI, `localStorage` | Per browser; safe to lose |
| Token | UI, `sessionStorage` | Cleared when the tab closes |

**Caching rules:**

- A **completed request is immutable**, so its query uses `staleTime: Infinity` and never refetches.
- An **in-progress request** is never fetched by polling; the UI gets it from `/live`, then switches to the REST cache once `live.request.completed` arrives.
- The **request list** is updated by live messages (prepend new rows) and refetched only on reconnect.
- **On reconnect** after a dropped `/live` connection, the UI invalidates the request list and any in-progress requests, then resubscribes.
- **Large values** are loaded lazily: the tree shows previews; full values come from `GET /api/v1/steps/:stepId` when the user opens the inspector.
- **Agent side:** no cache beyond the event buffer; if the collector is unreachable, the buffer keeps at most a fixed number of events and drops the oldest.

---

## 8. Environment variables

No variable holds a real secret. The token is generated per run and passed automatically.

### Read by the agent (set automatically by the CLI)

| Variable | Purpose | Default |
| --- | --- | --- |
| `NODE_OPTIONS` | Preloads the agent (`--require @pathlight-tracker/agent`) | Set by CLI |
| `PATHLIGHT_TRACKER_COLLECTOR_URL` | Collector WebSocket URL | Set by CLI |
| `PATHLIGHT_TRACKER_TOKEN` | One-time connection token | Set by CLI per run |
| `PATHLIGHT_TRACKER_DISABLED` | Kill switch: `1` loads the agent but does nothing | `0` |
| `PATHLIGHT_TRACKER_INCLUDE` | Glob(s) of files to instrument | `src/**` |
| `PATHLIGHT_TRACKER_EXCLUDE` | Glob(s) to skip (in addition to `node_modules`) | `**/*.spec.ts,**/*.test.ts` |
| `PATHLIGHT_TRACKER_REDACT_KEYS` | Extra keys to redact (comma-separated) | Built-in list (password, token, authorization, secret, cookie, apiKey…) |
| `PATHLIGHT_TRACKER_MAX_DEPTH` | Max depth of captured objects | `3` |
| `PATHLIGHT_TRACKER_MAX_ARRAY` | Max array items captured | `10` |
| `PATHLIGHT_TRACKER_MAX_STRING` | Max string length captured | `200` |
| `PATHLIGHT_TRACKER_MAX_STEPS` | Max steps per request before truncating | `5000` |
| `PATHLIGHT_TRACKER_LOG_LEVEL` | Agent self-diagnostics level | `warn` |

### Read by the collector

| Variable | Purpose | Default |
| --- | --- | --- |
| `PATHLIGHT_TRACKER_PORT` | Port to use instead of the default | Fixed default port, next free if busy |
| `PATHLIGHT_TRACKER_DB_PATH` | SQLite file location | `.pathlight-tracker/traces.db` |
| `PATHLIGHT_TRACKER_RETENTION` | Number of active requests kept (older ones move to the trash) | `100` |
| `PATHLIGHT_TRACKER_TRASH_TTL_HOURS` | Hours a trashed request is kept before permanent deletion | `72` |
| `PATHLIGHT_TRACKER_EDITOR` | Editor link pattern for "Open in code" (`{path}`, `{line}`, `{column}` placeholders) | `vscode://file/{path}:{line}:{column}` |
| `PATHLIGHT_TRACKER_OPEN_BROWSER` | Open the UI automatically | `1` |
| `PATHLIGHT_TRACKER_LOG_LEVEL` | Collector log level | `info` |

All settings can also live in an optional `pathlight-tracker.config.json` in the project root. Precedence: CLI flags > env vars > config file > defaults. `.pathlight-tracker/` is added to `.gitignore` on first run (with a printed notice).

---

## 9. Security rules

| Area | Rule |
| --- | --- |
| **Input validation** | Every agent event batch, live message and REST request is validated with Zod schemas from `protocol`. Invalid input is rejected and logged, never partially processed. |
| **Size limits** | Max WebSocket message size (e.g. 1 MB per batch), max captured value sizes (§8), max steps per request. Oversized payloads are truncated by the agent and rejected by the collector. |
| **Redaction** | Applied in the agent before data leaves the app, so secrets are never sent, stored or shown. Covers keys (password, token, authorization, secret, cookie, apiKey and user-added keys) and header values. Redacted values show as `[REDACTED]`. |
| **Network exposure** | Bind `127.0.0.1` only; token on every data route; origin and host header checks (§4). |
| **Rate limiting / backpressure** | Agent connections: if ingest falls behind, the collector sends `slow_down`, and the agent samples or drops lower-priority events (repeated loop iterations first). REST: `@fastify/rate-limit` caps requests per second as a guard against misbehaving local scripts. |
| **Row-level security (RLS)** | **Not applicable.** One user, one local database, no tenants. File permissions on `.pathlight-tracker/` are set to the current user only. |
| **Code safety in the agent** | No `eval` / `new Function`; no disk writes of transformed code; never call getters or `toJSON` on user objects; never monkey-patch globals. |
| **UI safety** | Captured values are rendered as text, never as HTML, so a captured string cannot inject script. Strict Content Security Policy on the served UI (no inline scripts, no external origins). |
| **Dependencies** | Minimal runtime dependencies in the agent; lockfile with frozen installs in CI; Renovate for updates; `pnpm audit` in CI. |
| **Production guard** | Agent refuses to activate when `NODE_ENV=production` unless explicitly forced, and prints a warning. |

---

## 10. Error handling and logging

### Principles

1. **The user's app always wins.** Any internal agent error is swallowed and counted, never thrown into user code.
2. **Fail open.** If the collector is down or tracing breaks, the app keeps running normally, just untraced.
3. **Tell the developer clearly** when tracing is degraded, in the CLI and the UI, not silently.

### By process

| Process | Approach |
| --- | --- |
| **Agent** | Every hook, patch and runtime helper is wrapped in `try/catch`. Internal errors increment a counter; after N errors in a short window the agent **auto-disables itself** for that process and prints one clear warning. If the transform fails on a file, that file loads untransformed. If the collector is unreachable, the agent retries with backoff, buffers a bounded number of events, then drops the oldest. |
| **Collector** | Invalid events are rejected with an error code and logged; one bad batch never stops ingest. Unfinished requests (app crashed or restarted mid-request) are finalized after a timeout and marked `incomplete`. The launcher always forwards the user's command output and exit code, even if the collector has problems. Uncaught errors are logged and the server stays up where possible. |
| **UI** | React error boundaries per panel (one broken view doesn't blank the app). Live connection status shown in the header (connected / reconnecting / collector stopped). REST errors use the shared error envelope and show a readable message with the error code. |

### What the developer sees

| Situation | Shown as |
| --- | --- |
| Agent auto-disabled | CLI warning + UI banner: "Tracing turned off for process 1234 after internal errors. Your app is unaffected." |
| File could not be instrumented | CLI debug log + that file's steps are missing (visible as a gap note in the map) |
| Protocol version mismatch | CLI error with the command to update |
| Request incomplete | Map shows the request with an "incomplete" badge |
| Step limit reached | Map shows "truncated after 5,000 steps" at the cut point |

### Logging

| Process | Logger | Where | Default level |
| --- | --- | --- | --- |
| Collector | pino | Console (pretty) + `.pathlight-tracker/logs/collector.log` (rotated) | `info` |
| Agent | Minimal internal logger (no dependencies) | stderr, prefixed `[pathlight-tracker]` | `warn` |
| UI | `console` in development; errors forwarded to the collector log via `/api/v1/client-logs` (v1) | Browser console | `warn` |

**Log rules:** structured JSON fields (`requestId`, `pid`, `code`); never log captured values or tokens; redaction applies to logs too.

---

## 11. Key decisions with reasons

| # | Decision | Reason | Alternatives rejected |
| --- | --- | --- | --- |
| 1 | **Three processes** (agent, collector, UI) | Keeps the user's app light and safe; heavy logic and UI live outside it | Everything in the app process (risky, slows the app) |
| 2 | **Web app first, VS Code extension second** | Proves the hard part (capture) with fast UI iteration; same collector and UI reused later | Extension first (slower iteration, more tooling friction) |
| 3 | **Load-time code wrapping with SWC** | Captures every user function with real values at low cost | CDP breakpoints (too slow); OpenTelemetry (span-level only); Babel (slower) |
| 4 | **In-memory transform, never written to disk** | Keeps the "zero code changes" promise; git stays clean | Generating instrumented copies of files |
| 5 | **Raw events from agent; trees built in collector** | Agent stays tiny and fast; collector can be changed without touching the app | Building trees inside the app |
| 6 | **`AsyncLocalStorage` for request context** | Standard, reliable way to keep calls in the right request across `await` | Manual context passing (impossible without code changes) |
| 7 | **Redact in the agent, before sending** | Secrets never leave the app, are never stored or displayed | Redacting only in the UI |
| 8 | **REST + WebSocket, versioned** | Simple, language-neutral contract for agent, UI, extension and a future MCP server | tRPC (ties clients to TypeScript RPC); polling (not live) |
| 9 | **SQLite + Drizzle in the collector** | Local, fast, queryable, typed, migrations included | In-memory only (lost on restart); Prisma/TypeORM (too heavy) |
| 10 | **No user auth; local token + origin checks** | Single-developer local tool; the real threat is other local programs and websites | User accounts (unnecessary complexity) |
| 11 | **Fail open, auto-disable on internal errors** | The traced app must never break because of Pathlight Tracker | Fail closed (would crash the developer's app) |
| 12 | **Capture object IDs from day one** | The v2 data journey needs them; they can't be added to old recordings | Adding identity tracking later |
| 13 | **Collector runs as a separate process in Phase 2** | Avoids native-module breakage inside VS Code's Electron host | Running the collector inside the extension host |
| 14 | **Batch UI rendering every ~100 ms** | Keeps the live map smooth on large requests | Rendering on every event (janky on big requests) |
| 15 | **Soft delete with a 72-hour trash, then purge** | Developers can undo mistakes, but captured values (which may be sensitive) are still erased for good | Hard delete only (no undo); soft delete forever (data never really gone) |
| 16 | **Three-panel layout, navigation in the header, no nav sidebar** | Only four destinations exist; width goes to the step tree and values | Icon rail sidebar (costs width for little gain) |
| 17 | **"Steps" in the UI, not "spans"** | Matches the data model and API; clearer for developers new to tracing | OpenTelemetry vocabulary (spans, trace IDs) |
| 18 | **Watched files matched through the source map** | Works when the app runs compiled `dist/` code; the same map gives the `.ts` line | Matching compiled paths (misses NestJS `dist/`) |
| 19 | **Fixed default port and a per-project token** | Saved and pasted links keep working after restarts | Random port and new token per run (links break on every restart) |
| 20 | **Red error path only for errors that reached the response** | Red means "this is where it broke"; swallowed errors show as Caught (violet) | Red for every thrown error (misleading on 200 responses) |
| 21 | **`if` / `switch` conditions in the MVP, expression conditions in v1** | The reference design needs the `if` row; expression probes are the riskiest transform work | All conditions in v1 (MVP examples can't pass) or all in the MVP (more Phase 3 risk) |

New decisions are recorded as one short file each in `docs/decisions/` (context, decision, consequences) and added to this table.
