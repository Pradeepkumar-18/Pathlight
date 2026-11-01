# Pathlight Tracker: Design (UI/UX)

Pathlight Tracker is a local developer debug visualizer: it draws a live map of each request as it hits your local Node/TypeScript server, showing every function it passed through and the real data at each step.

This document is the visual and interaction system for the map UI. The approved reference is the three-panel light design in `tracer-ui-reference.png` (request list · step tree · inspector). Explored alternatives are on the **Pathlight Tracker UI variants** canvas.

Related docs: `tracer-user-flows.md` (screens and states), `tracer-architecture.md` (UI modules), `tracer-tech-stack.md` (React, Tailwind, shadcn/ui).

---

## 0. Checklist at a glance

| Checkpoint | Where |
| --- | --- |
| Color palette with hex codes | §2 |
| Fonts and text sizes | §3 |
| Spacing and border-radius rules | §4 |
| Component library and reusable components | §5 |
| Layout rules (header, panels, widths) | §6 |
| Responsive behaviour | §7 |
| Light/dark mode decision | §8 |
| Wireframes and references | §9 |
| Accessibility basics | §10 |

---

## 1. Design principles

1. **The error path is the hero.** The first thing the eye lands on is where the request failed and the route that led there.
2. **Data over decoration.** Values, names and timings are the content; chrome stays quiet (white surfaces, hairline borders, one blue accent).
3. **Code looks like code.** Function names, paths, values and stack traces use the monospace font; labels and UI text use the sans font.
4. **Status is never colour alone.** Every status has a colour **and** a shape or word (✓ / ✕ / spinner, `500`, `GUARD`).
5. **Dense but calm.** Built for long trees: compact rows, clear alignment, generous contrast.
6. **Familiar to developers.** Patterns from browser DevTools and editors (tree, tabs, inspector, `Ctrl K`), not from marketing sites.

---

## 2. Color palette

Colors are defined once as **semantic tokens** (CSS variables) and mapped to Tailwind. Components use tokens, never raw hex. Every text pair below was checked for WCAG contrast (§10).

### 2.1 Core tokens

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--bg` | `#FFFFFF` | `#0F1115` | App background, panels |
| `--bg-subtle` | `#F8FAFC` | `#151820` | Table header row, code blocks, input fill |
| `--bg-muted` | `#F1F5F9` | `#1C2029` | Hover rows, neutral badges background |
| `--bg-selected` | `#EAF2FF` | `#1B2A44` | Selected request row and selected step row |
| `--border` | `#E5E7EB` | `#262B36` | Panel dividers, row separators (decorative) |
| `--border-control` | `#858E9C` | `#5D6575` | Input, checkbox and button outlines that must be seen (3:1) |
| `--text` | `#111827` | `#E6E8EE` | Primary text |
| `--text-secondary` | `#4B5563` | `#B4BAC6` | Labels, column headers, secondary values |
| `--text-muted` | `#5F6B7A` | `#8C94A3` | Meta text: durations, counts, timestamps |

### 2.2 Accent (brand and interaction)

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--accent` | `#2563EB` | `#5B9BFF` | Active tab underline, links, focus ring, toggles, "In progress" |
| `--accent-hover` | `#1D4ED8` | `#7DB0FF` | Hover on accent elements |
| `--accent-subtle` | `#EFF6FF` | `#16233A` | Accent backgrounds (outlined buttons on hover) |
| `--accent-border` | `#BFDBFE` | `#2F4670` | Selected-row outline |
| `--on-accent` | `#FFFFFF` | `#0F1115` | Text on a solid accent button |

