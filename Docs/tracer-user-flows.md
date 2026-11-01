# Pathlight Tracker: User Flows

Pathlight Tracker is a local developer debug visualizer: it draws a live map of each request as it hits your local Node/TypeScript server, showing every function it passed through and the real data at each step.

This document defines every screen, the main journeys step by step, navigation, connection ("logged-in vs logged-out") behaviour, empty/loading/error states and edge cases. It covers **Phase 1 (CLI + browser UI)**; Phase 2 (VS Code extension) differences are in §9.

Related docs: PRD, `tracer-architecture.md` (API, auth, events), `tracer-data-model.md` (requests, steps, trash), `tracer-design.md` (visual rules, responsive layout, accessibility).

---

## 0. Checklist at a glance

| Checkpoint | Where |
| --- | --- |
| Full list of screens | §1 |
| Step-by-step journeys (signup, onboarding, core action) | §2 |
| What each screen shows and its actions | §3 |
| Navigation between screens | §4 |
| Logged-in vs logged-out behaviour | §5 |
| Empty, loading and error states | §6 |
| Edge cases (invalid input, no permission, network fail) | §7 |

**About signup:** Pathlight Tracker has **no signup, login or accounts** (local, single-developer tool). The "signup + onboarding" journey is the **first run**: install-free `npx` command → browser opens → first map. "Logged in" means **the browser holds a valid session token** for the running collector (§5).

---

## 1. Screens

### 1a. Terminal (CLI)

| ID | Screen | Command | Phase |
| --- | --- | --- | --- |
| T1 | Dev session | `npx pathlight-tracker dev -- <your command>` | MVP |
| T2 | Doctor (setup check) | `npx pathlight-tracker doctor` | MVP |
| T3 | Clear | `npx pathlight-tracker clear` / `npx pathlight-tracker clear --purge` | MVP |

### 1b. Browser UI

The UI is one app with a fixed layout (header + three panels). Most "screens" are states of that layout, addressed by URL.

| ID | Screen | Route | Phase |
| --- | --- | --- | --- |
| S1 | Connect (token gate) | `/connect` | MVP |
| S2 | Workspace: waiting for first request (onboarding) | `/` (no requests yet) | MVP |
| S3 | Workspace: request list | `/` | MVP |
| S4 | Request map (call tree + inspector) | `/requests/:requestId` | MVP |
| S5 | Step inspector (panel inside S4) | `/requests/:requestId?step=:stepId` | MVP |
| S6 | Trash | `/trash` | MVP |
| S7 | Settings | `/settings` | MVP |
| S8 | Collector stopped / disconnected | overlay on any screen | MVP |
| S9 | Version mismatch | full-page | MVP |
| S10 | Not found (request, step or route) | in-panel or full-page | MVP |
| S11 | Search results | `/search?q=` | v1 |
| S12 | Compare two requests | `/compare?a=:id&b=:id` | v1 |
| S13 | Flow graph / Timeline views | tabs inside S4: `?view=graph`, `?view=timeline` | v1 |
| S14 | Data journey | panel inside S4: `?object=:objectId` | v2 |

Overlays and banners (not separate screens): agent-disabled banner, "session restarted" notice, toast messages, confirm dialogs.

### 1c. Workspace layout (S3/S4/S5)

