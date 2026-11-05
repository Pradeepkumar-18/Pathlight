# Learning notebook

## Learner profile
- Owner of Pathlight Tracker, building it with AI help. Makes the product decisions themselves.
- Writes short, informal English. Keep words simple.
- Prefers practical explanations. Often asks "what is the use of X?" (e.g. pnpm, the AppMap check), so every lesson starts with the use.
- Asked about pnpm (answered in lesson 02). Likes real-world bugs tied to the task.
- Still unknown: how comfortable they are with Node internals (async, hooks) and TypeScript. Update after the next lessons.

## Lessons
1. [Validate against AppMap](01-validate-against-appmap.md) (Task 0.1)
2. [The monorepo: pnpm, Turborepo and strict TypeScript](02-monorepo-pnpm-turborepo.md) (Task 0.2)
3. [Linting and formatting: ESLint 9, Prettier and Lefthook](03-linting-and-formatting.md) (Task 0.3)
4. [Unit testing: Vitest and coverage](04-testing-setup-vitest.md) (Task 0.4)
5. [Continuous Integration: GitHub Actions and Changesets](05-ci-github-actions-changesets.md) (Task 0.5)

## Concepts learned
- Desk research vs hands-on test: [01](01-validate-against-appmap.md)
- Go / adjust / stop validation: [01](01-validate-against-appmap.md)
- How runtime recording tools work (instrument, record, show): [01](01-validate-against-appmap.md)
- Record-then-open vs live: [01](01-validate-against-appmap.md)
- MCP server (what it is, why it moved to v1): [01](01-validate-against-appmap.md)
- Decision records and why we keep them: [01](01-validate-against-appmap.md)
- What pnpm is for (workspaces, shared store, strictness, Corepack pinning): [02](02-monorepo-pnpm-turborepo.md)
- Monorepo and the protocol-only dependency rule: [02](02-monorepo-pnpm-turborepo.md)
- Turborepo: `^build`, outputs, caching: [02](02-monorepo-pnpm-turborepo.md)
- Strict TS base config, CommonJS for `--require`, ES2023, source maps: [02](02-monorepo-pnpm-turborepo.md)
- Why `engines` Node 24 is root-only; why pinned TS 5.9.3: [02](02-monorepo-pnpm-turborepo.md)
- Verify on a fresh clone; Windows 260-char path (BUG-001): [02](02-monorepo-pnpm-turborepo.md)
- ESLint 9 flat config + typescript-eslint v8 (`projectService`): [03](03-linting-and-formatting.md)
- Prettier 3 code formatting vs documentation preservation (`.prettierignore`): [03](03-linting-and-formatting.md)
- Lefthook git pre-commit hooks + auto re-staging (`stage_fixed: true`): [03](03-linting-and-formatting.md)
- PostToolUse formatting hook for automated token-free cleanup: [03](03-linting-and-formatting.md)
- Vitest root config + per-package `--dir src`, tests kept out of `dist/`: [04](04-testing-setup-vitest.md)
- Colocated unit tests (`foo.ts` → `foo.test.ts`): [04](04-testing-setup-vitest.md)
- V8 code coverage reports (`@vitest/coverage-v8`): [04](04-testing-setup-vitest.md)
- GitHub Actions CI matrix (`[ubuntu, macos, windows]` x Node 24, decision 0019): [05](05-ci-github-actions-changesets.md)
- Frozen lockfile verification in CI (`--frozen-lockfile`): [05](05-ci-github-actions-changesets.md)
- Monorepo package versioning & automated changelogs with Changesets: [05](05-ci-github-actions-changesets.md)

## Open questions
- Is there real demand for a Node runtime tracer? The research found little public evidence of AppMap users on Node (demand unproven).
- Hands-on AppMap checklist is pending until `fixtures/nestjs-app` exists (after task 0.6). Decision 0001 may change.
- BUG-001 (Windows long paths) is still open until the README note in task 0.7.