### 2.3 Status

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--success` | `#16A34A` | `#3FB97F` | ✓ status icon |
| `--success-text` | `#15803D` | `#4ADE80` | `200`-class status codes, "allowed" |
| `--success-subtle` | `#F0FDF4` | `#10261B` | Success badge background |
| `--error` | `#DC2626` | `#F26D6D` | ✕ icon, error-path dot, solid `500` badge background (light) |
| `--error-text` | `#B91C1C` | `#FCA5A5` | Error messages, error-path names |
| `--error-subtle` | `#FEF2F2` | `#2A1719` | Error card background |
| `--error-border` | `#FECACA` | `#4A2226` | Error card border |
| `--warning-text` | `#92400E` | `#FCD34D` | Suspicious values (`undefined` where data was expected), `4xx` codes |
| `--warning-subtle` | `#FEF3C7` | `#2E2410` | Highlight behind a suspicious value |
| `--warning-border` | `#FDE68A` | `#5A4516` | Decision (`IF`) badge border |
| `--running` | = `--accent` | = `--accent` | In-progress spinner and dot |
| `--caught` | `#7C3AED` | `#C4B5FD` | Swallowed (caught) errors: dot and label |

Status legend shown above the tree: **Success** (green ✓), **Error** (red ✕), **In progress** (blue spinner), **Caught** (violet dot, an error that was caught and ignored).

### 2.4 HTTP methods and status codes

| Item | Light text / bg | Dark text / bg |
| --- | --- | --- |
| `GET` | `#1D4ED8` / `#EFF6FF` | `#93C5FD` / `#16233A` |
| `POST` | `#B45309` / `#FFFBEB` | `#FCD34D` / `#2E2410` |
| `PUT`, `PATCH` | `#6D28D9` / `#F5F3FF` | `#C4B5FD` / `#241D3D` |
| `DELETE` | `#BE123C` / `#FFF1F2` | `#FDA4AF` / `#3A1620` |
| `2xx` code | `--success-text` (text only) | same |
| `3xx` code | `--text-secondary` | same |
| `4xx` code | `--warning-text` | same |
| `5xx` code | White on `--error` (solid badge) in the map header; `--error-text` in lists | `#FFFFFF` on `#DC2626` |

POST uses amber, not red, so a `POST` is never confused with a failure. Only `5xx` is red.

### 2.5 Step kind badges

Small uppercase badges after the step name. Neutral badges keep the tree calm; only boundary and decision badges get colour.

| Badge | Shown for | Light text / bg / border | Dark text / bg |
| --- | --- | --- | --- |
| `GUARD`, `PIPE`, `INTERCEPTOR`, `MIDDLEWARE`, `FILTER` | Framework steps | `#4B5563` / `#F3F4F6` / none | `#B4BAC6` / `#1C2029` |
| `HANDLER`, `CONTROLLER`, `SERVICE`, `REPOSITORY`, `FN` | Your code (layer, see note) | `#4B5563` / `#F3F4F6` / none | `#B4BAC6` / `#1C2029` |
| `DB` | Database boundary | `#15803D` / `#F0FDF4` / `#86EFAC` | `#86EFAC` / `#10261B` |
| `HTTP` | Outgoing HTTP boundary | `#0369A1` / `#F0F9FF` / `#7DD3FC` | `#7DD3FC` / `#0E2433` |
| `IF`, `SWITCH` (MVP), `LOOP` (v1) | Decisions and loops | `#92400E` / `#FFFBEB` / `#FDE68A` | `#FCD34D` / `#2E2410` |

**Layer badge rule:** for `method` steps the badge is derived in the UI from the class name suffix (`…Controller` → CONTROLLER, `…Service` → SERVICE, `…Repository` / `…Repo` → REPOSITORY); anything else shows `FN`. No database change is needed.

### 2.6 Code and value colours

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--code-key` | `#4B5563` | `#B4BAC6` | Object keys |
| `--code-string` | `#047857` | `#6EE7B7` | Strings |
| `--code-number` | `#1D4ED8` | `#93C5FD` | Numbers, BigInt |
| `--code-literal` | `#6D28D9` | `#C4B5FD` | `true`, `false`, `null` |
| `--code-suspicious` | `--warning-text` on `--warning-subtle` | same | `undefined` and `NaN` inside objects, flagged |
| `--code-redacted` | `--text-muted`, italic | same | `[REDACTED]` |
| `--code-punctuation` | `--text-muted` | same | Braces, commas |

