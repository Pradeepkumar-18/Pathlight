# 24 · The launcher: `pathlight-tracker dev -- <command>`
2026-11-15 · Task 2.12 · `packages/collector/src/cli/dev.ts`, `cli/main.ts`, commit `45c2800`

## In one sentence
`dev` starts the collector, prints the map link with the token, runs your app with the agent preloaded, and stops everything cleanly with your app's exit code.

## Why we are doing this
The goal is "one command, zero setup": `pathlight-tracker dev -- node fixtures/express-app`. The user should not edit their app or set env vars by hand. The launcher does it for them.

## How it works
1. `startCollector` (lesson 23), then print `[pathlight-tracker] <version> · map: <url>/#token=<token>`.
2. Build the child's environment: the collector URL, the token, and `NODE_OPTIONS` with `--require "<agent path>"` **appended** to the user's own `NODE_OPTIONS`. The path is quoted so spaces survive.
3. Spawn the command with inherited stdio, so the app's output looks normal. Open the browser unless `--no-open`.
4. On Ctrl+C: POSIX forwards it to the app first; a second one force-stops. The CLI exits with the app's code (128 + signal number if a signal ended it), then stops the collector.
5. If the agent is not found, warn `AGENT_NOT_FOUND`; the app runs untraced (fail open, lesson 09). Packaging (task 5.6) will fix it.

**Windows traps (the teaching part).**
- `npm` and `npx` are `.cmd` shims, which only run through a shell, so we spawn via `cmd.exe`. But a shell joins words with plain spaces and does not quote: `C:\Program Files\nodejs\node.exe` splits into `C:\Program` and `Files\...`. `quoteForWindowsShell` quotes each word that has spaces or special characters.
- Killing the shell does **not** kill the app under it; the app would keep running and hold the port. So we stop the whole tree with `taskkill /T`.

**A CI-only race (commit 45c2800).** The test's stand-in app wrote its "ready" file *before* installing its SIGINT handler. On a fast CI machine the test sent Ctrl+C in between, and the default handler killed the app with the wrong code. Fix: install the handler first, then signal ready. General rule: announce readiness only when you really are ready.

## Why this way, not another
- Always `shell: true`: easy but breaks quoting on POSIX too; we use it only on Windows.
- Asking users to set `NODE_OPTIONS` themselves: error-prone, and it would overwrite theirs.

## Words to know
- **shim**: a small launcher script (`npm.cmd`) standing in for the real program.
- **process tree**: a process and all its children.
- **exit code 128 + n**: shell convention for "killed by signal n".
- **race condition**: result depends on timing.

## Try it yourself
Run `pnpm build`, then `node packages/collector/dist/cli/main.js dev --no-open -- node fixtures/express-app`. Press Ctrl+C and check the exit code with `echo $?`.

## Check yourself
1. Why append to `NODE_OPTIONS` rather than set it?
2. Why `taskkill /T` on Windows?
3. What was wrong in the CI test race?

<details><summary>Answers</summary>

1. The user may already use `NODE_OPTIONS`; replacing it would break their setup.
2. Killing `cmd.exe` leaves the app running; `/T` kills the children too.
3. The app said "ready" before it could handle SIGINT, so an early signal killed it.
</details>

## Go deeper
- `docs/user-flows.md` §5, lesson [14](14-cli-and-config-loading.md)
