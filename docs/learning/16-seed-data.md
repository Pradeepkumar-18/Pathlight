# 16 · Seed data and the drift guard
2026-11-14 · Task 2.4 · `fixtures/seed/sample.sql`, `packages/collector/src/store/seed.ts`, `seed.test.ts`

## In one sentence
We ship a small, realistic example recording (3 requests, 14 steps) that loads into the database with `pnpm seed`, so the UI can be built and tested before any real app is traced.

## Why we are doing this
The UI (Phase 4) needs data to draw. Without seed data you would have to run a fixture app, send requests and wait for the agent each time. Seed data is known, repeatable fake data: the same 500 error, the same trashed request, every time. Tests and screenshots can rely on it. It serves the PRD's core question "what happened in this request?" because the seed contains a failing request with a marked error path.

## How it works
`sample.sql` is the SQL from `data-model.md` §10, copied verbatim. It contains one failing request (500, error path from the root to the step that threw), one successful, and one in the trash.

**Drift guard.** Two copies of the same thing (the doc and the file) will eventually differ. A test reads the SQL block out of `data-model.md` §10 and compares it with `sample.sql` (minus three header comment lines). If somebody edits one and not the other, the test fails. Drift is caught by a machine, not by memory.

**One transaction** (`loadSeed`):

```ts
sqlite.transaction(() => {
  sqlite.exec('DELETE FROM sessions'); // cascades remove the rest
  sqlite.exec(sql);
})();
```

A transaction means all-or-nothing. If the seed fails half way, the old data is still there; a test proves it (`changes nothing when the seed fails half-way`). Loading twice works because it clears first.

**Why `INSERT OR REPLACE` for `meta`.** `openStore` already writes `schema_version` and `created_by_version` into `meta`. A plain `INSERT` in the seed would then fail with a duplicate key. `INSERT OR REPLACE` overwrites instead. The doc was updated in the same change, and the drift test keeps the file and doc equal.

## Why this way, not another
- Generating seed rows from code: more flexible, but a plain SQL file is the same thing the spec shows and is easy to read.
- Loading the seed through the future store layer: that layer (2.5) does not exist yet; raw SQL keeps this task small.
- Seeding on every start: no, it only runs when you ask (`pnpm seed`), because it deletes existing data in that store. Do not point it at a store you care about.

## Words to know
- **seed data**: known sample data loaded for development and tests.
- **transaction**: a group of changes that all succeed or all roll back.
- **drift**: two copies of the same information slowly becoming different.
- **idempotent**: safe to run many times with the same result.
- **INSERT OR REPLACE**: insert, or overwrite when the key already exists.

## Try it yourself
Run `pnpm seed` in a scratch folder, then open the `.pathlight-tracker/traces.db` file with any SQLite viewer (or `node -e` with better-sqlite3) and run `SELECT id, path, http_status, deleted_at FROM requests;`. Find the one with `deleted_at` set.

## Check yourself
1. Which problem does the drift-guard test prevent?
2. Why does `loadSeed` run `DELETE FROM sessions` and not delete each table?
3. What does the transaction guarantee if line 10 of the seed has an error?
4. Why did the `meta` insert become `INSERT OR REPLACE`?

<details><summary>Answers</summary>

1. The spec and the seed file silently becoming different.
2. Foreign keys cascade from sessions to requests, steps and object refs.
3. Nothing changes: the earlier data stays and the partial seed is rolled back.
4. The store already writes those meta keys at open, so a plain insert would hit a duplicate key.
</details>

## Go deeper
- `docs/data-model.md` §10
- Lesson [15](15-sqlite-drizzle-store.md) for cascades and the schema.
