# 12 · Performance spike: how much slower does tracing make the app?
2026-11-14 · Task 1.4 · `tests/bench/src/bench.ts`, `docs/decisions/0002-capture-approach.md`

## In one sentence
We ran the same NestJS app with and without the capture hook under the same load, found it only about 1.1–1.2× slower (target: under 5×), and used that to say "Go" at Checkpoint 1.

## Why we are doing this
Pathlight Tracker wraps every function in the user's app. If that made the app 10× slower, nobody would keep it on while debugging. Before building the collector and the UI (Phase 2 and later), we needed proof that the idea is fast enough. A cheap test now is better than finding out after months of work. This serves the principle "the user's app always wins" (see [lesson 09](09-require-hook-swc-spike.md)): capture must not hurt the app.

## How it works

**What a load test measures.** A tool (`autocannon`) opens 10 connections and sends requests as fast as it can for 10 seconds. It reports:
- **Requests per second (req/s)**: throughput. Higher is better.
- **Latency p50**: the median. Half of the requests were faster than this. The "typical" request.
- **Latency p99**: 99 out of 100 requests were faster. This shows the slow tail, the unlucky requests users actually notice.

**Slowdown** = untraced req/s divided by traced req/s. Example from the results: `GET /health` 7774 → 6814 req/s is 7774 / 6814 = 1.14×.

**Warm-up.** Node compiles hot code while it runs (JIT). The first seconds are slow for everyone. `bench.ts` sends 2 seconds of load first (`WARMUP_S = 2`) and throws the result away, then measures 10 seconds. Without warm-up we would measure "Node waking up", not the app.

**Trace output goes to the null device.** The spike prints trace lines. Printing to a terminal is slow and depends on the terminal, not on our code. In `startApp`, `stdio: ['ignore', 'ignore', 'ignore']` sends all output to the null device (a file that throws everything away). Both modes do this, so we measure only the cost of capture itself: wrapping, timing, formatting.

**Same load, fair comparison.** The two modes differ in one thing only: `--require HOOK`.

```ts
[...(traced ? ['--require', HOOK] : []), path.join(NEST_DIR, 'dist', 'main.js')]
```

**Start-up: one sample is noise.** Start-up time for the fixture is about 2.8 s, mostly the in-memory MongoDB starting. That varies a lot from run to run, so one measurement proves nothing. The script starts the app 5 times, alternating untraced / traced / untraced / ..., and takes the **median** (the middle value, so one weird run cannot move it). Alternating matters because the machine slowly changes (cache, other programs); if we ran all untraced first, then all traced, that drift would look like a difference. Result: 2784 ms vs 2795 ms, no measurable cost.

**Reading the results.**

| Scenario | Steps | Slowdown (3 runs) |
| --- | --- | --- |
| `GET /health` | 3 | 1.14× · 1.21× · 1.14× |
| `GET /orders/42` | 6 | 1.13× · 1.12× · 1.16× |
| `POST /orders` | 12 | 1.22× · 1.17× · 1.12× |

The three runs differ a little (1.12 to 1.22). That is normal noise, so we quote the range and not one lucky number. All are far below the 5× target. p99 barely moved (a few ms). Also check `errors / non-2xx = 0 / 0`: a fast run where requests failed would be meaningless, and the script fails if it sees any.

**Honest caveat.** These numbers exclude transport. The real agent will batch events and send them over a WebSocket (task 3.2), so task 3.15 runs `pnpm bench` again against the real agent, with the same 5× target.

**Go / no-go checkpoint.** A checkpoint is a planned stop at the end of a risky phase where you ask "did we prove the idea? Continue or change course?" with a clear rule decided in advance (here: slowdown under 5×, correct trees, concurrency works, behaviour unchanged). Checkpoint 1 answered Go, recorded in decision 0002.

## Why this way, not another
- **Median of alternating runs** vs one run or an average: the median ignores outliers; alternating cancels drift.
- **Wrap at load time** (decision 0002) beat Babel (slower at load) and patching `http` (the diagnostics channel does it without monkey-patching).
- **A new dev dependency (`autocannon` 9.0.0)** was approved by you first, as `CLAUDE.md` requires.

