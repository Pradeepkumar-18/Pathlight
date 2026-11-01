---
name: finish-task
description: Finish the current task - verify "Done when", run checks, update progress.md, commit, draft the PR and record the lesson.
disable-model-invocation: true
---

Finish the task that is `🟡` in `progress.md` → "In progress".

Docs are in `docs/` (until task 0.7: `Docs/` with a `tracer-` prefix).

1. **Verify "Done when".** Re-read it and show, point by point, how it is met (tests, files, output). If it is not met, stop and tell me what is missing.
2. **Run checks** that exist so far: `pnpm lint && pnpm typecheck && pnpm test`, plus `pnpm test:corpus` for agent changes and `pnpm test:e2e` for UI or API changes. Before tasks 0.3 / 0.4 some scripts don't exist yet; say which were skipped. If a check fails, fix the cause; never weaken a test.
3. **Review** with the `reviewer` and `spec-checker` agents if they exist in `.claude/agents/`; fix real findings.
4. **Update `progress.md`:**
   - task status `✅` (or `⛔` with the reason) and PR link if known; the phase's Done count in Summary
   - remove the row from **In progress**; update **Current task** / **Next steps**
   - bugs found and not fixed → **Known bugs / issues**; decisions made → **Decisions**
   - fill in the log entry (template at the top of the Log)
5. **Setup roadmap.** Mark `✅` any `.claude/SETUP-ROADMAP.md` rows done in this task; add rows for any new setup idea that came up. If the next item in the plan is a checkpoint (`✔` row) or a new phase, list the `⬜` rows triggered by `Checkpoint N`, `Each checkpoint` or `Phase N` and remind me.
6. **Commit** with a Conventional Commit message. Don't push unless I ask.
7. **PR description:** task ID, what changed, docs sections followed, how it was tested, `progress.md` updated (yes/no). Show it to me.
8. **Teach.** The `lesson-check.sh` Stop hook makes the `teacher` agent write the lesson automatically once the task is ✅; show me its summary and questions.
9. Tell me to run `/clear` before the next task.