The approved design is `tracer-ui-reference.png`; visual rules are in `tracer-design.md`. Navigation lives in the header; there is no navigation sidebar. The left request list and the right inspector are resizable and collapsible.

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│ Pathlight Tracker  shop-api ▾  ● Connected  Agent pid 48213 · NestJS     [Search…  Ctrl K]   🗑   ⚙      │
├───────────────────────┬────────────────────────────────────────────────┬──────────────────────┤
│ Requests  ◉ Follow    │ POST /orders  500  84 ms · 9 steps · 12:04:58  │ calculateDiscount    │
│ [Filter…        ] [⚲] │                [Copy link] [Open in code] [⋯]  │ SERVICE              │
│                       │ Trace  Graph  Timeline  Logs     ● ✓ ✕ ◌ legend│ pricing.service.ts:22│
│ POST /orders      500 │ Step                         Status  Duration ⋯│ Details  Error  Raw  │
│ 84 ms · 9 steps 12:04 │ › JwtAuthGuard.canActivate GUARD  ✓   1.1 ms   │ Input arguments      │
│ GET  /users       ··· │ › ValidationPipe.transform PIPE   ✓   0.9 ms   │ ARGS[0] · USER       │
│ 1.2 s · running       │ ⌄ ● OrdersController.create HANDLER ✕  81 ms   │ { id: 7, name:"Ravi",│
│ GET  /orders/42   200 │   ⌄ ● OrdersService.create SERVICE ✕ 80.5 ms   │   tier: undefined ⚠ }│
│ 21 ms · 3 steps 12:03 │     › ● UserService.findById(7)               │ ARGS[1] · TOTAL 1200 │
│ PATCH /cart/7     200 │         → { tier: undefined }   ✓   41 ms      │ Error                │
│ ── restarted 12:04 ── │         DB users.findOne({_id:7}) ✓  39 ms     │ TypeError: Cannot    │
│ GET  /health      200 │     ● CartService.total SERVICE  ✓  0.6 ms     │ read … 'rate'        │
│                       │   ▸ ● PricingService.calculateDiscount ✕ 0.3ms │ Source location      │
│                       │         IF user.tier === 'gold' → false        │ [Open in code]       │
│ 100 requests          │                                                │ Request ID · Step ID │
└───────────────────────┴────────────────────────────────────────────────┴──────────────────────┘
```

The request list scrolls (virtualized) instead of paging; the footer shows the count of kept requests.

---

## 2. Main journeys

### J1. First run (the "signup + onboarding" journey)

Goal: from nothing to a first live map in under 2 minutes, with no code changes.

| # | Where | User does | System does |
| --- | --- | --- | --- |
| 1 | Terminal | Runs `npx pathlight-tracker dev -- npm run start:dev` in their project | Downloads Pathlight Tracker if needed; creates `.pathlight-tracker/`, adds it to `.gitignore` (prints a notice); opens SQLite; starts collector on `127.0.0.1:<random port>`; generates token |
| 2 | Terminal | — | Runs pre-checks (Node version, CommonJS, source maps). Warnings printed but not blocking; blocking problems stop here (see J8) |
| 3 | Terminal | — | Spawns the user's command with the agent preloaded; forwards the app's own output unchanged; prints the UI URL |
| 4 | Browser | (Browser opens automatically) | Opens `http://127.0.0.1:<port>/#token=…`; UI stores the token, removes it from the address bar, connects `/live` |
| 5 | S2 | Sees "Waiting for your first request" with the app status | Shows agent status: "Waiting for app to start…" → "Connected: pid 48213, NestJS" |
| 6 | Postman / browser / test | Calls any endpoint, e.g. `POST /orders` | Agent records; collector streams steps |
| 7 | S2 → S4 | (No action needed) | First request appears and **opens automatically** in the map, drawing live; onboarding tips shown once: "Click any step to see its values", "Red = path to the error", "Open in code jumps to the line" |
| 8 | S4 | Clicks a step | Inspector shows values; "Open in code" opens VS Code at that line |

Terminal output for steps 1–3:

```
$ npx pathlight-tracker dev -- npm run start:dev

  Pathlight Tracker 0.1.0
  ✓ Node v24.10.0
  ✓ CommonJS + TypeScript, source maps on
  ✓ Added .pathlight-tracker/ to .gitignore

  Map UI:  http://127.0.0.1:52341   (opening in your browser…)
  Running: npm run start:dev  (agent attached)

  ── your app output ──────────────────────────────
  [Nest] 48213  - LOG [NestFactory] Starting Nest application...
```

### J2. Debug a failing request (core action)

