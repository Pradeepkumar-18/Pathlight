#!/usr/bin/env bash
# Stop hook: when a task in progress.md is marked done and Docs/learning/ has no
# lesson for it yet, keep Claude going and have the teacher agent write one.
# Lessons are matched by the "Task <id>" marker the teacher writes in each lesson.

input=$(cat)
# Nudge once per stop; never loop if the teacher could not write the lesson.
printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true' && exit 0

root="${CLAUDE_PROJECT_DIR:-.}"
progress=""
for f in "$root/docs/progress.md" "$root/Docs/progress.md"; do
  [ -f "$f" ] && progress="$f" && break
done
[ -z "$progress" ] && exit 0
learning="$(dirname "$progress")/learning"

missing=""
for id in $(grep -oE '^\| [0-9]+\.[0-9]+ \|[^|]*\| ✅ \|' "$progress" | grep -oE '^\| [0-9]+\.[0-9]+' | tr -d '| '); do
  grep -rqsE "Task ${id//./\\.}([^0-9]|$)" "$learning" --include='*.md' || missing="$missing $id"
done
[ -z "$missing" ] && exit 0

missing=$(echo $missing | sed 's/ /, /g')
printf '{"decision":"block","reason":"Task(s) %s are done in progress.md but have no lesson yet. Use the teacher agent to write one lesson per task (it must include the line \\"Task <id>\\"), then show the user its summary and questions."}\n' "$missing"
exit 0
