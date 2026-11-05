# 04 · Unit testing: Vitest and coverage
2026-11-04 · Task 0.4 · `vitest.config.mts`, `packages/*/src/index.test.ts`, `packages/*/tsconfig.build.json`, `.claude/rules/testing.md`

## In one sentence
We use Vitest to run unit tests across all monorepo packages in parallel, place tests right next to the code they verify, keep them out of production builds via `tsconfig.build.json`, and measure code coverage with v8.

## Why we are doing this
Pathlight Tracker exists to show what code actually does; our own code must be thoroughly tested:
1. **Speed and modern ESM support**: Vitest runs natively in Node with worker threads, executing tests across multiple packages in parallel in seconds.
2. **Unified monorepo test runner**: The root `vitest.config.mts` uses `include: ['packages/*/src/**/*.test.ts']` to allow a single `pnpm test` command to test all packages (`protocol`, `agent`, `collector`, `ui`) in one unified run, while each package runs scoped tests via `vitest run --dir src` (e.g. `pnpm --filter @pathlight-tracker/agent test`).
3. **Colocated tests**: Tests live right next to the source files (`index.ts` → `index.test.ts`). This makes it obvious when a file lacks tests and keeps tests up to date when files are refactored.
4. **Clean build artifacts**: Packages must not emit test files or test declarations into their `dist/` output.

## How it works

### 1. Root Configuration & Package Test Scripts
- `vitest.config.mts` sets global test defaults (Node environment, coverage configuration) and discovers all test suites with `include: ['packages/*/src/**/*.test.ts']`.
- Each package defines `"test": "vitest run --dir src"` in its `package.json` so local runs only execute tests within that package's source directory.
- Root `package.json` defines `"test": "vitest run"` and `"test:coverage": "vitest run --coverage"`.

### 2. Keeping Tests Out of Build Output (`tsconfig.build.json`)
- Each package provides a `tsconfig.build.json`:
  ```json
  {
    "extends": "./tsconfig.json",
    "exclude": ["src/**/*.test.ts"]
  }
  ```
- The package `build` script runs `tsc -p tsconfig.build.json`, ensuring `dist/` contains only runtime artifacts.
- The package `typecheck` script runs `tsc -p tsconfig.json --noEmit`, ensuring test files are still strictly type-checked.

### 3. Colocation Convention
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

### 4. V8 Coverage
`@vitest/coverage-v8` measures execution coverage using Node's built-in V8 coverage engine:
- Fast and accurate statement, branch, function, and line coverage.
- Generates text, HTML, and JSON summaries.
- `coverage/` output is git-ignored.

## Why this way, not another
- **Vitest vs Jest**: Jest requires heavy babel/ts-jest configuration and has notorious friction with modern ESM and monorepos. Vitest works out of the box with TypeScript.
- **Root include vs vitest workspaces**: Vitest 5 deprecated `defineWorkspace` in favor of project configs; a root `include` combined with per-package `--dir src` is simpler, faster, and avoids TS2305 errors.
- **`tsconfig.build.json` vs global ignores**: Using a dedicated build tsconfig guarantees tests are never compiled into `dist/` while preserving full IDE type-checking and type verification in CI.

## Words to know
- **Unit test**: A fast, isolated test that exercises one function or module.
- **Colocation**: Storing test files and implementation files in the same directory.
- **V8 Coverage**: Code coverage metrics generated directly by the V8 JavaScript engine.
- **Build config (`tsconfig.build.json`)**: A specialized TypeScript configuration used solely for production compilation.

## Try it yourself
1. Run `pnpm test` to see all 4 packages tested in parallel.
2. Run `pnpm test:coverage` to see the V8 statement/branch/function coverage table.
3. Run `pnpm --filter @pathlight-tracker/agent test` to test just one package.
4. Run `pnpm build` and verify `packages/agent/dist` does not contain `index.test.js`.

## Check yourself
1. Where should unit tests live in this repository?
2. What command runs unit tests across the entire monorepo?
3. How do we prevent test files from ending up in `dist/`?

<details>
<summary>Answers</summary>

1. Right next to the code they test (`foo.ts` → `foo.test.ts`).
2. `pnpm test` (or `pnpm test:coverage` with coverage).
3. By building with `tsconfig.build.json` which excludes `src/**/*.test.ts`.
</details>

## Go deeper
- [Vitest Coverage Guide](https://vitest.dev/guide/coverage)
- [Vitest CLI Options](https://vitest.dev/guide/cli.html)