| # | Screen | User does | System does |
| --- | --- | --- | --- |
| 1 | Client | Triggers the bug (e.g. `POST /orders` returns 500) | Map draws live; failing request marked red in the list |
| 2 | S4 | Opens the request (auto-opened if it's the newest and the user hasn't selected another) | Tree auto-expands **along the error path**; other branches stay collapsed |
| 3 | S4 | Follows the red path down | Each red step shows ✗ and its error |
| 4 | S5 | Clicks `PricingService.calculateDiscount` | Inspector: arguments (`user.tier: undefined` flagged), error message, file and line |
| 5 | S5 | Walks up to `UserService.findById` | Inspector shows return value `User { tier: undefined }`, plus its DB child step `users.findOne` with the query |
| 6 | S5 | Clicks **Open in code** | VS Code opens `src/users/user.service.ts:14` |
| 7 | Editor | Fixes the code, saves | Watch mode restarts app → new session; header shows "App restarted" notice (J5) |
| 8 | Client | Sends the request again | New request (200) appears at the top of the list; user compares by clicking between the two (or uses Compare in v1) |

### J3. Watch a request live

| # | Screen | User does | System does |
| --- | --- | --- | --- |
| 1 | S3 | Sends a slow request (e.g. calls an external API) | Row appears with ◌ "in progress" and a running timer |
| 2 | S4 | Opens it | Steps appear as they happen (batched every ~100 ms); running steps show a spinner and elapsed time |
| 3 | S4 | Keeps watching | When the response is sent, header shows final status and duration; spinners stop |
| 4 | S4 | Scrolls up while steps stream | Auto-scroll pauses ("New steps below ↓" pill); clicking it resumes |

### J4. Handle many requests

| # | Screen | User does | System does |
| --- | --- | --- | --- |
| 1 | S3 | Frontend fires many calls at once | List fills; concurrent requests stay separate (one map each) |
| 2 | S3 | Toggles **Errors only** or types `/orders` in the filter | List filters instantly (client-side for loaded rows, server query for older ones) |
| 3 | S3 | Clicks **Pin** on a request (keeps the map open) | Auto-open of new requests is paused while a request is pinned |
| 4 | S3 | Clicks **Follow latest** | New requests auto-open again |

### J5. App restarts (watch mode)

| # | Screen | User does | System does |
| --- | --- | --- | --- |
| 1 | Editor | Saves a file | `nest start --watch` restarts the app; the agent reconnects as a **new session** |
| 2 | Any | — | Header shows "App restarted (pid 48301)" for a few seconds; any request that was in progress is marked **incomplete** |
| 3 | S3 | — | Old requests stay in the list, grouped under a divider "Before restart 12:04:31" |

### J6. Delete, trash and restore

| # | Screen | User does | System does |
| --- | --- | --- | --- |
| 1 | S3/S4 | Clicks **Delete** on a finished request | Request moves to the trash; toast "Moved to trash · Undo" (10 s) |
| 2 | Toast | Clicks **Undo** | Request restored to the same place |
| 3 | S3 | Clicks **Clear all** | Confirm dialog: "Move 37 requests to the trash? They can be restored for 72 hours." → all finished requests moved to trash |
| 4 | S6 | Opens **Trash** | Lists trashed requests with "Deletes permanently in 71 h" |
| 5 | S6 | Clicks **Restore** on one | Request returns to the list |
| 6 | S6 | Clicks **Delete permanently** / **Empty trash** | Confirm dialog with exact count, then hard delete (cannot be undone) |

### J7. Come back later / reopen the UI

| # | Situation | What happens |
| --- | --- | --- |
| 1 | Tab closed, collector still running | User reopens the URL printed in the terminal (it includes the token) → connects straight away |
| 2 | Typed `http://127.0.0.1:<port>` without the token | S1 Connect screen asks for the token, shown in the terminal (`Token: 7Kq…` with a "copy link" hint) |
| 3 | Collector stopped (Ctrl+C) and started again | New port and token; the old tab shows S8 "Collector stopped"; the new run opens a new tab. History is still there (stored in `.pathlight-tracker/traces.db`) |

### J8. Setup problem (doctor)

