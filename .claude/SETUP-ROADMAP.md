# Claude setup roadmap

Planned changes to the Claude Code setup (`CLAUDE.md`, `.claude/`), tied to the task that triggers them so they are not forgotten.

- The `SessionStart` hook shows rows whose **Trigger** matches the current task.
- `/start-task` lists rows for the task being started; `/finish-task` marks them `✅`.
- Rows with a phase or checkpoint trigger: `/start-task` lists them on the first task of a phase; `/finish-task` lists them when the next item is a checkpoint or a new phase.
- Rows with a decision trigger: `/new-decision` lists them.
- Rows with another event trigger (e.g. Gemini joins): check this file whenever that happens.

Status: ⬜ To do · ✅ Done · ⏭️ Dropped (with reason)

## Done (initial setup, 2026-10-30)

- Slim `CLAUDE.md`; package rules moved to `.claude/rules/` (`agent`, `collector`, `database`, `ui`), loaded only for matching paths
- `settings.json`: read-only git and pnpm check commands allowed; `.env`, `*.db`, `rm -rf`, force push denied
- Hooks: `session-context.sh` (status from `progress.md` at session start), `ask-before-change.sh` (permission prompt for schema, migrations, tokens, dependencies, env), `lesson-check.sh` (Stop hook: teacher writes a lesson for every finished task, added 2026-11-01)
- Agents: `spec-reader` (Haiku), `teacher` (Sonnet), `product-analyst` (Opus)
- Skills: `/start-task`, `/finish-task`, `/new-decision`

## Upcoming

| Status | Trigger | Change | Why |
| --- | --- | --- | --- |
| ⬜ | 0.2 | Add `reviewer` agent (Sonnet, read-only): checks the diff against CLAUDE.md, `.claude/rules/` and the task's "Done when"; every finding has file, problem, fix | First code arrives; `/finish-task` already calls it if present |
| ⬜ | 0.2 | Add `spec-checker` agent (Sonnet, read-only): compares the finished task with the PRD and user flows, reports missing / extra / different | A second agent checks work it didn't write |
| ⬜ | 0.2 | Check `settings.json` allow list matches the real `package.json` scripts; check hook paths (`db/schema`, `migrations`, `ui/src/theme`) match the real layout | Layout becomes real |
| ⬜ | 0.2 | Consider a `.claude/settings.local.json` for personal overrides (gitignored already) | Only if you need different permissions than the team |
| ⬜ | 0.3 | Add `PostToolUse` hook on `Edit\|Write`: run Prettier on the edited file (plain bash parsing like `ask-before-change.sh`, no jq) | Formatting without spending tokens on it |
| ⬜ | 0.4 | Add `test-runner` agent (Haiku): runs the checks and returns only failures; use it in `/finish-task` | Test output is long; keeps it out of the main context |
| ⬜ | 0.4 | Add `.claude/rules/testing.md` for `**/*.test.ts` and `tests/**` with the conventions the testing setup establishes (runner, file placement, fixtures) | Test conventions only become real in 0.4 |
| ⬜ | 0.7 | Docs move: replace `Docs/tracer-*.md` paths and the "Until task 0.7" notes in `CLAUDE.md`, all agents, skills and `session-context.sh`; move `Docs/learning/`, `Docs/analysis/` and `Docs/decisions/` to `docs/`; `Docs/cursorrules` → root `.cursorrules`; decide where `vibe-coding-setup-guide.md` lives | Paths change |
| ⬜ | 0.7 | Point `.cursorrules` at the same rules (`.claude/rules/`) so nothing is duplicated | One source of truth |
| ⬜ | Checkpoint 0 | Run `product-analyst` on the whole product (gap vs AppMap and others) before committing to Phase 1 | Cheapest moment to change direction |
| ⬜ | 2.1 | Add `.claude/rules/protocol.md` once conventions are real; after 2.1, add `packages/protocol/` to `ask-before-change.sh` (changes = event protocol = architecture) | Not guarded during creation to avoid prompt noise |
| ⬜ | 2.3 | Re-check `database.md` rule paths and hook paths against the real Drizzle schema / migration folders | Exact paths known |
| ⬜ | Phase 3 | Re-check `agent.md` rule; make `test-runner` include `pnpm test:corpus` for agent changes | Corpus is the safety net |
| ⬜ | 4.1 | Re-check `ui.md` rule paths and theme path; consider a `design-check` agent comparing screens to `design.md` | UI work starts |
| ⬜ | Each checkpoint | Trim `CLAUDE.md` (keep under ~150 lines), prune rules nobody needs, review memory, review this file; run `product-analyst` on the next phase | Keeps always-loaded context small |
| ✅ | Name decision | Done 2026-11-01: renamed to `pathlight-tracker` in docs, README, CLAUDE.md, rules and agents (decision 0003). Optional: rename the GitHub repo to `pathlight-tracker` | Cheaper before code exists |
| ⬜ | 7.1 | Add `.claude/rules/extension.md` for `packages/extension/**` | VS Code extension work |
| ⬜ | 8.1 | Add project `.mcp.json` to use Pathlight's own MCP server while developing it | Dogfooding |
| ⬜ | Gemini / Antigravity joins | Add its rules file pointing to `CLAUDE.md` + `.claude/rules/` instead of copying them | One source of truth |