---

## 3. Typography

| Role | Font | Fallback stack |
| --- | --- | --- |
| UI text | **Inter** (variable, 400 / 500 / 600) | `system-ui, -apple-system, "Segoe UI", sans-serif` |
| Code, names, values, paths | **JetBrains Mono** (400 / 500) | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` |

Fonts are **bundled with the UI** (Fontsource packages), never loaded from a CDN, so the app works offline and inside VS Code webviews. Numbers in tables and durations use `font-variant-numeric: tabular-nums` so columns align.

### Type scale

| Token | Size / line height | Weight | Font | Used for |
| --- | --- | --- | --- | --- |
| `text-title` | 20 / 28 | 600 | Inter | Request title in map header (`/orders`) |
| `text-heading` | 16 / 24 | 600 | Inter | Panel titles ("Requests"), inspector step name |
| `text-body` | 14 / 20 | 400 | Inter | Default UI text, tabs, buttons, request paths |
| `text-body-strong` | 14 / 20 | 500 | Inter | Selected tab, step names in the tree |
| `text-small` | 13 / 18 | 400 | Inter | Secondary info, table cells, inspector rows |
| `text-caption` | 12 / 16 | 400 | Inter | Meta: "84 ms · 9 steps", legends, timestamps |
| `text-label` | 11 / 14 | 600, uppercase, +0.04em | Inter | Badges, column headers, `ARGS[0] · USER` |
| `code-body` | 13 / 20 | 400 | JetBrains Mono | Values, JSON, stack traces, file paths |
| `code-small` | 12 / 18 | 400 | JetBrains Mono | Inline values in tree rows, IDs |

Rules: two weights per screen region at most; never below 11px; sentence case everywhere except badges and column labels.

---

## 4. Spacing and border radius

### Spacing

Base unit **4 px**. Use only these steps:

| Token | Value | Typical use |
| --- | --- | --- |
| `space-1` | 4 px | Icon to text inside a badge |
| `space-2` | 8 px | Gap between inline items, badge padding |
| `space-3` | 12 px | Row padding, gap between controls |
| `space-4` | 16 px | Panel inner padding (inspector, list) |
| `space-5` | 20 px | Section gap inside inspector |
| `space-6` | 24 px | Panel padding (map), gap between header groups |
| `space-8` | 32 px | Empty-state padding |
| `space-12` | 48 px | Large empty-state spacing |

Fixed sizes:

| Element | Size |
| --- | --- |
| Header height | 56 px |
| Request list row | 64 px (two lines) |
| Step tree row | 40 px (comfortable) / 32 px (compact setting) |
| Tree indent per level | 24 px, with a 1 px guide line in `--border` |
| Buttons and inputs | 36 px tall (default), 32 px (small, in panel headers) |
| Icon size | 16 px (in buttons and rows), 20 px (header) |
| Minimum click target | 32 × 32 px in dense rows, 44 × 44 px for primary actions on touch screens |

### Border radius

| Token | Value | Used for |
| --- | --- | --- |
| `radius-sm` | 4 px | Badges, method chips, inline value highlights |
| `radius-md` | 6 px | Buttons, inputs, tree rows, selected rows |
| `radius-lg` | 8 px | Cards, code blocks, error card, dropdowns, dialogs |
| `radius-full` | 999 px | Status pills ("Connected"), toggles, avatars of agents |

### Elevation

Flat by default. Shadows only for floating layers:

| Layer | Shadow |
| --- | --- |
| Dropdowns, tooltips, command palette | `0 4px 16px rgba(17, 24, 39, 0.12)` (dark: `rgba(0,0,0,0.5)`) |
| Dialogs and drawers | `0 12px 32px rgba(17, 24, 39, 0.18)` (dark: `rgba(0,0,0,0.6)`) |

---

## 5. Components

### 5.1 Library

**shadcn/ui** (Radix primitives, copied into `packages/ui/src/components/ui`) styled with Tailwind tokens from §2–§4, plus **Lucide** icons. No other component library.

| shadcn/ui component | Used for |
| --- | --- |
| `Button` (variants: default, outline, ghost, destructive, link) | All actions |
| `Input` | Filters, connect token |
| `Switch` | Follow latest |
| `Tabs` | Trace / Graph / Timeline / Logs; Details / Error / Raw JSON |
| `Badge` | Method, kind, status badges |
| `Tooltip` | Icon buttons, truncated names |
| `DropdownMenu` | Row "⋯" menus, project/session menu |
| `Dialog`, `AlertDialog` | Confirm empty trash, delete permanently |
| `Sheet` | Panels as drawers on smaller screens |
| `Command` | Search palette (`Ctrl K`) |
| `ScrollArea` | Panels |
| `ResizablePanelGroup` | Draggable panel widths |
| `Toast` (Sonner) | "Moved to trash · Undo", copy confirmations |
| `Skeleton` | Loading rows |
| `Separator` | Dividers |

### 5.2 Pathlight Tracker components

| Component | What it is | Key states |
| --- | --- | --- |
| `AppHeader` | Logo, project name, connection pill, agent info, search, icon actions | Connected / reconnecting / stopped |
| `ConnectionPill` | Dot + label | Connected (green), Reconnecting (blue spinner), Stopped (red) |
| `RequestList` | Filter, Follow latest toggle, virtualized rows, restart dividers | Loading, empty, filtered-empty |
| `RequestRow` | Method chip, path, status code, duration · step count, time | Default, hover, selected, in progress, incomplete, error |
| `MethodChip` | `GET` / `POST` / … coloured per §2.4 | — |
| `StatusCode` | `200` text or solid `500` badge | 2xx / 3xx / 4xx / 5xx |
| `RequestHeader` | Method, path, status badge, duration, step count, time, actions (Copy link, Open in code, ⋯) | Running (timer), done, incomplete |
| `StepTree` | Virtualized table: Step / Status / Duration / ⋯ columns; guide lines; auto-expanded error path | Live streaming, truncated, empty |
| `StepRow` | Chevron, status dot, name, kind badge, inline return value, status icon, duration, ⋯ menu | Default, hover, selected, error path, running, collapsed group (×N) |
| `KindBadge` | §2.5 badges | — |
| `StatusIcon` | ✓ / ✕ / spinner / caught dot | success, error, running, caught |
| `StatusLegend` | Legend above the tree | — |
| `Inspector` | Step name, layer badge, file:line, tabs (Details / Error / Raw JSON) | No selection, loading, error step |
| `ValueView` | Expandable JSON-like value with syntax colours, suspicious-value highlight, redacted and truncated markers | Collapsed, expanded, lazy-loading |
| `ArgumentBlock` | `ARGS[0] · USER` label + `ValueView` | — |
| `ErrorCard` | Error type, message, `.ts` stack (Node internals collapsed) | — |
| `SourceLocation` | File icon, `file:line`, **Open in code** | Link unavailable → Copy path |
| `InfoList` | Key/value rows: Duration, Called by, Request ID, Step ID (copy buttons) | — |
| `EmptyState` | Icon, title, text, one action | — |
| `Banner` | Full-width message under header | Info, warning (agent disabled), error (stopped) |
| `ConfirmDialog` | Wraps AlertDialog with exact counts | — |

---

## 6. Layout

### 6.1 App shell (desktop)

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ Header 56px: Logo · project ▾ · ● Connected · Agent pid · NestJS   [Search  Ctrl K] ⟳ 🗑 ⚙ │
├──────────────────────┬────────────────────────────────────────────┬──────────────────────┤
│ Request list         │ Map                                        │ Inspector            │
│ 320px (240–420)      │ fluid, min 480px                           │ 400px (320–560)      │
│ resizable,           │ RequestHeader                              │ resizable,           │
│ collapsible          │ Tabs: Trace · Graph · Timeline · Logs      │ collapsible          │
│                      │ Legend                                     │                      │
│                      │ StepTree (Step / Status / Duration / ⋯)    │ Details · Error ·    │
│                      │                                            │ Raw JSON             │
└──────────────────────┴────────────────────────────────────────────┴──────────────────────┘
```

