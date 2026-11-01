---
paths:
  - "packages/collector/src/db/**"
  - "**/migrations/**"
  - "fixtures/seed/**"
---

# Database rules

- **Ask before any schema change** (table, column, index, constraint or enum) or migration. After approval: update `docs/data-model.md` first, generate the migration with `pnpm --filter @pathlight-tracker/collector db:generate`, and record it with `/new-decision`.
- Tables and columns are `snake_case`; JSON and API fields stay `camelCase`.
- Follow `docs/data-model.md` exactly, including soft delete, retention and purge (§7).
