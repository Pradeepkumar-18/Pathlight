# Pathlight Tracker

**Hit an endpoint and watch a live map of your code light up: every function the request passed through, and the real data at each step.**

Pathlight Tracker (`pathlight-tracker` on npm) is a local debug visualizer for Node.js / TypeScript backends. A runtime agent preloaded into your app records every function call, argument, return value and error for each request. A local collector stores it in SQLite and streams it to a map UI in your browser (a VS Code extension comes later).


## Why

AI writes much of our code now, and when it breaks nobody holds a mental model of it. Breakpoints and `console.log` need you to know where to look; APM tools show HTTP and DB spans, not the path through your own functions; static call graphs show what *could* run, not what did. Pathlight Tracker turns debugging from guessing into seeing.

## Principles

1. **Observe, never change.** Your app behaves exactly the same with or without it.
2. **Your code only.** `node_modules` is skipped; only boundaries (DB, HTTP calls) are shown.
3. **One request = one map,** even with many concurrent requests across `await`s.
4. **Local only.** For development, never production. Data never leaves your machine.
5. **What first, why later.** Recorded facts now; an AI explanation layer later.

## Status

🚧 **Phase 0 (setup) is finishing; the product itself is not built yet.** The repo has the monorepo, tooling, CI and two fixture apps. Live status is in [docs/progress.md](docs/progress.md).

Planned usage once the MVP ships:

```bash
npx pathlight-tracker dev -- <your start command>
```

## Set up the repo

You need **Node 24** and **pnpm 10** (`corepack enable` gives you the pinned pnpm). On Windows, clone into a short path such as `C:\dev\pathlight` or enable long paths (see Troubleshooting).

1. `git clone https://github.com/Pradeepkumar-18/Pathlight.git`
2. `cd Pathlight`
3. `corepack enable`
4. `pnpm install` (the first install downloads a MongoDB binary for the fixtures; it can take a few minutes)
5. `pnpm build`
6. `pnpm lint && pnpm typecheck && pnpm test`
7. `pnpm fixtures:smoke` starts both fixture apps and checks their endpoints

To run one fixture app and call it yourself: `pnpm fixture:nest` (port 3001) or `pnpm fixture:express` (port 3002). The endpoints and the deliberate bugs are listed in [fixtures/README.md](fixtures/README.md).

### Troubleshooting

- **`turbo` fails with ENOENT on Windows:** the repo path is too deep, so files inside `node_modules/.pnpm` pass the 260-character limit. Clone into a shorter folder, or enable long paths (`git config --system core.longpaths true` and the Windows "Enable Win32 long paths" policy).
- **Wrong Node version:** the repo requires Node 24 (`.nvmrc`); the fixture apps themselves run on Node 20.19 or newer.

## Docs

| Doc | What's in it |
| --- | --- |
| [PRD](docs/prd.md) | Problem, goals, scope by phase (MVP, v1, v2) |
| [Implementation plan](docs/implementation-plan.md) | Every task, its dependencies and "Done when" |
| [Progress](docs/progress.md) | Current task, bugs, decisions, log |
| [Architecture](docs/architecture.md) | Packages, data flow, security, key decisions |
| [Tech stack](docs/tech-stack.md) | Libraries and tools, and what not to use |
| [Data model](docs/data-model.md) | SQLite schema, retention, soft delete |
| [API spec](docs/api-spec.md) | REST and WebSocket contract |
| [User flows](docs/user-flows.md) | Screens, states and edge cases |
| [Design](docs/design.md) + [UI reference](docs/ui-reference.png) | Tokens, components, layout |
| [CLAUDE.md](CLAUDE.md) | Rules for AI coding assistants in this repo |

[CONTRIBUTING.md](CONTRIBUTING.md) explains how work is organised (one task per session, one branch and PR per phase).
