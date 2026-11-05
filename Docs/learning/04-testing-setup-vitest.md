# 04 · Unit testing: Vitest, workspaces and coverage
2026-11-04 · Task 0.4 · `vitest.config.ts`, `vitest.workspace.ts`, `packages/*/src/index.test.ts`, `.claude/rules/testing.md`

## In one sentence
We use Vitest to run unit tests across all monorepo packages in parallel, place tests right next to the code they verify, and measure code coverage with v8.

## Why we are doing this
Pathlight Tracker exists to show what code actually does; our own code must be thoroughly tested:
1. **Speed and modern ESM support**: Vitest runs natively in Node with worker threads, executing tests across multiple packages in parallel in seconds.
2. **Monorepo workspaces**: `vitest.workspace.ts` allows a single `pnpm test` command to test all packages (`protocol`, `agent`, `collector`, `ui`) in one unified run, while still allowing developers to run tests in a single package (`pnpm --filter @pathlight-tracker/agent test`).
3. **Colocated tests**: Tests live right next to the source files (`index.ts` → `index.test.ts`). This makes it obvious when a file lacks tests and keeps tests up to date when files are refactored.

## How it works

### 1. Vitest Workspace Configuration
- `vitest.workspace.ts` defines `['packages/*']`, auto-discovering all packages in the monorepo.
- `vitest.config.ts` sets global test defaults (Node environment, coverage configuration).
- Each package defines `"test": "vitest run"` in its `package.json`.
- Root `package.json` defines `"test": "vitest run"` and `"test:coverage": "vitest run --coverage"`.

### 2. Colocation Convention
In accordance with `CLAUDE.md`, tests live next to the code:
```text
packages/
  protocol/src/
    index.ts
    index.test.ts
  agent/src/
    index.ts
    index.test.ts
  collector/src/
    index.ts
    index.test.ts
  ui/src/
    index.ts
    index.test.ts
```

### 3. V8 Coverage
`@vitest/coverage-v8` measures execution coverage using Node's built-in V8 coverage engine:
- Fast and accurate statement, branch, function, and line coverage.
- Generates text, HTML, and JSON summaries.
- `coverage/` output is git-ignored.

## Why this way, not another
- **Vitest vs Jest**: Jest requires heavy babel/ts-jest configuration and has notorious friction with modern ESM and monorepos. Vitest works out of the box with TypeScript.
- **Colocated tests vs top-level `tests/` folder**: Top-level `tests/` folders drift out of sync with code over time. Colocated tests make coverage visible at a glance. We reserve `tests/` strictly for cross-package suites (`tests/behaviour-corpus/`, `tests/bench/`, `tests/e2e/`).

## Words to know
- **Unit test**: A fast, isolated test that exercises one function or module.
- **Colocation**: Storing test files and implementation files in the same directory.
- **V8 Coverage**: Code coverage metrics generated directly by the V8 JavaScript engine.
- **Workspace runner**: A test runner capable of discovering and executing tests across multiple independent packages in a monorepo.

## Try it yourself
1. Run `pnpm test` to see all 4 packages tested in parallel.
2. Run `pnpm test:coverage` to see the V8 statement/branch/function coverage table.
3. Run `pnpm --filter @pathlight-tracker/agent test` to test just one package.

## Check yourself
1. Where should unit tests live in this repository?
2. What command runs unit tests across the entire monorepo?
3. What is the role of `vitest.workspace.ts`?

<details>
<summary>Answers</summary>

1. Right next to the code they test (`foo.ts` → `foo.test.ts`).
2. `pnpm test` (or `pnpm test:coverage` with coverage).
3. It declares all workspace packages (`packages/*`) so Vitest can find and run tests across the whole monorepo in one run.
</details>

## Go deeper
- [Vitest Workspace Guide](https://vitest.dev/guide/workspace)
- [Vitest Coverage Guide](https://vitest.dev/guide/coverage)

