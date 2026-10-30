# Tracer: Tech Stack

Tracer is a local developer debug visualizer: it draws a live map of each request as it hits your local Node/TypeScript server, showing every function it passed through and the real data at each step.

This document fixes the technology for every part of the system. Each checkpoint below has one decision, not a menu.

---

## 0. Checklist at a glance

| Checkpoint | Decision |
| --- | --- |
| Frontend framework + language + styling + UI library | React + Vite, TypeScript, Tailwind CSS, shadcn/ui (Radix primitives) + Lucide icons; Inter + JetBrains Mono; light and dark themes |
| Backend / runtime / framework | Node.js; collector CLI with `commander` + Fastify; runtime agent with SWC + `pirates` + `AsyncLocalStorage` |
| Database + ORM | SQLite via `better-sqlite3` + Drizzle ORM |
| Auth provider | None (local only); random port + one-time token |
| State management + data fetching | Zustand for live state; native WebSocket for the live feed; TanStack Query for history over REST |
| Third-party services | None in MVP (no payments, email, storage or AI); AI and MCP are future add-ons |
| Hosting / deployment | No hosting: CLI on npm, extension on VS Code Marketplace + Open VSX, CI on GitHub Actions |
| Package manager, linter, formatter, tests | pnpm, ESLint (typescript-eslint), Prettier, Vitest, Playwright |
| Key versions pinned | See section 11 |
| "Do not use" list | See section 12 |

---

## 1. Guiding decisions

- **TypeScript end to end.** Agent, collector, UI and extension share one language and one set of types.
- **Local only.** No backend server, cloud account, database server or user accounts. Everything runs on the developer's machine.
- **Zero code changes in the traced project.** The agent is preloaded with `NODE_OPTIONS="--require @tracer/register"`; only the start command changes.
- **Web app first, VS Code extension second.** Phase 1 ships a browser UI served by a local CLI. Phase 2 wraps the same collector and UI inside a VS Code extension.
- **Host-agnostic core.** Agent, collector and UI never depend on the browser or VS Code directly; only a thin host adapter changes between phases.

---

## 2. System overview

```
┌──────────────────┐  WebSocket  ┌──────────────────────────┐  WebSocket  ┌──────────────────┐
│  Runtime agent   │ ──────────▶ │  Collector (Node CLI)    │ ──────────▶ │  Map UI (React)  │
│  inside your app │   events    │  store + local server    │   live map  │                  │
└──────────────────┘             └──────────────────────────┘             └──────────────────┘
                                                                            Phase 1: browser tab
                                                                            Phase 2: VS Code webview
```

| Part | What it does | Phase 1 (web) | Phase 2 (extension) |
| --- | --- | --- | --- |
| Runtime agent | Wraps functions, records calls, data, errors | Same | Same |
| Collector | Receives events, builds trees, stores, serves UI | `npx tracer dev` | Spawned by the extension as a child Node process |
| Map UI | Draws the live map | Browser tab at `localhost` | Same React build in a webview |
| Host adapter | Opens source files, launches the app | `vscode://file/...` links, CLI | VS Code editor and debug APIs |

---

## 3. Frontend (Map UI)

The same build runs in a browser tab (Phase 1) and a VS Code webview (Phase 2).

| Concern | Decision | Notes |
| --- | --- | --- |
| Framework | **React** | Same build for browser and webview |
| Build tool | **Vite** | Fast dev server and builds |
| Language | **TypeScript** (strict mode) | Shares types with `protocol` package |
| Styling | **Tailwind CSS** | Semantic color, spacing and radius tokens as CSS variables (see `tracer-design.md` §2–§4); mapped to VS Code theme variables in Phase 2 |
| Theme | Light + dark, following the OS by default; `data-theme` attribute + Tailwind `darkMode` | See `tracer-design.md` §8 |
| Fonts | **Inter** (UI) + **JetBrains Mono** (code), bundled via **Fontsource** | No CDN, so it works offline and in VS Code webviews |
| UI component library | **shadcn/ui** (Radix primitives) | Copied into the repo, so no runtime lock-in; accessible menus, dialogs, tooltips, tabs |
| Command palette (search) | shadcn/ui `Command` (**cmdk**) | `Ctrl K` / `Cmd K` |
| Resizable panels | shadcn/ui `Resizable` (**react-resizable-panels**) | Request list and inspector widths, collapsible |
| Toasts | **Sonner** (shadcn/ui `Toast`) | "Moved to trash · Undo" |
| Icons | **Lucide** (`lucide-react`) | Matches shadcn/ui |
| Large live step tree | **TanStack Virtual** | Renders thousands of rows smoothly (tree and request list) |
| Value inspector | Custom expandable JSON component | Shows redacted, truncated and suspicious (`undefined`) markers clearly |
| Flow graph (v1) | **React Flow** (`@xyflow/react`) + **elkjs** | Auto-layout of boxes and arrows |
| Timeline (v1) | Custom Canvas/SVG | Thousands of bars, zoom and pan |
| Jump to source (Phase 1) | Editor link pattern, default `vscode://file/<path>:<line>` | Configurable for Cursor, WebStorm and others (`TRACER_EDITOR`) |
| Design reference | `tracer-design.md` + `tracer-ui-reference.png` | Approved three-panel layout |

