# PRD: Pathlight Tracker, a live request debug map for local Node.js development

Oct 29, 2026 (updated Oct 30, 2026) · @Pradeep

## Overview and problem

Pathlight Tracker is a local developer debug visualizer: it draws a live map of each request as it hits your local Node/TypeScript server, showing every function it passed through and the real data at each step. It runs as a browser app first (`npx pathlight-tracker dev`), then inside VS Code as an extension. It is for local development only, never production.

**The problem.** AI now writes much of our code. When that code breaks, nobody holds a mental model of it. The developer doesn't know:

- which function calls which, and in what order
- why a path was taken
- what data went in and came out of each function
- where the data went wrong

It feels like opening a novel in the middle: things are happening, but you don't know who anyone is or how they got there. Debugging becomes guessing.

**Why today's tools fall short.**

- Breakpoints and `console.log` need you to already know where to look.
- APM tools (Datadog, OpenTelemetry) show HTTP and DB spans, not the path through your own functions.
- Static call-graph tools show what *could* be called, not what actually ran or with what data.
- AI assistants read the code but guess at runtime behaviour instead of seeing it.

**One-line pitch:** hit an endpoint and watch a live map of your code light up, showing every function the request passed through and the real data at each step.

## Core idea, goal and principles

**Core idea: a live map of your request.** When you hit an API on your local server, Pathlight Tracker draws, in real time (in a browser tab now, inside VS Code later), the path that request took through your code: every function it touched, in order, with the real data at each step. Think of a metro map that lights up station by station as the request travels, and at every station you can see what the passenger (your data) was carrying.

**Goal: turn debugging from guessing into seeing.** A developer understands what AI-written code actually did, and finds where it broke, without adding logs or breakpoints, just by hitting the endpoint and watching.

**Principles**

1. **Observe, never change.** The app behaves exactly the same with or without Pathlight Tracker. If tracing changes behaviour, the tool can't be trusted.
2. **Your code only.** Library code in `node_modules` is skipped; only its boundaries (DB, HTTP calls) are shown, so the map stays clean.
3. **One request = one map.** Every recorded call belongs to exactly one request, even when many run concurrently across `await`s.
4. **Local only.** For development, never production. Data never leaves the machine.
5. **What first, why later.** Pathlight Tracker answers "what really happened" completely. "Why the AI wrote it this way" is deferred to a later AI layer.

**Why local-only makes it simpler**

| Decision | In production it would be... | Local only, so... |
| --- | --- | --- |
| How much to record | Sample a small share of requests | Record everything for the requests you trigger |
| Performance overhead | Must be tiny | A 2–5× slowdown is acceptable while debugging |
| Where data lives | Cloud backend, auth, multi-tenant | One SQLite file on your machine, no server, no login |
| Security | Strict compliance rules | Still redact secrets, but data never leaves the laptop |
| Deployment | Agents on many servers | One command: `npx pathlight-tracker dev -- <your start command>` |

## Questions the developer asks

These ten questions are the product's real requirements: Pathlight Tracker answers questions 1 to 9 with recorded facts, and leaves question 10 (intent) to a later AI layer.

| # | Developer's question | Book analogy | Example in code | Answered by |
| --- | --- | --- | --- | --- |
| 1 | Where does it start? | Where's chapter 1? | Which route or controller triggered this? | Request entry node (MVP) |
| 2 | What calls what? | Who talks to whom? | `Controller → OrdersService → PricingService → Repo` | The map (MVP) |
| 3 | In what order? | What happens first, next, last? | Is the user fetched before the cart total? | Order in the map + timeline (MVP / v1) |
| 4 | What data goes in and out? | What is each character carrying? | What's inside `user`, `cart`, `dto`? | Args and return values (MVP) |
| 5 | Where does data change shape? | When did the character change? | DTO becomes entity, `null` appears | Changed-value highlight, data journey (v1 / v2) |
| 6 | What touches the outside world? | Events with consequences | DB, Redis, Kafka, HTTP calls | Boundary nodes (MVP / v1) |
| 7 | Which branch was taken, and why? | Which plot path happened? | Did `if (isPremium)` go true or false? | Condition tracking (MVP: `if` / `switch`; v1: ternary, `&&` / `\|\|`, `?.`) |
| 8 | Where did it fail, and what led there? | The plot twist and its cause | Error plus the chain before it | Red error path (MVP) |
| 9 | What's hidden or magic? | Off-page events | NestJS guards, pipes, interceptors | Framework nodes (MVP) |
| 10 | Why does this code exist? | The author's intent | Why call `recalculateTax` twice? | Not answered; future AI layer |

