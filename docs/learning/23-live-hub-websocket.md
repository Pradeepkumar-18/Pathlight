# 23 · The live hub and `startCollector`
2026-11-15 · Task 2.11 · `packages/collector/src/live/hub.ts`, `live/route.ts`, `src/collector.ts`

## In one sentence
The live hub pushes changes to open browser tabs over `WS /live`, and `startCollector` is the one function that wires every collector part together.

## Why we are doing this
The product is a *live* map: you click in your app and the step tree grows on screen. Polling REST every second would be wasteful and laggy. The hub sends only what changed, to only the tabs that care.

## How it works
A tab subscribes to topics: `requests` (the list) or `request:<id>` (one request's steps). Messages are `live.request.started / completed / deleted / restored / purged`, `live.steps.appended / updated`, and `live.agent.connected / disconnected / disabled`.

- **Batching.** Messages go out about every 100 ms, and consecutive step appends are merged. Ten steps in a burst become one message.
- **No duplicates.** A tab subscribed to both `requests` and `request:<id>` still gets each message once.
- **Housekeeping.** `ping` gets `pong`; a bad message gets `INVALID_MESSAGE` and the socket stays open; an 11th UI is closed with 4029.

`startCollector` (in `collector.ts`) does the assembly: store, `.gitignore` entry, token, builder, ingest, hub, REST API, server on 127.0.0.1, `collector.json`, retention after each completed request, the hourly purge job, and a clean `stop()`. Builder results (lesson 21), API deletes (22) and disconnects (20) all flow into the hub.

The integration test sends the recorded `POST /orders` batches and checks the `/live` messages arrive in order (`agent.connected`, `request.started`, steps seq 1 to 9, `request.completed` with the red path, `agent.disconnected`), validating each with the protocol schema. A tab watching another request gets nothing.

## Why this way, not another
- Poll REST: simple, but slow and heavy.
- Send full state each time: easy, but large; deltas keep messages small.
- A single `startCollector` makes the CLI and tests start the *same* thing, so tests use a real collector, not mocks.

## Words to know
- **topic**: a named channel a client subscribes to.
- **delta**: only the change, not the whole state.
- **batching / debounce**: grouping messages in a short window.
- **wiring**: connecting parts so they work together.

## Try it yourself
In `live.test.ts`, change the second subscription to `request:` plus a wrong ID and predict what the test would see before running it.

## Check yourself
1. Why merge step appends in 100 ms batches?
2. What happens when an eleventh UI connects?
3. Why use a real collector in tests?

<details><summary>Answers</summary>

1. Fewer messages and less UI re-rendering during bursts.
2. The socket is closed with code 4029.
3. It tests the real wiring, catching problems mocks hide.
</details>

## Go deeper
- `docs/api-spec.md` §10 (live messages), `docs/architecture.md` §6
