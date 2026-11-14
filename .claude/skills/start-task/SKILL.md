---
name: start-task
description: Start a task from the implementation plan - checks dependencies, uses the phase branch, updates progress.md and plans the work.
argument-hint: "[task ID, e.g. 2.3]"
disable-model-invocation: true
---

Start task **$ARGUMENTS** (if empty, use the "next" task from the top of `progress.md`).

1. **Find the task.** Grep its row in `implementation-plan.md` (`| <id> |`): description, dependencies, "Done when". Tell me the task and its "Done when" in 2–3 lines.
2. **Check dependencies.** Every dependency must be `✅` in `progress.md`. If not, stop and tell me.
3. **Check the Claude setup roadmap.** Look in `.claude/SETUP-ROADMAP.md` for `⬜` rows whose trigger is this task ID, or `Phase N` if this is the first task of phase N. List them and ask whether to do them first.
4. **Branch.** One branch per phase, not per task. If the phase branch `phase/<N>-<short-name>` exists, switch to it; otherwise create it from an up-to-date `main`.
5. **Update `progress.md`:** task status `🟡`, **Current phase** / **Current task**, a row in **In progress** (ID, task, today's date), and a log entry stub with the "Done when" copied in. Update the Summary row's status for the phase if it was `⬜`.
6. **Plan.** List the spec sections this task needs (use the `spec-reader` agent for lookups instead of reading whole specs), the files you expect to touch, and the tests that prove "Done when". Flag anything from CLAUDE.md "Ask before changing".
7. **Stop and wait for my go-ahead** before writing code.