## Target users

The primary user is a backend developer on Node/TypeScript who uses AI assistants daily and debugs locally.

| Persona | Who they are | What hurts today | What they need from Pathlight Tracker |
| --- | --- | --- | --- |
| AI-heavy backend dev (primary) | 1–5 years experience, NestJS or Express, ships mostly AI-generated code | Can't tell which functions ran or what data they got | One-command trace of a request with real values |
| Onboarding developer | New to a codebase, often junior | Doesn't know the flow of an unfamiliar service | A live map of what a real request touches |
| Tech lead / reviewer | Reviews AI-written PRs | Can't verify the PR behaves as claimed | Run the PR's path once and see its real behaviour |
| Solo builder / indie hacker | Builds fast with AI, no team to ask | Stuck on bugs in code they didn't write | See exactly where the data went wrong, fast |

**Out of scope for now:** SRE and on-call engineers debugging production. That is a different product with different risks.

## Goals, non-goals and success metrics

The MVP succeeds if a developer finds the cause of a bug faster with Pathlight Tracker than with logs and breakpoints, with near-zero setup.

**Goals**

1. Draw a live map of each request as it runs, from request in to response out.
2. Show real arguments, return values and errors at every step of the developer's own code.
3. Make the framework layer (NestJS guards, pipes, interceptors, filters; Express middleware) visible.
4. Highlight the error path, including swallowed errors, so the failing step is found without reading everything.
5. Link every step to its source line in the editor.
6. Work in under 2 minutes from first command to first map, with no code changes.

**Non-goals**

- AI explanation of traces (deferred until the core capture and map are proven)
- Production monitoring or always-on tracing
- Languages other than JavaScript/TypeScript on Node
- Step-back time-travel debugging
- Team sharing, cloud storage or dashboards
- Frontend/browser code
- Local variables inside a function (only what goes in and out; line-level values may come much later)

**Success metrics** (initial targets, to be validated)

| Metric | Target | How we measure |
| --- | --- | --- |
| Time to first map after first run | under 2 minutes | Timed on a fresh machine (task 5.4) |
| Map appears after request finishes | under 300 ms | Benchmark suite |
| Used on real projects | Weekly by the author for 4+ weeks after MVP | Personal log in `progress.md` |
| Outside interest | Growing npm downloads, GitHub stars and issues | npm and GitHub stats |

No usage stats are collected for now: this starts as a personal open-source project. Opt-in usage stats (off by default) are planned only after the product proves useful (Future, task 8.3).
| App slowdown in trace mode | under 5× on typical endpoints | Benchmark suite |

## User journey and stories

The core journey is four steps: start in trace mode, hit an endpoint, watch the map draw, jump into code.

1. **Start.** The developer runs `npx pathlight-tracker dev -- npm run start:dev` (web MVP), or clicks "Start with Pathlight Tracker" in VS Code (extension phase). No code changes. The map opens in the browser.
2. **Hit.** They call an endpoint from Postman, the browser or a test.
3. **Watch.** The map draws live as the request runs: framework steps, each function with its arguments, return value, duration and errors, and DB/HTTP calls at the edges. The failing path turns red.
4. **Jump.** Clicking a step shows its values in the inspector and opens that exact line in the editor. (Inline values next to the code arrive with the VS Code extension.)

Example of what the map shows for a failing request:

```
POST /orders                                       ✗ 500  (84ms)
├─ [guard]  JwtAuthGuard.canActivate → true
├─ [pipe]   ValidationPipe → CreateOrderDto { userId: 7, items: [...] }
└─ OrdersController.create(dto)
   └─ OrdersService.create(dto)
      ├─ UserService.findById(7) → { id: 7, tier: undefined }   ← suspicious
      │   └─ [db] users.findOne({ id: 7 })
      ├─ CartService.total(items) → 1200
      └─ PricingService.calculateDiscount(user, 1200)
           ◇ if (user.tier === 'gold') → false   (v1)
           ✗ TypeError: Cannot read 'rate' of undefined
```

