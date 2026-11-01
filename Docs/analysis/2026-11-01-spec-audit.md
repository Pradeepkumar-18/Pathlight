# Spec audit
Date: 2026-11-01 · Cross-check of all planning docs before coding

Saved as received (it uses the old working name "Tracer"). Decisions taken on it: `docs/decisions/0003`–`0016` and `progress.md` → "Decisions". Fixing every item is task **0.8 Spec consistency pass**.

## Words you'll see a lot

- **Agent:** the small part of Tracer that runs inside your app and records what happens.
- **Collector:** Tracer's own program on your computer. It receives the recordings, saves them in a database file and serves the web page.
- **UI / map:** the web page in your browser where you look at the recordings.
- **Step:** one line in the map, such as one function call, one guard or one database query.
- **Seed data:** fake example data in the data-model doc, used to build and test the UI before the real recording works.
- **Token:** a one-time password the collector makes on every start, so only you can see your data.
- **MVP / v1 / v2:** the first, second and third releases.

## The 6 biggest problems

**A. Is "which way an if went" in the first release or not?** The plan puts it in v1 (later). But the example data and the reference picture already show an if row, and some MVP tasks say "must match the example exactly." So those MVP tasks can't pass unless you build a v1 feature early. Fix: decide. Either move it into the MVP, or remove the if row from the MVP examples.

**B. You can't measure success the way the PRD says.** The PRD measures things like "how many users come back after 4 weeks" by collecting usage stats from users (called telemetry). But the tech stack and CLAUDE.md forbid sending anything off the computer, and no task builds it. The step from MVP to v1 depends on that number, so it can never be checked. Fix: either plan opt-in usage stats, or choose other ways to measure, such as surveys, user interviews or GitHub stars.

**C. CLAUDE.md forbids something the tool has to do.** It says "never print or store the token." But the terminal has to print the link that contains the token, and the browser has to keep the token. An AI that follows the rules strictly gets stuck. Fix: reword it as: "Never write the token into log files or the database. Printing it once in the terminal and keeping it in the browser is allowed."

**D. Tracer may end up watching nothing.** By default Tracer only watches files under `src/`. But a NestJS app actually runs compiled JavaScript files from `dist/`, so nothing matches. Also, there are two conversions between the code you wrote and the code that runs: TypeScript compiles it, then Tracer rewrites it again. The docs don't say how to combine both to get back to the right `.ts` line. Fix: set a default that matches what really runs, and write down how line numbers are traced back.

**E. Spotting "swallowed" errors has no plan.** A swallowed error is one the code catches and silently ignores. The docs want these flagged, but the error is recorded the moment it's thrown, and at that moment nobody knows yet whether it will be ignored. The same problem applies to "converted" (an error that became a 500 response). Fix: describe how the collector decides afterwards. For example: if a function finishes normally after one of its inner calls threw, mark that error as swallowed.

**F. Deleted data isn't really wiped from the file.** In SQLite, deleted data stays in the file unless a special setting is turned on when the database is first created. The docs run the cleanup command but never turn the setting on, so deleted data, which may be sensitive, stays in the file. Fix: add `PRAGMA auto_vacuum = INCREMENTAL` before the tables are created.

## 1. Things the PRD wants that the plan or screens forgot

- **1.1 Prisma.** The PRD promises Prisma support in the first release, but the test apps only use Mongoose and TypeORM, so nobody can check that Prisma works. Fix: add Prisma to a test app, or move Prisma to later.
- **1.2 Object IDs.** The PRD says to give every object a label from day one, so that later you can follow one object across functions. But no task actually saves these labels to the database; the request body can't be saved, because the table needs a step and the request body isn't a step; thrown errors have no way to get a label. Fix: add the saving to task 2.9, define how the location is written (like `args[0]`), and decide where request-level objects go.
- **1.3 Copy link to a step.** The PRD asks for it, but the screens only offer "copy link to a request." Fix: add it to the inspector panel and to task 4.9.
- **1.4 Choosing your editor for "Open in code."** One doc says Settings shows this read-only, another says you can change it there. On top of that, the collector builds the link, so changing it in the browser wouldn't do anything. Fix: pick one place; make it a browser setting and have the browser build the link.
- **1.5 Example curl on the waiting screen.** The screen is supposed to show your app's port number, but nothing ever tells Tracer that port. Fix: have the agent report the port, or show a placeholder.
- **1.6 The "Pin" button.** The design doesn't say where it goes, and nothing explains how Pin, "Follow latest" and clicking a request work together. Fix: place the button and write those rules.
- **1.7 Function types that may be skipped.** The PRD lists static methods and arrow functions stored inside classes, but task 3.6 doesn't mention them. The PRD also says getters are "not tracked by default," which suggests a switch to turn them on, but no such switch exists. Fix: list them in task 3.6, and change "by default" to "never."
- **1.8 Interceptor and filter details.** The PRD wants to show what an interceptor did before and after, and which error a filter turned into which response. The data model has no format for storing these details. Fix: add the formats.
- **1.9 "Unhandled error" gets lost.** The agent sends it when the request ends, but no database column stores it. Fix: add a column, or save it as a step.
- **1.10 Browser security rule (CSP).** Only checked in the final review; no task builds it. Fix: add it to task 2.7.
- **1.11 The `tracer clear` command** is only created as an empty placeholder, and no later task finishes it. Fix: add a task.

