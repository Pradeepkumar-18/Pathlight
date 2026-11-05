# 02 · The monorepo: pnpm, Turborepo and strict TypeScript
2026-11-01 · Task 0.2 · `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.nvmrc`, `packages/*/package.json`, `packages/*/tsconfig.json`

## In one sentence
We put four packages (`protocol`, `agent`, `collector`, `ui`) in one repo, use pnpm to link them, Turborepo to build them in the right order, and one strict TypeScript config so they all behave the same.

## Why we are doing this
Pathlight Tracker is really four programs that must agree on one thing: the shape of the events (the "protocol"). The agent writes events, the collector stores them, the UI shows them. If they lived in four repos, changing one event field would mean four releases and a lot of "which version works with which?". In one repo, you change `protocol` and every package sees it right away, in one commit.

The rule from `CLAUDE.md`: **agent, collector and ui import only from protocol, never from each other.** That keeps the packages independent (the agent must stay tiny because it runs inside the user's app), and the protocol is the only shared contract.

```
        protocol   (types + Zod schemas, depends on nothing)
        ^   ^   ^
        |   |   |
    agent  collector  ui
```

## How it works

### pnpm: what it is for (your open question)
pnpm is a package manager, like npm. It downloads libraries and links them into `node_modules`. What it gives us:
- **Workspaces.** `pnpm-workspace.yaml` says `packages: ["packages/*"]`. Every folder there is a workspace package, and pnpm links them to each other locally (no publishing needed).
- **One shared store.** Each library version is saved once on your disk and linked, so installs are fast and small.
- **Strictness.** A package can only import what it lists in its own `package.json`. npm often lets you import something you never declared (it just happens to be hoisted). That is exactly the kind of leak our dependency rule wants to block.

Why not npm? npm workspaces work too, but pnpm is stricter and faster, and `tech-stack.md` picked it. 

**Pinning with Corepack.** `"packageManager": "pnpm@10.34.9"` in the root `package.json` tells Corepack (shipped with Node) to use exactly that pnpm version. Everyone, and CI, uses the same one. No "works on my machine" from different pnpm versions.

### Turborepo: build in the right order, skip repeated work
Root script: `"build": "turbo run build"`. Turbo looks at every package's `build` script and runs them. Two ideas in `turbo.json`:
- `"dependsOn": ["^build"]`: the `^` means "first build the packages I depend on". If `agent` depended on `protocol`, protocol builds first.
- `"outputs": ["dist/**"]`: Turbo hashes the inputs (source files, config, dependencies). If nothing changed, it does not rebuild; it restores `dist/` from its cache and prints `FULL TURBO`. `outputs` tells it what to save and restore.

`typecheck` also depends on `^build`, because a package's types come from the built `dist/index.d.ts` of the packages it uses.

### The TypeScript base config
Every package has a tiny `tsconfig.json` that does `"extends": "../../tsconfig.base.json"` and sets only `rootDir: src` and `outDir: dist`. The shared rules live once in `tsconfig.base.json`:
- **`strict: true`** (plus `noUncheckedIndexedAccess`, `noImplicitOverride`). The tool exists to show what AI-written code did; our own code must not hide bugs. `array[0]` is typed `T | undefined`, so you must handle the empty case.
- **CommonJS output** (`"type": "commonjs"` in each package). The agent is loaded with `node --require pathlight-agent app.js`. `--require` loads CommonJS synchronously before the app starts, which is what lets us patch things first. ES modules load differently and later, so CommonJS is the safe choice for the agent. The other packages follow for simplicity.
- **`target: ES2023`.** Traced apps run Node 20+, which understands ES2023, so TypeScript does not need to rewrite modern syntax into older code.
- **Source maps** (`sourceMap`, `declarationMap`). When an error happens in `dist/*.js`, tools can point back to the original `.ts` line. Since Pathlight Tracker's job is showing "where in the code", this matters.
- `declaration: true` creates `.d.ts` files so other packages get types.

### Why `engines` Node 24 is only on the root
The root is `private` and is only our development workspace, so we require Node 24 there (`.nvmrc` says `24` for version managers). The packages themselves, especially the agent, will run inside users' apps on Node 20+. If we put `engines: node 24` on them, we would wrongly tell users "you cannot install this". Develop on 24, support 20+.

### Why TypeScript 5.9.3, not the latest
npm's latest is TypeScript 7.x. We pin 5.9.3 because the tech stack pins major versions. A new major can change behaviour and break the build or plugins we rely on. Upgrading is a **decision** (CLAUDE.md: "Ask before changing"), not something that happens because `npm install` grabbed "latest". Exact versions (no `^`) in `package.json` follow the same idea.

## Why this way, not another
- **Many repos:** cross-package changes become painful; rejected.
- **One package with folders:** the agent would carry the collector and UI code into users' apps, and nothing would stop wrong imports.
- **Nx / Lerna:** heavier. pnpm + Turborepo is the smallest setup that does linking, ordering and caching.

## The "Done when" check and BUG-001
The task's "Done when" was verified on a **fresh clone**, not only in the working folder. A fresh clone shows what a new contributor sees: missing files you forgot to commit, scripts that only worked thanks to leftover `dist/` folders.

It found a real problem: `turbo.exe` failed to start (ENOENT) because the repo sat in a deep folder. On Windows, paths over about 260 characters break many programs, and pnpm stores packages in long paths like `node_modules/.pnpm/turbo-windows-64@.../...`. A deep clone path pushed it over the limit. It is logged as **BUG-001**, with the plan to document it in the README (task 0.7): keep the clone path short (e.g. `C:\dev\pathlight`) or enable Windows long paths. Lesson: always test on a clean copy, and write down environment traps instead of keeping them in your head.

## Words to know
- **Monorepo** → many packages in one repository.
- **Workspace** → a folder pnpm treats as a package and links locally.
- **Corepack** → Node's tool that runs the pinned package manager version.
- **Turborepo (turbo)** → task runner that orders builds and caches results.
- **`^build`** → "build my dependencies first".
- **Cache hit / FULL TURBO** → nothing changed, outputs restored instead of rebuilt.
- **CommonJS** → the older `require()` module system; works with `node --require`.
- **Source map** → file linking compiled JS back to your TS lines.
- **`engines`** → declares which Node versions a package supports.

## Try it yourself
Use a short clone path if you are on Windows.
1. Run `pnpm build`. Read the output: note how many packages built and the "Cached: 0 cached".
2. Run `pnpm build` again. You should see `FULL TURBO` and cache hits, and it finishes in a fraction of a second.
3. Edit a comment in `packages/protocol/src/index.ts` (or add a space), run `pnpm build` again. Which packages rebuild? Then undo the edit.
4. Delete `packages/agent/dist` and build again. Does Turbo restore it from cache?

## Check yourself
1. Why does pnpm's strictness help our rule "agent, collector and ui import only from protocol"?
2. What does `"dependsOn": ["^build"]` mean, and what does `outputs: ["dist/**"]` let Turborepo do?
3. Why is the agent built as CommonJS, and why is `engines` Node 24 only on the private root?

<details>
<summary>Answers</summary>

1. pnpm only lets a package import what it declares in its own `package.json`, so an undeclared import (e.g. agent importing collector) fails instead of working by accident.
2. Build the packages I depend on first. `outputs` tells Turbo which files to save and restore, so an unchanged package is restored from cache instead of rebuilt.
3. The agent is loaded with `node --require`, which loads CommonJS synchronously before the app starts. The root is only our dev workspace; users' apps run Node 20+, so the packages must not demand Node 24.
</details>

## Go deeper
- `Docs/tracer-tech-stack.md` (pinned versions and the "do not use" list).
- `Docs/progress.md`, BUG-001, and the task 0.2 log entry.
- Turborepo docs: "Task dependencies" and "Caching".
