# Pathlight

**Hit an endpoint and watch a live map of your code light up: every function the request passed through, and the real data at each step.**

Pathlight is a local debug visualizer for Node.js / TypeScript backends. A runtime agent preloaded into your app records every function call, argument, return value and error for each request. A local collector stores it in SQLite and streams it to a map UI in your browser (a VS Code extension comes later).

> The specs use **Tracer** as the working name. The final product name is still an open decision (see [progress](Docs/progress.md#decisions)).

## Why

AI writes much of our code now, and when it breaks nobody holds a mental model of it. Breakpoints and `console.log` need you to know where to look; APM tools show HTTP and DB spans, not the path through your own functions; static call graphs show what *could* run, not what did. Pathlight turns debugging from guessing into seeing.

## Principles

1. **Observe, never change.** Your app behaves exactly the same with or without it.
2. **Your code only.** `node_modules` is skipped; only boundaries (DB, HTTP calls) are shown.
3. **One request = one map,** even with many concurrent requests across `await`s.
4. **Local only.** For development, never production. Data never leaves your machine.
5. **What first, why later.** Recorded facts now; an AI explanation layer later.

## Status

🚧 **Planning complete, implementation not started.** Next task: 0.1 (validate against AppMap). Live status is in [Docs/progress.md](Docs/progress.md).

Planned usage once the MVP ships:

```bash
npx tracer dev -- <your start command>
```

## Docs

| Doc | What's in it |
| --- | --- |
| [PRD](Docs/tracer-prd.md) | Problem, goals, scope by phase (MVP, v1, v2) |
| [Implementation plan](Docs/tracer-implementation-plan.md) | Every task, its dependencies and "Done when" |
| [Progress](Docs/progress.md) | Current task, bugs, decisions, log |
| [Architecture](Docs/tracer-architecture.md) | Packages, data flow, security, key decisions |
| [Tech stack](Docs/tracer-tech-stack.md) | Libraries and tools, and what not to use |
| [Data model](Docs/tracer-data-model.md) | SQLite schema, retention, soft delete |
| [API spec](Docs/tracer-api-spec.md) | REST and WebSocket contract |
| [User flows](Docs/tracer-user-flows.md) | Screens, states and edge cases |
| [Design](Docs/tracer-design.md) + [UI reference](Docs/tracer-ui-reference.png) | Tokens, components, layout |
| [CLAUDE.md](CLAUDE.md) | Rules for AI coding assistants in this repo |

Task 0.7 moves these into `docs/` without the `tracer-` prefix.