## 2. Extra things not in the PRD (scope creep)

- **2.1** `tracer doctor` isn't in the PRD. It's useful, so add it to the PRD.
- **2.2** `tracer clear`: add it to the PRD or drop it.
- **2.3** A search box in the MVP, but the PRD says search is v1. Hide it until v1.
- **2.4** Many extra filters (errors only, method, slow, route, state, session, date range, sort by duration). Add them to the PRD, or keep just "errors only" and "path."
- **2.5** Extra settings: row density, show framework steps, show timings, a config viewer with sources, "copy config," and the `/config` endpoint. The PRD only asks for the theme, and config is v1.
- **2.6** A sessions menu, "app restarted" dividers and notice, and "Open .tracer folder." A web page can't open a folder on your disk. Drop the folder button, and add the sessions features to the PRD.
- **2.7** Tablet and phone layouts. Support laptop size and up for the MVP, or add a requirement.
- **2.8** Greyed-out "coming soon" Graph, Timeline and Logs tabs. The PRD itself warns that extra tabs confuse new users. Hide them until v1.
- **2.9** Small extras: a logs endpoint for the UI's own errors, an in-memory database fallback, a trash size limit, the "o + Enter" shortcut, a `--quiet` flag, and the `X-Tracer-Truncated` header. Add them to the PRD or drop them.

## 3. The same thing called different names in different files

- **3.1** "Phase 2" means the VS Code extension in most docs, but "Protocol and collector" in the plan. Fix: use MVP / v1 / v2 for releases, and "Phase N" only inside the plan.
- **3.2** The main view is called "step tree," "call tree," "Trace tab" and "map." Fix: "step tree" everywhere.
- **3.3** The agent package is named `@tracer/register`, but its folder is `packages/agent`, and the commands expect `@tracer/agent`. The npm name `tracer` is taken. Fix: pick one name and check npm now.
- **3.4** The architecture's list of step types is missing `method`, which the data model uses. `if` and loop events reuse the field name `kind` with a different meaning. Fix: add `method`, and give those fields their own names.
- **3.5** The PRD counts `?.` as a decision, but the list of decision types doesn't include it, and ternary and `&&`/`||` have no badge. Fix: extend the list and the badges.
- **3.6** The architecture and the API spec describe the agent's messages differently (version and process ID per event vs per batch; the API calls the type field `e`; "request ended" has no response headers but the database stores them). Fix: make the API spec the master copy.
- **3.7** `console.log` output is "a kind of boundary step" in one doc and "a separate event" in another. Fix: pick one.
- **3.8** One thing has three names: "caught" (event), "swallowed" (database) and "Caught" (legend). Fix: write down that they mean the same thing.
- **3.9** The architecture's message list is missing several messages the API spec has. Fix: point to the API spec instead of copying it.
- **3.10** `PROTOCOL_MISMATCH` and `COLLECTOR_ERROR` are used but don't exist in the API's error list. Fix: use real codes, or add them.
- **3.11** Disconnect code 4003 means two different things. Fix: give the second meaning its own code.
- **3.12** The architecture allows only `127.0.0.1`, but the API also allows `localhost`. Fix: make them match.
- **3.13** The flows say old sessions are "ended," but the allowed values are connected, disconnected and disabled. Fix: use "disconnected."
- **3.14** Who decides the layer badge (SERVICE, CONTROLLER)? Design says the browser, the API says the collector. Fix: the collector; update the design doc.
- **3.15** The API's value format has a "suspicious" flag that the data model's version is missing. Fix: add it.
- **3.16** CLAUDE.md says object IDs are ULIDs, but they're simple counters like `obj_17`. Fix: correct CLAUDE.md.
- **3.17** Agent and collector both read `TRACER_LOG_LEVEL` with different defaults; the app inherits the collector's settings. Fix: give the agent its own setting.
- **3.18** The docs refer to each other as `tracer-prd.md` etc., while CLAUDE.md uses `docs/prd.md`. Fix: rename the files (task 0.7).
- **3.19** The folder layout is drawn differently in three docs. Fix: keep one official version, in the architecture doc.
- **3.20** The tech stack says "two tables," but there are five. Fix: correct the wording.

## 4. Database problems

