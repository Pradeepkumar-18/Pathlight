import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyRetention,
  clearAll,
  counts,
  deletePermanently,
  emptyTrash,
  purgeAll,
  purgeExpired,
  restore,
  softDelete,
  startPurgeJob,
} from './lifecycle';
import { openStore } from './open';
import type { Store } from './open';
import { loadSeed } from './seed';

const FAILED = 'req_01JBSEED000000000000000001'; // POST /orders, 9 steps
const OK = 'req_01JBSEED000000000000000002'; // GET /orders/42
const TRASHED = 'req_01JBSEED000000000000000003'; // GET /health, deleted at 1793342120000
const SESSION = 'ses_01JBSEED000000000000000001';
const NOW = 1_793_342_200_000;
const HOUR = 60 * 60 * 1000;

let root: string;
let store: Store;

const n = (sql: string): number => (store.sqlite.prepare(sql).get() as { n: number }).n;
const stepsOf = (id: string): number =>
  n(`SELECT count(*) AS n FROM steps WHERE request_id = '${id}'`);
const refsOf = (id: string): number =>
  n(`SELECT count(*) AS n FROM object_refs WHERE request_id = '${id}'`);
const deletedAt = (id: string): number | null =>
  (
    store.sqlite.prepare('SELECT deleted_at AS d FROM requests WHERE id = ?').get(id) as
      { d: number | null } | undefined
  )?.d ?? null;

/** Adds an active request; `inProgress` ones have no end yet. */
function addRequest(id: string, startedAt: number, inProgress = false): void {
  store.sqlite
    .prepare(
      `INSERT INTO requests (id, session_id, method, path, state, request_json, started_at, created_at, updated_at)
       VALUES (?, ?, 'GET', '/x', ?, '{}', ?, 1, 1)`,
    )
    .run(id, SESSION, inProgress ? 'in_progress' : 'completed', startedAt);
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'pt-lifecycle-'));
  store = openStore({ projectRoot: root, dbPath: 'traces.db', version: '0.1.0' });
  loadSeed(store);
});

afterEach(() => {
  store.close();
  rmSync(root, { recursive: true, force: true });
});

describe('soft delete and restore', () => {
  it('moves a finished request to the trash, keeping its steps', () => {
    expect(softDelete(store.db, FAILED, NOW)).toBe('ok');
    expect(deletedAt(FAILED)).toBe(NOW);
    expect(stepsOf(FAILED)).toBe(9);
  });

  it('refuses to delete an in-progress request', () => {
    addRequest('req_LIVE', 1, true);
    expect(softDelete(store.db, 'req_LIVE', NOW)).toBe('in_progress');
    expect(deletePermanently(store.db, 'req_LIVE')).toBe('in_progress');
    expect(deletedAt('req_LIVE')).toBeNull();
  });

  it('reports unknown and already-trashed requests', () => {
    expect(softDelete(store.db, 'req_missing', NOW)).toBe('not_found');
    expect(softDelete(store.db, TRASHED, NOW)).toBe('already_in_trash');
  });

  it('restores a trashed request with all its steps', () => {
    softDelete(store.db, FAILED, NOW);
    expect(restore(store.db, FAILED, 100, NOW)).toEqual({ result: 'ok', trashed: [] });
    expect(deletedAt(FAILED)).toBeNull();
    expect(stepsOf(FAILED)).toBe(9);
    expect(refsOf(FAILED)).toBe(6);
    expect(restore(store.db, OK, 100, NOW).result).toBe('not_in_trash');
  });

  it('a restore over the retention limit moves the oldest active request to the trash, not the restored one', () => {
    // Retention 2 with 2 active (FAILED, OK): restoring the old /health request trashes the oldest active.
    const result = restore(store.db, TRASHED, 2, NOW);
    expect(result.result).toBe('ok');
    expect(result.trashed).toEqual([FAILED]);
    expect(deletedAt(TRASHED)).toBeNull();
    expect(stepsOf(FAILED)).toBe(9); // trashed, not purged
  });
});

