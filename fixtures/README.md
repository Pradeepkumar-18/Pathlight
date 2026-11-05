# Fixtures

Real apps that Pathlight Tracker is developed and tested against (task 0.6). Both are CommonJS TypeScript with source maps, the setup the MVP supports (`tech-stack.md` §14), and need no database install.

| Command | What it does |
| --- | --- |
| `pnpm fixture:nest` | Build and start the NestJS app on `127.0.0.1:3001` |
| `pnpm fixture:express` | Build and start the Express app on `127.0.0.1:3002` |
| `pnpm fixtures:smoke` | Build both, start each on a random port, check every endpoint below (needs Node 24: the script runs as TypeScript directly) |

Set `PORT` to change the port (`0` picks a free one).

## `nestjs-app`

NestJS 11 with Mongoose (users, in-memory MongoDB via `mongodb-memory-server`) and TypeORM (cart items and orders, in-memory SQLite). It has a controller, services, repositories, a guard, pipes, a global interceptor and a global exception filter.

Requests to `/orders` need `authorization: Bearer fixture-token`.

| Request | Status | Why |
| --- | --- | --- |
| `GET /health` | 200 | |
| `GET /orders/42` | 200 | Seeded order |
| `POST /orders` `{"userId":8}` | 201 | Gold user |
| `POST /orders` `{"userId":7}` | **500** | **The PRD bug:** user 7 has no `tier`, so `PricingService.calculateDiscount` throws `TypeError: Cannot read properties of undefined (reading 'rate')` at `src/pricing/pricing.service.ts:27` |
| `GET /orders/42` without the token | 403 | Guard |
| `POST /orders` `{"userId":"seven"}` | 400 | Validation pipe |

Flow of the failing request: `AuthGuard` → `ValidationPipe` → `OrdersController.create` → `OrdersService.create` → `UserService.findById(7)` → `users.findOne({ id: 7 })` → `CartService.total(7)` = 1200 → `PricingService.calculateDiscount` throws.

Keep `calculateDiscount` on line 22, the `if (user.tier === 'gold')` on line 24 and the throw on line 27: the seed data (`data-model.md` §10) points at them, and a unit test pins them.

## `express-app`

Express 5 with a middleware chain (request id, request logger, JSON body, API key), an error middleware, Prisma 7 on SQLite (`@prisma/adapter-better-sqlite3`) and an axios call to a local stub "profile service" started inside the app. It uses plain functions rather than classes.

Requests to `/users` need `x-api-key: fixture-key`.

| Request | Status | Why |
| --- | --- | --- |
| `GET /health` | 200 | |
| `GET /users/8` | 200 | Prisma query |
| `GET /users/8/profile` | 200 | Prisma query + axios call |
| `GET /users/8/badge` | 200 | Gold user |
| `GET /users/7/badge` | **500** | **Deliberate bug:** user 7 has no `tier`, so `badgeFor` throws `TypeError: Cannot read properties of undefined (reading 'label')` in `src/users/badge.service.ts` |
| `GET /users/8` without the key | 401 | Auth middleware |
| `GET /users/999` | 404 | Unknown user |

`pnpm build` runs `prisma generate` (client in `generated/`, git-ignored) and `prisma db push` (creates `prisma/fixture.db`); the app re-seeds the database on every start. Its `package.json` `main` points at the build, so `node fixtures/express-app` starts it (task 2.12).

## Notes

- **NestJS 11, not 12.** NestJS 12 ships as ESM only, and the MVP traces CommonJS apps only.
- **First install is slow:** `mongodb-memory-server` downloads a MongoDB binary (~800 MB on Windows) into the repo root `node_modules/.cache/mongodb-memory-server/`. CI caches it.
- Nothing leaves the machine: both apps bind to `127.0.0.1`, and the axios call goes to the local stub.
