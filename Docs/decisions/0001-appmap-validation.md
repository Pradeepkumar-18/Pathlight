# 0001 · AppMap validation: adjust
Date: 2026-11-01 · Status: Accepted

## Context
Task 0.1 asks whether AppMap already does what Pathlight Tracker plans. It was checked by desk research (public docs, source code, format spec, GitHub issues) by the `product-analyst` agent: `docs/analysis/2026-11-01-appmap-validation.md`. A hands-on test was not done yet.

## Decision
**Adjust: build the MVP, with a changed pitch.**
- AppMap now claims the "runtime evidence for AI-assisted development" angle and has an MCP server, so "built for AI-written code" is no longer a difference.
- Its Node agent is thin exactly where we plan to be strong: values are one-line strings cut to ~100 characters with no redaction, no branch outcomes, record-then-open only, unreliable async nesting (#180, #251), NestJS layer not labelled, `fetch` not captured.
- The PRD's "Where Pathlight Tracker differs" list now leads with: one correct tree per request, full redacted values, live view, Express and NestJS framework steps, decisions and swallowed errors, and coverage of Mongoose / TypeORM / Prisma / `fetch`.
- `fetch` stays an MVP HTTP boundary (already in PRD and task 3.12).
- **Don't build on `appmap-node`:** its licence is MIT + Commons Clause (not OSI open source), and its value capture and async model are the parts we need to do differently.

## Alternatives considered
Go unchanged (the AI pitch is no longer ours); stop (AppMap's gaps are real and match our planned strengths).

## Consequences
- PRD competitive section rewritten; MCP server moved to v1 (decision 0017); AppMap-format export added to v2 (decision 0018).
- Follow-up: run the report's hands-on checklist on `fixtures/nestjs-app` after task 0.6 and update this record if anything changes.
- Use AppMap's open bugs (#180 async parent, #251 async timeout, #181/#182 source-map paths, #183 pre-ES6 classes) as behaviour-corpus cases in tasks 1.3 and 3.x.
