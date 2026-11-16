# 31 · The production loader and transform
2026-11-16 · Task 3.6 · `packages/agent/src/loader/loader.ts`, `glob.ts`, `source-map.ts`, `transform/wrap.ts`, `runtime/runtime.ts`

## In one sentence
A `pirates` hook rewrites your own `.js` files in memory so each function reports when it is entered, and any file it cannot handle loads untouched.

## Why we are doing this
This is the core of the product: without wrapped functions there are no steps on the map. Lesson [09](09-require-hook-swc-spike.md) was a spike (a trial); this is the version meant for real use, and it must pass the behaviour corpus (lesson [11](11-behaviour-preservation-corpus.md)) against the real agent.

## How it works
1. `pirates` runs our function for every `.js` / `.cjs` file Node loads.
2. We skip `node_modules` and the agent's own files (it would trace itself).
3. We read the file's source map to find the **original `.ts` path**, then match the include / exclude globs (`PATHLIGHT_TRACKER_INCLUDE`, default `src/**`; `PATHLIGHT_TRACKER_EXCLUDE`) against that. No source map: we use the compiled path and send a `NO_SOURCE_MAP` warning event.
4. SWC rewrites functions, methods, static and private methods, arrows, arrow class fields, object methods and async functions. Each file registers a **site table** (name, kind, `.ts` line and column, async, class, argument names). Each call becomes `enter(site, this, args)`.
5. If the transform gives up or crashes, the original code is returned (`FILE_NOT_TRACED` warning). Nothing is ever written to disk.
6. The runtime has a pluggable recorder (events come in task 3.7), never throws into user code, and stops when the agent is off. With `PATHLIGHT_TRACKER_AGENT_LOG_LEVEL=trace`, each step prints one stderr line, a useful way to see it working.

```ts
const wrapped = transform(code, { runtimePath, file: info.originalFile, originFor: info.originFor });
if (wrapped === null) { warn('FILE_NOT_TRACED', ...); return code; } // load as it is
```

## Why this way, not another
- Matching on the `.ts` path means users write globs about the files they know, not about `dist/`.
- In-memory only: the user's build output stays clean (decision 0002; `architecture.md` §3b).
- Bugs found on the way: empty function bodies made unparseable code (also in the spike), and SWC 1.16 changed `Parameter` nodes and private names. Real code finds what spikes miss.
- Result: corpus 13 identical, 2 known differences, plus a new `empty-and-derived` case; 17 transform and 19 loader / glob tests, including a crashing transform that still loads through the real `require`.
- Sources: `architecture.md` §3b, §5, §8, §10; implementation-plan 3.6.

## Words to know
- **hook (pirates)**: code that runs when Node loads a module.
- **site table**: a list of every wrapped function with its position.
- **source map**: a map from compiled code back to the original `.ts`.
- **fail open**: on any problem, run the original (lesson [26](26-agent-register-and-fail-open.md)).

## Try it yourself
Run the NestJS fixture with `PATHLIGHT_TRACKER_AGENT_LOG_LEVEL=trace` through the agent (see root `package.json` `dev:nest`; check its README for the exact flags) and watch the step lines on stderr. Then add `throw new Error()` to a copy of a file's syntax and see that the app still starts.

## Check yourself
1. Why match globs on the original `.ts` path?
2. What happens to a file the transform cannot handle?
3. Why skip the agent's own files?

<details><summary>Answers</summary>

1. Users think in `src/*.ts`, not compiled `dist/*.js`.
2. It loads exactly as it is, with a `FILE_NOT_TRACED` warning.
3. The agent would wrap and trace itself, creating loops and noise.
</details>

## Go deeper
- `docs/architecture.md` §3b; decision 0002