| Rule | Value |
| --- | --- |
| Header | 56 px, full width, `--bg`, bottom `--border`; not sticky-scrolling (the panels scroll, the header never does) |
| Navigation | In the header only. **No navigation sidebar** (Requests, Search, Trash and Settings are the only destinations) |
| Request list | Left panel. Default 320 px; drag to resize 240–420 px; collapse with `[` or the panel button; width remembered per browser |
| Map | Centre, takes remaining width, minimum 480 px |
| Inspector | Right panel. Default 400 px; resize 320–560 px; collapse with `]`; opens automatically when a step is selected |
| Page width | Full window; no max-width (a tool, not a document). Content inside panels is left-aligned |
| Scrolling | Each panel scrolls independently; the page itself never scrolls on desktop |
| Panel padding | List 16 px; map 24 px; inspector 20 px |
| Column alignment | Status column fixed 72 px, Duration column fixed 88 px right-aligned, ⋯ column 40 px |

### 6.2 Header contents (left → right)

| Item | Behaviour |
| --- | --- |
| Logo + "Pathlight Tracker" | Goes to the request list |
| Project name ▾ | Shows the project folder name; the menu lists sessions (app restarts). Not a project switcher (one collector = one project) |
| Connection pill | §5.2 `ConnectionPill` |
| Agent info | `Agent pid 48213 · NestJS`; tooltip with Node version and agent version |
| Search | Opens the `Ctrl K` command palette (v1 search; in MVP it searches loaded requests and steps) |
| Reconnect (⟳) | Visible only when disconnected; otherwise hidden (data is live) |
| Trash | Goes to `/trash`, with a count badge when not empty |
| Settings | Goes to `/settings` |