| # | Screen | User does | System does |
| --- | --- | --- | --- |
| 1 | T1 | Runs `pathlight-tracker dev` in an unsupported project (e.g. `"type": "module"`) | Prints a clear blocking message and the next step, does **not** start the app |
| 2 | T2 | Runs `npx pathlight-tracker doctor` | Lists every check with ✓ / ⚠ / ✗ and a fix for each |
| 3 | T1 | Fixes warnings (e.g. turns on `sourceMap`), re-runs | Starts normally |

```
$ npx pathlight-tracker doctor
  ✓ Node v24.10.0 (supported: 20+)
  ✓ TypeScript project
  ⚠ tsconfig.json: "sourceMap" is off → steps will show compiled .js lines.
    Fix: set "sourceMap": true in compilerOptions
  ✗ package.json: "type": "module" (ESM) is not supported yet (planned for v2)
  ✓ Framework: NestJS 11
```

### J9. Compare two requests (v1)

| # | Screen | User does | System does |
| --- | --- | --- | --- |
| 1 | S3 | Selects two requests (Ctrl/Cmd+click) → **Compare** | Opens S12 |
| 2 | S12 | Reads side-by-side trees | Steps aligned by name and position; differences highlighted (missing step, different value, different branch) |
| 3 | S12 | Clicks a highlighted difference | Both inspectors show the step's values side by side |

---

## 3. Screen details

### T1. Dev session (terminal)

| Shows | Actions |
| --- | --- |
| Pathlight Tracker version, pre-check results, UI URL, token hint, the user's app output (unchanged), Pathlight Tracker warnings prefixed `[pathlight-tracker]`, a one-line summary per finished request (optional, `--quiet` hides) | `Ctrl+C` stops the app and the collector (forwards the signal to the app first); `o` + Enter reopens the UI in the browser |

### T2. Doctor

| Shows | Actions |
| --- | --- |
| Each check with status and a fix | None; exits with code `0` (all good), `1` (blocking problems) |

### T3. Clear

| Shows | Actions |
| --- | --- |
| `pathlight-tracker clear`: "Moved 37 requests to the trash (restorable for 72 h)". `pathlight-tracker clear --purge`: confirmation prompt with counts, then "Deleted permanently" | `--yes` skips the prompt |

### S1. Connect (token gate)

| Shows | Actions |
| --- | --- |
| "Connect to your Pathlight Tracker session", explanation that the link with the token is in the terminal, a token field | Paste token → **Connect**; link "Where do I find this?" (shows the terminal line) |

### S2. Waiting for first request (onboarding)

| Shows | Actions |
| --- | --- |
| Big status card: app state (Starting → Connected, pid, framework), "Send any request to your app to see its map", example `curl` with the app's detected port if known, 3 quick tips | Copy the `curl` command; **Load sample data** (opens the seed example, read-only, clearly labelled "Sample"); dismiss tips |

### S3. Request list (left panel; whole workspace when nothing is selected)

| Shows | Actions |
| --- | --- |
| Rows (two lines): method chip, path, status code; duration · step count, start time. In-progress spinner, incomplete badge, restart dividers. Virtualized scroll, footer with the count of kept requests | Click row → S4; filter by path, method or status (filter menu: errors only, method, slow); **Follow latest** toggle; **Pin**; row `⋯` menu: **Delete** (finished only); **Clear all**; select two → **Compare** (v1); collapse / resize the panel |

### S4. Request map (centre panel)

| Shows | Actions |
| --- | --- |
| Header: method chip, path, status badge, duration · step count · start time. Tabs: **Trace** (MVP), Graph, Timeline, Logs (v1). Status legend (Success, Error, In progress, Caught). Step table with columns Step · Status · Duration · ⋯: chevron, error-path dot, step name, kind/layer badge (GUARD, PIPE, HANDLER, SERVICE, DB, IF…), inline return value with suspicious values highlighted, ✓/✕/spinner, duration, collapsed-count badge, redacted/truncated markers, indent guide lines. Error path auto-expanded. Truncation note if `PATHLIGHT_TRACKER_MAX_STEPS` was hit. Banner if the request is incomplete | Expand / collapse (click, `←`/`→`), **Expand error path** (`e`), **Collapse all**, select step (`↑`/`↓`), switch tab, header actions: **Copy link**, **Open in code** (handler), `⋯` → **Copy as cURL**, **Delete**; row `⋯` → Open in code, Copy value, Follow this object (v2) |

