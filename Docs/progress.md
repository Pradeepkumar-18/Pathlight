# Progress

Live status of `docs/implementation-plan.md`. Update this file in the same PR as every task (rules in `CLAUDE.md` → "Progress tracking").

**Status key:** ⬜ Not started · 🟡 In progress · ✅ Done · ⛔ Blocked · ⏭️ Skipped (with reason)

## Summary

| Phase | Tasks | Done | Status |
| --- | --- | --- | --- |
| 0 Setup and validation | 7 | 0 | ⬜ |
| 1 Capture spike | 4 | 0 | ⬜ |
| 2 Protocol and collector | 13 | 0 | ⬜ |
| 3 Runtime agent | 14 | 0 | ⬜ |
| 4 Map UI | 16 | 0 | ⬜ |
| 5 Integration and MVP release | 8 | 0 | ⬜ |
| **MVP total** | **62** | **0** | ⬜ |
| 6 v1 | 14 | 0 | ⬜ |
| 7 VS Code extension and v2 | 10 | 0 | ⬜ |
| 8 Future | 2 | 0 | ⬜ |

**Current phase:** Phase 0: Setup and validation (not started)
**Current task:** none yet (next: 0.1)
**Blockers:** none

## In progress

Tasks currently `🟡 In progress`. Remove the row when the task is done or blocked.

| ID | Task | Started | Notes |
| --- | --- | --- | --- |
| — | none | | |

## Known bugs / issues

Open bugs and issues found while coding. Close a row by setting Status to `Fixed` with the task or PR that fixed it; delete fixed rows at each checkpoint.

| ID | Found | Area | Description | Status | Fix (task / PR) |
| --- | --- | --- | --- | --- | --- |
| — | | | none | | |

IDs: `BUG-001`, `BUG-002`, …

## Decisions

Decisions made during planning and coding. Architecture or schema decisions also get a record in `docs/decisions/` (see `CLAUDE.md` → "Ask before changing").

| Date | Decision | Status | Record |
| --- | --- | --- | --- |
| 2026-10-30 | UI wording: "steps", not "spans" | ✅ Decided | `architecture.md` §11 #17 |
| 2026-10-30 | Final product name ("Tracer" is the working name) | ❓ Open | |
| 2026-10-30 | Condition probes in MVP or v1 (plan currently has them in v1, task 6.1) | ❓ Open | |
| 2026-10-30 | Licensing: open source / freemium / paid | ❓ Open | |

## Next steps

1. 0.1 Validate against AppMap → `docs/decisions/0001-appmap-validation.md`
2. 0.2 Create the monorepo
3. Resolve open decisions above before Checkpoint 0

---

## Phase 0: Setup and validation

| ID | Task | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| 0.1 | Validate against AppMap | ⬜ | | |
| 0.2 | Create the monorepo | ⬜ | | |
| 0.3 | Linting and formatting | ⬜ | | |
| 0.4 | Testing setup | ⬜ | | |
| 0.5 | CI | ⬜ | | |
| 0.6 | Fixture apps | ⬜ | | |
| 0.7 | Docs in repo | ⬜ | | |
| ✔ | **Checkpoint 0: Setup review** | ⬜ | | |

## Phase 1: Capture spike

| ID | Task | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| 1.1 | Require hook + SWC transform spike | ⬜ | | |
| 1.2 | Request context spike | ⬜ | | |
| 1.3 | Behaviour-preservation corpus v0 | ⬜ | | |
| 1.4 | Performance spike | ⬜ | | |
| ✔ | **Checkpoint 1: Go / no-go on capture approach** | ⬜ | | |

## Phase 2: Protocol and collector

| ID | Task | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| 2.1 | Protocol package: types and schemas | ⬜ | | |
| 2.2 | Collector CLI skeleton + config | ⬜ | | |
| 2.3 | Database setup | ⬜ | | |
| 2.4 | Seed data | ⬜ | | |
| 2.5 | Store layer | ⬜ | | |
| 2.6 | Soft delete, retention and purge | ⬜ | | |
| 2.7 | Server + auth | ⬜ | | |
| 2.8 | Ingest (`/agent`) | ⬜ | | |
| 2.9 | Trace builder | ⬜ | | |
| 2.10 | REST API (MVP endpoints) | ⬜ | | |
| 2.11 | Live hub (`/live`) | ⬜ | | |
| 2.12 | Launcher | ⬜ | | |
| 2.13 | Collector logging and errors | ⬜ | | |
| ✔ | **Checkpoint 2: Collector review** | ⬜ | | |

## Phase 3: Runtime agent

