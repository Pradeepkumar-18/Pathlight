#!/usr/bin/env bash
# PreToolUse hook: turns CLAUDE.md "Ask before changing" into a real permission
# prompt for schema, migrations, design tokens, dependencies, env files and the
# shared protocol package (tests excluded).
# Plain bash on purpose: jq is not installed on every dev machine.

input=$(cat)
field() {
  printf '%s' "$input" | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -1
}

path=$(field file_path | tr '\\' '/')
cmd=$(field command)
reason=""

case "$path" in
  */migrations/*|*/db/schema*|*/collector/src/store/schema.ts|*/collector/drizzle/*) reason="the database schema or a migration" ;;
  */packages/ui/src/theme/*) reason="design tokens" ;;
  */package.json|*/pnpm-lock.yaml|*/pnpm-workspace.yaml) reason="dependencies or the workspace" ;;
  */.env|*/.env.*) reason="an env file" ;;
  */packages/protocol/src/*.test.ts|*/packages/protocol/src/spec-examples.ts) ;;
  */packages/protocol/src/*) reason="the event protocol or API contract (packages/protocol)" ;;
esac

if [ -z "$reason" ] && printf '%s' "$cmd" |
  grep -Eq '(^|[;&|] *)(pnpm|npm|yarn) +(add|remove|rm|up|upgrade|update|uninstall|(install|i) +[^-])'; then
  reason="dependencies"
fi

if [ -n "$reason" ]; then
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"CLAUDE.md: ask before changing %s. Approve only if you already agreed to this change."}}\n' "$reason"
fi
exit 0
