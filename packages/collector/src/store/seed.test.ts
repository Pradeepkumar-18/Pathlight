import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openStore } from './open';
import type { Store } from './open';
import { loadSeed, SEED_FILE } from './seed';

const DATA_MODEL = path.resolve(__dirname, '..', '..', '..', '..', 'docs', 'data-model.md');
const STEP = (n: number): string => `stp_01JBSEED0000000000000000${String(n).padStart(2, '0')}`;

let root: string;
let store: Store;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'pt-seed-'));
  store = openStore({
    projectRoot: root,
    dbPath: '.pathlight-tracker/traces.db',
    version: '0.1.0',
  });
});

afterEach(() => {
  store.close();
  rmSync(root, { recursive: true, force: true });
});

describe('seed data', () => {
  it('fixtures/seed/sample.sql matches data-model.md §10 exactly', () => {
    const doc = readFileSync(DATA_MODEL, 'utf8');
    const section = doc.slice(doc.indexOf('## 10. Sample / seed data'));
    const start = section.indexOf('```sql') + '```sql\n'.length;
    const fromSpec = section.slice(start, section.indexOf('```', start));
    const fromFile = readFileSync(SEED_FILE, 'utf8').replace(/^(--[^\n]*\n){3}/, '');
    expect(fromFile).toBe(fromSpec);
  });

  it('loads 3 requests and 14 steps', () => {
    expect(loadSeed(store)).toEqual({ requests: 3, steps: 14, objectRefs: 7 });
  });

  it('marks the error path from the root to the step that threw (decision 0010)', () => {
    loadSeed(store);
    const onPath = store.sqlite
      .prepare(
        "SELECT id FROM steps WHERE request_id = 'req_01JBSEED000000000000000001' AND on_error_path = 1 ORDER BY seq",
      )
      .all()
      .map((row) => (row as { id: string }).id);
    expect(onPath).toEqual([STEP(3), STEP(4), STEP(8)]);
    const failing = store.sqlite
      .prepare(
        "SELECT http_status, has_error, error_step_id FROM requests WHERE id = 'req_01JBSEED000000000000000001'",
      )
      .get();
    expect(failing).toEqual({ http_status: 500, has_error: 1, error_step_id: STEP(8) });
  });

  it('includes one request in the trash, with its step', () => {
    loadSeed(store);
    const trashed = store.sqlite
      .prepare('SELECT id, path, deleted_at FROM requests WHERE deleted_at IS NOT NULL')
      .all();
    expect(trashed).toEqual([
      { id: 'req_01JBSEED000000000000000003', path: '/health', deleted_at: 1793342120000 },
    ]);
    const active = store.sqlite
      .prepare('SELECT count(*) AS n FROM requests WHERE deleted_at IS NULL')
      .get();
    expect(active).toEqual({ n: 2 });
    expect(
      store.sqlite
        .prepare("SELECT name FROM steps WHERE request_id = 'req_01JBSEED000000000000000003'")
        .get(),
    ).toEqual({
      name: 'HealthController.check',
    });
  });

  it('stores valid JSON in every *_json column', () => {
    loadSeed(store);
    for (const table of ['sessions', 'requests', 'steps']) {
      const rows = store.sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<
        string,
        unknown
      >[];
      for (const row of rows) {
        for (const [column, value] of Object.entries(row)) {
          if (column.endsWith('_json') && typeof value === 'string') {
            expect(() => JSON.parse(value), `${table}.${column}`).not.toThrow();
          }
        }
      }
    }
  });

  it('can be loaded again: it replaces the previous data', () => {
    loadSeed(store);
    expect(loadSeed(store)).toEqual({ requests: 3, steps: 14, objectRefs: 7 });
  });

  it('changes nothing when the seed fails half-way', () => {
    loadSeed(store);
    expect(() => loadSeed(store, "INSERT INTO sessions (id) VALUES ('broken');")).toThrow();
    expect(store.sqlite.prepare('SELECT count(*) AS n FROM requests').get()).toEqual({ n: 3 });
  });
});