| ID | Task | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| 3.1 | Register, config and safety | ⬜ | | |
| 3.2 | Transport | ⬜ | | |
| 3.3 | Safe value capture | ⬜ | | |
| 3.4 | Redaction | ⬜ | | |
| 3.5 | Object IDs | ⬜ | | |
| 3.6 | Loader + transform (production) | ⬜ | | |
| 3.7 | Runtime helpers + source maps | ⬜ | | |
| 3.8 | Request context + HTTP patch | ⬜ | | |
| 3.9 | Express patch | ⬜ | | |
| 3.10 | NestJS patch | ⬜ | | |
| 3.11 | DB boundaries | ⬜ | | |
| 3.12 | Outbound HTTP boundaries | ⬜ | | |
| 3.13 | Error handling classification | ⬜ | | |
| 3.14 | Agent performance and safety pass | ⬜ | | |
| ✔ | **Checkpoint 3: Agent review** | ⬜ | | |

## Phase 4: Map UI

| ID | Task | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| 4.1 | UI project setup | ⬜ | | |
| 4.2 | Host adapter + connect flow | ⬜ | | |
| 4.3 | Data layer | ⬜ | | |
| 4.4 | Live client | ⬜ | | |
| 4.5 | App shell and layout | ⬜ | | |
| 4.6 | Request list | ⬜ | | |
| 4.7 | Request header + tabs | ⬜ | | |
| 4.8 | Step tree | ⬜ | | |
| 4.9 | Inspector | ⬜ | | |
| 4.10 | Delete, undo and trash | ⬜ | | |
| 4.11 | Settings screen | ⬜ | | |
| 4.12 | Onboarding and empty states | ⬜ | | |
| 4.13 | Loading and error states | ⬜ | | |
| 4.14 | Keyboard and accessibility | ⬜ | | |
| 4.15 | Responsive layout | ⬜ | | |
| 4.16 | Dark theme pass | ⬜ | | |
| ✔ | **Checkpoint 4: UI review** | ⬜ | | |

## Phase 5: Integration and MVP release

| ID | Task | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| 5.1 | End-to-end tests | ⬜ | | |
| 5.2 | Edge-case pass | ⬜ | | |
| 5.3 | `tracer doctor` and pre-checks | ⬜ | | |
| 5.4 | Performance acceptance | ⬜ | | |
| 5.5 | Security review | ⬜ | | |
| 5.6 | Packaging | ⬜ | | |
| 5.7 | User docs | ⬜ | | |
| 5.8 | Release `0.1.0` | ⬜ | | |
| ✔ | **Checkpoint 5: MVP release review** | ⬜ | | |

---

## ═══════ MVP LINE ═══════

---

## Phase 6: v1

| ID | Task | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| 6.1 | Condition probes | ⬜ | | |
| 6.2 | Decision rows in UI | ⬜ | | |
| 6.3 | Loop summaries | ⬜ | | |
| 6.4 | Callback collapsing and constructors | ⬜ | | |
| 6.5 | Argument mutation detection | ⬜ | | |
| 6.6 | Test runs as entry points | ⬜ | | |
| 6.7 | Redis, queue publish and log boundaries | ⬜ | | |
| 6.8 | Logs tab | ⬜ | | |
| 6.9 | Search | ⬜ | | |
| 6.10 | Compare two requests | ⬜ | | |
| 6.11 | Flow graph view | ⬜ | | |
| 6.12 | Timeline view | ⬜ | | |
| 6.13 | Custom config rules and client logs | ⬜ | | |
| 6.14 | v1 hardening and release `0.2.0` | ⬜ | | |
| ✔ | **Checkpoint 6: v1 review** | ⬜ | | |

## Phase 7: VS Code extension and v2

| ID | Task | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| 7.1 | Extension skeleton | ⬜ | | |
| 7.2 | Webview host adapter | ⬜ | | |
| 7.3 | Theme mapping | ⬜ | | |
| 7.4 | Editor integration | ⬜ | | |
| 7.5 | Publish extension | ⬜ | | |
| 7.6 | ESM and bundlers | ⬜ | | |
| 7.7 | Data journey | ⬜ | | |
| 7.8 | Queue consumers and cron entry points | ⬜ | | |
| 7.9 | More frameworks | ⬜ | | |
| 7.10 | Export and share | ⬜ | | |
| ✔ | **Checkpoint 7: Phase 2 product review** | ⬜ | | |

## Phase 8: Future

| ID | Task | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| 8.1 | MCP server | ⬜ | | |
| 8.2 | AI explanation layer | ⬜ | | |

---

## Log

Newest first. One entry per task (or checkpoint). Template:

```
### YYYY-MM-DD · <task ID> <task name> · ✅ Done | ⛔ Blocked
- Done when: <copied from implementation-plan.md>
- What changed: <1–3 lines>
- Tests: <added / updated>
- Docs updated: <files, or "none">
- Decisions: <added to "Decisions", or "none">
- Bugs: <added to / closed in "Known bugs / issues", or "none">
- Follow-ups: <new tasks, open questions, or "none">
```

### 2026-10-30 · Planning complete
- Docs written: PRD, tech stack, architecture, data model, user flows, design (+ UI reference), API spec, implementation plan, CLAUDE.md.
- Decisions: see "Decisions" (1 decided, 3 open).
- Next: task 0.1 (AppMap validation).
