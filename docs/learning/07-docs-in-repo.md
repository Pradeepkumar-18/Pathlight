# 07 · Docs in the repo: one place, one name, one source of truth
2026-11-06 · Task 0.7 · `docs/`, `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `README.md`, `CONTRIBUTING.md`

## In one sentence
Task 0.7 moved all specs into a lower-case `docs/` folder with short names, fixed every path that pointed to them, and made sure each rule is written in only one place.

## Why we are doing this
Specs are only useful if people (and AI assistants) can find them. Before this task:
- The folder was `Docs/` and files were named `tracer-prd.md`, `tracer-api-spec.md`. "tracer" was the old working name (decision 0003 renamed the product).
- Rules were copied into several files (`CLAUDE.md`, `.cursorrules`, `AGENTS.md`). Copies drift apart. Then the AI follows one copy and you read another.
- A new contributor had no clear "how do I set this up" path, and the Windows long-path problem (BUG-001, see [lesson 02](02-monorepo-pnpm-turborepo.md)) was still open.

## How it works

### 1. Renaming `Docs/` to `docs/` on Windows
Windows treats `Docs` and `docs` as the same name. Git, however, tracks case. If you rename directly, Git may see "nothing changed". The trick is two steps:

```
git mv Docs docs-tmp
git mv docs-tmp docs
```

The first move is a real change, the second lands on the final name. Git now records the rename, so Linux and macOS (CI runs on both, [lesson 05](05-ci-github-actions-changesets.md)) see `docs/`, not `Docs/`.

Dropping the prefix: `Docs/tracer-api-spec.md` became `docs/api-spec.md`. Git shows this as a rename, so history is kept.

### 2. Updating every path
Every file that mentioned the old paths was edited: `CLAUDE.md`, `AGENTS.md`, `README.md`, the `.claude/` agents, skills and hooks, and links between the specs. A broken path fails silently: an AI agent just does not find the spec and guesses. That is why this was a whole task.

### 3. One source of truth
`.cursorrules` (used by the Cursor editor) now only says "read `CLAUDE.md` and `.claude/rules/`". It no longer holds its own copy of the rules. Rule of thumb: when a rule changes, you should have to edit exactly one file.

### 4. README and CONTRIBUTING
The README has a 7-step setup and a troubleshooting section. The key entry is BUG-001: on Windows, deep `node_modules` paths can pass 260 characters and installs fail. The fix is to enable long paths and keep the repo path short. `CONTRIBUTING.md` explains how to work on the project.

### 5. Commands "from task X"
The `CLAUDE.md` commands table lists commands such as `pnpm dev:nest` that only exist after a later task. They are now marked "from task X" so nobody (human or AI) runs a command that is not built yet and thinks the repo is broken.

### 6. New rule: one branch and one PR per phase
Before: one PR per task. Now: one branch (this one is `phase/0-setup-finish`) and one pull request for a whole phase. Fewer, bigger reviews, and you review the phase as a whole. Tasks are still done and logged one at a time in `progress.md`.

## Why this way, not another
- **Keep `Docs/` and the prefix**: less work now, but permanent confusion with the old name, and a case problem on Linux.
- **Keep a full copy of the rules in `.cursorrules`**: works with Cursor out of the box, but two copies will disagree. We chose a pointer.
- **One PR per task**: smaller reviews, but many PRs for tiny doc work. You chose one per phase.

## Words to know
- **Source of truth** → the one place a fact lives; everything else links to it.
- **`git mv`** → move a file and tell Git it is the same file (keeps history).
- **Case-insensitive file system** → `Docs` and `docs` are one name (Windows, default macOS).
- **Cross-reference** → a link from one doc to another; breaks when files move.
- **Phase branch** → one long branch for a whole phase of the plan.

## Try it yourself
1. Run `git log --follow --oneline docs/api-spec.md` and see that history goes back to when it was `Docs/tracer-api-spec.md`.
2. Search `CLAUDE.md`, `AGENTS.md`, `README.md` and `.claude/` for the text `Docs/`. Which hits remain, and are they on purpose?
3. Open `.cursorrules` and count how many rules it holds itself.

## Check yourself
1. Why did the rename to `docs/` need two `git mv` steps?
2. Why is `.cursorrules` just a pointer now?
3. Why mark some commands "from task X" in `CLAUDE.md`?
4. What changes with "one branch and one PR per phase"?

<details><summary>Answers</summary>

1. Windows ignores case, so a one-step rename looks like no change to Git. Going through a temporary name forces a real rename.
2. So the rules exist in one file only. Copies drift apart.
3. Those commands do not exist yet. Marking them stops people from thinking a missing command is a bug.
4. Several tasks share one branch and one pull request. You review the whole phase at once; `progress.md` still tracks each task.
</details>

## Go deeper
- `CONTRIBUTING.md` and the README troubleshooting section (BUG-001).
- `CLAUDE.md`: "Docs: what to read and when" and "Commit and PR format".
