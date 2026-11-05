---
name: new-decision
description: Record a technical or product decision - decision record file, architecture table and progress.md.
argument-hint: "[short title]"
disable-model-invocation: true
---

Record the decision **$ARGUMENTS**.

Docs are in `docs/` (until task 0.7: `Docs/` with a `tracer-` prefix).

1. **Confirm the content with me first:** context (why it came up), the decision, alternatives considered, consequences (what it affects: docs, code, schema, phases). Ask if anything is unclear; don't guess.
2. **Write the record** at `docs/decisions/NNNN-<kebab-title>.md` (next free number, 4 digits; create the folder if missing):

   ```
   # NNNN · <Title>
   Date: YYYY-MM-DD · Status: Accepted | Superseded by NNNN

   ## Context
   ## Decision
   ## Alternatives considered
   ## Consequences
   ```
3. **Architecture decisions:** add a row to the decisions table in `architecture.md` §11.
4. **`progress.md` → Decisions:** add a row (or flip an existing `❓ Open` row to `✅ Decided`) linking the record.
5. **Update the affected docs** the decision changes, and list them for me. Don't change code in this skill.
6. **Setup roadmap.** List `⬜` rows in `.claude/SETUP-ROADMAP.md` whose trigger this decision fires (e.g. "Name decision"), and add a row if the decision needs a setup change.