There is **no user avatar**: Pathlight Tracker has no accounts.

### 6.3 Map content

| Element | Rule |
| --- | --- |
| Request header | Method chip (large), path (`text-title`), status badge, `84 ms · 9 steps · 12:04:58`, then right-aligned actions: **Copy link**, **Open in code** (opens the handler), `⋯` (Copy as cURL, Delete) |
| Tabs | Trace (MVP), Graph (v1), Timeline (v1), Logs (v1, captured `console.log` output for this request) |
| Legend | Right of tabs, `text-caption` |
| Tree columns | Step · Status · Duration · ⋯ |
| Inline values | After a step name, the return value preview in `code-small`; suspicious values in `--warning-text` on `--warning-subtle` |
| Error path | Red dot before the name, ✕ status, auto-expanded |
| Selection | Row gets `--bg-selected` and `--accent-border` outline |

---

## 7. Responsive behaviour

Pathlight Tracker is **desktop-first** (it runs next to your editor), but every screen works down to phone width.

| Width | Layout |
| --- | --- |
| **≥ 1280 px (desktop)** | Three panels side by side (§6.1) |
| **1024–1279 px (small laptop)** | List + map side by side; inspector becomes a right-side `Sheet` (drawer) that opens when a step is selected |
| **768–1023 px (tablet)** | Map only; request list is a left drawer (button in the header); inspector is a right drawer |
| **< 768 px (phone)** | One column, one screen at a time: Requests → Map → Step details, with a back button in a 48 px header; tree indent reduces to 16 px per level; Status and Duration columns merge under the name; header actions move into a `⋯` menu |

Rules at every size:

