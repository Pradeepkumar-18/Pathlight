# 17 · The store layer: filters, sorts and cursors
2026-11-14 · Task 2.5 · `packages/collector/src/store/requests.ts`, `steps.ts`, `cursor.ts`, `writes.ts`

## In one sentence
The store layer is the only code that talks SQL for reading and writing traces: it lists requests with filters, sorts and "next page" cursors, and writes agent batches in one transaction.

## Why we are doing this
Lesson 15 gave us tables; nothing yet knew how to ask good questions of them. The UI must answer "which requests failed?" or "show me the slow ones" without loading thousands of rows. One module that owns every query also means one place to guarantee a rule: **trashed requests never appear** in normal reads.

## How it works
Every read starts from a shared condition, so nobody can forget the trash rule:

```ts
activeRequests   // deleted_at IS NULL
trashedRequests  // deleted_at IS NOT NULL
```

`listRequests` adds filters (method, status classes like `5xx`, `hasError`, state, path text, route, session, since / until, `minDurationMs`) and one of four sorts. Path search is plain text: `%` and `_` are escaped, so searching `50%` does not mean "anything".

**Cursors, not page numbers.** Page 2 with `OFFSET 50` breaks when new rows arrive while you page. Instead the cursor remembers the last row seen (sort key plus ID) and the next query says "give me rows after that". This is called keyset pagination. The ID breaks ties, so two rows with the same duration are never skipped or repeated. The cursor is base64url text that also holds the sort and a fingerprint of the filters; if you reuse it with another sort or filter, you get `INVALID_CURSOR`.

**Writes.** `writeBatch` puts a whole agent batch (sessions, requests, steps, object refs) in one transaction. A step whose ID already exists is skipped, so a re-sent batch does not duplicate. If one row fails, everything rolls back (same all-or-nothing idea as lesson 16).

## Why this way, not another
- OFFSET paging: simpler, but unstable while data changes (live tool, so this matters).
- Decision made here: in-progress requests have no duration, so they sort as duration -1 (last when descending).
- Cursor holds a filter fingerprint so a stale cursor fails loudly rather than returning wrong rows.

## Words to know
- **keyset pagination**: paging by "after this row" instead of "skip N rows".
- **cursor**: an opaque token that remembers where the last page ended.
- **tie-breaker**: a second sort column (the ID) that makes ordering unique.
- **fingerprint**: a short summary of the filters, used to detect a mismatch.

## Try it yourself
Run `pnpm --filter @pathlight-tracker/collector test requests` and open `requests.test.ts`. Find the test that pages every sort 3 rows at a time. Change the page size to 2 and confirm it still passes.

## Check yourself
1. Why can `OFFSET` paging return a row twice in a live tool?
2. What does the ID do in a cursor?
3. Why is `%` escaped in the path filter?

<details><summary>Answers</summary>

1. New rows shift the positions, so a row from page 1 can slide onto page 2.
2. It breaks ties when many rows share the same sort value.
3. So the user's text is matched literally and not as an SQL wildcard.
</details>

## Go deeper
- `docs/api-spec.md` §6.1 (filters) and §9 (sorts, cursors)
- Lesson [15](15-sqlite-drizzle-store.md) for the tables.
