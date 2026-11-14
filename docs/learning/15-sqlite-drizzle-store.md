# 15 · The database: SQLite, Drizzle and migrations
2026-11-14 · Task 2.3 · `packages/collector/src/store/schema.ts`, `src/store/open.ts`, `packages/collector/drizzle/0000_init.sql`

## In one sentence
The collector keeps every recorded request in one local SQLite file, whose tables are described in TypeScript and created by generated migrations, with safety rules built into the database itself.

## Why we are doing this
Pathlight Tracker must remember requests after a restart so you can come back and look at what your AI-written code did. SQLite is a database that is just a file: no server to install, which fits "local only, one command". Captured values can contain private data, so the file must be protected and never committed.

## How it works
**Drizzle** is a TypeScript library for talking to SQL. We write the tables as code (`schema.ts`: `sessions`, `requests`, `steps`, `object_refs`, `meta`). That is "schema as code". Then `pnpm --filter @pathlight-tracker/collector db:generate` turns the code into a **migration**, a SQL file (`drizzle/0000_init.sql`). When the collector starts, `migrate()` runs any migration the file has not seen yet. Later schema changes become `0001_...`, so existing databases upgrade instead of being recreated. The schema must match `data-model.md` §9 exactly, which is why changes need approval first.

**Rules inside the database** (plain words):
- **CHECK constraint**: the database refuses a row that breaks a rule, even if our code has a bug. Example: `has_error IN (0,1)`, or "a request can only be in the trash if it is not still in progress".
- **Foreign key with cascade**: `steps.request_id` points to `requests.id`. With `ON DELETE CASCADE`, deleting a request deletes its steps and object refs automatically. No orphans.
- **Partial index**: an index covering only some rows, e.g. `idx_requests_active` only indexes rows where `deleted_at IS NULL`. The list of live requests stays fast and small, because trashed ones are not in it.

**PRAGMAs** are SQLite settings, set in `openStore`:
- `journal_mode = WAL`: readers (the UI API) and the writer (ingest) do not block each other.
- `foreign_keys = ON`: SQLite ignores foreign keys unless you ask, per connection. Without it, cascades silently do nothing.
- `auto_vacuum = INCREMENTAL`: lets the file give back space after deletes (retention and purge). It only takes effect **before the first table exists**, so it is the first thing we run. Set it later and it is silently ignored, and the file only ever grows.

**Privacy**: the folder is created `0700` and the file `0600` (only you can read them; ignored on Windows). `ensureGitignored` adds `.pathlight-tracker/` to `.gitignore` once, so traces are never committed.

**When it fails**: if the file cannot be created or opened, `openStore` throws `StoreUnavailableError` with code `STORE_UNAVAILABLE`. The CLI prints it and does not start the app.

## Why this way, not another
- **Error instead of an in-memory fallback** (decision 0008): an in-memory database would look like it works, then lose everything on exit. A clear error is more honest. Fallback may come in v1.
- Hand-written SQL migrations: easy to drift from the TypeScript types; generating them keeps one source.
- A server database like Postgres: needs installing and running, against the "one command" goal.

## Words to know
- **migration**: a versioned SQL step that changes the database structure.
- **schema**: the tables, columns and rules.
- **PRAGMA**: a SQLite setting command.
- **WAL**: write-ahead log, a journal mode allowing reads during writes.
- **cascade**: a delete that follows foreign keys to child rows.
- **partial index**: an index with a `WHERE` filter.
- **soft delete**: marking a row deleted (`deleted_at`) instead of removing it (the trash).

## Try it yourself
In `store/open.test.ts`, find the test for constraint violations. Open a scratch store (see the test's `beforeEach`) and try inserting a `requests` row with `has_error = 5` using `store.sqlite.prepare(...).run(...)`. Read the error message and find the matching `check(...)` in `schema.ts`.

## Check yourself
1. Why is `auto_vacuum` set before running migrations?
2. What does `ON DELETE CASCADE` do for a purged request, and which PRAGMA does it depend on?
3. What is the benefit of a CHECK constraint when our code already validates input?
4. Why does a failing store stop the app instead of falling back to memory?

<details><summary>Answers</summary>

1. It only takes effect before the first table is created.
2. Its steps and object refs are deleted too; it needs `foreign_keys = ON` on that connection.
3. It is a last line of defence: a bug in our code cannot store impossible data.
4. A memory fallback would silently lose the data on exit; an honest error (decision 0008) is better.
</details>

## Go deeper
- `docs/data-model.md` §2, §8, §9
- `docs/decisions/0008-*` (no in-memory fallback)