---

## 4. State management and data fetching

| Concern | Decision | Notes |
| --- | --- | --- |
| Live map state | **Zustand** | Small store that appends streamed events; selectors keep re-renders cheap |
| Live feed | **Native WebSocket** with a small reconnecting client | Pushes each new step as it happens |
| UI update rate | Batch incoming steps into one render every ~100 ms | Keeps the UI smooth on big requests |
| History and search (request list, old maps) | **TanStack Query** over a small REST API from the collector | Caching, loading and refetch handled for free |
| Host communication (Phase 2) | `postMessage` adapter with the same interface as the WebSocket client | UI code doesn't know which host it's in |

---

## 5. Backend / runtime

### 5a. Runtime agent (inside the traced app)

| Concern | Decision | Notes |
| --- | --- | --- |
| Runtime | **Node.js** (traced apps: Node 20+) | Agent must run on whatever Node the user's app uses |
| Wrap functions with probes | **SWC** (`@swc/core`) | Fast transform at load time |
| Hook module loading (CommonJS) | **`pirates`** | Battle-tested require hook |
| Hook module loading (ESM, v2) | Node **`module.register()`** loader hooks | Official ESM hook API |
| Patch libraries (NestJS, DB, HTTP) | **`require-in-the-middle`** + **`diagnostics_channel`** | Same approach as OpenTelemetry; its instrumentations are reference code only |
| Request context | **`AsyncLocalStorage`** (`node:async_hooks`) | Keeps calls in the right request across `await` |
| Source maps | **`@jridgewell/trace-mapping`** | Maps JS back to `.ts` lines |
| Object identity | **`WeakMap`** | Stable object IDs for the data journey, no memory leaks |
| Safe value capture | Custom serializer | Never calls getters or `toJSON`; caps depth, arrays and strings; handles cycles; redacts secrets |
| Timing | `process.hrtime.bigint()` | Nanosecond precision |
| Event batching | In-memory buffer flushed every ~50 ms | App never blocks on I/O |
| Transport to collector | **`ws`** WebSocket client | JSON messages in MVP |

### 5b. Collector (local Node CLI)

| Concern | Decision | Notes |
| --- | --- | --- |
| Runtime | **Node.js 24 LTS** (development and CLI) | Works on Node 20+ for users |
| CLI framework | **`commander`** | `tracer dev -- <command>` |
| HTTP framework | **Fastify** | Serves the UI, a small REST API (history, search) and WebSockets via `@fastify/websocket` |
| Launch the user's app | `child_process.spawn` + `NODE_OPTIONS` | Works through `nest start --watch`, nodemon and restarts |
| Open the browser | **`open`** | Cross-platform |
| Input validation | **Zod** | Validates every event from the agent and every API request |
| Logging | **pino** | Fastify's default logger |

---

## 6. Database and ORM

| Concern | Decision | Notes |
| --- | --- | --- |
| Database | **SQLite** (one local file, e.g. `.tracer/traces.db`) | No database server |
| Driver | **`better-sqlite3`** | Fast, synchronous, works in a plain Node CLI |
| ORM / query layer | **Drizzle ORM** (`drizzle-orm` + `drizzle-kit`) | Typed schema and queries, lightweight, built-in migrations |
| Retention | Last 100 requests, auto-pruned (configurable) | Keeps the file small |
| Phase 2 | Collector runs as a separate Node process | Avoids native-module problems inside VS Code's Electron host |

