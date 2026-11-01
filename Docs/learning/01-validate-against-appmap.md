# 01 · Validate against AppMap
2026-11-01 · Task 0.1 · `Docs/analysis/2026-11-01-appmap-validation.md`, `Docs/decisions/0001-appmap-validation.md`, `0017-mcp-server-in-v1.md`, `0018-appmap-format-export.md`, PRD "Competitive landscape"

## In one sentence
Before writing code, we checked the closest existing tool (AppMap) to see if our idea was already taken, and the answer was "build it, but change the pitch".

## Why we are doing this
Building takes months. If someone already did the same thing well, you waste those months. So task 0.1 is a cheap check done first: read how AppMap works, find where it is weak, and decide if there is still a real gap.

For you as the owner, this is the "what is the use of it" answer: it protects your time, and it tells you what to say when people ask "why not just use AppMap?".

It serves the PRD's main promise: a developer who just pasted AI-written code can see what really happened in one request.

## How it works

### How runtime recording tools work (in general)
These tools watch your app while it runs, instead of only reading the code.

1. **Instrument**: the tool changes your code as it loads. Every function gets a small wrapper, like a stopwatch with a notebook.
2. **Record**: each time a function is called, the wrapper writes down "called with these values" and "returned this value" (or "threw this error").
3. **Show**: the notes are turned into a picture (call tree, sequence diagram).

AppMap does this by wrapping your start command: `npx appmap-node npm run start:dev`. It sets `NODE_OPTIONS` so its code loads first. Pathlight Tracker uses the same launcher idea (`npx pathlight-tracker dev`), so we learned our design is on the right track.

### Record-then-open vs live
- **Record-then-open** (AppMap): the request runs, a file is written, and the file is complete only after the request ends. Then you open it in VS Code. Like filming a match and watching it later.
- **Live** (our plan): steps appear in the browser while the request is still running. Like watching the match on TV. If a request hangs, you see where it hung.

### What the desk research found
Desk research means we read docs, source code, the file format spec, and GitHub issues. We did not run the tool.

AppMap has moved onto our pitch. In 2026 it says "Runtime evidence for AI-assisted development" and has an MCP server (a way for AI tools like Claude Code to read its recordings). So "built for AI-written code" is no longer a difference.

But on Node.js it is thin exactly where we want to be strong:

| AppMap on Node | What we plan |
| --- | --- |
| Values are short strings, cut at about 100 characters | Full values you can expand |
| No redaction of secrets | Redact before storing |
| No record of which `if` branch ran | `if` / `switch` outcomes |
| File opens only after the request ends | Live |
| Async calls can attach to the wrong parent (issues #180, #251) | One correct tree per request |
| NestJS guards, pipes etc. not labelled | Labelled steps |
| `fetch` not captured | `fetch` as a boundary step |

Each row is backed by source code, the spec or an issue (marked `[V]` in the report). Where the report guessed, it says `[I]` (inference). Good habit: always ask "is this verified or guessed?".

One honest warning from the report: it found little public evidence that people strongly want AppMap on Node. The space is open, but demand is unproven.

### The verdict: "adjust"
Three possible answers: **go** (unchanged), **adjust** (go, but change something), **stop**.

We chose adjust. The gap is real, so we build the MVP. But the pitch changes:
- Old pitch: "for AI-written code" (AppMap says it too).
- New pitch: correct, live, full-value view of one request, for Express and NestJS. "AI-written code" now describes *who it is for*, not *how we differ*.

## Why this way, not another
- **Go unchanged**: the AI pitch is no longer ours. Rejected.
- **Stop**: AppMap's gaps match our planned strengths. Rejected.
- **Build on `appmap-node` instead of our own agent**: rejected. Its licence is MIT + Commons Clause (not real open source), and its value capture and async model are the exact parts we need to do differently.

### How the plan changed
- **PRD "Where Pathlight Tracker differs"** now has 6 points: one correct tree per request, full redacted values, live, framework-aware (Express and NestJS), decisions and swallowed errors, coverage of Mongoose / TypeORM / Prisma / `fetch`.
- **MCP server moved from Future to v1** (decision 0017, task 6.16). AppMap and Sentry Spotlight both have one now, so for AI-tool users it is table stakes. It is read-only and local.
- **AppMap-format export added to v2** (decision 0018, task 7.10). We become a partner, not only a rival: users can open our data in AppMap's viewers. Things AppMap's format cannot hold (branch outcomes, swallowed errors, full values) get dropped or summarised.
- **AppMap's open bugs become our test cases** in the behaviour corpus (#180, #251, #181/#182, #183).

## Desk research vs hands-on test
- **Desk research**: reading about the tool. Fast, cheap, but it can be wrong. Some of our claims are guesses.
- **Hands-on test**: install it, run it on a real app, and see. Slower, but it is the truth.

Task 0.1's "Done when" was a decision file with go/adjust, and that exists, so the task is done. But the hands-on checklist (12 items, like "does a deeply nested value get cut?" or "do two concurrent requests give two clean trees?") is still pending. It needs a real app to test on: `fixtures/nestjs-app`, which comes from task 0.6. Until then the verdict is "adjust, based on reading". If the hands-on test shows AppMap is better than the report says, decision 0001 gets updated.

## Words to know
- **Instrumentation** → wrapping your functions so they report what they do.
- **Runtime** → while the program is running (opposite of reading the code).
- **Desk research** → learning from docs and code without running the tool.
- **Hands-on test** → actually running the tool yourself.
- **MCP server** → a small local service that lets AI tools ask questions about your data.
- **Async nesting** → keeping the call tree correct across `await` and parallel requests.
- **Redaction** → hiding secrets (tokens, passwords) before saving.
- **Commons Clause** → a licence add-on that limits selling the software. Not OSI open source.
- **[V] / [I]** → verified from a source / inferred (a guess to check).
- **ADR / decision record** → a short file in `Docs/decisions/` explaining why we chose something.

## Try it yourself
(10 minutes) Open `Docs/analysis/2026-11-01-appmap-validation.md` and find the "Task 0.1 verdict" section. Pick two items in the hands-on checklist. For each, write one line: what would you see in AppMap if the report is right, and what if it is wrong? Then note which one would change the decision most.

## Check yourself
1. Why did we check AppMap before writing any code, and what were the three possible outcomes?
2. Name two things AppMap does thinly on Node that Pathlight Tracker plans to do well, and say why "built for AI-written code" is no longer a good way to describe our difference.
3. Why is the hands-on checklist still pending, and what could happen to decision 0001 when it is done?

<details>
<summary>Answers</summary>

1. To avoid spending months on something that already exists. Outcomes: go, adjust, stop.
2. Any two of: full values (AppMap cuts at ~100 characters), redaction, branch outcomes, live view, correct async trees, labelled NestJS steps, `fetch`. AppMap now claims the AI-assisted angle and has an MCP server too, so it does not separate us.
3. It needs a running app (`fixtures/nestjs-app`, after task 0.6), and the report was desk research only. If AppMap does better than the report claims, the gap is smaller and the decision record gets updated (possibly changing the pitch again).
</details>

## Go deeper
- `Docs/analysis/2026-11-01-appmap-validation.md`: "The user gap" and the hands-on checklist.
- `Docs/tracer-prd.md`: "Competitive landscape".
- `Docs/decisions/0017-mcp-server-in-v1.md` and `0018-appmap-format-export.md`.