### S5. Step inspector (right panel)

| Shows | Actions |
| --- | --- |
| Header: step name, layer badge, `file:line` · class. Tabs: **Details**, **Error** (when the step threw), **Raw JSON**. Details: input arguments (`ARGS[0] · USER` blocks), result (hidden when the step threw), error card (type, message, `.ts` stack with Node internals collapsed), source location, additional info (duration, called by, Request ID, Step ID with copy buttons). For framework steps: guard allowed/blocked, pipe input vs output. For DB/HTTP boundaries: query or URL, payload, result summary. For decisions (v1): expression, values, result, branch. For loops (v1): iterations and samples. Markers: `[REDACTED]`, "truncated" with reason, ⚠ on suspicious `undefined` | **Open in code**; expand nested values (lazy-loaded); **Copy value** as JSON; copy IDs; **Follow this object** (v2, opens data journey); collapse / resize the panel |

### S6. Trash

| Shows | Actions |
| --- | --- |
| Trashed requests with method, path, status, deleted time, "deletes permanently in N h" | **Restore**, **Preview** (read-only map), **Delete permanently**, **Empty trash** (confirm dialogs) |

### S7. Settings

| Shows | Actions |
| --- | --- |
| Read-only: active config (include/exclude, redaction keys, limits, retention, trash TTL) with where each value came from (default / env / config file). Editable UI preferences: theme (system/light/dark), density, follow latest by default, show framework steps, show timings | Change UI preferences (saved in the browser); **Copy config as `pathlight-tracker.config.json`** |

### S8. Collector stopped / disconnected (overlay)

| Shows | Actions |
| --- | --- |
| "Reconnecting…" with attempt counter (temporary drop), or "Pathlight Tracker stopped. Start it again with `npx pathlight-tracker dev -- …`" (collector gone). Already-loaded data stays visible and greyed | **Retry now**; continue browsing loaded data read-only |

### S9. Version mismatch

| Shows | Actions |
| --- | --- |
| "This page was loaded from an older Pathlight Tracker version" or "Agent and collector versions don't match", with the update command | **Reload**; copy update command |

### S10. Not found

| Shows | Actions |
| --- | --- |
| In the map panel: "This request no longer exists. It may have been deleted or removed by retention." For a trashed request: "This request is in the trash" | **Back to requests**; **Restore** (if in trash) |

### S11. Search (v1)

| Shows | Actions |
| --- | --- |
| Matching steps grouped by request: function name, file, matched value snippet | Click result → S4 with that step selected |

### S12. Compare (v1)

| Shows | Actions |
| --- | --- |
| Two trees side by side, aligned; added/missing/changed steps highlighted; summary "3 differences" | Next/previous difference; swap sides; open either request |

---

## 4. Navigation

```
                    ┌──────────────┐
  Terminal (T1) ───▶│ S1 Connect   │── valid token ──┐
   opens URL with   └──────────────┘                 ▼
   #token ─────────────────────────────────▶ ┌────────────────┐
                                             │ S2 Waiting     │── first request ──┐
                                             └────────────────┘                   ▼
                                             ┌────────────────┐  click row  ┌───────────────┐
                                  ┌─────────▶│ S3 Requests    │────────────▶│ S4 Map + S5   │
                                  │          └────────────────┘◀── Back ────│ Inspector     │
                                  │            │  │  │                      └───────────────┘
                                  │   header:  │  │  └─ select 2 ─▶ S12 Compare (v1)   │
                                  │   Trash ───┘  └── Search ─────▶ S11 (v1) ──────────┘
                                  │      ▼
                                  │   S6 Trash ── Restore ──▶ back in S3
                                  └── S7 Settings (header ⚙)

  From any screen: connection lost ─▶ S8 overlay;  version mismatch ─▶ S9;  bad id ─▶ S10
  From S5: "Open in code" ─▶ VS Code (outside the app)
```

