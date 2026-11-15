# 22 · The REST API and contract tests
2026-11-15 · Task 2.10 · `packages/collector/src/api/`, `cli/running-collector.ts`

## In one sentence
The MVP REST endpoints let the UI list, open, delete and restore requests, and contract tests prove every response matches the shared Zod schemas and the spec's examples.

## Why we are doing this
The UI is a separate package that can only know the collector through `protocol`. If the collector's real answers drift from the spec, the UI breaks in ways that are hard to find. A contract test says: "the thing the server really sends is what the document promises."

## How it works
Endpoints (`api-spec.md` §6): `/health`, `/sessions`, `/requests` (filters, sorts, cursors from lesson 17), `/requests/:id`, `/requests/:id/steps`, `/steps/:id`, `/requests/:id/curl`, deletes and restore, `/trash`, `/sample`.

- **Strict validation.** Query params are checked with Zod: `INVALID_PARAMS`, `INVALID_ID`, `INVALID_CURSOR`. Unknown params are errors, not ignored.
- **Soft-deleted reads.** A trashed request returns `REQUEST_IN_TRASH` with `deletedAt` unless `includeDeleted` is set.
- **Delete is idempotent.** Deleting twice is fine. `?permanent=true` returns 204.
- **405 vs 404.** A known path with the wrong method gives `405 METHOD_NOT_ALLOWED` with an `Allow` header.
- `/steps/:id` parses `.ts` stack frames, shows `calledBy`, and `fileChangedSince` (is the source file newer than the recording?).
- `/requests/:id/curl` builds a curl command from the captured `host` header.
- `/sample` builds the seed in an in-memory database (`openStore` accepts `:memory:`), flagged `sample: true`.
- Deletes and restores report to `ApiEvents` so the live hub can notify tabs. `pathlight-tracker clear` now uses a running collector (found via `collector.json`, only if it answers), otherwise works on the database directly.

**Bug caught.** The seed's request headers were `{}`, which is not a valid captured value. The contract test parsed every stored captured value with the protocol schema and failed. The seed now uses `null`.

## Why this way, not another
- Hand-written expectations only: they drift. Parsing with the shared schema ties tests to the one contract.
- Task 5.6 must ship `sample.sql` in the npm package, or `/sample` breaks for real users (open follow-up).

## Words to know
- **contract test**: checks that responses match an agreed shape.
- **idempotent**: repeating gives the same result.
- **error envelope**: the standard JSON shape for errors.
- **keyset cursor**: see lesson 17.

## Try it yourself
Open `api.test.ts`, find the test for `REQUEST_IN_TRASH`, and trace in `requests-routes.ts` where that error is produced.

## Check yourself
1. Why parse responses with the protocol schema in tests?
2. What is the difference between 404 and 405 here?
3. Why is DELETE idempotent useful for a UI?

<details><summary>Answers</summary>

1. It ties server, UI and tests to one definition so drift fails a test.
2. 405: the path exists but not for that method; 404: no such path.
3. Double clicks or retries after a network error do not produce errors.
</details>

## Go deeper
- `docs/api-spec.md` §5 to §8, lesson [13](13-protocol-package-zod-schemas.md)
