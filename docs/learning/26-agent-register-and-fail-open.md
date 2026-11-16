# 26 · The agent entry: register, config and fail open
2026-11-16 · Task 3.1 · `packages/agent/src/register.ts`, `agent.ts`, `safety/safety.ts`, `safety/logger.ts`, `packages/protocol/src/config.ts`

## In one sentence
The agent starts with `node --require`, reads its settings, refuses to run in the wrong situations (kill switch, production, no collector), and wraps all its own work so a bug in the agent can never break your app.

## Why we are doing this
The agent lives inside the developer's running app. If it crashes, the app crashes, and the developer blames our tool. The rule from lesson 09 ("the user's app always wins", fail open) now becomes real code. Also, this is a debug tool: it must never record in production by accident (PRD: local only).

## How it works
- `register.ts` is the package entry (`main` points to `dist/register.js`). It never throws. It calls `startAgent`.
- `startAgent` reads the settings (`PATHLIGHT_TRACKER_*` env vars) and decides:
  - `PATHLIGHT_TRACKER_DISABLED` set: do nothing, say nothing (a silent kill switch).
  - `NODE_ENV=production`: one warning, and do nothing, unless `PATHLIGHT_TRACKER_ALLOW_PRODUCTION=1`.
  - No collector URL: one warning.
  - Only one agent per process.
- `safety.ts` has `run(code, action, fallback)`: it runs agent code in a try/catch. On error it counts the error and returns the fallback. After **20 internal errors within 60 seconds**, the agent turns itself off, prints one `AGENT_DISABLED` warning and sends an `agent.disabled` event.

```ts
function run<T>(code: string, action: () => T, fallback: T): T {
  if (disabled) return fallback;
  try { return action(); } catch (error) { report(code, error); return fallback; }
}
```

- The stderr logger (`[pathlight-tracker] ...`) has no dependencies and logs only the error's type, never its message, because a message could quote a captured value.

## Why this way, not another
- Why a window of 20 errors, not "disable on the first error"? One odd edge case should not end a whole debugging session; a flood means something is really wrong.
- Shared settings moved from the collector into `packages/protocol/src/config.ts`, so agent and collector read the same definition (the dependency rule: both may import only `protocol`). You approved this on 2026-11-15, plus `warning` and `agent.disabled` taking `traceId: null` outside a request (`api-spec.md` §11.1).
- Sources: `architecture.md` §5, §8, §9, §10.
- Note for later: the agent's log level is `PATHLIGHT_TRACKER_AGENT_LOG_LEVEL`, kept separate from the collector's so the app does not inherit it (`architecture.md` env table).

## Words to know
- **fail open**: when our code breaks, the app carries on normally.
- **kill switch**: one setting that turns the feature fully off.
- **production guard**: a refusal to run when `NODE_ENV=production`.
- **internal error**: a bug in the agent, not in the user's app.

## Try it yourself
Run `pnpm --filter @pathlight-tracker/agent test safety`. In `safety.test.ts`, find the test that forces errors. Change `INTERNAL_ERROR_LIMIT` to 2 temporarily (do not commit) and see which tests fail. Then run a small app with `PATHLIGHT_TRACKER_DISABLED=1` and check nothing is printed.

## Check yourself
1. Why does the kill switch print nothing, but the production guard prints a warning?
2. Why does the logger print only the error's type and not its message?
3. Why were the settings moved into `protocol`?

<details><summary>Answers</summary>

1. Kill switch is a deliberate choice, so no noise. In production the developer may not expect the agent to be loaded, so one warning explains why nothing is recorded.
2. The message could contain a captured value (a secret).
3. Agent and collector may not import each other, only `protocol`; both need the same settings.
</details>

## Go deeper
- `docs/architecture.md` §5 and §10; lesson [09](09-require-hook-swc-spike.md) (fail open)