**The two decisions you made (recorded in 0002):**
1. **Keep follow-on promises.** When a wrapped function returns a promise, we return a new promise that settles the same way, so the step ends exactly when the work ends. Why you chose it: if we returned the original promise and attached our own handler, an unhandled rejection could be silently swallowed, and the user's app would stop crashing when it should. That would change behaviour, the worst sin for this tool. Cost: `returned === stored` identity checks and custom properties on that promise differ. OpenTelemetry makes the same choice.
2. **Accept the `Function.prototype.toString` difference.** Calling `.toString()` on a wrapped function shows the wrapped source, with probes. Fixing it means patching a global built-in, which the agent rules forbid (too risky for the user's app). It is rare in real code. It will be listed in the user docs (task 5.7), and `pnpm test:corpus` fails if either difference disappears, so a later fix gets noticed.

The pattern: when two options conflict, choose the one that keeps the user's app behaving the same, and document the small cost.

## Phase 1 in one paragraph
Task 1.1 proved we can wrap functions at load time with a require hook and SWC and still point to the original `.ts` line. Task 1.2 proved each request gets its own trace with `AsyncLocalStorage`, even with 20 at once. Task 1.3 proved the app behaves the same with and without the hook (12 of 14 cases identical, 2 known differences). Task 1.4 proved the cost is only about 1.1–1.2×. Together they gave a Go at Checkpoint 1, so Phase 2 (protocol and collector) can start.

## Words to know
- **Throughput (req/s)** → how many requests the app finishes per second.
- **Latency** → how long one request takes.
- **p50 / p99** → median latency / the latency that 99% of requests beat.
- **Warm-up** → load sent first and ignored, so Node's JIT is ready.
- **Null device** → a place output goes to disappear (`NUL` on Windows, `/dev/null` elsewhere).
- **Median** → the middle value of a sorted list.
- **Checkpoint (go / no-go)** → a planned decision point with pass rules set beforehand.
- **Follow-on promise** → a new promise chained from the original that settles the same way.

## Try it yourself
1. Run `pnpm bench` and note the slowdown column.
2. In `tests/bench/src/bench.ts`, temporarily change `WARMUP_S` to `0` and run again. Does the first scenario look different? (Undo the change afterwards.)
3. Run `BENCH_DURATION=3 pnpm bench` a few times. How much does the slowdown number move between runs? That movement is the noise.

## Check yourself
1. What is the difference between p50 and p99, and why can a good p50 hide a problem?
2. Why does the benchmark send trace output to the null device, and why would a terminal make the result misleading?
3. Why are start-up times measured 5 times, alternating traced and untraced, and compared by median?
4. The results show 1.12–1.22×. What is the target, and why do we quote a range and not one number?
5. Why did you choose follow-on promises over returning the original promise?

<details>
<summary>Answers</summary>

1. p50 is the typical request (half are faster); p99 is the slow tail (1 in 100 is slower). A good p50 can hide a few very slow requests that users notice.
2. Terminal printing is slow and varies by machine, so the numbers would measure the terminal. The null device removes it so only capture cost remains, in both modes.
3. One start-up is noisy (MongoDB start dominates). Repeating gives several samples, the median ignores outliers, and alternating stops slow machine drift from favouring one mode.
4. Target is under 5×. Runs vary a little from noise, so the range is more honest than one lucky run; even the worst (1.22×) is far below the target.
5. Returning the original and attaching our own handler could swallow unhandled rejections, so the app would stop crashing when it used to. That changes behaviour. The follow-on promise keeps behaviour, at the cost of promise identity checks.

</details>

## Go deeper
- `docs/decisions/0002-capture-approach.md` (evidence, accepted differences, known limits)
- `tests/bench/src/bench.ts` (about 175 lines, read `measure` and `main`)
- `docs/implementation-plan.md`, task 3.15 (re-running the bench with the real agent)