| From | To | How |
| --- | --- | --- |
| Terminal | S1 or S2/S3 | URL opened automatically or clicked; with token goes straight in |
| S1 | S2 or S3 | Valid token |
| S2 | S4 | First request auto-opens |
| S3 | S4 | Click a row, or `Enter` on a focused row |
| S4 | S3 | Request list is always visible on the left; `Esc` clears selection |
| S4 | S5 | Select a step (same page, right panel; URL gets `?step=`) |
| S5 | VS Code | **Open in code** (`vscode://file/<abs path>:<line>`) |
| Header | S6, S7, S11 | Trash, ⚙ Settings, Search (`/` or `Ctrl/Cmd+K`) |
| S6 | S3 | Restore, or Back |
| Any | S8, S9, S10 | Automatically on connection loss, version mismatch or missing data |

**Deep links:** every screen has a stable URL (`/requests/req_…?step=stp_…`), so the browser back/forward buttons work and a link can be reopened while the same collector database exists. Tokens are never put in these URLs.

**Keyboard:** `↑`/`↓` move between steps, `←`/`→` collapse/expand, `Enter` opens, `e` expands the error path, `o` opens in code, `/` search, `Esc` back, `Delete` moves the selected request to trash (with Undo).

---

## 5. Connected vs not connected ("logged-in vs logged-out")

There are no accounts. Access is controlled by the **one-time token** for the current collector run (see `tracer-architecture.md` §4).

| State | How the user gets here | What they see | What they can do |
| --- | --- | --- | --- |
| **Connected** ("logged in") | Opened the URL with `#token`, or pasted a valid token in S1 | Full app; header shows ● Connected | Everything |
| **No token** ("logged out") | Opened `http://127.0.0.1:<port>` without the token, or a new tab without `sessionStorage` | S1 Connect | Paste the token; nothing else loads (no data is sent without a token) |
| **Invalid token** | Wrong or mistyped token | S1 with error "This token doesn't match the running Pathlight Tracker session" | Retry |
| **Expired token** | Collector was restarted (new token); old tab still open | S8 "Pathlight Tracker was restarted. Open the new link from your terminal." | Open the new link; old data stays visible read-only until then |
| **Collector unreachable** | Collector stopped or crashed | S8 "Pathlight Tracker stopped" | Retry; browse already-loaded data read-only |
| **Wrong origin** | Page loaded from another site or host (e.g. a malicious page) | Requests rejected by the collector (`403 ORIGIN_NOT_ALLOWED`); no data | None, by design |

Session rules:

- The token lives in `sessionStorage` for that tab and is cleared when the tab closes.
- New tabs opened from inside the app (e.g. "Open in new tab") share the token; tabs opened by typing the bare URL show S1.
- There is no "log out" button; closing the tab or stopping the collector ends the session.

---

## 6. Empty, loading and error states

### Empty states

| Screen | Condition | Message and action |
| --- | --- | --- |
| S2 | Collector running, app not connected yet | "Waiting for your app to start…" + spinner; after 30 s: "Still waiting. Check the terminal for app errors." |
| S2 | App connected, no requests yet | "Send any request to your app to see its map" + example `curl` + **Load sample data** |
| S3 | Filter matches nothing | "No requests match 'payments'" + **Clear filter** |
| S3 | All requests moved to trash | "No requests. Deleted ones are in the Trash (37)" + link |
| S4 | Request has no steps from user code (e.g. served by a static file middleware) | "This request didn't run any of your code" + shows the request and response only |
| S4 | Request has steps but all files were excluded | "Your code for this request is excluded by PATHLIGHT_TRACKER_EXCLUDE" + link to S7 |
| S5 | No step selected | "Select a step to see its values" |
| S5 | Function with no arguments / void return | "No arguments" / "Returned undefined" |
| S6 | Trash empty | "Trash is empty. Deleted requests stay here for 72 hours." |
| S11 (v1) | No results | "No steps match. Search looks at function names, files and captured values." |

