# 0020 · Fixture stack: no database install, NestJS 11
Date: 2026-11-05 · Status: Accepted

## Context
Task 0.6 needs a NestJS fixture with Mongoose and TypeORM and an Express fixture with Prisma and axios, each starting "with one command". The specs did not say how the fixtures get their databases. NestJS 12 (current major) ships as ESM only, while the MVP traces CommonJS apps only (`tech-stack.md` §14).

## Decision
- MongoDB for the NestJS fixture runs in-process via `mongodb-memory-server`; TypeORM uses in-memory SQLite (`better-sqlite3`); Prisma 7 uses a SQLite file through `@prisma/adapter-better-sqlite3`. No database install, no Docker.
- The NestJS fixture uses NestJS 11 (CommonJS).
- `pnpm-workspace.yaml` `onlyBuiltDependencies` allows install scripts for `better-sqlite3`, `prisma`, `@prisma/engines` and `mongodb-memory-server` only.
- The axios call goes to a stub HTTP server inside the Express fixture, so nothing leaves the machine.

## Alternatives considered
- Local `mongod` or Docker Compose for MongoDB/Postgres: rejected, breaks "one command" and adds an install step on every OS.
- NestJS 12: rejected for now, the MVP cannot trace ESM apps.

## Consequences
- First install downloads a MongoDB binary (~800 MB on Windows) into `node_modules/.cache/mongodb-memory-server`; CI caches that folder.
- Fixtures declare `engines: >=20.19` (NestJS 11 / Prisma 7 / mongoose 9 minimum), slightly above "Node 20+" in the tech stack.
- NestJS 12 being ESM-only means new Nest projects may not be traceable by the MVP; to review at Checkpoint 0.
- Approved by the user on 2026-11-05 (task 0.6 plan).
