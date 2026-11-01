# 0003 · Product name: pathlight-tracker
Date: 2026-11-01 · Status: Accepted

## Context
"Tracer" was a working name. The npm names `tracer` and `pathlight` are both taken; `pathlight-tracker` is free (checked 2026-11-01).

## Decision
The one name is **pathlight-tracker**: npm package, CLI (`npx pathlight-tracker dev`), internal workspace scope `@pathlight-tracker/*` (private, not published), env prefix `PATHLIGHT_TRACKER_`, folder `.pathlight-tracker/`, config `pathlight-tracker.config.json`, logger `[pathlight-tracker]`. In prose it is written "Pathlight Tracker". The agent package is `@pathlight-tracker/agent` (replaces `@tracer/register`).

## Alternatives considered
`pathlight` (taken on npm); `tracer` (taken, generic).

## Consequences
All docs, `CLAUDE.md`, rules and agents renamed on 2026-11-01. Spec filenames keep the `tracer-` prefix until task 0.7 drops it. Rename the GitHub repo from `Pathlight` to `pathlight-tracker` if you want them to match.
