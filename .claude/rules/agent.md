---
paths:
  - "packages/agent/**"
  - "tests/behaviour-corpus/**"
---

# Runtime agent rules

- **The user's app always wins.** Wrap every hook, patch and runtime helper in `try/catch`; count internal errors, never rethrow them into user code; fail open to "not traced".
- Keep the agent tiny: few dependencies, no blocking I/O, nothing that can throw into user code.
- Don't write instrumented code to disk, use `eval` / `new Function`, monkey-patch globals, or call getters / `toJSON` on captured user objects.
- Log internal errors with the `[tracer]` logger, with a code and context, never captured values.
- Every agent change runs `pnpm test:corpus` before it is done.
- Details: `docs/architecture.md` (agent sections), `docs/api-spec.md` (event protocol).
