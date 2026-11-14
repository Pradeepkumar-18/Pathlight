# 10 · Request context: one trace per request
2026-11-14 · Task 1.2 · `packages/agent/src/spike/context.ts`, `packages/agent/src/spike/runtime.ts`, `fixtures/smoke/src/trace-lines.ts`, `fixtures/smoke/src/spike-context.ts`

## In one sentence
Task 1.2 proved that we can give every incoming HTTP request its own invisible "trace label" that follows the code across `await`, so 20 requests running at the same time still produce 20 clean, separate step trees.

## Why we are doing this
In lesson 09 (task 1.1) the runtime kept ONE global indent counter. That works when only one request runs at a time. A real server handles many at once. The product promise (PRD: "what did my code do for THIS request?") breaks if request A's steps land inside request B's tree.

For the developer using Pathlight, a mixed tree is worse than no tree: it shows calls that never happened in their request, so they cannot trust it.

## How it works

### The problem: concurrency mixes output
Node runs one piece of JavaScript at a time, but `await` pauses a function and lets another request run. So the order of events looks like this:

```
request A: → OrdersController.create
request B: → OrdersController.create     (B starts while A waits for the database)
request A:   → OrdersService.place
request B:   → OrdersService.place
request A:   ← OrdersService.place
```

With one global counter, B's "→" raises the indent that A's "←" then lowers. Lines get the wrong indent and cannot be told apart. The smoke test saw the output switch between traces 40 times, so this is the normal case, not a rare one.

The fix is to ask "which request am I in right now?" at every probe. A plain global variable cannot answer it, because after an `await` the "current request" is whoever ran last.

### AsyncLocalStorage: a label that follows the async chain
`AsyncLocalStorage` (from `node:async_hooks`) is like a backpack that Node attaches to a chain of work. Anything started from that chain (a timer, a promise continuation, code after `await`) carries the same backpack, even if other requests ran in between. Think of a coloured wristband: each request gets its own colour and keeps it through every await.

```ts
const storage = new AsyncLocalStorage<Trace>();

export function startTrace(): Trace {
  counter += 1;
  const trace: Trace = { id: `t${counter}`, depth: 0 };
  storage.enterWith(trace);   // from now on, this chain of work has this trace
  return trace;
}

export function currentTrace(): Trace {
  return storage.getStore() ?? OUTSIDE;   // OUTSIDE = shared "-" trace for start-up and timers
}
```

`runtime.ts` now reads `currentTrace()` in `enter`, keeps `depth` inside that trace, and tags each line `[pt t7]`. Each request counts its own indent.

### Where to start the trace: diagnostics_channel
We need a moment that is (a) before the user's handler runs and (b) in the same async chain as the handler. Node publishes the event `http.server.request.start` on `diagnostics_channel` right before the server emits `request`:

```ts
subscribe('http.server.request.start', () => {
  try { startTrace(); } catch { /* the user's app always wins */ }
});
```

Because the subscriber runs synchronously just before the handler, `enterWith` there covers middleware, guards, interceptors, the handler and everything awaited.

### Checking it: trace-lines.ts
`parseTraceLines` reads the `[pt <trace>]` lines, `groupByTrace` collects them per request, and `treeProblems` checks that every `→` is closed by a `←` or `✕` at the same indent, and that each line's indent equals the number of steps still open. A line from another request would break that. `spike-context.ts` fires 20 concurrent `POST /orders` (10 fail with 500, 10 return 201) and expects 20 well-formed trees.

## Why this way, not another
- **Patch `http.createServer` / `Server.prototype.emit`**: works, but monkey-patching Node internals is fragile, can conflict with other tools (OpenTelemetry, APM) and breaks the rule "don't monkey-patch globals" (`.claude/rules/agent.md`). `diagnostics_channel` is the official, supported hook: Node tells us, we do not rewrite Node.
- **Pass a request ID as a function argument**: impossible without changing the user's code, which the product must never do.
- **`AsyncLocalStorage.run(store, fn)` instead of `enterWith`**: `run` is cleaner, but needs a callback wrapped around the handler, which we cannot get from a subscriber. `enterWith` sets the store for the rest of the current execution. This was a spike finding: it works reliably for the whole NestJS request.
- **Known limit**: two steps of the SAME request running in parallel (`Promise.all`) share one indent counter. Task 3.8 will use parent step IDs instead of indent. Findings go to decision 0002 (task 1.4).

## Words to know
- **Concurrency**: many requests in progress at once, taking turns on one thread.
- **AsyncLocalStorage**: Node's "context that follows async work".
- **`enterWith`**: sets that context for the current execution and what it schedules next.
- **diagnostics_channel**: Node's built-in publish/subscribe for observing internals.
- **Trace**: here, all the steps of one request, tagged `[pt t7]`.
- **Well-formed tree**: every open step is closed once, at the right indent.

## Try it yourself
1. Run `pnpm spike:context` and read the output summary.
2. In `runtime.ts`, temporarily make `enter` use a module-level `const trace = { id: 'x', depth: 0 }` instead of `currentTrace()`. Run it again. Which check fails and how many problems does it report? Revert afterwards.

## Check yourself
1. Why is a global indent counter wrong once two requests overlap?
2. What does `AsyncLocalStorage` keep working across an `await` that a plain variable does not?
3. Why subscribe to `http.server.request.start` instead of patching `http`?
4. Which kind of parallelism inside one request is still NOT handled, and which task fixes it?

<details>
<summary>Answers</summary>

1. `await` lets another request run in between, so its enter/exit lines change the same counter and the indents and tree shapes get mixed.
2. It returns the right request's trace after the await resumes, whoever ran in between.
3. It is the official Node hook (no monkey-patching, fewer conflicts), and it fires synchronously just before the handler so the context covers the whole request.
4. Parallel steps in one request (`Promise.all`) share one indent; task 3.8 uses parent step IDs.
</details>

## Go deeper
- Node docs: `AsyncLocalStorage` and `diagnostics_channel` (the `http.server.request.start` message).
- `docs/progress.md`, entry 1.2 ("Findings for 0002").
- Lesson [09](09-require-hook-swc-spike.md) for the probes this builds on.
