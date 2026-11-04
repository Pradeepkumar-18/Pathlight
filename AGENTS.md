# AGENTS.md

> **Single Source of Truth**: This project uses [`CLAUDE.md`](./CLAUDE.md) and scoped rules in [`.claude/rules/`](./.claude/rules/) (mirrored in [`.agents/rules/`](./.agents/rules/)) as the unified coding standards and project policies for all AI coding assistants (Antigravity, Gemini, Claude Code, Cursor).

---

## 1. Project Overview & Scope

- **Pathlight Tracker**: Local developer debug visualizer for Node.js / TypeScript backends.
- A runtime agent preloaded into the target app records every function call, value, and error; a local collector stores it in SQLite and streams it to a React map UI.
- **Local only, never production; web app first, VS Code extension later.**
- Never send data off-machine (no telemetry or remote logging).

---

## 2. Docs & Source of Truth

All project specs live in `Docs/` (moves to `docs/` at Task 0.7 with `tracer-` prefix removed until then):

- **Implementation Plan**: `Docs/tracer-implementation-plan.md`
- **Progress & Tasks**: `Docs/progress.md` (Update at the start and end of every task)
- **Architecture**: `Docs/tracer-architecture.md`
- **Data Model & Schema**: `Docs/tracer-data-model.md`
- **API Spec**: `Docs/tracer-api-spec.md`
- **User Flows & Edge Cases**: `Docs/tracer-user-flows.md`
- **Decisions**: `Docs/decisions/` and `Docs/progress.md` -> Decisions

---

## 3. Package Architecture & Dependency Boundary

```text
packages/protocol    Shared types + Zod schemas (depends on nothing)
packages/agent       Runtime agent preloaded into user app (the user's app always wins!)
packages/collector   CLI (`pathlight-tracker dev`), Fastify server, SQLite store, ingest, live hub, REST API
packages/ui          React map UI (browser now, VS Code webview later; UI says "steps", not "spans")
packages/extension   VS Code extension (Phase 2 only)
fixtures/            nestjs-app, express-app, seed data
tests/               behaviour-corpus, bench, e2e
```

**Strict Dependency Rule**: `agent`, `collector`, and `ui` import **only** from `protocol`, never from each other.

---

## 4. Scoped Rules

Refer to and follow the scoped rules for touched packages:

- **`packages/agent/**`**: See [`.claude/rules/agent.md`](./.claude/rules/agent.md) — The user's app always wins; wrap in try/catch; never throw into user code; run `pnpm test:corpus`.
- **`packages/collector/**`**: See [`.claude/rules/collector.md`](./.claude/rules/collector.md) — Fastify, SQLite, reject invalid input with envelope, log with pino without captured values.
- **`packages/collector/src/db/**` & `migrations/**`**: See [`.claude/rules/database.md`](./.claude/rules/database.md) — Ask before any schema change or migration. Snake_case tables/columns.
- **`packages/ui/**`**: See [`.claude/rules/ui.md`](./.claude/rules/ui.md) — Shadcn/ui + Lucide, tokens only (`packages/ui/src/theme`), words say **steps** (never spans), render values as text (never raw HTML).

---

## 5. Coding & Quality Standards

- **TypeScript Strict**: `strict: true`. No `any`; use `unknown` and narrow. No `@ts-ignore` (use `@ts-expect-error` with explanation).
- **Naming**: `kebab-case` files and directories, `camelCase` functions/variables, `PascalCase` types/classes/components, `UPPER_SNAKE_CASE` constants.
- **IDs & Envs**: Prefixed ULIDs (`ses_`, `req_`, `stp_`, `obj_`). Env vars have `PATHLIGHT_TRACKER_` prefix.
- **Validation**: Validate all external inputs with Zod.
- **Files**: Under ~300 lines, named exports only.
- **Verification Gate**: Before marking any task done, run:
  ```bash
  pnpm lint && pnpm typecheck && pnpm test
  ```
  _(plus `pnpm test:corpus` for agent changes and `pnpm test:e2e` for UI/API changes)_.

---

## 6. Ask Before Changing

Stop and ask the user before:

1. Changing the **database schema** or generating a migration.
2. Changing **architecture**, package boundaries, or the event protocol.
3. Adding, removing, or renaming **REST endpoints, WebSocket messages, error codes, or env vars**.
4. Adding or upgrading a **dependency**.
5. Modifying **design tokens** in `packages/ui/src/theme`.
6. Changing features across phases or moving outside `implementation-plan.md`.

_(Note: For Gemini-specific autonomous execution rules, see [`GEMINI.md`](./GEMINI.md))._

---

## 7. Workflows & Skills

Use the workflows defined in `.agents/skills/` (mirrored from `.claude/skills/`):

- `/start-task [task ID]`: Check dependencies, create task branch, update `progress.md`, and plan the work.
- `/finish-task`: Verify "Done when", run test/lint checks, review diff, update `progress.md`, draft commit & PR.
- `/new-decision [title]`: Record an ADR in `docs/decisions/` and update `progress.md`.
