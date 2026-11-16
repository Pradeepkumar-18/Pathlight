# 27 · The agent transport: batching, buffer, reconnect
2026-11-16 · Task 3.2 · `packages/agent/src/transport/transport.ts`, `buffer.ts`, `hello.ts`, `tests/integration`

## In one sentence
The agent sends its events to the collector over a WebSocket in small batches, keeps them until acknowledged, and survives the collector disappearing without ever blocking or crashing the app.

## Why we are doing this
The collector (lesson [20](20-ingest-websocket-agent.md)) is the listening side. Now we build the speaking side. A debug tool that slows the app when its collector is down, or eats all the memory, would be worse than no tool.

## How it works
1. Connect with the token as a subprotocol, send `hello`, wait for `welcome` (it gives the batch limits).
2. Events go into a buffer. Every **50 ms** (or when a batch is full) the transport sends a batch.
3. Each batch stays in the buffer until the collector sends `ack`. After a reconnect, unacked batches are resent in order.
4. `slow_down` from the collector: only one batch in flight until it clears.
5. Connection lost: reconnect with jittered backoff (250 ms growing to 5 s), one warning per outage. Close codes 4001 / 4003 / 4009 mean "stop for good".
6. The buffer is bounded: **10,000 events or 8 MB** (unacked ones count). When full it drops whole requests, oldest first, so you never get half a request.
7. The socket and timers are `unref`'d: they do not keep the Node process alive, so the app can always exit.

```ts
export const FLUSH_MS = 50;
export const BACKOFF_INITIAL_MS = 250;
export const BACKOFF_MAX_MS = 5_000;
```

## Why this way, not another
- Drop oldest, not newest: the freshest request is what the developer is looking at now.
- Drop whole requests: a tree with missing steps would mislead (PRD: show what really happened).
- Resend unacked in order: the collector's builder (lesson [21](21-trace-builder.md)) relies on order.
- The integration tests found a real collector bug: on shutdown, the store closed before socket close events, so `closeSession` threw. Now sessions end while the store is still open (`ingest.endAllSessions`). This is why integration tests, using agent and collector together (`tests/integration`), are worth having.
- Sources: `api-spec.md` §10, §11.1; `architecture.md` §5, §10.

## Words to know
- **batching**: grouping many small messages into one send.
- **ack**: the receiver says "I have these".
- **backoff + jitter**: waiting longer after each failure, with a random part so many clients do not retry together.
- **backpressure**: the receiver asks the sender to slow down.
- **unref**: tell Node "do not stay alive just for this".

## Try it yourself
Run `pnpm test` and find the integration test that kills and restarts the collector (in `tests/integration/src`). Read how it checks that events arrive in order. Then change `FLUSH_MS` locally to 500 and see whether any test is affected (revert afterwards).

## Check yourself
1. Why does the buffer drop whole requests instead of single events?
2. Why must the socket be `unref`'d?
3. Why keep batches until `ack` instead of deleting them when sent?

<details><summary>Answers</summary>

1. Half a request would draw a wrong, misleading map.
2. Otherwise a pending socket would stop the app from exiting normally.
3. If the connection drops after sending, the events may be lost; unacked ones can be resent.
</details>

## Go deeper
- `docs/api-spec.md` §10; `docs/architecture.md` §10
