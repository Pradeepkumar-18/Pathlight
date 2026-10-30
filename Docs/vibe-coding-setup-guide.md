# Vibe Coding Project Setup Guide

A complete guide to the documentation and Claude agent setup needed before vibe coding a project from a PRD.

---

## Table of Contents

1. [Documents You Need Besides the PRD](#1-documents-you-need-besides-the-prd)
2. [Tech Stack vs Architecture: What Each File Contains](#2-tech-stack-vs-architecture-what-each-file-contains)
3. [Checklists for Every MD File](#3-checklists-for-every-md-file)
4. [Final Cross-Check: Who Does It, You or the AI?](#4-final-cross-check-who-does-it-you-or-the-ai)
5. [Setting Up Agent Files for Claude Code](#5-setting-up-agent-files-for-claude-code)
6. [Sources](#6-sources)

---

## 1. Documents You Need Besides the PRD

An AI coding tool works best when it has clear context and doesn't have to guess. Prepare these documents, roughly in order of importance.

### 1.1 Tech Stack / Architecture doc (most important)
- Frontend, backend, database, auth, hosting (e.g., Next.js + Supabase + Vercel)
- Exact versions of key libraries
- Folder structure you want
- How the main pieces connect, such as the frontend calling an API that talks to the DB

Without this, the AI picks a different stack each time.

### 1.2 Data Model / Database Schema
- Tables or collections, fields, types, and relationships
- Example: `users`, `projects`, `tasks`, and how they link

### 1.3 User Flows / App Flow doc
- Every screen and how users move between them
- Example: "Signup → onboarding → dashboard → create project"
- Include edge cases such as logged-out users and empty states

### 1.4 UI/UX Guidelines (Design doc)
- Colors, fonts, spacing, component library (e.g., shadcn/ui, Tailwind)
- Rough wireframes or reference screenshots
- Keeps the UI consistent across screens

### 1.5 API Spec (if you have a backend)
- Endpoints, methods, request/response shapes, and error formats

### 1.6 Implementation Plan / Task Breakdown
- The project split into small, ordered steps, for example:
  1. Set up project and auth
  2. Build database schema
  3. Build dashboard
- Feed the AI one step at a time. This is the biggest factor in vibe coding success.

### 1.7 Rules file for the AI (e.g., `CLAUDE.md`, `.cursorrules`)
- Coding conventions, such as "use TypeScript, no `any`, functional components"
- Things to avoid, such as "don't change the DB schema without asking"
- Commands to run and test the project

### 1.8 Progress / Changelog file
- A running note of what's done, what's in progress, and known bugs
- Helps the AI pick up context in new sessions

### Nice to have
- Security checklist (env variables, auth rules, input validation)
- Testing plan
- Deployment doc

### Minimum set (lean version)
**PRD + Tech Stack + Data Model + Implementation Plan + AI rules file**

### Practical tip
You can ask an AI to *generate* these documents from your PRD. Review and edit each one before you start coding.

---

## 2. Tech Stack vs Architecture: What Each File Contains

Simple rule:
- **Tech Stack = "what tools we use"**
- **Architecture = "how the pieces fit together and work"**

### 2.1 `tech-stack.md`: the tools

A reference list the AI checks so it doesn't invent or swap libraries.

- **Frontend:** framework, language, styling, UI library
  e.g., Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** runtime, framework, e.g., Node.js, Next.js API routes / Express / FastAPI
- **Database & ORM:** e.g., PostgreSQL (Supabase), Prisma / Drizzle
- **Auth:** e.g., Supabase Auth, Clerk, NextAuth
- **State management & data fetching:** e.g., Zustand, TanStack Query
- **Third-party services:** payments (Stripe/Razorpay), email (Resend), storage (S3), AI APIs
- **Hosting & deployment:** e.g., Vercel, Railway, Docker
- **Dev tools:** package manager (pnpm/npm), linter, formatter, testing framework
- **Versions:** pin the important ones
- **Not allowed / avoid:** e.g., "Don't use Redux," "No CSS-in-JS"

Keep it short, factual, and mostly bullet points.

### 2.2 `architecture.md`: how it works

Explains the structure and the rules of the system.

- **System overview:** a short paragraph or diagram showing the main parts
  e.g., Client → API layer → Services → Database, plus external services
- **Folder / project structure:** the directory tree and what goes where

  ```
  /app        → pages & routes
  /components → reusable UI
  /lib        → utilities, db client
  /services   → business logic
  /types      → shared TypeScript types
  ```

- **Data flow:** how a request travels, e.g., "UI → server action → service → DB → response"
- **Auth & authorization flow:** how login works, how sessions are stored, who can access what (roles, protected routes)
- **Key modules / features:** each major module and its responsibility
- **API design approach:** REST vs server actions vs tRPC, naming conventions, error format
- **State management approach:** what lives on the server, what's client state, and caching
- **Environment & config:** list of env variable *names* (never real secrets), dev/staging/prod setup
- **Security considerations:** input validation, row-level security, rate limiting
- **Error handling & logging:** where errors are caught and how they're shown or logged
- **Architecture decisions:** short notes like "Chose server actions over REST because…" These stop the AI from "fixing" things you chose on purpose.

### 2.3 Tip
At the top of your AI rules file (`CLAUDE.md` / `.cursorrules`), reference both:

> "Always follow `tech-stack.md` and `architecture.md`. Don't add new libraries or change the structure without asking."

---

## 3. Checklists for Every MD File

Before you start coding, tick every box. Anything left unchecked is something the AI will end up guessing.

### 3.1 `prd.md`
- [ ] Problem statement: what problem you're solving and for whom
- [ ] Target users / personas
- [ ] Core features, listed and prioritized (Must-have / Nice-to-have)
- [ ] User stories ("As a user, I want to… so that…")
- [ ] Acceptance criteria for each feature
- [ ] Out of scope: what you are *not* building in v1
- [ ] Success metrics
- [ ] Assumptions and open questions

### 3.2 `tech-stack.md`
- [ ] Frontend framework + language + styling + UI library
- [ ] Backend / runtime / framework
- [ ] Database + ORM
- [ ] Auth provider
- [ ] State management + data fetching
- [ ] Third-party services (payments, email, storage, AI APIs)
- [ ] Hosting / deployment platform
- [ ] Package manager, linter, formatter, test framework
- [ ] Key versions pinned
- [ ] "Do not use" list

### 3.3 `architecture.md`
- [ ] System overview (diagram or paragraph)
- [ ] Folder structure with purpose of each folder
- [ ] Request / data flow explained
- [ ] Auth and authorization flow (roles, protected routes)
- [ ] Main modules and their responsibilities
- [ ] API approach (REST / server actions / tRPC) + naming conventions
- [ ] Client vs server state and caching rules
- [ ] Env variable names listed (no real secrets)
- [ ] Security rules (validation, RLS, rate limiting)
- [ ] Error handling and logging approach
- [ ] Key decisions with reasons

### 3.4 `data-model.md` (database schema)
- [ ] Every table/collection listed
- [ ] Fields with types, required/optional, defaults
- [ ] Primary keys and foreign keys
- [ ] Relationships (one-to-many, many-to-many)
- [ ] Indexes and unique constraints
- [ ] Enums / allowed values
- [ ] Timestamps (`created_at`, `updated_at`) and soft-delete rule
- [ ] Access rules (who can read/write each table)
- [ ] Sample data / seed data

### 3.5 `user-flows.md`
- [ ] Full list of screens/pages
- [ ] Step-by-step flow for each main journey (signup, onboarding, core action)
- [ ] What each screen shows and what actions it has
- [ ] Navigation between screens
- [ ] Logged-in vs logged-out behavior
- [ ] Empty states, loading states, error states
- [ ] Edge cases (invalid input, no permission, network fail)

### 3.6 `design.md` (UI/UX)
- [ ] Color palette (with hex codes)
- [ ] Fonts and text sizes
- [ ] Spacing and border-radius rules
- [ ] Component library and reusable components list
- [ ] Layout rules (sidebar, navbar, page width)
- [ ] Responsive behavior (mobile / tablet / desktop)
- [ ] Light/dark mode decision
- [ ] Wireframes or reference screenshots/links
- [ ] Accessibility basics (contrast, labels, keyboard use)

### 3.7 `api-spec.md` (if you have a backend)
- [ ] Every endpoint: method + path
- [ ] Purpose of each endpoint
- [ ] Request body / params with types
- [ ] Response shape (success example)
- [ ] Error responses and status codes
- [ ] Auth required? Which roles?
- [ ] Pagination, filtering, sorting rules
- [ ] Rate limits (if any)

### 3.8 `implementation-plan.md`
- [ ] Project broken into phases
- [ ] Each phase broken into small tasks (one AI session each)
- [ ] Tasks in correct order (dependencies first)
- [ ] "Done when…" condition for each task
- [ ] Setup tasks first (repo, env, DB, auth)
- [ ] Testing / review checkpoint after each phase
- [ ] MVP line clearly marked

### 3.9 `CLAUDE.md` / `.cursorrules` (AI rules)
- [ ] Short project summary (2–3 lines)
- [ ] Links to all other md files and when to read them
- [ ] Coding conventions (language, naming, file style)
- [ ] Do's and don'ts ("don't add libraries without asking")
- [ ] Commands: install, run, build, test, lint
- [ ] How to handle errors and edge cases
- [ ] "Ask before changing schema / architecture" rule
- [ ] "Update progress.md after each task" rule

### 3.10 `progress.md`
- [ ] Current phase / current task
- [ ] Completed tasks (with date)
- [ ] In-progress tasks
- [ ] Known bugs / issues
- [ ] Decisions made during coding
- [ ] Next steps

### 3.11 Final cross-check before coding
- [ ] Feature names are the same in PRD, user flows, and implementation plan
- [ ] Every PRD feature appears in the implementation plan
- [ ] Every table in the data model is used by some feature
- [ ] Tech stack and architecture don't contradict each other
- [ ] No real API keys or passwords in any file

---

## 4. Final Cross-Check: Who Does It, You or the AI?

**Answer: both.** Let the AI do the first pass, then you verify the important parts.

Since the AI wrote most of these files (everything except the PRD), it may not notice its own mistakes, and it can confidently say "everything is consistent" when it isn't.

### Step 1: Let the AI do the heavy checking

Open a **fresh chat/session** so it isn't biased by the conversation that created the files. Give it all the md files and use this prompt:

```
Act as a strict reviewer. Read all these files: prd.md, tech-stack.md,
architecture.md, data-model.md, user-flows.md, design.md, api-spec.md,
implementation-plan.md, CLAUDE.md.

Check and report:
1. Any PRD feature missing from user-flows or implementation-plan
2. Any feature/screen/task that is NOT in the PRD (scope creep)
3. Feature or entity names that differ between files
4. Tables in data-model not used by any feature, or features needing
   data that has no table
5. API endpoints missing for any user flow, or endpoints no flow uses
6. Contradictions between tech-stack and architecture
7. Anything vague the AI would have to guess while coding
8. Any real secrets/API keys

List every issue with the file name and a suggested fix.
Don't rewrite the files yet.
```

Then ask it to fix the issues one by one.

### Step 2: You check what only you can judge

You don't need to verify every line, but these are on you:

- **PRD ↔ implementation plan:** Is everything *you* actually want there, and nothing extra the AI added? You're the only one who knows your real intent.
- **Out of scope:** Did the AI quietly add features you didn't ask for, like admin panels, notifications, or analytics?
- **User flows:** Read them like a user. Does the app behave the way you imagine?
- **Tech stack:** Are these tools you're okay with, including cost (paid services), hosting, and your own comfort level?
- **Data model:** Does the data you need to store make sense? You don't need to know SQL; just check that the fields match real-world information.
- **Secrets:** Quickly confirm no real keys or passwords are in any file.

### Simple rule

| Check | Who |
|---|---|
| Names consistent, missing endpoints, unused tables, contradictions | AI |
| Right features, right scope, right user experience, cost/tool choices | You |

Expect your part to take 20–30 minutes. That's much cheaper than discovering a mismatch after the AI has written 50 files of code.

---

## 5. Setting Up Agent Files for Claude Code

For Claude Code, the agent setup is a set of files in your project.

### 5.1 The big picture

```
your-project/
├── CLAUDE.md                ← main instructions (most important)
├── .mcp.json                ← optional: external tools
├── docs/                    ← your planning md files
│   ├── prd.md
│   ├── tech-stack.md
│   ├── architecture.md
│   ├── data-model.md
│   ├── user-flows.md
│   ├── design.md
│   ├── api-spec.md
│   ├── implementation-plan.md
│   └── progress.md
└── .claude/
    ├── settings.json        ← permissions + hooks
    ├── settings.local.json  ← your personal overrides (gitignored)
    ├── rules/               ← topic-specific rules
    ├── agents/              ← subagents (specialists)
    └── skills/              ← reusable /commands
```

Most users only edit `CLAUDE.md` and `settings.json`. The rest is optional: add skills, rules, or subagents as you need them.

### 5.2 Level 1: `CLAUDE.md` (start here)

- The project "brain." It loads into context at the start of every session.
- Put your conventions, common commands, and architectural context here.
- **Keep it short.** The official docs recommend under 200 lines; longer files still load but may reduce how well Claude follows them.
- Don't paste the whole PRD. Point to your docs instead.
- Can also live at `.claude/CLAUDE.md` if you prefer a clean project root.
- Inside a session, run `/memory` to open and edit it.

Example:

```markdown
# Project: TaskFlow

A task manager for small teams. Full details in docs/.

## Read these before working
- Product requirements: docs/prd.md
- Tools we use: docs/tech-stack.md
- How code is organized: docs/architecture.md
- Database: docs/data-model.md
- Current task & status: docs/implementation-plan.md, docs/progress.md

## Commands
- Install: `pnpm install`
- Dev: `pnpm dev`
- Test: `pnpm test`
- Lint: `pnpm lint`

## Rules
- Follow tech-stack.md. Never add a new library without asking me.
- Never change the database schema without asking me.
- Work on ONE task from implementation-plan.md at a time.
- After finishing a task, update docs/progress.md.
- TypeScript strict mode, no `any`.
- Ask me if anything in the docs is unclear. Don't guess.
```

### 5.3 Level 2: `.claude/settings.json` (safety + automation)

- **Difference from CLAUDE.md:** CLAUDE.md is guidance Claude reads; settings are **enforced** whether Claude follows them or not.
- **Permissions** control which commands and tools Claude can use (allow / deny / ask).
- **Hooks** run your own scripts at specific moments, e.g., after a file edit.
- Other keys: `model` (default model), `env` (environment variables), `statusLine`, `outputStyle`.

Example:

```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm test *)",
      "Bash(pnpm lint *)",
      "Bash(pnpm dev *)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Read(./.env)"
    ]
  },
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
      }]
    }]
  }
}
```

What it does:
- Allows tests, lint, and dev server without asking
- Blocks dangerous deletes and reading your `.env`
- Auto-formats every file Claude edits

**`settings.local.json`:** same format, for your personal tweaks. It's gitignored, so use it when you need different permissions or defaults than the shared config.

### 5.4 Level 3: `.claude/rules/` (when CLAUDE.md gets long)

- Split instructions into topic files.
- A rule **without** `paths:` loads at session start, like CLAUDE.md.
- A rule **with** `paths:` loads only when Claude reads a matching file, which saves context.
- Subfolders work too (e.g., `.claude/rules/frontend/react.md`).
- Start splitting into rules when CLAUDE.md approaches 200 lines.

`.claude/rules/api.md`:

```markdown
---
paths:
  - "src/app/api/**/*.ts"
---

# API Rules
- Validate all input with Zod
- Return shape: { data } or { error }
- Check user auth before any DB access
```

`.claude/rules/ui.md`:

```markdown
---
paths:
  - "src/components/**/*.tsx"
---

# UI Rules
- Follow docs/design.md for colors and spacing
- Use shadcn/ui components, don't build from scratch
- Every list needs empty, loading, and error states
```

### 5.5 Level 4: `.claude/agents/` (specialist subagents)

- Each markdown file defines a subagent with its own system prompt, tool access, and optionally its own model.
- Subagents run in a **fresh context window**, keeping your main conversation clean.
- `description` tells Claude when to delegate to the agent automatically.
- `tools:` restricts what it can do (`Read, Grep, Glob` = read-only).
- The body of the file becomes the agent's system prompt.
- Type `@` and pick an agent from the autocomplete to delegate directly.

`.claude/agents/code-reviewer.md`:

```markdown
---
name: code-reviewer
description: Reviews code changes for bugs, security issues, and rule violations. Use after finishing a task.
tools: Read, Grep, Glob
---

You are a strict senior code reviewer. Check the recent changes for:
1. Bugs, edge cases, missing error handling
2. Security: auth checks, input validation, exposed secrets
3. Violations of docs/architecture.md and docs/tech-stack.md

Every finding must include the file, the problem, and a concrete fix.
```

`.claude/agents/spec-checker.md`:

```markdown
---
name: spec-checker
description: Checks whether a completed feature matches the PRD and user flows. Use before marking a task done.
tools: Read, Grep, Glob
---

Compare the implemented feature against docs/prd.md (acceptance criteria)
and docs/user-flows.md. List anything missing, extra, or different.
Do not edit code. Only report.
```

The spec-checker also solves the "AI checking its own work" problem from Section 4: it's a separate agent reviewing work it didn't write.

### 5.6 Level 5: `.claude/skills/` (your own slash commands)

- Each skill is a folder containing a `SKILL.md` plus any supporting files.
- Run it by typing `/skill-name`.
- `disable-model-invocation: true` means only you can trigger it; Claude won't start it on its own.
- Skills can take arguments (`$ARGUMENTS`), e.g., `/deploy staging`.
- Note: the older `.claude/commands/` folder still works, but skills are the recommended way for new commands.

`.claude/skills/next-task/SKILL.md`:

```markdown
---
description: Pick up the next task from the implementation plan and build it
disable-model-invocation: true
---

1. Read docs/progress.md and docs/implementation-plan.md
2. Find the next unfinished task. Tell me which one before starting.
3. Read only the docs that task needs.
4. Build it. Run `pnpm test` and `pnpm lint`.
5. Ask the code-reviewer agent to review, then fix the findings.
6. Ask the spec-checker agent to verify against the PRD.
7. Update docs/progress.md with what was done.
8. Stop and summarize. Don't start the next task.
```

Now you just type `/next-task` each time to run your full build → review → verify → log loop.

### 5.7 Level 6 (optional): `.mcp.json`

- Connects external tools (databases, GitHub, browsers, APIs) through MCP servers.
- Lives at the **project root**, not inside `.claude/`.
- Use environment variable references for secrets (e.g., `${NOTION_TOKEN}`), never real values.
- Skip it until you actually need it.

### 5.8 Setup order

1. Put all your planning docs in `/docs`
2. Write `CLAUDE.md` (30–60 lines is enough to start)
3. Add `.claude/settings.json` with basic permissions
4. Add the `code-reviewer` and `spec-checker` agents
5. Add the `/next-task` skill
6. Add rules only when CLAUDE.md starts getting crowded

### 5.9 Tips
- Run `/memory` inside a session to edit CLAUDE.md.
- When Claude makes the same mistake twice, add a line to CLAUDE.md or a rule.
- Commit the `.claude/` folder to git so your setup is versioned with your code (except `settings.local.json`).

---

## 6. Sources

- [Explore the .claude directory – Claude Code Docs](https://code.claude.com/docs/en/claude-directory.md)
- [Claude Code Docs Map](https://code.claude.com/docs/en/claude_code_docs_map.md)
