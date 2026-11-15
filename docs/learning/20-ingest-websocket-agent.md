# 20 · Ingest: receiving events from the agent
2026-11-14 · Task 2.8 · `packages/collector/src/ingest/` (`ingest.ts`, `sessions.ts`, `route.ts`), `src/ids.ts`, `fixtures/events/post-orders.json`

## In one sentence
`WS /agent` accepts batches of events from the agent, validates each event on its own, stores the good ones, and answers with an `ack`.

## Why we are doing this
The agent runs inside the user's app and sends a firehose of events. The collector must never fall over because of one bad event, and must never let a fast app drown it. This is the rule from `.claude/rules/collector.md`: one bad message must never stop ingest.

## How it works
A conversation over one WebSocket:

```
agent: hello (protocol version)      collector: welcome (limits)
agent: batch #1 (events...)          collector: ack 1
agent: batch #2                      collector: ack 2
```

- **Version check.** A different protocol version gets a `PROTOCOL_MISMATCH` error with details, then the socket closes with code 4009.
- **Validate twice.** The envelope first, then each event separately with the Zod schemas from `protocol`. A bad event is dropped and reported as `INVALID_EVENT`; its neighbours are kept.
- **Limits.** Over 1 MB or 2,000 events: close 4013. Ten invalid messages in a row: close 4008. The WebSocket library cap is raised to 16 MB so our own 1 MB check, not the library, decides.
- **Backpressure.** Batches wait in a queue and are drained one per event-loop turn so the server stays responsive. Above 5,000 waiting events the collector sends `slow_down`; below 1,000, `resume`.
- **Sessions.** `hello` creates the session row. On disconnect the session becomes `disconnected` and its running requests become `incomplete`.
- `ids.ts` makes prefixed ULIDs in-house (time-sorted, unique), with no new dependency.

`fixtures/events/post-orders.json` is a real recorded stream (18 events) for the seed's failing `POST /orders`. Tests replay it, and task 2.9 reuses it.

## Why this way, not another
- Rejecting a whole batch for one bad event would lose good data.
- Unbounded queue: a chatty app could eat the collector's memory; `slow_down` tells the agent to hold back.
- Follow-up found here: the `boundary` event had no fields for name and source location; this led to a protocol change approved before 2.9.

## Words to know
- **ack**: "I stored it" reply.
- **backpressure**: the receiver telling the sender to slow down.
- **close code**: number sent when a WebSocket closes (4xxx are app-defined).
- **envelope**: the outer message that wraps the events.

## Try it yourself
Open `ingest.test.ts`, find the test with 6,000 queued events, and read which messages it expects (`slow_down` then `resume`). Why 5,000 and 1,000 rather than one number?

## Check yourself
1. What happens to valid events next to an invalid one?
2. What does the collector do when the agent disconnects mid-request?
3. Why two thresholds for backpressure?

<details><summary>Answers</summary>

1. They are stored and acked; only the bad one is dropped with `INVALID_EVENT`.
2. The session becomes `disconnected` and running requests become `incomplete`.
3. Hysteresis: one number would make it flip between slow_down and resume constantly.
</details>

## Go deeper
- `docs/api-spec.md` §11 (agent protocol), lesson [13](13-protocol-package-zod-schemas.md)
