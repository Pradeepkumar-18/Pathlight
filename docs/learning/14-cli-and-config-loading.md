# 14 · The CLI and config loading
2026-11-14 · Task 2.2 · `packages/collector/src/cli/program.ts`, `src/config/settings.ts`, `src/config/load.ts`

## In one sentence
The collector gets a command line (`pathlight-tracker dev -- npm run start:dev`) and one place that decides every setting, remembering where each value came from.

## Why we are doing this
A **CLI** (command-line interface) is a program you run by typing its name in a terminal, plus words and flags. It is the front door of Pathlight Tracker: the developer should only type one line to start their app with the agent attached and the map open (user flows T1 to T3).

Settings (port, how deep to capture values, redact keys) can come from many places. If you do not define the order, you get "why did my setting not work?" bugs. This task fixes the order and shows the answer in `GET /config` (api-spec §5.2).

## How it works
**commander** is a library that parses the words you type. We describe commands (`dev`, `clear`, `doctor`), their flags and arguments; commander gives us clean values and writes `--help` for free.

The `--` in `pathlight-tracker dev --port 4000 -- npm run start:dev` is a fence. Everything before it is for Pathlight Tracker; everything after is the user's own command, passed on untouched (`<command...>` in `program.ts`). Without the fence, `--port` after `npm` could be stolen by the wrong program.

**Precedence**: lowest to highest

```
defaults  <  pathlight-tracker.config.json  <  env (PATHLIGHT_TRACKER_*)  <  CLI flags
```

`loadConfig` walks each setting, and every candidate that is valid replaces the previous one. The result keeps the source:

```ts
{ port: { value: 4000, source: 'cli' }, retention: { value: 100, source: 'default' } }
```

Tracking the source is what lets the UI and `doctor` say "this value came from your env var".

**Strict schemas.** Each setting has a Zod schema in `settings.ts`. Env vars and flags are always text, so `fromText` converts text first (`"false"` becomes `false`), and the schema then checks strictly. We avoid `z.coerce.boolean()` because it uses JavaScript truthiness: any non-empty string, including `"false"`, becomes `true`. `PATHLIGHT_TRACKER_DISABLED=false` would then disable nothing wrongly, or worse, enable it. A strict schema plus our own small converter has no such surprise.

**Bad values do not stop the tool.** If a value is invalid (`--port abc`, a broken JSON file), `loadConfig` skips it, keeps the lower-precedence value, and adds a warning with a code (`CONFIG_INVALID_VALUE`, `CONFIG_FILE_INVALID`, `CONFIG_UNKNOWN_KEY`). The CLI prints the warnings and still starts. Reason: the user's app is more important than our config typo (user-flows §7).

**Stubs that name their task.** `dev`, `clear` and `doctor` are not built yet. They are handlers that print `"dev" is not built yet (task 2.12)` and exit 1. This makes `--help` and parsing testable now, and nobody mistakes a silent no-op for a working command. `createProgram(io, handlers)` takes the handlers as a parameter, so later tasks plug in real ones and tests plug in fakes.

## Why this way, not another
- Plain `process.argv` parsing: more code and no free `--help`; commander is the documented choice in `tech-stack.md`.
- Fail hard on a bad value: rejected, because a typo in an optional tuning knob should not block debugging.
- Coercing booleans: see above, silently wrong.

## Words to know
- **CLI**: a program driven from the terminal.
- **flag / option**: `--port 4000`, a named input.
- **argument**: a positional input (the user's command).
- **precedence**: which source wins when several set the same thing.
- **fallback**: the lower-priority value used when a higher one is invalid.
- **stub**: a placeholder that has the right shape but not the behaviour yet.

## Try it yourself
In `packages/collector`, read `config/load.test.ts`. Then add a temporary test (do not commit it): call `loadConfig({ projectRoot: '.', env: { PATHLIGHT_TRACKER_OPEN_BROWSER: 'false' }, flags: { port: 'abc' } })` and print the result. Check that `openBrowser` has `source: 'env'` and `port` is the default with a warning.

## Check yourself
1. In `a -- b`, who receives `b`, and why do we need the `--`?
2. Why is `z.coerce.boolean()` dangerous for `PATHLIGHT_TRACKER_DISABLED=false`?
3. The file says `port: 5000` but the env var is `PATHLIGHT_TRACKER_PORT=abc`. What port is used and what does the user see?
4. Why do the stub commands print their task number instead of doing nothing?

<details><summary>Answers</summary>

1. The user's own command (it is passed through untouched). The `--` marks where our flags end.
2. It turns any non-empty string into `true`, so `"false"` becomes `true`.
3. 5000 (from the file, `source: 'config-file'`), plus a `CONFIG_INVALID_VALUE` warning on the terminal.
4. A silent no-op looks like success; a clear message with exit code 1 says what is missing and which task builds it.
</details>

## Go deeper
- `docs/architecture.md` §8 (settings and env vars)
- `docs/user-flows.md` §7 (edge cases for bad config)
