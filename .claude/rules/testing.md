---
paths:
  - '**/*.test.ts'
  - 'tests/**'
---

# Testing conventions

- **Runner**: Vitest is the unit test runner across all packages (`pnpm test` or `pnpm --filter <pkg> test`).
- **Placement**: Unit tests live directly next to the code they test: `foo.ts` → `foo.test.ts`.
- **Coverage**: Coverage is measured via `@vitest/coverage-v8` (`pnpm test:coverage`).
- **Independence**: Tests must be self-contained and runnable in any order without shared mutable state.
- **Assertion style**: Use Vitest's `describe`, `it`, and `expect(...)` API.
- **No weakening**: Never skip or weaken a failing test to make checks pass. Always fix the root cause.