**User stories**

- As a developer, I want to see a map of every function my request passed through as it runs, so I know what the AI-written code actually does.
- As a developer, I want the arguments and return value of each call, so I can find where the data went wrong.
- As a developer, I want errors, including swallowed ones, and the path to them highlighted, so I don't read the whole map.
- As a NestJS developer, I want guards, pipes, interceptors and filters shown as steps, so the framework magic is visible.
- As a developer, I want DB queries and outgoing HTTP calls shown with what was sent and returned, so I see the outside world.
- As a developer, I want to click a step and land on its source line, so I connect runtime to code.
- As a developer, I want secrets hidden by default, so I can trust the tool with real data.
- As a developer, I want deleted requests to go to a trash I can restore from, so a mistake isn't permanent.
- As a developer, I want to see which way each `if` went and the values that decided it, so I know why a path was taken. *(v1)*
- As a developer, I want loops summarized with the iteration that failed, so I find the bad item fast. *(v1)*
- As a developer, I want to compare a working and a broken request, so I see exactly what changed. *(v1)*
- As a developer, I want to follow one value through every function, so I see where it changed. *(v2)*

## Views

All views read the same recording, so supporting many views is cheap on the backend; the decision is to ship one primary view first and add the others as linked views.

| View | What it shows | Best for | Extra capture needed | Phase |
| --- | --- | --- | --- | --- |
| Step tree (live) | Indented tree of steps with values, status, duration and errors | Following the flow step by step | None | MVP (primary view) |
| Flow graph | Boxes and arrows by function (`Controller → Service → Repo`) | Seeing the shape of the code at a glance | None, it regroups the tree | v1 |
| Timeline / waterfall | Each step as a bar on a time axis | Finding what was slow and what ran in parallel | None, uses start time and duration | v1 |
| Data journey | One value (e.g. `user.tier`) followed through every function, with changes marked | "Where did my data go wrong?" | Object identity, captured from day one | v2 |

**Rules for the views**

- **One primary view, others linked.** Selecting a step in any view selects it in all of them (the Chrome DevTools pattern).
- **Don't build all four at once.** Four half-done views lose to one excellent one, and equal tabs confuse new users.
- **Capture object IDs from day one.** Data journey ships later, but old recordings can't gain object identity retroactively.
- **Decisions as a toggle layer.** Condition markers (`if` / `switch` in the MVP, expressions in v1) and loop markers (v1) can be switched on or off so the map stays clean.

The approved visual design (three panels: request list, step tree, inspector) is in `tracer-design.md` and `tracer-ui-reference.png`.

## Tracking coverage

The MVP records request in → framework steps → your functions with their data → DB and HTTP calls → errors → response out, plus `if` / `else if` / `switch` conditions; expression conditions (ternary, `&&` / `||`, `?.`) and summarized loops follow in v1.

**1. The request (entry and exit)**

| What | Details | Phase |
| --- | --- | --- |
| Incoming HTTP request | Method, URL, route params, query, body, headers (secrets hidden) | MVP |
| Outgoing HTTP response | Status code, response body, total time | MVP |
| Test run as entry point | Trace one Jest/Vitest test | v1 |
| Kafka/queue consumer as entry point | A message starts a new map | v2 |
| Cron / scheduled task as entry point | A scheduled run starts a new map | v2 |

**2. Your functions**

| What | Example | Phase |
| --- | --- | --- |
| Class methods | `OrdersService.create()` | MVP |
| Named functions | `function calculateDiscount()` | MVP |
| Arrow functions in variables | `const formatPrice = () => {}` | MVP |
| Async functions, tracked until resolved | `async findUser()` | MVP |
| Static methods | `PriceUtil.round()` | MVP |
| Constructors | `new OrderEntity(...)` | v1 |
| Inline callbacks, collapsed with a count | `items.map(i => ...)` | v1 |
| Generators | `function*` | v2 |
| Getters / setters | `get fullName()` | Not tracked by default (reading can cause side effects) |

**3. Data at every step**