Tables: `sessions`, `requests` (with soft delete), `steps`, `object_refs`, `meta`. Full schema in `tracer-data-model.md`.

---

## 7. Auth

| Concern | Decision | Notes |
| --- | --- | --- |
| Auth provider | **None** | Single developer, local machine, no accounts |
| Connection security | Collector binds to `127.0.0.1` only, random port, one-time token passed to the agent and UI | No other local program or network device can read trace data |
| Future team features | Out of scope | Revisit only if sharing or cloud features are ever added |

---

## 8. Third-party services

| Service type | Decision |
| --- | --- |
| Payments | **None** |
| Email | **None** |
| File / cloud storage | **None** (all data stays in the local SQLite file) |
| AI APIs | **None in MVP.** Future AI explanation layer: user's own key (Anthropic, OpenAI or Gemini SDK), compressed and redacted traces only |
| MCP | **None in MVP.** Future optional server via `@modelcontextprotocol/sdk` |
| Telemetry / analytics | **None in MVP.** If added later: opt-in, anonymous usage counts only, never trace data |
| Error reporting | **None in MVP.** Local logs only |

---

## 9. Hosting and deployment

There is nothing to host: Tracer runs entirely on the developer's machine.

| Concern | Decision |
| --- | --- |
| CLI and agent distribution | **npm** (`npx tracer dev -- <your command>`) |
| Extension distribution (Phase 2) | **VS Code Marketplace** (`@vscode/vsce`) + **Open VSX** (`ovsx`) for Cursor and Windsurf users |
| Extension bundling (Phase 2) | **esbuild** |
| CI | **GitHub Actions** on Windows, macOS and Linux |
| Releases and versioning | **Changesets** |
| Docs / landing page (later) | Static site on GitHub Pages |

---

## 10. Tooling: package manager, linter, formatter, tests

| Concern | Decision |
| --- | --- |
| Package manager | **pnpm** with workspaces |
| Monorepo task runner | **Turborepo** |
| Linter | **ESLint** (flat config) + **typescript-eslint** |
| Formatter | **Prettier** |
| Git hooks | **lefthook** (lint and format on commit) |
| Unit tests | **Vitest** |
| Behaviour-preservation tests | Corpus of tricky code (getters, generators, decorators, `this`, `arguments`, short-circuit conditions, async ordering) run with and without the agent, asserting identical results |
| Fixture apps | Sample **Express** app and sample **NestJS** app (Mongoose and TypeORM) in the repo |
| UI end-to-end tests | **Playwright** |
| Performance benchmarks | **autocannon** against fixtures, traced vs untraced |
| Extension tests (Phase 2) | **`@vscode/test-electron`** |

Repo layout:

```
tracer/
├── packages/
│   ├── agent/        # runtime agent (preloaded into the user's app)
│   ├── protocol/     # shared event types and Zod schemas
│   ├── collector/    # CLI: receives events, builds trees, stores, serves UI
│   ├── ui/           # React map UI (browser + webview)
│   └── extension/    # VS Code extension (Phase 2)
├── fixtures/
│   ├── express-app/
│   └── nestjs-app/
└── tests/
    └── behaviour-corpus/
```

---

## 11. Key versions pinned

Pinned by major version. At project setup, install the latest stable release within each major, then lock exact versions in `pnpm-lock.yaml` and record them here. Upgrade majors only on purpose, never by accident.

| Tool | Pinned version |
| --- | --- |
| Node.js (development, CI, CLI) | 24.x LTS (set in `.nvmrc` and `engines`) |
| Node.js (traced apps supported) | 20.x and newer |
| pnpm | 10.x (set via `packageManager` field) |
| TypeScript | 5.x (strict mode) |
| React | 19.x |
| Vite | latest stable major at setup |
| Tailwind CSS | 4.x |
| shadcn/ui | latest CLI at setup (components are copied into the repo) |
| Zustand | 5.x |
| Inter / JetBrains Mono (Fontsource) | latest at setup |
| `cmdk`, `react-resizable-panels`, `sonner` | latest stable major at setup (installed through shadcn/ui) |
| TanStack Query | 5.x |
| TanStack Virtual | 3.x |
| Fastify | 5.x |
| `ws` | 8.x |
| `better-sqlite3` | latest stable major at setup |
| Drizzle ORM | latest stable major at setup |
| `@swc/core` | 1.x |
| Zod | latest stable major at setup |
| Vitest | latest stable major at setup |
| Playwright | 1.x |
| ESLint | 9.x (flat config) |
| Prettier | 3.x |
| VS Code engine (Phase 2) | `^1.85.0` minimum |

