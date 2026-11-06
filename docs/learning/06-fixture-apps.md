# 06 · Fixture apps: real apps with deliberate bugs
2026-11-05 · Task 0.6 · `fixtures/nestjs-app`, `fixtures/express-app`, `fixtures/smoke/src/smoke.ts`, `docs/decisions/0020-fixture-stack.md`

## In one sentence
A fixture is a small but realistic backend app, with bugs planted on purpose, that we use as the test subject for everything Pathlight will trace later.

## Why we are doing this
Pathlight records what a running app did. You cannot build or test that with toy snippets. You need an app that has real layers (guard, controller, service, database, HTTP calls) and a real failure to explain.

The fixtures give us:
- The PRD's headline story: "why did order creation fail for user 7?" The agent (task 1.1), the map UI (3.7, 3.9 to 3.14) and the end-to-end tests (5.1) all trace these apps.
- A known answer. We know exactly which line is broken, so we can check that Pathlight points at it.
- Two styles of app. NestJS uses classes and decorators. Express uses plain functions. The agent must handle both.

## How it works

### The NestJS fixture (`fixtures/nestjs-app`)
A request travels through these layers:

```
AuthGuard -> ValidationPipe -> OrdersController.create -> OrdersService.create
  -> UserService.findById(7) -> users.findOne({ id: 7 })      (Mongoose)
  -> CartService.total(7) = 1200                              (TypeORM)
  -> PricingService.calculateDiscount   <- throws here
```

Users live in MongoDB through Mongoose. Cart items and orders live in SQLite through TypeORM. Two database libraries is on purpose, so the tracer sees both.

The planted bug, in `pricing.service.ts`:

```ts
if (user.tier === 'gold') { return total * GOLD_RATE; }
return total * TIER_DISCOUNTS[user.tier as Tier].rate;   // line 27
```

User 7 has no `tier`. `TIER_DISCOUNTS[undefined]` is `undefined`, and `.rate` on it throws `TypeError: Cannot read properties of undefined (reading 'rate')`. TypeScript did not catch it because of the `as Tier` cast. That is the kind of mistake AI-written code often contains.

Line numbers matter: the method is on line 22, the `if` on line 24, the throw on line 27. The seed data in `data-model.md` §10 points at those lines, and a unit test pins them. If you add a comment above them, a test fails. That is on purpose.

### The Express fixture (`fixtures/express-app`)
- A middleware chain: request id, request logger, JSON body, API key check. Then an error middleware at the end.
- Prisma 7 on SQLite, using a "driver adapter" (`@prisma/adapter-better-sqlite3`), which is how Prisma 7 talks to the database.
- An axios call to a stub "profile service". The stub is a tiny HTTP server started inside the same app, so no data leaves your machine.
- Plain functions, no classes. `GET /users/7/badge` fails the same way (`reading 'label'`).

### No database install
Asking you to install MongoDB or Docker would break the "one command" goal. So:
- MongoDB runs inside the Node process with `mongodb-memory-server`.
- TypeORM uses in-memory SQLite. Prisma uses a SQLite file.

Trade-off: the first install downloads a MongoDB binary of about 800 MB (on Windows). It is cached in `node_modules/.cache/mongodb-memory-server`, and CI caches that folder too.

### Why NestJS 11 and not 12 (decision 0020)
NestJS 12 is ESM-only. The MVP only traces CommonJS apps (`tech-stack.md` §14). So the fixture uses 11. Be honest about the risk: new Nest projects may soon be ESM, and the MVP might not trace them. This is to be reviewed at Checkpoint 0.

### pnpm 10 blocks install scripts
Packages like `better-sqlite3` and `mongodb-memory-server` need to run a script on install (compile or download). pnpm 10 blocks scripts by default, for safety. We list the only four allowed packages in `pnpm-workspace.yaml` under `onlyBuiltDependencies`. This is an allowlist: anything not on it cannot run code at install.

### Decorator metadata and "value imports"
NestJS injects services by reading the constructor's parameter types at runtime. TypeScript emits that info only when `emitDecoratorMetadata` is on, and only if the class is imported as a real (value) import. If you write `import type { UserService }`, the class disappears at runtime and Nest cannot inject it.

Our ESLint rule `consistent-type-imports` normally says "use `import type` when you can". So `eslint.config.mjs` sets `emitDecoratorMetadata: true` in `parserOptions`, which tells the rule: "classes used in decorated constructors must stay value imports".

### Source maps
The apps compile TypeScript to JavaScript in `dist/`. We run Node with `--enable-source-maps`, so stack traces show `pricing.service.ts:27` and not a line in `dist/pricing.service.js`. Pathlight needs this to show you your own code.

### The smoke script (`fixtures/smoke/src/smoke.ts`)
It proves both apps work, including their planned 500s:
1. Spawn the app with `PORT=0`, so the OS picks a free port (no clashes).
2. Read its output until it prints `listening on http://127.0.0.1:...`, and parse the URL.
3. Send each request and compare the status (200, 201, 400, 403, 404, 500).
4. Check the logs contain the expected `TypeError` and file name. A 500 alone is not proof it is the right bug.
5. Always kill the child process in a `finally` block, so nothing is left running.

## Why this way, not another
- Docker or local MongoDB: rejected, extra install on every OS.
- Mock the database: rejected, the tracer must see real driver calls.
- Skip the second fixture: rejected, a class-based and a function-based app exercise different parts of the agent.

## Words to know
- **Fixture**: a fixed, known test subject.
- **Guard / pipe / interceptor**: NestJS steps that check access, validate input, or wrap a request.
- **Middleware**: an Express function that runs in order for each request.
- **In-memory database**: lives in RAM and vanishes when the app stops.
- **Driver adapter**: the bridge Prisma 7 uses to talk to a database.
- **Allowlist**: a list of only the things permitted.
- **Source map**: a file that maps compiled JS lines back to your TS lines.
- **ESM / CommonJS**: the two JavaScript module systems (`import` vs `require`).

## Try it yourself
1. Run `pnpm fixtures:smoke` (Node 24 needed) and read the output.
2. Run `pnpm fixture:nest`, then in another terminal call `POST /orders` with body `{"userId":7}` and header `authorization: Bearer fixture-token`. Find the stack trace in the app's log and confirm it says `pricing.service.ts:27`.
3. Try the same with `{"userId":8}` and compare.

## Check yourself
1. Why does user 7 cause a 500 but user 8 does not?
2. Why are the line numbers in `pricing.service.ts` pinned, and what is pinning them?
3. Why does the project use NestJS 11 instead of the newest version?
4. Why does the smoke script start apps on `PORT=0` and also check the logs?
5. What would break if someone changed an injected service to `import type`?

<details>
<summary>Answers</summary>

1. User 7 has no `tier`, so `TIER_DISCOUNTS[undefined]` is `undefined` and reading `.rate` throws. User 8 is gold and returns before that line.
2. The seed data points at them, and a unit test checks them.
3. NestJS 12 is ESM-only and the MVP traces CommonJS only (decision 0020).
4. Port 0 gives a free port, so runs never clash. The log check proves the 500 came from the planted bug and not from some other failure.
5. The class would not exist at runtime, so Nest could not inject it and the app would fail on startup or at the first request.

</details>

## Go deeper
- `docs/decisions/0020-fixture-stack.md`
- `fixtures/README.md`