| What | Phase |
| --- | --- |
| Arguments in, return value out, error thrown | MVP |
| Caller (parent), file and `.ts` line (source maps), time taken, class instance (`this`) | MVP |
| Object IDs for every captured object | MVP (stored, used by data journey in v2) |
| Arguments mutated inside a function (before vs after) | v1 |
| Same object followed across functions (data journey) | v2 |

**4. Framework layer**

| Framework | What | Phase |
| --- | --- | --- |
| NestJS | Middleware, guards (allowed or blocked), interceptors (before and after), pipes (input before vs after transform), controller handler, exception filters | MVP |
| Express | Middleware chain in order, route handler, error middleware | MVP |
| Fastify, Next.js API routes | Equivalent hooks | v2 |

**5. Calls to the outside world (boundary nodes only, not library internals)**

| What | Example | Phase |
| --- | --- | --- |
| Database queries | Mongoose, TypeORM, Prisma: query and result summary | MVP |
| Outgoing HTTP | `axios`, `fetch`: URL, payload, status, response | MVP |
| Redis commands | `GET`, `SET` and value | v1 |
| Kafka/queue publish | Topic and message | v1 |
| `console.log` output | Attached to the step that printed it (Logs tab) | v1 |
| File system reads/writes | Path and size | v2 |

**6. Errors**

| What | Why it matters | Phase |
| --- | --- | --- |
| Thrown errors | The red path to the failure | MVP |
| Swallowed errors (caught and ignored) | AI code does this often; bugs vanish silently | MVP |
| Unhandled promise rejections | Async errors that escape | MVP |
| Error converted to HTTP response | e.g. `TypeError` became a 500 | MVP |

**7. Async flow**

| What | Phase |
| --- | --- |
| Calls across `await`, kept in the right request | MVP |
| Concurrent requests, each with its own map | MVP |
| Parallel work (`Promise.all`) as side-by-side branches | v1 |
| `setTimeout` / event emitters started inside a request | v2 |

**8. Conditions and loops**

Conditions are recorded with the branch taken and the values that decided it; loops are always summarized, never stored per iteration.

| What | What the map shows | Phase |
| --- | --- | --- |
| `if / else if`, `switch` | Branch taken + the values in the condition, e.g. `if (user.tier === 'gold') → false, user.tier = undefined` | MVP |
| Ternary, `&&` / `\|\|`, `?.` | Same, for expression conditions | v1 |
| `for`, `while`, `for...of`, `.forEach` / `.map` | Iteration count and time; details kept only for first, last, failing and unusual-branch iterations | v1 |
| Executed lines (coverage-style highlight) | Which lines ran inside a function | v2 |

Example loop summary:

```
↻ for (const item of items)   → 48 iterations, 12ms
    first: item = { sku: 'A1', qty: 2 }
    last:  item = { sku: 'Z9', qty: 1 }
    ✗ failed at iteration 31: item.price is undefined
```

**Not tracked, by design:** library internals in `node_modules` (boundaries only), local variables inside functions, production servers, frontend code, and languages other than JavaScript/TypeScript.

## Functional requirements

MVP requirements prove the live map; v1 makes it a daily debugging tool; v2 widens reach and adds the VS Code extension. IDs are stable; rows are grouped by phase.