Rules:

- Exact versions live in the lockfile; CI installs with `--frozen-lockfile`.
- Renovate (or Dependabot) opens grouped update PRs weekly; majors are reviewed by hand.
- The agent package keeps runtime dependencies to an absolute minimum, because it loads inside the user's app.

---

## 12. "Do not use" list

| Do not use | Why | Use instead |
| --- | --- | --- |
| Babel for the agent transform | Too slow on large projects at load time | SWC |
| OpenTelemetry SDK as a core dependency | Span-level only, heavy, not built for function-level values | Our own agent; OTel instrumentations as reference code only |
| Chrome DevTools Protocol / debugger breakpoints for capture | Far too slow when stepping into every function | Load-time code wrapping |
| Writing instrumented code to disk | Breaks "zero code changes"; pollutes git | In-memory transform only |
| `eval` / `new Function` in the agent | Security risk; breaks CSP and source maps | Pre-transformed source |
| Calling getters, `toJSON` or `JSON.stringify` on captured user objects | Can trigger side effects (lazy DB loads) and crash on cycles | Custom safe serializer |
| Monkey-patching globals (`Object`, `JSON`, `Promise`) | Changes app behaviour | Wrap only user functions and specific library hooks |
| Heavy runtime dependencies in the agent (lodash, moment, etc.) | Loads inside the user's app; bloats and risks conflicts | Small hand-written helpers |
| `better-sqlite3` inside the VS Code extension host | Native module breaks across Electron versions | Run the collector as a separate Node process |
| Heavy ORMs (Prisma, TypeORM) in the collector | Overkill for two tables; Prisma needs extra engines and a generate step | Drizzle ORM |
| Any cloud backend, remote database or remote logging of trace data | Breaks the local-only promise | Local SQLite, local logs |
| Redux / MobX | More boilerplate than this UI needs | Zustand |
| Socket.IO | Extra protocol and payload overhead for a local link | Plain WebSocket (`ws`, `@fastify/websocket`) |
| Express for the collector | Slower, weaker typing and schema support | Fastify |
| webpack | Slow builds; unnecessary here | Vite (UI), esbuild (extension) |
| npm or yarn | Inconsistent workspace behaviour across the repo | pnpm |
| CDN-loaded scripts or styles in the UI | Breaks in VS Code webviews (CSP) and offline use | Bundle everything with Vite |
| `ts-node` inside the agent | Slow, conflicts with the user's own setup | SWC transform |

---

## 13. Future add-ons

| Add-on | Stack | When |
| --- | --- | --- |
| MCP server (AI assistants read Tracer data) | `@modelcontextprotocol/sdk` (TypeScript) | Optional, after v1 |
| AI explanation layer | Anthropic, OpenAI or Gemini SDK with the user's own key; compressed and redacted traces | After v2 |

---

## 14. Using Tracer on a project (no code changes)

```bash
# Normally:
npm run start:dev

# With Tracer:
npx tracer dev -- npm run start:dev
```

- Source files on disk are never modified; functions are wrapped in memory at load time.
- Requirements: CommonJS + TypeScript with `"sourceMap": true` (usually already on in NestJS), Node 20+.
- Not in the MVP: ESM projects, webpack/esbuild-bundled apps, apps running inside Docker.

---

## 15. Summary

> **TypeScript everywhere** · **React + Vite + Tailwind + shadcn/ui** for the map · **Zustand + WebSocket + TanStack Query** for state and data · **Node CLI with Fastify** as collector · **SWC + pirates + AsyncLocalStorage** for capture · **SQLite + better-sqlite3 + Drizzle** for storage · **no auth, no third-party services, no hosting** · **pnpm, ESLint, Prettier, Vitest, Playwright** · published to **npm**, the **Marketplace** and **Open VSX**.
