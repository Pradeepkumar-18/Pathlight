# GEMINI.md

> See [`AGENTS.md`](./AGENTS.md) and [`CLAUDE.md`](./CLAUDE.md) for full project rules, conventions, and workflows.

## Gemini-Only Autonomous Operation & Permission Rule
This permission policy applies **strictly to Gemini / Antigravity**:
- **Autonomous Execution**: Proceed automatically without prompting the user for confirmation on routine operations (creating/editing files, running commands, builds, package scripts, running tests, or documentation updates).
- **ONLY ask explicit permission before:**
  1. **`git commit`**: Running `git commit` or creating any commit.
  2. **File deletion**: Deleting or removing any existing file or directory.