| ID | Area | Requirement | Phase |
| --- | --- | --- | --- |
| FR-1 | Launch | Start the app in trace mode with one command (`npx pathlight-tracker dev -- <command>`) and no code changes | MVP |
| FR-2 | Live | Stream call events to the map UI while the request runs and draw the map live | MVP |
| FR-3 | Capture | Record every call into user code (not `node_modules`): name, file, line, args, return value, error, duration, parent | MVP |
| FR-4 | Capture | Group calls by request, correctly across `await` and concurrent requests | MVP |
| FR-5 | Capture | Map compiled JS back to `.ts` lines via source maps | MVP |
| FR-6 | Capture | Record request in (method, path, params, body) and response out (status, body) | MVP |
| FR-7 | Framework | Show NestJS middleware, guards, interceptors, pipes, handler and filters, and Express middleware and handlers, as steps | MVP |
| FR-8 | Boundaries | Show DB queries (Mongoose, TypeORM, Prisma) and outgoing HTTP calls with what was sent and returned | MVP |
| FR-9 | Errors | Capture thrown, swallowed and unhandled-rejection errors. The red error path leads to errors that reached the response (unhandled, or turned into a 5xx); swallowed errors are marked "Caught" (violet), not red | MVP |
| FR-10 | Capture | Assign object IDs to captured objects (for the v2 data journey) | MVP |
| FR-11 | Safety | Redact sensitive keys (password, token, authorization, secret) by default, before storing | MVP |
| FR-12 | Safety | Cap value depth, array length and string length; handle circular references; never call getters | MVP |
| FR-13 | UI | List recent requests (method, path, status, duration, step count) | MVP |
| FR-14 | UI | Step tree as primary view with expandable values, durations and the error path in red | MVP |
| FR-15 | UI | Click a step to see its values in the inspector and open its source line in the editor | MVP |
| FR-32 | Trash | Deleting a request moves it to a trash (with Undo); restore, delete permanently, empty trash; automatic permanent deletion after 72 hours | MVP |
| FR-33 | UI | Light and dark themes, following the OS by default, switchable in Settings | MVP |
| FR-34 | UI | Three-panel layout (request list, step tree, inspector) with resizable, collapsible side panels; navigation in the header | MVP |
| FR-35 | UI | Follow latest (auto-open new requests) and Pin (keep the current request open) | MVP |
| FR-36 | Onboarding | Waiting screen with agent status, an example curl command and "Load sample data" | MVP |
| FR-37 | UI | Copy link to a request or step, and copy a request as cURL | MVP |
| FR-38 | Config | Editor for Open in code chosen in Settings (VS Code by default; Cursor, WebStorm and others); stored in the browser, which builds the link | MVP |
| FR-41 | CLI | `pathlight-tracker doctor` checks the setup (Node version, module type, source maps, port) and prints fixes | MVP |
| FR-42 | CLI | `pathlight-tracker clear` deletes recordings (through the running collector when there is one) | MVP |
| FR-43 | UI | Sessions menu and "app restarted" dividers in the request list | MVP |
| FR-44 | UI | Request list filters: path text and "errors only" | MVP |
| FR-45 | UI | Settings: theme, editor, follow-latest default | MVP |
| FR-46 | UI | Layout for laptop and desktop widths (1100 px and up) | MVP |
| FR-47 | UI | Saved and pasted links keep working after the app or collector restarts | MVP |
| FR-16 | Decisions | Record branch taken and condition values for `if`, `else if` and `switch`; toggleable layer | MVP |
| FR-48 | Decisions | Same for ternary, `&&`, `\|\|` and `?.` | v1 |
| FR-17 | Decisions | Summarize loops: count, time, and first, last, failing and unusual iterations | v1 |
| FR-18 | Capture | Collapse repeated callbacks (`.map`, `.forEach`) into one node with a count | v1 |
| FR-19 | Capture | Detect arguments mutated inside a function (before vs after) | v1 |
| FR-20 | Capture | Trace one Jest/Vitest test as an entry point | v1 |
| FR-21 | Boundaries | Show Redis commands, Kafka/queue publishes and `console.log` output at their step | v1 |
| FR-22 | UI | Flow graph and timeline as linked secondary views | v1 |
| FR-23 | UI | Search and filter within a map (function, file, value) | v1 |
| FR-24 | UI | Compare two requests side by side and highlight differences | v1 |
| FR-25 | Config | Include/exclude files and add custom redaction rules | v1 |
| FR-49 | UI | More request list filters (method, slow, route, state, session, date range, sort by duration) | v1 |
| FR-50 | UI | More settings: row density, show framework steps, show timings, config viewer with sources, copy config (`GET /config`) | v1 |
| FR-51 | Misc | UI error logs endpoint, in-memory database fallback, trash size limit, `o + Enter` to reopen the browser, `--quiet` flag, truncation header | v1 |
| FR-39 | UI | Logs tab showing `console.log` output captured during the request, attached to the step that printed it | v1 |
| FR-40 | Extension | VS Code extension: one-click start, the same map in a webview, inline values next to code, CodeLens | v2 |
| FR-26 | UI | Data journey: follow one value through every function and mark where it changed | v2 |
| FR-27 | Capture | Follow a request across Kafka/queue consumers; cron jobs as entry points | v2 |
| FR-28 | Capture | Support ESM and bundled apps (Vite, esbuild); Fastify and Next.js API routes | v2 |
| FR-29 | Decisions | Coverage-style highlight of executed lines | v2 |
| FR-30 | Export | Export a map as JSON or a shareable report | v2 |
| FR-31 | AI | Plain-language explanation of a map ("why"), grounded in recorded data | Future |
| FR-52 | Metrics | Opt-in usage stats, off by default, documented payload, never captured values or paths | Future |
| FR-53 | UI | Tablet and phone layouts | Future |

