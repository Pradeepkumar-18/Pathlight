---
paths:
  - "packages/collector/**"
---

# Collector rules

- Reject invalid input with the error envelope and codes from `docs/api-spec.md` §8; one bad message must never stop ingest or crash the server.
- Log errors with pino, with a code and context, never captured values.
- Any API change runs `pnpm test:e2e` before it is done.
- Database work: see `.claude/rules/database.md`.
