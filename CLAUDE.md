# CLAUDE.md

Rules for AI coding assistants working in this repo. Read this file fully at the start of every session.

## Project summary

**Tracer** (working name) is a local developer debug visualizer for Node.js/TypeScript backends. A runtime agent preloaded into the user's app records every function call, value and error for each request; a local collector stores it in SQLite and streams it to a React map UI, so developers can see exactly what AI-written code did. Local only, never production; web app first, VS Code extension later.

## Docs: what to read and when

All specs live in `docs/`. They are the source of truth: if code and docs disagree, stop and ask.

| Doc | Read it when you are… |
| --- | --- |
| `docs/prd.md` | Unsure whether a feature is in scope, or which phase (MVP, v1, v2) it belongs to |
| `docs/implementation-plan.md` | Starting any task: find the task ID, its dependencies and its "Done when" |
| `docs/progress.md` | Starting and finishing every task (see "Progress tracking") |
| `docs/architecture.md` | Touching package boundaries, data flow, auth, env vars, error handling or logging |
| `docs/tech-stack.md` | Choosing a library or tool, or checking the "do not use" list |
| `docs/data-model.md` | Touching the database, migrations, soft delete, retention or seed data |
| `docs/api-spec.md` | Adding or changing a REST endpoint, WebSocket message, error code or limit |
| `docs/user-flows.md` | Building any screen, state (empty / loading / error) or edge case |
| `docs/design.md` + `docs/ui-reference.png` | Writing any UI: colors, type, spacing, components, layout, accessibility |
| `docs/decisions/` | Before reversing an earlier technical decision |

Read only the sections a task needs; quote the section you followed in the PR description.

## Repo map

```
packages/protocol    Shared types + Zod schemas (depends on nothing)
packages/agent       Runtime agent preloaded into the user's app
packages/collector   CLI (`tracer dev`), Fastify server, SQLite store, ingest, live hub, REST API
packages/ui          React map UI (browser now, VS Code webview later)
packages/extension   VS Code extension (Phase 2 only)
fixtures/            nestjs-app, express-app, seed data
tests/               behaviour-corpus, bench, e2e
docs/                All specs
```

Dependency rule: `agent`, `collector` and `ui` import only from `protocol`, never from each other.

## Commands

| Task | Command |
| --- | --- |
| Install | `pnpm install` |
| Build all | `pnpm build` |
| Run the UI dev server (against seed data) | `pnpm --filter @tracer/ui dev` |
| Run Tracer on a fixture | `pnpm dev:nest` / `pnpm dev:express` |
| Load seed data | `pnpm seed` |
| Unit tests | `pnpm test` (one package: `pnpm --filter @tracer/<pkg> test`) |
| Behaviour corpus | `pnpm test:corpus` |
| End-to-end tests | `pnpm test:e2e` |
| Benchmarks | `pnpm bench` |
| Lint / typecheck / format | `pnpm lint` · `pnpm typecheck` · `pnpm format` |
| DB migration from schema | `pnpm --filter @tracer/collector db:generate` |

Before saying a task is done, run: `pnpm lint && pnpm typecheck && pnpm test` (plus `pnpm test:corpus` for any agent change, `pnpm test:e2e` for any UI or API change).

## Coding conventions

**Language and types**
- TypeScript everywhere, `strict: true`. No `any`; use `unknown` and narrow. No `@ts-ignore` (use `@ts-expect-error` with a reason if truly needed).
- Shared shapes come from `@tracer/protocol`. Never redefine an event, API or value type locally.
- Validate every external input (agent events, REST params and bodies, config, env) with Zod.

**Naming**
- Files and folders: `kebab-case` (`event-buffer.ts`, `call-tree/`).
- Variables and functions: `camelCase`; types, classes, React components: `PascalCase`; constants: `UPPER_SNAKE_CASE`.
- Database: `snake_case` tables and columns. JSON and API fields: `camelCase`.
- IDs: prefixed ULIDs (`ses_`, `req_`, `stp_`, `obj_`). Env vars: `TRACER_` prefix.
- UI wording says **steps**, never "spans".

**File style**
- One module, one job. Keep files under ~300 lines; split when larger.
- Named exports only (no default exports, except where a framework requires it).
- Imports ordered: Node built-ins, external packages, `@tracer/*`, relative.
- Comments explain *why*, not *what*. No commented-out code.
- Tests live next to the code: `foo.ts` → `foo.test.ts`.