- **4.1** The meta table stores the retention limit and trash time, but the real values come from config. Fix: drop them, or label them "for information only."
- **4.2** Later features (tracing a test, a queue message or a cron job) aren't web requests, but the requests table requires an HTTP method and path. Fix: plan a "what started this" column now.
- **4.3** No place for: before/after values of changed arguments (v1), argument names, the "this file couldn't be recorded" note, setup warnings, the app's exit code. Fix: add places, or drop the features.
- **4.4** If `console.log` lines are saved as steps, they use up step numbers, count toward the 5,000-step limit and appear in the tree. Fix: decide whether that's wanted.
- **4.5** Example IDs are 24 characters, but real ULIDs are 26. Fix: generate proper IDs.
- **4.6** Example data saves empty params as `{}`, but the API returns `null`. Fix: store `null`.
- **4.7** Example times in the data model (2025) differ from the API examples (2026). Fix: make them match.
- **4.8** The example data puts the `if` step on the red error path, but the API example's path stops before it. Fix: define the rule (from the top down to the step that threw) and correct one of them.
- **4.9** Each step has a sequence number meant to block duplicates, but the agent doesn't send it; if the collector assigns it, duplicates get new numbers. Fix: say who assigns it, and catch duplicates by step ID.
- **4.10** `tracer clear --purge` means "empty the trash" in one place and "delete everything" in another. Fix: pick one.
- **4.11** The trash size limit can delete items early, but the UI promises "restorable for 72 hours." Fix: change the wording or remove the limit.

## 5. API vs screens

- **5.1** Settings should show setup warnings, but no endpoint provides them. Fix: add them to `/health`, or drop the feature.
- **5.2** "Open .tracer folder" has no endpoint. Fix: drop it.
- **5.3** `tracer clear` edits the database directly, so open browser tabs keep showing old data. Fix: when the collector is running, the CLI asks it to clear (found through a small file like `.tracer/collector.json`).
- **5.4** The API says `tracer doctor` uses `/health`, but doctor runs without a collector. Fix: remove that claim.
- **5.5** "Copy as cURL" builds an address like `localhost:3000`, but nothing says where 3000 comes from. Fix: define it.
- **5.6** The sample data has no page address of its own, and it's unclear how the sample file ships inside the npm package. Fix: add a `/sample` page and bundle the file.
- **5.7** The request list shows a step count, but for running requests you aren't viewing, no message updates it. Fix: add a field to an existing message.
- **5.8** Some endpoints and filters aren't used by any screen. Fix: drop them, or connect them to a screen.
- **5.9** The architecture's table of protected routes leaves out the POST routes. Fix: add them.

## 6. Tech stack vs architecture

- **6.1** The docs use many libraries the tech-stack list doesn't name (notably no routing library was chosen). Fix: add all of them to the list with versions.
- **6.2** The timer counts from an arbitrary start, not clock time, but examples show real times. Fix: send real time once at request start, plus offsets.
- **6.3** "New steps within ~100 ms" doesn't add up: agent 50 ms + collector ~100 ms + browser 100 ms. Fix: remove a wait, or loosen the promise.
- **6.4** The default editor link differs (with / without column). Fix: make them match.
- **6.5** "Sonner (shadcn Toast)" names two components. Fix: say Sonner.
- **6.6** Tracer loads SWC inside your app, which may already use its own SWC version. Fix: say how Tracer keeps its copy separate.
- **6.7** "No backend server," but the collector is a local server. Fix: "no remote server."

## 7. Unclear spots where the AI would have to guess

- **7.1** Missing numbers: internal errors before the agent turns itself off; the agent's buffer size; when an unfinished request becomes "incomplete" (clashes with long requests); bad messages before disconnect; when the collector tells the agent to slow down.
- **7.2** What gets dropped when overloaded? "Drop loop data first," but loops aren't in the MVP; dropping a "started" without its "ended" breaks the tree.
- **7.3** How are swallowed errors shown: red path or violet? Several errors in one request?
- **7.4** "Suspicious" means `undefined`, but a missing key (common with MongoDB, the PRD's main example) isn't flagged.
- **7.5** The production guard says "unless forced," but no setting name is given.
- **7.6** No format for `tracer.config.json`; "CLI flags win over config," but no flags are defined.
- **7.7** Secret-hiding rules: the key list ends with "…"; exact match or contains; case; do `accessToken`, `x-api-key`, `set-cookie` count?
- **7.8** Default row height is 40 px in one place and 32 px in another.
- **7.9** The "all your files are excluded" message can't be shown; nothing stored tells Tracer that.
- **7.10** Who turns the raw error text into locations with `.ts` lines? The example data has no stack.
- **7.11** "File may have changed since this request" needs a file-date check no API does.
- **7.12** The framework is reported in the agent's first message, before NestJS has loaded, so it would always say "unknown."
- **7.13** Saved links break: the port changes on every restart, and a link without the token lands on Connect.
- **7.14** One terminal example prints the link without the token; another says it includes it.
- **7.15** CLAUDE.md doesn't say how the UI dev server gets data and a token against example data; task 0.7 requires "all CLAUDE.md commands work," but those commands are created later.
- **7.16** `better-sqlite3` must be compiled for your machine; without a prebuilt binary, `npx` install can be slow or fail, risking "first map in under 2 minutes."

## 8. Secrets and passwords

None found. Everything that looked like a secret is a fake placeholder (`7Kq…`, `[REDACTED]`, `/home/dev/shop-api`, example process numbers).
