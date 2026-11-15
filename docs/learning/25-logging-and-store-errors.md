# 25 · Logging and store errors: logId, 503, no secrets
2026-11-15 · Task 2.13 · `packages/collector/src/logging/logger.ts`, `logging/pino-roll.d.ts`, `server/errors.ts`, `collector.ts`

## In one sentence
The collector logs every error with a code and a `logId`, turns a locked database into `503 STORE_UNAVAILABLE`, and keeps tokens and captured values out of every log.

## Why we are doing this
When something fails, the developer needs a trail; but this tool handles sensitive data (request bodies, headers, the access token). A log file is easy to paste into a bug report. So logs must be useful and safe. CLAUDE.md: never swallow errors silently, never write tokens or captured values to logs.

## How it works
- **Two outputs** (pino): the console shows one readable line per coded entry, like `[pathlight-tracker] ERROR <code> <message> (logId ...)`; the full JSON goes to `.pathlight-tracker/logs/collector.<n>.log` (10 MB per file, 5 kept, via pino-roll). `dev` sends console lines to stderr so app output stays clean. If the file cannot be opened we fall back to the console with `LOG_FILE_UNAVAILABLE`.
- **Redaction.** `token`, `authorization` and `headers` are redacted by the logger. More important, the code simply never logs event payloads; errors carry a code and context only. A test ingests events, forces errors, then greps log files and console for the token and every captured value preview: none found.
- **`logId`.** Each HTTP request gets a ULID as its Fastify request ID. It appears in the log entry *and* in the error response `details.logId`. A user can say "logId 01J..." and you find the exact log line: a **correlation ID**.
- **503.** SQLite errors like `SQLITE_BUSY` / `LOCKED` / `CANTOPEN` map to `503 STORE_UNAVAILABLE` ("retry shortly"), not a vague 500. The test holds the write lock from a second connection, checks 503 with a ULID `logId`, a level-50 log entry, and that the collector works again after the lock ends.
- **Uncaught errors.** `startCollector` handles `uncaughtException` and `unhandledRejection`: logs `UNCAUGHT_ERROR` and stays up (`/health` still answers). Ingest and purge failures are logged too.

## Why this way, not another
- `pino-pretty` (nicer console) was not on the approved library list, and the repo asks before adding any dependency; a 15-line custom console stream (`formatConsoleLine`) does the job. Pino 10.4.0 and pino-roll 4.0.0 were approved first (dependency rule). `pino-roll.d.ts` types the untyped package.
- Replaced Fastify's deprecated `disableRequestLogging` with `logController`.
- Crashing on uncaught errors is the Node default, but a debug tool that dies loses your recording.

## Words to know
- **correlation ID**: one ID linking a response to its log lines.
- **redaction**: hiding sensitive fields before writing.
- **log rotation**: starting a new file at a size limit and deleting old ones.
- **503**: server temporarily unable to handle the request.

## Try it yourself
Run `pnpm --filter @pathlight-tracker/collector test logging`. In `logging.test.ts`, find the lock test and the grep for secrets. Add a fake secret to a captured value and see the test still pass only because it is never logged.

## Check yourself
1. Why is `logId` in both the response and the log?
2. Why 503 and not 500 for a locked database?
3. Why is redaction not the only protection against leaking values?

<details><summary>Answers</summary>

1. It links what the user saw to the exact log entry.
2. The cause is temporary and retrying works; 500 suggests a bug.
3. The best protection is never passing payloads to the logger at all.
</details>

## Go deeper
- `docs/architecture.md` §6 and §10, `docs/api-spec.md` §8
