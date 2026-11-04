#!/usr/bin/env bash
# PostToolUse hook: runs Prettier on the edited file so the assistant does not spend tokens on formatting.
# Plain bash on purpose: jq is not installed on every dev machine.

input=$(cat)
field() {
  printf '%s' "$input" | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -1
}

path=$(field file_path | tr '\\' '/')

if [ -n "$path" ] && [ -f "$path" ]; then
  case "$path" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.yml|*.yaml)
      npx prettier --write "$path" >/dev/null 2>&1
      ;;
  esac
fi

exit 0