### Loading states

| Where | What loads | Display |
| --- | --- | --- |
| App start | Connecting to `/live`, first request list | Header shows "Connecting…"; skeleton rows in S3 (no spinner flash under 300 ms) |
| S3 | Older requests (scroll / pagination) | Skeleton rows at the bottom |
| S4 | Opening a completed request | Skeleton tree; first 200 steps rendered first, rest streamed in |
| S4 | Live request in progress | Steps appear as they arrive; spinner on running steps; elapsed timer in the header |
| S4 | Expanding a large subtree | Inline "Loading 1,240 steps…" row |
| S5 | Full value of a large object | Preview shown immediately; nested levels load on expand |
| S6 | Trash list | Skeleton rows |
| Actions (delete, restore, empty trash) | Waiting for the collector | Button shows a spinner and is disabled; UI updates optimistically for delete/restore and rolls back on failure |

### Error states

| Error | Where shown | Message | Recovery |
| --- | --- | --- | --- |
| Live connection dropped | S8 overlay (non-blocking for 5 s, then visible) | "Reconnecting… (attempt 3)" | Auto-retry with backoff; **Retry now** |
| Collector stopped | S8 | "Pathlight Tracker stopped. Start it again with `npx pathlight-tracker dev -- …`" | Read-only browsing of loaded data |
| REST call failed | Toast or in-panel | "Couldn't load this request (COLLECTOR_ERROR). Retry" | **Retry** |
| Request not found | S10 in map panel | "This request no longer exists" | Back to list |
| Request in trash | S10 | "This request is in the trash" | **Restore** |
| Agent auto-disabled | Header banner (yellow) + terminal | "Tracing turned off for pid 48213 after internal errors. Your app is unaffected." | Restart the app; link to logs |
| Agent can't reach collector | Terminal `[pathlight-tracker]` warning; UI shows "App not connected" | "Your app is running but not sending traces" | Check that both run from the same `pathlight-tracker dev` command |
| Request incomplete (app crashed / restarted) | Badge on row + banner in S4 | "This request didn't finish: the app stopped while it was running" | Shows everything recorded up to that point |
| Step limit reached | Note at the cut point in S4 | "Recording stopped after 5,000 steps (PATHLIGHT_TRACKER_MAX_STEPS)" | Change the limit in config |
| Version mismatch | S9 | "Agent 0.2 and collector 0.1 don't match" | Update command |
| UI panel crashed | That panel only (error boundary) | "This panel hit an error. Reload panel" | **Reload panel**; other panels keep working |

---

## 7. Edge cases

### Invalid input

| Case | Behaviour |
| --- | --- |
| Malformed URL id (`/requests/abc`) | S10 "Not found"; no crash |
| Pasted token with spaces or quotes | Trimmed automatically before checking |
| Invalid `pathlight-tracker.config.json` (bad JSON or unknown keys) | Terminal: clear error with file and line; falls back to defaults for that file; collector still starts |
| Invalid env value (`PATHLIGHT_TRACKER_MAX_DEPTH=abc`) | Terminal warning; default used |
| `pathlight-tracker dev` with no command after `--` | Usage help: `pathlight-tracker dev -- <your start command>` |
| Search with special characters (v1) | Treated as plain text, never as a regex or SQL |
| Captured string containing HTML or script | Rendered as text; never executed |
| Huge value (e.g. 50 MB buffer) | Captured as a summary ("Buffer, 50 MB, truncated"); never sent in full |
| Circular objects | Shown as `[Circular → User]` |
| Non-JSON values (BigInt, Symbol, functions, Map, Set, Date) | Shown with their type and a preview |
| Unicode, emoji, very long names | Names truncated with ellipsis and full text in tooltip |

