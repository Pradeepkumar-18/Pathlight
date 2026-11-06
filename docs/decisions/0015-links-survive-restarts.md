# 0015 · Saved links survive restarts
Date: 2026-11-01 · Status: Accepted

## Context
The port and token changed on every collector start, so saved or pasted links broke and landed on the Connect screen.

## Decision
Fixed default port (next free one if busy) and a per-project token kept in `.pathlight-tracker/`, so links keep working. Deleting the token file rotates it. The exact port number and storage are set in task 2.7.

## Alternatives considered
Accept broken links (worse experience); fixed port only (the token still changes).

## Consequences
Security trade-off: the token lives longer. It is still local-only, bound to `127.0.0.1`, with origin and host checks, and readable only by the same user who can already read the database. Architecture §4 and §11 #19, API spec and tech stack updated; PRD FR-47.