describe('permanent delete, clear all, empty trash, purge all', () => {
  it('deletes one request permanently with its steps and object refs', () => {
    expect(deletePermanently(store.db, FAILED)).toBe('ok');
    expect([stepsOf(FAILED), refsOf(FAILED)]).toEqual([0, 0]);
    expect(deletePermanently(store.db, FAILED)).toBe('not_found');
  });

  it('clear all moves every finished active request to the trash, skipping in-progress ones', () => {
    addRequest('req_LIVE', 1, true);
    expect(clearAll(store.db, NOW).sort()).toEqual([FAILED, OK]);
    expect(deletedAt('req_LIVE')).toBeNull();
    expect(counts(store.db)).toEqual({ active: 0, trashed: 3, inProgress: 1 });
  });

  it('empty trash deletes only trashed requests', () => {
    expect(emptyTrash(store.db)).toEqual([TRASHED]);
    expect(n('SELECT count(*) AS n FROM requests')).toBe(2);
  });

  it('purge all deletes every finished request, active and trashed, but not in-progress ones', () => {
    addRequest('req_LIVE', 1, true);
    expect(purgeAll(store.db).sort()).toEqual([FAILED, OK, TRASHED]);
    expect(n('SELECT count(*) AS n FROM steps')).toBe(0);
    expect(n('SELECT count(*) AS n FROM object_refs')).toBe(0);
    expect(n('SELECT count(*) AS n FROM requests')).toBe(1);
  });
});

describe('retention', () => {
  it('moves the oldest active requests beyond the limit to the trash and never purges them directly', () => {
    for (let i = 0; i < 5; i += 1) addRequest(`req_NEW${i}`, 2_000_000_000_000 + i);
    const moved = applyRetention(store.db, 4, NOW);
    expect(moved).toEqual([FAILED, OK, 'req_NEW0']); // oldest first
    expect(moved.every((id) => deletedAt(id) === NOW)).toBe(true);
    expect(stepsOf(FAILED)).toBe(9); // still there, only in the trash
  });

  it('never moves an in-progress request', () => {
    addRequest('req_OLD_LIVE', 1, true);
    expect(applyRetention(store.db, 1, NOW)).toEqual([FAILED, OK]);
    expect(deletedAt('req_OLD_LIVE')).toBeNull();
  });

  it('does nothing under the limit', () => {
    expect(applyRetention(store.db, 100, NOW)).toEqual([]);
  });
});

describe('purge job', () => {
  it('purges trashed requests older than the TTL with their steps, then vacuums', () => {
    const vacuum = vi.fn();
    // /health was trashed at 1793342120000; 72 h later it expires.
    expect(purgeExpired(store.db, vacuum, 72, 1_793_342_120_000 + 71 * HOUR).purged).toEqual([]);
    expect(vacuum).not.toHaveBeenCalled();
    const result = purgeExpired(store.db, vacuum, 72, 1_793_342_120_000 + 73 * HOUR);
    expect(result.purged).toEqual([TRASHED]);
    expect(stepsOf(TRASHED)).toBe(0);
    expect(vacuum).toHaveBeenCalledOnce();
  });

  it('removes disconnected sessions with no requests left, but never connected ones', () => {
    store.sqlite.exec(`
      INSERT INTO sessions (id, pid, cwd, node_version, agent_version, protocol_version, status, connected_at, created_at, updated_at)
      VALUES ('ses_GONE', 1, '/app', 'v24', '0.1.0', 1, 'disconnected', 1, 1, 1),
             ('ses_IDLE', 2, '/app', 'v24', '0.1.0', 1, 'connected', 1, 1, 1);`);
    expect(purgeExpired(store.db, vi.fn(), 72, NOW).sessionsRemoved).toBe(1);
    expect(n("SELECT count(*) AS n FROM sessions WHERE id = 'ses_IDLE'")).toBe(1);
  });

  it('runs on start and then on every interval, and can be stopped', () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const stop = startPurgeJob({ run, intervalMs: HOUR });
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2 * HOUR);
    expect(run).toHaveBeenCalledTimes(3);
    stop();
    vi.advanceTimersByTime(2 * HOUR);
    expect(run).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('the real incremental vacuum runs on this database', () => {
    expect(() => store.sqlite.pragma('incremental_vacuum')).not.toThrow();
  });
});
