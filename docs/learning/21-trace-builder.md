# 21 · The trace builder: events become rows
2026-11-15 · Task 2.9 · `packages/collector/src/builder/` (`builder.ts`, `finalize.ts`, `refs.ts`, `rows.ts`, `session-events.ts`, `layer.ts`)

## In one sentence
The builder turns the agent's stream of small events into the request, step and object-ref rows the UI reads, and marks the red error path.

## Why we are doing this
The agent sends events like "function entered" and "function threw". The UI wants a tree: request, steps, depth, which step caused the 500. Someone has to do that translation, and it must be exact. The proof: feeding the recorded `POST /orders` stream must give rows identical to the seed data (except IDs and times).

## How it works
- `request.start` creates the request row and the session framework info.
- Steps get `seq` in arrival order, and `depth` from their parent. An exit or throw event **updates** the same step. Boundaries (DB, HTTP calls) and decisions become leaf steps.
- A step limit stops recording and marks the request truncated.
- A re-sent step is skipped; each batch is one transaction. It returns the IDs started, appended, updated and completed, for the live hub.
- `refs.ts` records object refs from every `objectId` in args, return values and the request body, with paths like `args[0]`.
- `finalize.ts` follows decision 0010: an error is **propagated**, **swallowed**, **converted** or **unhandled**. For errors that reached the response, it marks the red path from the root to the step that threw (`error_step_id`, `has_error`). A 404 has no red path.
- `layer.ts` guesses a controller / service / repository / fn badge from the class name.

**What the tests caught.** Comparing builder output to the seed found two seed bugs. The error stacks in `data-model.md` §10 held raw line breaks inside JSON strings, so they were not valid JSON (introduced in task 0.8). Also, an empty headers object `{}` and some request-body refs did not match what the agent really sends. The seed and docs were fixed and a new test checks that every `*_json` column is valid JSON. Lesson: a second implementation that must agree with the first exposes mistakes in both.

## Why this way, not another
- Store events raw and build on read: slower reads, harder queries.
- Build at ingest (chosen): the UI reads ready rows; cost is paid once per event.
- `loop` and `log` events are accepted but not stored (v1).

## Words to know
- **finalize**: compute the final facts (error state, red path) when a request ends.
- **error path**: the steps from root to the one that threw.
- **swallowed / converted error**: caught and ignored, or turned into another error.
- **truncated**: recording stopped at the step limit.

## Try it yourself
Run `pnpm --filter @pathlight-tracker/collector test builder`. Then break one JSON string in `sample.sql` with a raw newline and see which test fails.

## Check yourself
1. Why does an exit event update a step instead of adding one?
2. When is there no red path?
3. How did the builder tests find seed bugs?

<details><summary>Answers</summary>

1. The step was created at entry; exit only adds result and duration.
2. When no error reached the response (404, swallowed errors, no errors).
3. Output was compared with the seed; invalid JSON stacks and wrong headers showed up as differences.
</details>

## Go deeper
- `docs/decisions/0010-*`, `docs/api-spec.md` §11.1, lesson [20](20-ingest-websocket-agent.md)
