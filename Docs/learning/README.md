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

## Open questions
- Is there real demand for a Node runtime tracer? The research found little public evidence of AppMap users on Node (demand unproven).
- Hands-on AppMap checklist is pending until `fixtures/nestjs-app` exists (after task 0.6). Decision 0001 may change.
- BUG-001 (Windows long paths) is still open until the README note in task 0.7.
