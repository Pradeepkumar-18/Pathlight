# 0017 · Read-only MCP server moves to v1
Date: 2026-11-01 · Status: Accepted

## Context
The MCP server was planned for Future (task 8.1). AppMap already lets coding agents read its recordings through MCP (decision 0001).

## Decision
Ship a read-only MCP server in v1 (task 6.16, FR-54), so Claude Code or Cursor can read requests, steps and error paths. Same local token as the UI; nothing leaves the machine.

## Alternatives considered
Keep it in Future (AppMap would be the only option for AI agents for longer).

## Consequences
Plan: 8.1 removed, 6.16 added; 8.2 (AI explanation) now depends on 6.16. v1 has 16 tasks, Future 3.