- No horizontal page scroll. Long names truncate with an ellipsis and show the full name in a tooltip (or on tap).
- Wide values in the inspector wrap; the Raw JSON tab scrolls horizontally inside its own box.
- Touch targets are 44 × 44 px below 1024 px.

**Phase 2 (VS Code webview):** the panel is often narrow (beside the editor), so the same breakpoints apply to the panel width, not the window width.

---

## 8. Light and dark mode

| Decision | Detail |
| --- | --- |
| Both themes ship in the MVP | Light (as in the reference) and dark, from the same tokens (§2) |
| Default | Follow the operating system (`prefers-color-scheme`) |
| Override | Settings → Theme: System / Light / Dark, remembered per browser |
| Implementation | Tokens as CSS variables on `:root` and `[data-theme="dark"]`; Tailwind `darkMode: ["class", '[data-theme="dark"]']` |
| Phase 2 | In VS Code, follow the editor theme by mapping tokens to VS Code theme variables (`--vscode-editor-background`, etc.); status colours stay Pathlight Tracker's own so meaning never changes |
| Rule | No component may hard-code a colour; every new colour is a token with both light and dark values, checked for contrast |

---

## 9. Wireframes and references

| Reference | Where |
| --- | --- |
| **Approved main screen** (request list · step tree · inspector) | `tracer-ui-reference.png` |
| Explored directions A–D (Midnight IDE, Paper, Signal, Metro map) with palettes | **Pathlight Tracker UI variants** design canvas |
| Screen list, states and flows | `tracer-user-flows.md` |

### Differences between the reference image and this spec

The reference is followed closely; these items are adjusted on purpose:

| In the reference | In the spec | Why |
| --- | --- | --- |
| "spans", Trace ID, Span ID | "steps", Request ID, Step ID | Matches the data model and API; friendlier than tracing jargon |
| User avatar (top right) | Removed | No accounts |
| Project dropdown as a switcher | Project name with a sessions menu | One collector serves one project |
| Refresh button always shown | Reconnect shown only when disconnected | Data is live |
| Pagination "1–10 of 248" | Virtualized list with a total count | Retention keeps 100 requests; scrolling is faster than paging |
| "Skipped" in the legend | "Caught" (swallowed error) | Matches captured states; nothing is "skipped" |
| "Result: undefined" on a step that threw | Result hidden; Error shown instead | A step that threw has no return value |
| Stack trace with Node internals | Your `.ts` frames first; internals collapsed under "Show 3 internal frames" | Keeps the useful frames visible |
| POST chip in red | POST in amber | Red is reserved for errors |

### Other screens (structure)

**Waiting for first request (onboarding)**

```
┌ Header ─────────────────────────────────────────────────────────────┐
│                                                                     │
│            ● Agent connected · pid 48213 · NestJS                   │
│            Send any request to your app to see its map              │
│            ┌──────────────────────────────────────────┐             │
│            │ curl -X POST http://localhost:3000/orders │  [Copy]    │
│            └──────────────────────────────────────────┘             │
│            [Load sample data]                                       │
│            Tips: click a step to see values · red = path to error  │
└─────────────────────────────────────────────────────────────────────┘
```

**Trash**

```
┌ Header ─────────────────────────────────────────────────────────────┐
│ Trash · 3 requests · deleted requests are kept for 72 hours [Empty] │
│ GET  /health     200   deleted 2 min ago   deletes in 71 h  Restore ⋯│
│ POST /bookings   500   deleted 1 h ago     deletes in 70 h  Restore ⋯│
└─────────────────────────────────────────────────────────────────────┘
```

**Connect (no token)**

```
┌─────────────────────────────────────────────┐
│ Connect to your Pathlight Tracker session              │
│ Open the link printed in your terminal, or  │
│ paste the token here:                       │
│ [ token                       ] [Connect]   │
│ Where do I find this?                       │
└─────────────────────────────────────────────┘
```

**Phone (< 768 px)**

