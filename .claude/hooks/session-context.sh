#!/usr/bin/env bash
# SessionStart hook: prints a short project status so every session starts from
# progress.md without reading the whole file (saves tokens). Never fails the session.

root="${CLAUDE_PROJECT_DIR:-.}"
progress=""
for f in "$root/docs/progress.md" "$root/Docs/progress.md"; do
  [ -f "$f" ] && progress="$f" && break
done
[ -z "$progress" ] && exit 0

# Rows of a "## <title>" table, skipping header, separator and "—" placeholder rows.
table_rows() {
  awk -v title="## $1" '
    $0 == title { inside = 1; next }
    inside && /^## / { exit }
    inside && /^\| / && !/^\| *(ID|Date|---)/ && !/^\| *— *\|/ { print }
  ' "$progress"
}

echo "## Project status (from $(basename "$(dirname "$progress")")/progress.md)"
grep -E '^\*\*(Current phase|Current task|Blockers):\*\*' "$progress"

in_progress=$(table_rows "In progress")
[ -n "$in_progress" ] && printf 'In progress:\n%s\n' "$in_progress"

bugs=$(table_rows "Known bugs / issues" | grep -v '| Fixed |' | grep -c '^|')
open_decisions=$(grep -c '❓ Open' "$progress")
echo "Open bugs: $bugs · Open decisions: $open_decisions"

echo "Next steps:"
awk '/^## Next steps/ { inside = 1; next } inside && /^(## |---)/ { exit } inside && /^[0-9]+\./ { print "  " $0 }' "$progress"

# Setup roadmap items triggered by the current or next task.
roadmap="$root/.claude/SETUP-ROADMAP.md"
task=$(grep -E '^\*\*Current task:\*\*' "$progress" | grep -oE '[0-9]+\.[0-9]+' | head -1)
if [ -f "$roadmap" ] && [ -n "$task" ]; then
  due=$(grep -E "^\| ⬜ \| $task \|" "$roadmap")
  [ -n "$due" ] && printf 'Claude setup due for task %s (.claude/SETUP-ROADMAP.md):\n%s\n' "$task" "$due"
fi

branch=$(git -C "$root" branch --show-current 2>/dev/null)
[ -n "$branch" ] && echo "Git branch: $branch"
exit 0