## Non-functional requirements

Pathlight Tracker must never change how the user's code behaves, and must keep their data on their machine.

| Area | Requirement |
| --- | --- |
| Correctness | Instrumentation must not change behaviour: `this` binding, `arguments`, generators, async ordering, thrown errors and stack traces stay the same |
| Correctness | Condition probes must preserve short-circuit evaluation (`&&`, `\|\|`, `?.`) and evaluate each expression exactly once |
| Performance | Under 5× slowdown on typical endpoints in trace mode; zero overhead when trace mode is off |
| Performance | Loops never store per-iteration data beyond the summarized samples |
| Live latency | New steps appear in the map live while the request runs (no fixed millisecond target; it varies with load); the full map within 300 ms of the response |
| Performance | The map opens a 5,000-step request in under 1 second |
| Privacy | All data stored locally (SQLite); nothing leaves the machine (no telemetry) |
| Privacy | Redaction applied before data is stored or streamed |
| Safety | Capturing values never triggers getters, `toJSON` or lazy DB loads |
| Reliability | A pathlight-tracker failure must never crash the user's app; it degrades to "not traced" |
| Compatibility | Node 20+, TypeScript, CommonJS; modern Chrome, Edge, Firefox and Safari for the map UI; VS Code 1.85+ for the extension phase; Windows, macOS, Linux |
| Storage | Keep the last 100 requests by default, configurable; older ones move to a trash and are permanently deleted after 72 hours |
| Accessibility | WCAG 2.2 AA: contrast, full keyboard use, screen-reader labels (see `tracer-design.md` §10) |

## Competitive landscape

AppMap is the closest existing tool and must be tried hands-on before building; Pathlight Tracker's angle is live, data-first, NestJS-aware and built for understanding AI-written code.