```
┌ ← POST /orders   500 ⋯ ┐      ┌ ← calculateDiscount  ┐
│ Trace │ Logs           │      │ Details │ Error      │
│ ● OrdersController ✕   │ tap  │ ARGS[0] · USER       │
│   81 ms                │ ───▶ │ { id: 7, tier:       │
│  ● OrdersService ✕     │      │   undefined ⚠ }      │
│    80.5 ms             │      │ [Open in code]       │
└────────────────────────┘      └──────────────────────┘
```

---

## 10. Accessibility basics

Target: **WCAG 2.2 AA**.

### Contrast (checked)

All text tokens in §2 were measured against the backgrounds they sit on:

| Pair | Light | Dark |
| --- | --- | --- |
| Primary text on background | 17.7 : 1 | 15.4 : 1 |
| Secondary text on background | 7.6 : 1 | 9.7 : 1 |
| Muted text on background / selected row | 5.4 : 1 / 4.8 : 1 | 6.2 : 1 / 4.7 : 1 |
| Accent on background; text on accent button | 5.2 : 1 | 6.8 : 1 |
| Error text on error card | 5.9 : 1 | 9.0 : 1 |
| Warning text on warning highlight | 6.4 : 1 | 10.6 : 1 |
| White on solid `500` badge | 4.8 : 1 | 4.8 : 1 |
| Method chips (GET / POST / PATCH / DELETE) | 6.2 / 4.8 / 6.5 / 5.7 : 1 | 8.7 / 10.6 / 8.6 / 8.4 : 1 |
| Control borders (inputs, checkboxes) | 3.3 : 1 | 3.2 : 1 |
| Status icons (✓, ✕) | 3.3 / 4.8 : 1 | ≥ 6 : 1 |

Rule: text ≥ 4.5 : 1, icons and control borders ≥ 3 : 1. Decorative dividers (`--border`) are exempt. Any new token is checked before use.

### Not colour alone

- Status: icon shape (✓ / ✕ / spinner / dot) + colour + accessible name ("Error").
- Error path: red dot **and** ✕ **and** auto-expansion.
- Methods: always the word (`POST`), never only a colour.
- Suspicious values: highlight **and** ⚠ icon with the tooltip "Missing value".

### Labels and semantics

- Real elements: `<button>`, `<a href>`, `<input>` with `<label>`; never click handlers on `<div>`.
- Icon-only buttons have `aria-label` ("Trash", "Settings", "More actions for OrdersService.create").
- The step tree uses the ARIA `treegrid` pattern: rows have `aria-level`, `aria-expanded`, `aria-selected`; columns have headers.
- The request list is a `listbox` with `aria-selected` on the active row.
- Live updates: one polite `aria-live` region announces "New request POST /orders, 500" and "Request finished"; it does **not** announce every streamed step.
- Each route sets the page `<title>` (e.g. "POST /orders 500 · Pathlight Tracker").

### Keyboard

| Key | Action |
| --- | --- |
| `Tab` / `Shift Tab` | Move between header, request list, tree, inspector |
| `↑` / `↓` | Move within the list or tree |
| `←` / `→` | Collapse / expand a tree row (or move to parent / first child) |
| `Enter` | Open the focused request or select the focused step |
| `e` | Expand the error path |
| `o` | Open the selected step in code |
| `Ctrl K` / `Cmd K` or `/` | Search |
| `[` / `]` | Collapse / expand the request list / inspector |
| `Esc` | Close drawer, dialog or palette; clear selection |
| `Delete` | Move the selected request to trash (with Undo) |

- Visible focus ring on everything: 2 px `--accent` outline with 2 px offset.
- Focus is trapped in dialogs and returns to the trigger on close.
- Shortcuts never fire while typing in an input.

### Motion and sizing

- Respect `prefers-reduced-motion`: no row slide-in animation and a static "running" indicator instead of a spinner.
- UI works at 200% browser zoom without losing content (panels collapse into drawers).
- Minimum text size 11 px; users can switch the tree to the comfortable 40 px row height in Settings.
