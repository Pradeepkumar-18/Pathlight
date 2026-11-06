# Contributing

Pathlight Tracker is built task by task from [docs/implementation-plan.md](docs/implementation-plan.md), mostly with AI coding assistants. These rules keep that work small, reviewable and in line with the specs. Setup steps are in the [README](README.md); rules for AI assistants are in [CLAUDE.md](CLAUDE.md).

## Session rules

These come from the implementation plan, §2.

| Rule | Detail |
| --- | --- |
| One task per session | Pick the next task in [docs/progress.md](docs/progress.md). Don't combine tasks in one session. |
| One branch and one PR per phase | Commit each task on the phase branch (`phase/<N>-<short-name>`). Open the PR when the phase's last task is done. |
| Start with context | Read the task's row (description, dependencies, "Done when") and only the spec sections it names. |
| Tests in the same change | A task isn't done until its tests pass. |
| Definition of done | Code + tests + `pnpm lint && pnpm typecheck && pnpm test` pass + docs updated if behaviour changed + `progress.md` updated. |
| If a task grows | Split it. Add the new task right after it, with its own "Done when", in both the plan and `progress.md`. |
| Never skip a checkpoint | Each phase ends with a review checkpoint; fix its findings before the next phase. |

With Claude Code, `/start-task <id>` and `/finish-task` do the bookkeeping: dependency check, branch, `progress.md`, reviews and the lesson.

## Before you change these, ask first

Database schema, architecture or package boundaries, REST endpoints, WebSocket messages, error codes, env vars, dependencies, design tokens, or moving a feature between phases. The full list and how to ask are in [CLAUDE.md](CLAUDE.md) → "Ask before changing". Decisions are recorded in [docs/decisions/](docs/decisions/).

## Commits and PRs

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(collector): …`, `fix(agent): …`, `test: …`, `docs: …`.
- The pre-commit hook (lefthook) formats and lints staged files.
- PR description: the phase, each task ID and what changed, the docs sections followed, how it was tested, and whether `progress.md` was updated.
- CI must be green on Ubuntu, macOS and Windows before merging.
