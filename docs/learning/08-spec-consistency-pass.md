# 08 · Spec consistency pass: fix the docs before writing code
2026-11-06 · Task 0.8 · `docs/analysis/2026-11-01-spec-audit.md`, `docs/analysis/2026-11-06-spec-audit-resolution.md`, `docs/decisions/0021-spec-consistency-choices.md`

## In one sentence
Task 0.8 went through every problem found in the spec audit and made all the documents agree, so the coding phases do not have to guess.

## Why we are doing this
Pathlight has many specs (PRD, architecture, API, data model, UI design). They were written at different times, and over time they drift: one says 24-character IDs, another 26; one says a step is "caught", another "swallowed".

Why this matters before coding: an AI (or a person) building task 2.3 reads one doc and builds exactly that. If another doc says something different, the bug is not in the code, it is in the spec, and you only find it weeks later when the parts do not fit. Fixing a sentence costs minutes. Fixing a database that shipped with the wrong column costs a migration.

## How it works

### The audit and the resolution
- `2026-11-01-spec-audit.md` is the list of problems (about 70 items, 6 big ones).
- `2026-11-06-spec-audit-resolution.md` answers each item with a status: **Fixed** (the docs now agree), **Decision** (a decision record settled it), or **Linked** (the docs say which later task settles the detail). Nothing is left open.

### The master copy
When the same thing is described in several places, pick one place as the master and make the others link to it. For agent messages the master is `api-spec.md` §11.1 (the event list: `request.start`, `step.enter`, `step.exit`, `warning`, ...). `architecture.md` §3d now only summarises and points there. One list to update, one list to trust.

### Decision records vs open choices
Some fixes just follow earlier decisions (0003 to 0016). But some needed a new concrete choice, for example the exact name of a new event field, or WebSocket close code `4008`. Those touch areas `CLAUDE.md` says "ask before changing" (protocol, schema, env vars). So they are collected in decision **0021**, status **Proposed**: written down, but not yet approved. You approve or change them in the Phase 0 PR review. If you change one, update the spec and the record before Phase 1.

### Four examples worth understanding

**1. `auto_vacuum` must be set before any table.** SQLite does not give file space back when you delete rows. The file stays big, and deleted data may still be inside it. `PRAGMA auto_vacuum = INCREMENTAL` lets SQLite really remove it. But it only takes effect if set before the first table is created (later you need a slow full `VACUUM`). Pathlight promises that purged data is gone, so this line goes first in the schema (`data-model.md` §2 and §9).

**2. IDs are 26 characters.** A ULID is 26 characters. The seed and examples had 24-character ones, so a validator written for the real format would reject the sample data. Fixed everywhere. Object IDs (`obj_17`) are different: the agent counts them, they are not ULIDs.

**3. The red error path rule.** A function may throw and the error be caught and ignored (swallowed). Only the error that actually reached the response is red; swallowed ones show as "caught" in violet (decision 0010). The seed had an `if` step on the red path although it did not throw. Fixed: the red path ends at the step that threw.

**4. Prove the seed in real SQLite.** Reading sample data is not enough. The seed was run in a real SQLite database: 3 requests, 14 steps, and no foreign-key violations. That is a cheap way to catch typos in IDs and links between rows.

## Why this way, not another
- **Leave gaps for the tasks that implement them**: rejected. The audit's point was that the builder would have to guess.
- **One decision record per item**: rejected as noise. Small choices are grouped in 0021 and reviewed once.
- **Mark them accepted right away**: rejected, because they cover protocol and schema, which need your approval.

## Words to know
- **Spec drift** → docs slowly disagreeing with each other.
- **Master copy** → the one doc that owns a fact.
- **Decision record** → a short file saying what was chosen and why.
- **Proposed** → written down, waiting for approval.
- **ULID** → sortable unique ID, 26 characters.
- **Foreign key (FK)** → a column that must point at a real row in another table.
- **`PRAGMA`** → a SQLite setting command.

## Try it yourself
1. Open `docs/data-model.md` near line 401 and find the `auto_vacuum` line. Is it above the first `CREATE TABLE`?
2. Search `docs/architecture.md` and `docs/data-model.md` for "caught" and check both use the same meaning.
3. Read decision 0021 and pick one item you disagree with. Note it for the PR review.

## Check yourself
1. Why fix the specs before starting Phase 1?
2. What is a "master copy", and which section is it for agent events?
3. Why is decision 0021 "Proposed" and not "Accepted"?
4. Why must `auto_vacuum` be set before the first table?
5. Why run the seed in a real SQLite database instead of just reading it?

<details><summary>Answers</summary>

1. Builders follow the spec literally. Conflicts become bugs found late, and schema mistakes need migrations.
2. One doc that owns a fact; others link to it. `api-spec.md` §11.1.
3. It changes protocol, schema and env vars, which need the owner's approval.
4. SQLite only applies it to a new database before tables exist; later it needs a full `VACUUM`. Without it, purged data stays in the file.
5. Running it catches wrong IDs and broken foreign keys that reading misses (3 requests, 14 steps, zero violations).
</details>

## Go deeper
- `docs/analysis/2026-11-06-spec-audit-resolution.md` (the "6 biggest problems" table).
- `docs/decisions/0010-error-path-and-swallowed-errors.md` and `docs/decisions/0011-schema-gaps.md`.