| Tool or category | What it does | Gap Pathlight Tracker fills |
| --- | --- | --- |
| [AppMap](https://github.com/getappmap/appmap) | Records runtime behaviour without code changes (function calls, return values, exceptions, HTTP, SQL); VS Code; supports Node.js; stores locally; sequence diagrams; now focused on its AI assistant | Mostly record-then-open (to verify hands-on); not data-first; not NestJS-layer focused |
| Static call graphs ([Graph-It-Live](https://github.com/magic5644/Graph-It-Live/wiki), [Chartographer](https://marketplace.visualstudio.com/items?itemName=ArpinFidel.chartographer)) | Show which functions can call which, from reading code | No runtime truth: not what ran, not the data |
| CPU profiler ([Chrome DevTools](https://oneuptime.com/blog/post/2026-01-22-nodejs-debug-chrome-devtools/view)) | Flame chart, bottom-up and call tree with timings | No argument or return values; not request-scoped |
| [Debug Visualizer](https://marketplace.visualstudio.com/items?itemName=hediet.debug-visualizer) | Visualizes data structures at a breakpoint | One moment in time, not the flow |
| APM (Datadog, OpenTelemetry) | Request spans, DB/HTTP timing in production | No path through your own functions or their values |
| AI coding assistants | Read and explain code | Reason statically; guess at runtime behaviour |

**Where Pathlight Tracker differs**

1. **Live:** the map draws as the request runs, not as a file opened afterward.
2. **Data-first:** focused on where data changed, with conditions explaining why a path was taken.
3. **NestJS-aware:** guards, pipes, interceptors and filters as first-class steps.
4. **Built for AI-written code:** the pitch is understanding code you didn't write.

**Biggest threats:** AppMap adding a live, data-first view; AI coding assistants adding runtime awareness. Defence: depth on Node/NestJS, capture accuracy, and possibly exposing Pathlight Tracker's data to assistants through MCP.

## Release plan

Ship the smallest loop that proves value (hit an endpoint, watch the live map, jump to code) as a web app first, then widen coverage, and only then move into VS Code.

| Phase | Theme | What ships | Gate to move on |
| --- | --- | --- | --- |
| **Validation** | Is the gap real? | AppMap tried hands-on; capture spike proves wrapping works on NestJS | Go / adjust decision; behaviour corpus green; slowdown under 5× |
| **MVP (web app)** | Live request map | `npx pathlight-tracker dev`; Express + NestJS (CommonJS); live step tree with real values; framework steps; DB and HTTP boundaries; errors incl. swallowed; inspector; trash; light and dark; redaction; local SQLite; `if` / `switch` conditions; Prisma; `doctor` and `clear` | First map in under 2 minutes on a fresh machine |
| **v1** | Daily debugging tool | Expression conditions and loop summaries; flow graph and timeline; compare two requests; search; Logs tab; test runs, Redis, Kafka; custom rules; extra filters and settings | Used weekly by the author on real projects; outside interest growing |
| **v2** | VS Code and wider reach | VS Code extension (same UI, inline values, CodeLens); ESM and bundlers; Fastify and Next.js; Kafka consumers and cron jobs; data journey; export | Extension adoption and retention |
| **Future** | AI on top of real data | MCP server for AI assistants; AI explanation layer; opt-in usage stats; tablet and phone layouts | Core proven |

Each phase starts only when the previous gate is met. The task-level breakdown is in `tracer-implementation-plan.md`.

## Risks, assumptions and open questions

The biggest risks are technical (instrumenting arbitrary AI-written code safely) and market overlap with AppMap; both are tested before heavy building.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| AppMap already covers most of the need | Months spent rebuilding what exists | Validation step below before building |
| Instrumentation changes app behaviour | Users lose trust immediately | Large test suite of tricky patterns (generators, getters, decorators, `this`, short-circuit conditions); fail safe to "not traced" |
| Too slow on hot paths or loops | Users turn it off | User code only, summarized loops, batched events, trace on demand |
| Async context lost across awaits or queues | Steps attach to the wrong request | `AsyncLocalStorage`; heavy concurrency tests |
| Live map floods on big requests | Unreadable map, laggy UI | Collapse callbacks, summarize loops, cap steps per request |
| Sensitive data captured | Security concerns | Redact before storing; local-only; trash purged after 72 hours |
| ESM and bundler variety | Many projects can't use it | Start with CommonJS + TypeScript; ESM in v2 |
| Switching between browser and editor feels clunky | Weaker experience than an in-editor tool | `Open in code` links in the MVP; VS Code extension in v2 |

**Validation step (before building)**

- [ ] Install AppMap on a real NestJS project and record several requests
- [ ] Note what it already does well (don't rebuild that)
- [ ] Note what frustrates you, especially "live", "data-first" and the NestJS layer (that's the product)
- [ ] Decide go / adjust / stop based on those notes

**Assumptions to validate**

- Developers will start their app through a CLI command (and later an extension).
- A live map with values is faster than breakpoints and logs for AI-written code.
- Live drawing adds real value over a recording opened afterward.

**Open questions**

- Which open-source licence: MIT or Apache-2.0? (Decided: open source.)
- Should Pathlight Tracker expose its data through MCP so Claude Code or Cursor can read real runtime data?
- When the core is proven, in which phase should the AI explanation layer return?

## Related documents

| Document | What it covers |
| --- | --- |
| `tracer-tech-stack.md` | Technology choices, versions, "do not use" list |
| `tracer-architecture.md` | Processes, folders, data flow, auth, modules, state, env vars, security, errors, decisions |
| `tracer-data-model.md` | Database tables, keys, indexes, enums, soft delete, access rules, seed data |
| `tracer-user-flows.md` | Screens, journeys, navigation, connection states, empty/loading/error states, edge cases |
| `tracer-design.md` + `tracer-ui-reference.png` | Colors, type, spacing, components, layout, responsive, themes, accessibility |
| `tracer-api-spec.md` | REST and WebSocket endpoints, types, errors, pagination, limits |
| `tracer-implementation-plan.md` | Phases, tasks, dependencies, "done when", checkpoints, MVP line |