### No permission

| Case | Behaviour |
| --- | --- |
| Missing or invalid token | S1 Connect / invalid token message (§5) |
| Request from another website (wrong `Origin`) | Rejected `403`; nothing displayed |
| Port in use (`PATHLIGHT_TRACKER_PORT` fixed) | Terminal: "Port 4000 is in use. Remove PATHLIGHT_TRACKER_PORT to use the default port." |
| No write permission for `.pathlight-tracker/` | Terminal error with path; falls back to in-memory storage for this run with a warning |
| `vscode://` links not handled (VS Code not installed, or link handler blocked) | After clicking **Open in code**, show the path with **Copy path** as fallback; Settings lets the user pick another editor URL pattern (e.g. Cursor, WebStorm) |
| Source file moved or deleted since the request | Open in code still tries; inspector notes "File may have changed since this request" if the file's timestamp is newer than the request |
| Delete pressed on an in-progress request | Button disabled with tooltip "Wait until the request finishes" |
| App in production mode (`NODE_ENV=production`) | Agent does not activate; terminal explains how to force it |

### Network and process failures

| Case | Behaviour |
| --- | --- |
| `/live` WebSocket drops | Auto-reconnect with backoff; on reconnect, refresh request list and in-progress requests; no duplicate steps (dedupe by `seq`) |
| Collector crashes | UI → S8; the user's app keeps running untraced (agent buffers a little, then drops events) |
| User's app crashes | Terminal shows the app's output; in-progress requests become **incomplete**; UI shows "App stopped (exit code 1)" in the header |
| App restarts (watch mode) | New session; restart divider in the list (J5) |
| Agent overloaded (very fast loops, thousands of calls) | Collector sends `slow_down`; agent collapses repeated calls; UI shows "Some repeated calls were collapsed" |
| Many concurrent requests | Each keeps its own map; list shows them in start order; auto-open follows the newest unless pinned |
| Very long request (minutes) | Stays in progress with a live timer; steps keep streaming |
| Request still running when the user deletes others with "Clear all" | In-progress requests are skipped and stay in the list |
| Two browser tabs open | Both stay in sync through `/live` (delete in one tab removes it in the other) |
| Request deleted in another tab while viewing it | Map panel switches to S10 "This request is in the trash" with **Restore** |
| Trash purge while viewing the trash | Row disappears with a short note "Permanently deleted after 72 hours" |
| Laptop sleeps and wakes | WebSocket reconnects automatically; timers resync |
| Windows paths (`C:\…`) | Normalised for display; `vscode://file/C:/…` used for links |
| Collector restarted with existing database | Old history shown; previous sessions marked "ended" |

---

## 8. Phase 1 summary of what exists where

| Feature | Terminal | Browser UI |
| --- | --- | --- |
| Start / stop tracing | ✓ | — |
| Setup checks | ✓ (`doctor`, pre-checks) | Warnings shown in S7 |
| See requests, maps, values | Summary line only | ✓ |
| Delete / restore / empty trash | `clear`, `clear --purge` | ✓ |
| Configuration | Env vars, `pathlight-tracker.config.json` | Read-only view (S7) |
| Open source code | — | ✓ (`vscode://` links) |

---

## 9. Phase 2 (VS Code extension) differences

| Area | Phase 1 (browser) | Phase 2 (VS Code) |
| --- | --- | --- |
| Start | `npx pathlight-tracker dev -- …` in a terminal | **Start with Pathlight Tracker** command / status bar button; picks the start script from `package.json` |
| Connect (S1) | Token in URL fragment | Not shown: the extension passes the token to the webview directly |
| Workspace (S3/S4/S5) | Browser tab | Webview panel beside the editor (same UI) |
| Open in code | `vscode://` link | Direct editor API; opens in the same window |
| Inline values | — | Values shown next to code lines after a request (decorations) |
| CodeLens | — | "Called 3× in last request · 2 errors" above functions |
| Collector stopped (S8) | Overlay | Extension restarts the collector automatically once, then shows a notification |
