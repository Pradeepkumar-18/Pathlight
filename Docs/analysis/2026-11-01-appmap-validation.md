# AppMap validation (desk research for task 0.1)

2026-11-01 · Does AppMap already do what Pathlight Tracker plans to do, and where is the real gap? (Desk-research stand-in for the hands-on test in task 0.1. It is not a hands-on result.)

Legend used throughout: **[V]** = verified from a cited public source (docs, source code, issue, release note). **[I]** = my inference or assumption, to be checked hands-on.

## TL;DR

- **AppMap has moved onto our pitch.** In 2026 it calls itself "Runtime evidence for AI-assisted development" [V]. It is free for up to 25 developers [V] and ships an MCP server so coding agents can query recordings [V]. Two things the PRD treats as ours, "built for AI-written code" and "MCP as a defence", are now **AppMap's headline**. That part of the differentiation is gone.
- **The Node side of AppMap is thin where we plan to be deep.** These are the strongest gaps:
  - Each value is a display string, from `util.inspect` at depth 1, trimmed to about 100 characters by the spec [V].
  - There is no redaction in the Node agent [V].
  - There is no branch or condition event in the format [V].
  - The file can only be opened when recording ends, so nothing is live [V].
  - The async call tree is "synthesized" with a 3-second buffer. The maintainers call correct async nesting a fundamental limitation (#251, open) [V].
  - There is an open bug where a query attaches to the wrong parent, reported on NestJS + TypeORM (#180) [V].
  - TypeORM support is an open feature request [V]. `fetch`/undici is not hooked [V from source; I on impact].
- **The real gap is "trustworthy and live for one request", not "AI".** Pathlight Tracker is worth building if it gives:
  - exactly one correct tree per request across `await`s;
  - full, explorable, redacted values;
  - `if`/`switch` decisions;
  - NestJS layers as labelled steps;
  - a tree that draws while the request runs.

  AppMap structurally doesn't do these on Node today.
- **Verdict: ADJUST, not stop.** Rewrite the PRD's "Where Pathlight Tracker differs" so it leads with correctness, values and live, not "for AI code". Treat AppMap's MCP and Gold Traces as the bar the Future phase must clear. Consider AppMap-format export as an interoperability move.
- **Activity matters.** `appmap-node` went quiet from Sep 2024 to Feb 2026, then shipped 8 releases in 2026, the last on 6 Oct 2026 [V]. It has 13 stars [V]. Most company effort seems to go into the AI/MCP/review layer, not the Node agent [I].

## The user gap

**Who and when.** A NestJS/Express developer has just pasted in AI-written code. They hit `POST /orders`, get a 500 or a wrong number, and need to know which function got the bad value within the next 30 seconds. What they are feeling: "I didn't write this, and I don't know where to look."

**What happens with AppMap today (desk walk-through; [I] unless marked).**

1. They run `npx appmap-node npm run start:dev` [V: wraps the launch command via `NODE_OPTIONS`]. That's low friction, the same model as ours.
2. They hit the endpoint. A file appears in `tmp/appmap/requests` once the request finishes [V: request recording]. While the request runs, the file is incomplete JSON [V: `AppMapStream.ts` writes events straight to the target path and closes on finish]. **They can't watch it.**
3. They open it in VS Code or JetBrains. Views: sequence diagram, dependency map, trace view, flame graph [V]. The values they see are one-line strings like `{ id: 7, tier: undefined, ... }`: `util.inspect` at depth 1 [V], trimmed to about 100 characters per the spec [V]. **The nested field that broke is often cut off** [I].
4. On NestJS:
   - Their own guard's `canActivate` appears as a plain function call, if it is in `packages.path` [I].
   - Built-ins such as `ValidationPipe`, and the order Nest runs them in, are inside `node_modules`, which is excluded by default [V]. **The framework layer is invisible or unlabelled** [I].
5. With TypeORM, the SQL may sit outside the service call that made it (#180, open) [V].
6. If a `try/catch` swallowed the real error, the format only says "this call threw". It has no idea of "caught and hidden" [I, from the spec's event model].
7. There is no record of which `if` branch ran [V: the spec has only `call`/`return` events].

**Where they give up [I].** At steps 3 to 6: the value is truncated, the tree shape is wrong, or the framework step is missing. Then they fall back to `console.log`. That's exactly the moment Pathlight Tracker targets.

**Evidence of pain.** Public user complaints are scarce:
- There is little HN or Reddit discussion. The AppMap Show HN got 5 points and 2 comments [V].
- VS Code reviews are 5 stars from only 47 ratings [V], with no review text available.

Most of the evidence above comes from AppMap's own issue tracker and source code, not from user testimony. **I couldn't find evidence of strong demand for AppMap on Node.** That cuts both ways: the space is open, but demand is unproven.

## Landscape

| Tool | Strengths | Weaknesses (for our user) | What we can learn |
| --- | --- | --- | --- |
| **AppMap (`appmap-node` + IDE extensions + MCP)** | Zero-code setup by wrapping the start command [V]. Records parameters, returns, exceptions, SQL, HTTP, Prisma and the native MongoDB driver [V: `src/hooks/`]. Rich views: sequence, dependency map, trace, flame graph [V]. Local storage [V]. MCP server for agents (`claude mcp add appmap -- appmap query mcp`) [V]. Gold Traces for before/after behavioural review [V]. Free under 25 devs, $15/dev/month for Team [V] | After the fact only [V]. Values are depth-1 strings trimmed to about 100 characters [V]. No redaction in the Node agent: no header filter for `authorization`/`cookie`, no key masking [V]. Async tree synthesized, nesting breaks after 3 s (#251) [V]. Wrong parents on NestJS+TypeORM (#180) [V]. TypeORM unsupported (#178) [V]. No `fetch`/undici hook [V source]. Request bodies only if the framework set `req.body` [V]. No branches [V]. Docs list Node 18/20/21 only [V]. Big files (>50 MB) bog down the IDE [V, generic guide]. Licence is MIT **+ Commons Clause** for `appmap-node`, so not OSI open source [V] | The `appmap.yml` packages/exclude model. The launcher pattern (confirms our CLI design). The Mongo `Collection.prototype` method list and Prisma hook as references. `object_id` per value (same idea as our data journey). Response body max length. Their open bugs are our test cases: async parentage, source-map path matching (#181, #182, which mirrors our decision 0009), pre-ES6 classes (#183) |
| **Sentry Spotlight** | Local, real-time web UI for errors, traces and logs from Sentry SDKs. Has an MCP server with tools for errors, logs and traces [V] | Span-level (HTTP/DB/framework) only. No path through your own functions with values [I, consistent with OTel-style spans]. Needs Sentry SDK setup | Proof that a "live local sidecar + browser UI + MCP" shape is accepted. Our differentiator against it is function-level values |
| **Replay.io (Node)** | True record-and-replay: any value, any line, after the fact [V general] | Node runtime is **alpha**, built on Node v16 [V]. Uploads recordings to Replay's cloud [V: "uploaded with the Replay CLI"], which conflicts with local-only | Users want *every* value. Replay proves the appetite but is not a realistic option for current Node versions |
| OTel + local Jaeger / Aspire dashboard | Standard and free, waterfall view | Spans only, needs instrumentation code, no argument or return values [I] | Waterfall is a v1 view we already planned |
| Node inspector / VS Code debugger | Exact values, step-through | You must know where to break. No request-scoped history | Our "Open in code" link should land exactly where a breakpoint would go |

## Ideas

| Idea | Gap it closes | Effort | Impact | Phase fit | Breaks a principle? |
| --- | --- | --- | --- | --- | --- |
| **Reposition the PRD's "differs" list.** Lead with (1) a correct tree per request across `await`s, (2) full redacted values, (3) live, (4) NestJS layers and decisions. Drop "for AI code" as a differentiator; keep it as the audience | AppMap now owns the "AI code" message | S | L | Now (PRD edit, human decides) | No |
| **Make async correctness a published, tested promise.** A behaviour-corpus suite of concurrent requests, long awaits (>3 s), and NestJS+TypeORM, with a README line like "steps never attach to the wrong request" | AppMap #180 and #251, the thing users can't fix themselves | M (already partly planned: 3.x, corpus) | L | MVP | No |
| **Values you can open, not strings.** Structured JSON values with lazy expand, no 100-character cut, redaction before storage | AppMap's depth-1, 100-character strings with no redaction | M (planned) | L | MVP | No |
| **Cover the ORMs AI writes most.** Mongoose and TypeORM as named steps (`[db] users.findOne`) under the right parent, plus `fetch`/undici as an HTTP boundary | AppMap: TypeORM open, no undici, Mongoose only through the raw driver [I] | M | M–L | MVP (Mongoose/TypeORM already planned). `fetch`: check it is in 3.x | No |
| **AppMap-format export (`.appmap.json`).** One button. The user gets AppMap's sequence diagrams, Gold Traces and MCP for free | Turns the competitor into a complement; zero cost to switch | S–M | M | v2 (next to "export") | No (local file) |
| **Re-examine MCP timing.** AppMap and Spotlight both ship MCP now. A read-only `get_request_tree` / `find_step` over our SQLite is cheap once the REST API exists | Our "Future" MCP is now table stakes for the AI-coder audience | M | M–L | Proposal: move a minimal read-only MCP from Future to v1 (human decides) | No (local stdio) |

## Wild cards

1. **"Live" becomes "pause on the first suspicious step".** AppMap can't show a request in flight. We could flag the first `undefined` (decision 0016) or caught error while the request is still running, and highlight it in the live tree before the response returns. This makes "live" a reason to look, not just an animation. *Risk:* it's tempting to actually pause execution, which would break "observe, never change". Highlight only.
2. **Build on `appmap-node` instead of our own agent.** Considered and **not recommended**:
   - Its sync-tree model and the 100-character `value` contract are the exact things we need to beat. Inheriting them gives up the gap.
   - Commons Clause would also constrain anyone selling support later [V licence; I on impact].
   - Worth stating in the decision record so the question doesn't come back.
3. **"Prove the AI's claim" mode.** The tech-lead persona pastes the PR description's claim (for example "now applies the gold discount"). Pathlight shows the decision row `if (user.tier === 'gold') → false` from a real run. This is AppMap's Gold Traces idea at the scale of one request, with no committing of baselines. *Risk:* this edges toward the AI layer, which is Future.

## Recommendation

1. **Go ahead with the MVP, with an adjusted pitch (ADJUST).**
   - **Why:** what makes AppMap weak on Node (truncated string values, no redaction, no branches, after-the-fact files, async parent bugs, framework internals hidden) maps one-to-one to our MVP goals 1 to 4. AppMap's strategy has moved up the stack to AI review and MCP, so it is unlikely to deepen the Node agent soon [I].
   - **Validate first:** hands-on items 1 to 5 in the checklist below. If AppMap shows full nested values and correct async trees on our fixture, the gap is much smaller than this report claims.
2. **Make async correctness and full values the headline, and test them against AppMap's open bugs.**
   - **Why:** these are invisible in a demo but decide trust. They are also where AppMap has said publicly that the problem is hard.
   - **Validate first:** the capture spike (1.x) on `fixtures/nestjs-app` with TypeORM and a deliberate >3 s `await`.
3. **Open a decision on MCP timing and AppMap-format export.**
   - **Why:** "AI coding assistants adding runtime awareness" was listed as a threat in the PRD. It has arrived through AppMap and Sentry Spotlight.
   - **Validate first:** whether the author would actually use an MCP tool on their own projects, and how to price the effort after the REST API (2.10) exists.

**Suggested `progress.md` → "Decisions" entries (❓ Open; the human decides):**
- Task 0.1 verdict: adjust (pitch reframed around correctness, values and live; "AI code" becomes the audience, not the differentiator).
- Move a minimal read-only MCP server from Future to v1?
- Add AppMap-format export to v2 export (7.x)?
- Confirm `fetch`/undici is an MVP HTTP boundary (check task 3.x wording).
- Record "don't build on `appmap-node`" and the reasons.

## Task 0.1 verdict

**Recommendation: ADJUST (go, with a changed pitch).** This is desk research, so it does not satisfy task 0.1's "Done when" on its own. The human decides and writes `decisions/0001-appmap-validation.md`.

**Reasons**
- AppMap overlaps on capture breadth and setup [V], and now on the AI and MCP story [V]. Claiming "for AI-written code" as a difference is no longer credible.
- AppMap does not cover live viewing, value depth, redaction, conditions, swallowed errors or the NestJS layer on Node, and its async tree shape is unreliable. Each point is backed by source, spec or issue [V], with impact on our user marked [I].
- AppMap's recent Node work has been framework and test-runner compatibility (Next.js, Vitest, better-sqlite3), not data depth [V release notes].

**What Pathlight Tracker must do clearly better (all must hold, or the gap closes)**
1. **One request = one correct tree**, under concurrency and long `await`s. No 3-second cut-off, no orphaned DB steps.
2. **Full values**: structured, expandable, not string-truncated, with secrets redacted *before* storage.
3. **Live**: steps appear while the request runs, and a hung request is visible as hung.
4. **NestJS framework steps labelled by role** (guard, pipe, interceptor, filter), including built-ins from `@nestjs/*`, in execution order.
5. **Decisions and swallowed errors**: `if`/`switch` outcomes and violet "Caught" errors (decision 0010). AppMap's format has no place for either.
6. **Coverage of what AI writes**: Mongoose, TypeORM, Prisma and `fetch` as named boundary steps.

**Worth copying from AppMap**
- The launcher pattern via `NODE_OPTIONS` and a wrapped start command (confirms our design).
- Config shape: include paths, plus exclude by file, class or method.
- `object_id` on values. Response-body length cap. Custom inspect for driver objects.
- Hook surface: their Mongo `Collection.prototype` method list and Prisma hook are good checklists.
- A per-test recording mode (relevant to our v1 "test runs").
- Their open bugs as corpus cases: #180 async parent, #251 async timeout, #181/#182 source-map path matching (same problem as our decision 0009), #183 pre-ES6 classes. Also a safety lesson: their recorder "pause" is not in `try/finally` [V], which is the kind of slip that breaks "observe, never change".

**Hands-on checklist (verify later on `fixtures/nestjs-app`; each is currently desk-only)**
- [ ] `npx appmap-node npm run start:dev` works on NestJS (CommonJS, Node 24), and the time to first AppMap is measured. Docs list only Node 18/20/21 [V]; #190 fixed a Node 24 regression [V].
- [ ] A deeply nested argument (3+ levels) appears complete or cut in the trace view [I: cut].
- [ ] Two concurrent `POST /orders` requests produce two clean maps. A >3 s `await` keeps nesting [I: it does not].
- [ ] TypeORM queries sit under the right service call (#180) [V open bug; repro is intermittent].
- [ ] `ValidationPipe`, `JwtAuthGuard`, interceptors and exception filters appear, are labelled, and run in order [I: built-ins missing, user ones unlabelled].
- [ ] Mongoose `User.findOne` appears as a `mongodb/users.findOne` call [I].
- [ ] A swallowed error (`catch {}`) is visible and distinguishable [I: shows only as an exception on the inner call].
- [ ] An `Authorization` header and a `password` field appear unredacted [V source: no redaction in the Node agent].
- [ ] An outgoing `fetch()` call is recorded [V source: only `http`/`https` hooked].
- [ ] Any way to view a request before it finishes [V source: file incomplete until close].
- [ ] Slowdown on the fixture endpoints vs plain `node` (no public figure found).
- [ ] Try the AppMap MCP with Claude Code on the fixture, and note what an agent can and can't answer from it.

## Sources

- appmap-agent-js, deprecated and archived 15 Mar 2024: https://github.com/getappmap/appmap-agent-js
- appmap-node repo: https://github.com/getappmap/appmap-node
- appmap-node releases (v2.25.0 to v2.27.1, 2026): https://github.com/getappmap/appmap-node/releases
- appmap-node docs (Node 18/20/21, Express/Next/Nest, pg/sqlite3/mysql, recording modes): https://appmap.io/docs/reference/appmap-node.html
- appmap-node hooks directory (mongo, prisma, http…): https://github.com/getappmap/appmap-node/tree/main/src/hooks
- Mongo hook source: https://raw.githubusercontent.com/getappmap/appmap-node/main/src/hooks/mongo.ts
- HTTP hook source (no redaction, no undici): https://raw.githubusercontent.com/getappmap/appmap-node/main/src/hooks/http.ts
- Value serialization (inspect depth 1, no redaction): https://raw.githubusercontent.com/getappmap/appmap-node/main/src/parameter.ts
- File writing (incremental, finalized on close): https://raw.githubusercontent.com/getappmap/appmap-node/main/src/AppMapStream.ts
- Instrumentation transform (meriyah, source maps): https://raw.githubusercontent.com/getappmap/appmap-node/main/src/transform.ts
- Licence (MIT + Commons Clause): https://raw.githubusercontent.com/getappmap/appmap-node/main/LICENSE
- package.json (v2.27.1, engines >=18): https://raw.githubusercontent.com/getappmap/appmap-node/main/package.json
- Issues list: https://github.com/getappmap/appmap-node/issues
- Issue #180, wrong parent in async flows (NestJS + TypeORM): https://github.com/getappmap/appmap-node/issues/180
- Issue #251, async tracking 3 s timeout: https://github.com/getappmap/appmap-node/issues/251
- AppMap data spec (call/return only, value trimmed to 100 chars, v1.14): https://github.com/getappmap/appmap
- AppMap homepage ("Runtime evidence for AI-assisted development", Gold Traces): https://appmap.io/
- How AppMap works (views, MCP tools, local storage): https://appmap.io/how-it-works
- llms.txt: http://appmap.io/llms.txt
- Pricing (free ≤25 devs, Team $15/dev/month): https://appmap.io/pricing
- VS Code extension (72.8k installs, 47 ratings, MCP, Navie): https://marketplace.visualstudio.com/items?itemName=appland.appmap
- VS Code extension reference (diagram tree, remote recording, Navie review): https://appmap.io/docs/reference/vscode.html
- JetBrains plugin: https://plugins.jetbrains.com/plugin/16701-appmap-runtime-evidence-for-ai-coding
- Flame graph launch: https://dev.to/appmap/introducing-flame-graphs-its-getting-hot-in-here-1j9l
- Confluence app (views list): https://marketplace.atlassian.com/apps/1233075/appmap-for-confluence
- appmap-js issues (large repo performance, Navie button): https://github.com/getappmap/appmap-js/issues
- appmap-js PR #2415, Navie mermaid change, Oct 2026: https://github.com/getappmap/appmap-js/pull/2415
- appmap-js PR #2422, require Node 22: https://github.com/getappmap/appmap-js/pull/2422
- AppMap and MongoDB blog, Jul 2025: https://mongodb.com/company/blog/innovation/fine-tune-mongodb-deployments-appmaps-ai-tools-diagrams
- Large recordings guides: https://gist.github.com/dividedmind/453140198ecacbf00ead6f00adede9df · https://gist.github.com/dividedmind/a020d93af85b0f5a7b37e861b42399e8 · https://gist.github.com/dividedmind/16cdbaff767990a0a1cb413c47c790e4
- HN search (Show HN 5 points): https://hn.algolia.com/api/v1/search?query=appmap&tags=story
- Replay Node (alpha, Node v16): https://docs.replay.io/reference/replay-runtimes/replay-node
- Sentry Spotlight MCP: https://docsearch.algolia.com/mcp/docs/repo/getsentry/spotlight · https://docs.sentry.io/platforms/react-native/guides/expo/integrations/spotlight/