**UI**
- Colors, spacing, radius and type only through design tokens (`packages/ui/src/theme`). No raw hex values in components.
- Use shadcn/ui components and Lucide icons; no other UI library.
- Every interactive element is a real `<button>`, `<a>` or `<input>` with a label; icon-only buttons need `aria-label`.
- Render captured values as text, never as HTML.

## Do's and don'ts

**Do**
- Work on one task from `implementation-plan.md` per session; keep the PR small.
- Write or update tests in the same change. Cover the "Done when" condition explicitly.
- Follow the exact shapes and examples in `api-spec.md` and `data-model.md`.
- Keep the agent tiny: few dependencies, no blocking I/O, nothing that can throw into user code.
- Update docs in the same PR when behaviour changes (and say so in the PR).

**Don't**
- **Don't add a dependency without asking first.** Name the package, why it's needed and the alternative you considered. Check `tech-stack.md` §12 ("Do not use") before proposing anything.
- Don't change code outside the task's scope ("while I'm here" refactors go in a separate task).
- Don't write instrumented code to disk, use `eval` / `new Function`, monkey-patch globals, or call getters / `toJSON` on captured user objects.
- Don't log, print or store tokens or captured values outside the database.
- Don't send any data off the machine (no telemetry, remote logging or cloud calls) unless a task explicitly says so.
- Don't skip or weaken a failing test to make CI pass. Fix the cause or ask.
- Don't invent features, endpoints, fields or UI that aren't in the docs.

## Errors and edge cases

- **The user's app always wins.** In `agent`, wrap every hook, patch and runtime helper in `try/catch`; count internal errors, never rethrow them into user code; fail open to "not traced".
- **Collector:** reject invalid input with the error envelope and codes from `api-spec.md` §8; one bad message must never stop ingest or crash the server.
- **UI:** every screen handles its empty, loading and error states from `user-flows.md` §6; each panel has an error boundary.
- **Edge cases:** before finishing a task, check the relevant rows in `user-flows.md` §7 and add a test for each one your code touches.
- Never swallow an error silently in Tracer's own code: log it (pino in the collector, `[tracer]` logger in the agent) with a code and context, without captured values.
- If behaviour for an edge case isn't specified, don't guess: ask, then record the answer in the right doc.

## Ask before changing

Stop and ask the human before you:

- Change the **database schema** (any table, column, index, constraint or enum) or write a migration.
- Change the **architecture**: package boundaries, processes, data flow, the event protocol, auth or security rules.
- Add, remove or rename a **REST endpoint, WebSocket message, error code or env var**.
- Add or upgrade a **dependency**, or change a pinned major version.
- Change the **design tokens** or a pattern defined in `design.md`.
- Move a feature between phases (MVP, v1, v2), or build something not in `implementation-plan.md`.
- Delete or rewrite more than one file you weren't asked to change.

When asking: say what you want to change, why, and what else it affects. After approval, update the doc first, then the code, and add a decision record in `docs/decisions/` for architecture or schema changes.

## Progress tracking

**Update `docs/progress.md` after every task, in the same PR.**

1. At the start: set the task to `🟡 In progress`, update **Current phase** / **Current task**, add it to **In progress**, and copy its "Done when" into the log entry.
2. During the task: add any bug or issue you find (and don't fix in this task) to **Known bugs / issues**, and any decision made to **Decisions**.
3. At the end: set it to `✅ Done` (or `⛔ Blocked` with the reason), remove it from **In progress**, update **Next steps**, and add a log entry with the date, task ID, what changed, tests added, decisions, bugs, and any follow-ups or new tasks discovered.
4. If you split a task, add the new tasks to both `progress.md` and `implementation-plan.md`.
5. Never mark a task done unless its "Done when" condition is met and all checks pass.

## Commit and PR format

- Branch: `task/<id>-<short-name>` (e.g. `task/2.3-database-setup`).
- Commit messages: Conventional Commits (`feat(collector): add soft delete`, `fix(agent): …`, `test: …`, `docs: …`).
- PR description: task ID, what changed, docs sections followed, how it was tested, `progress.md` updated (yes/no).
