import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { agentEventSchema, helloMessageSchema } from '@pathlight-tracker/protocol';
import type { AgentEvent } from '@pathlight-tracker/protocol';

import { openSession } from '../ingest/sessions';
import { openStore } from '../store/open';
import type { Store } from '../store/open';
import { loadSeed } from '../store/seed';
import { createBuilder } from './builder';

const RECORDED = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'fixtures',
  'events',
  'post-orders.json',
);
const REQUEST = 'req_01JBSEED000000000000000001';
/** IDs the store generates and every time field: the only columns allowed to differ from the seed. */
const IGNORED = new Set([
  'session_id',
  'created_at',
  'updated_at',
  'started_at',
  'ended_at',
  'start_offset_ns',
  'duration_ns',
]);

const recorded = JSON.parse(readFileSync(RECORDED, 'utf8')) as Record<string, unknown>[];
const hello = helloMessageSchema.parse(recorded[0]);
const batches = recorded
  .slice(1)
  .map((batch) => (batch.events as unknown[]).map((event) => agentEventSchema.parse(event)));

const roots: string[] = [];
let built: Store;
let seeded: Store;

function store(): Store {
  const root = mkdtempSync(path.join(tmpdir(), 'pt-builder-'));
  roots.push(root);
  return openStore({ projectRoot: root, dbPath: 'traces.db', version: '0.1.0' });
}

function rows(target: Store, sql: string): Record<string, unknown>[] {
  // JSON columns are compared as data: key order inside the text doesn't matter.
  return (target.sqlite.prepare(sql).all(REQUEST) as Record<string, unknown>[]).map((row) =>
    Object.fromEntries(
      Object.entries(row)
        .filter(([column]) => !IGNORED.has(column))
        .map(([column, value]) => [
          column,
          column.endsWith('_json') && typeof value === 'string' ? JSON.parse(value) : value,
        ]),
    ),
  );
}

beforeEach(() => {
  built = store();
  seeded = store();
  loadSeed(seeded);
});

afterEach(() => {
  built.close();
  seeded.close();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function feed(events: AgentEvent[][] = batches, maxSteps = 5000) {
  const builder = createBuilder(built.db, { maxSteps, now: () => 1 });
  const sessionId = openSession(built.db, hello, 1);
  return { sessionId, results: events.map((batch) => builder.apply(sessionId, batch)) };
}

describe('trace builder: the recorded POST /orders stream', () => {
  it('produces the request row of the seed (except IDs and times)', () => {
    feed();
    expect(rows(built, 'SELECT * FROM requests WHERE id = ?')).toEqual(
      rows(seeded, 'SELECT * FROM requests WHERE id = ?'),
    );
  });

  it('produces the step rows of the seed: seq, depth, parents, statuses, error handling, error path, details', () => {
    feed();
    const sql = 'SELECT * FROM steps WHERE request_id = ? ORDER BY seq';
    expect(rows(built, sql)).toEqual(rows(seeded, sql));
  });

  it('produces the object refs of the seed, including the request body', () => {
    feed();
    const sql =
      'SELECT request_id, step_id, object_id, role, path, type_name FROM object_refs WHERE request_id = ? ORDER BY object_id, role, step_id';
    expect(rows(built, sql)).toEqual(rows(seeded, sql));
  });

  it('records the framework from request.start (it is still unknown at hello)', () => {
    const { sessionId } = feed();
    expect(
      built.sqlite.prepare('SELECT framework FROM sessions WHERE id = ?').get(sessionId),
    ).toEqual({ framework: 'nestjs' });
  });

  it('reports what changed per batch for the live hub', () => {
    const { results } = feed();
    expect(results[0]?.startedRequests).toEqual([REQUEST]);
    expect(results[0]?.appendedSteps.get(REQUEST)).toHaveLength(5);
    expect(results[1]?.completedRequests).toEqual([REQUEST]);
  });

  it('ignores a re-sent batch instead of duplicating steps', () => {
    const builder = createBuilder(built.db, { maxSteps: 5000, now: () => 1 });
    const sessionId = openSession(built.db, hello, 1);
    builder.apply(sessionId, batches[0] ?? []);
    const again = (batches[0] ?? []).filter((event) => event.e !== 'request.start');
    builder.apply(sessionId, again);
    builder.apply(sessionId, batches[1] ?? []);
    expect(built.sqlite.prepare('SELECT count(*) AS n FROM steps').get()).toEqual({ n: 9 });
  });

  it('stops recording at the step limit and marks the request truncated', () => {
    feed(batches, 4);
    expect(built.sqlite.prepare('SELECT count(*) AS n FROM steps').get()).toEqual({ n: 4 });
    expect(
      built.sqlite.prepare('SELECT truncated, step_count FROM requests WHERE id = ?').get(REQUEST),
    ).toEqual({ truncated: 1, step_count: 4 });
  });
});

describe('trace builder: session events', () => {
  it('keeps each warning once and records the agent disabling itself', () => {
    const builder = createBuilder(built.db, { maxSteps: 5000, now: () => 1 });
    const sessionId = openSession(built.db, hello, 1);
    const warning = agentEventSchema.parse({
      e: 'warning',
      traceId: REQUEST,
      ts: '1',
      code: 'NO_SOURCE_MAP',
      message: 'no map',
      file: 'src/a.js',
    });
    builder.apply(sessionId, [warning, warning]);
    builder.apply(sessionId, [
      // Outside any request: process-level events carry no request ID.
      agentEventSchema.parse({
        e: 'agent.disabled',
        traceId: null,
        ts: '2',
        reason: 'too many internal errors',
        internalErrorCount: 20,
      }),
    ]);
    const session = built.sqlite
      .prepare('SELECT status, disabled_reason, warnings_json FROM sessions WHERE id = ?')
      .get(sessionId) as Record<string, string>;
    expect(session.status).toBe('disabled');
    expect(session.disabled_reason).toBe('too many internal errors');
    expect(JSON.parse(session.warnings_json ?? '[]')).toEqual([
      { code: 'NO_SOURCE_MAP', message: 'no map', file: 'src/a.js' },
    ]);
  });
});
