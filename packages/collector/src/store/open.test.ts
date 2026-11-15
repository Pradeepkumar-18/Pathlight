import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureGitignored, openStore, StoreUnavailableError } from './open';
import type { Store } from './open';

const DATA_MODEL = path.resolve(__dirname, '..', '..', '..', '..', 'docs', 'data-model.md');

/** The seed INSERTs from `data-model.md` §10, exactly as written there. */
function seedSql(): string {
  const doc = readFileSync(DATA_MODEL, 'utf8');
  const section = doc.slice(doc.indexOf('## 10. Sample / seed data'));
  const start = section.indexOf('```sql') + '```sql'.length;
  return section.slice(start, section.indexOf('```', start));
}

let root: string;
let store: Store | undefined;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'pt-store-'));
});

afterEach(() => {
  store?.close();
  store = undefined;
  rmSync(root, { recursive: true, force: true });
});

const open = (): Store => {
  store = openStore({
    projectRoot: root,
    dbPath: '.pathlight-tracker/traces.db',
    version: '0.1.0',
    now: () => 1,
  });
  return store;
};

describe('openStore', () => {
  it('creates the database with every table, WAL, foreign keys and incremental vacuum', () => {
    const { sqlite, file } = open();
    expect(file).toBe(path.join(root, '.pathlight-tracker', 'traces.db'));
    const tables = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '%drizzle%' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all()
      .map((row) => (row as { name: string }).name);
    expect(tables).toEqual(['meta', 'object_refs', 'requests', 'sessions', 'steps']);
    expect(sqlite.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(sqlite.pragma('auto_vacuum', { simple: true })).toBe(2); // 2 = INCREMENTAL
    expect(sqlite.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get()).toEqual({
      value: '1',
    });
  });

  it('reopens an existing database without migrating it twice', () => {
    open().close();
    store = undefined;
    const again = open();
    const runs = again.sqlite.prepare('SELECT count(*) AS n FROM __drizzle_migrations').get() as {
      n: number;
    };
    expect(runs.n).toBe(1);
  });

  it.skipIf(process.platform === 'win32')(
    'makes the folder owner-only (0700) and the file 0600',
    () => {
      const { file } = open();
      expect(statSync(path.dirname(file)).mode & 0o777).toBe(0o700);
      expect(statSync(file).mode & 0o777).toBe(0o600);
    },
  );

  it('accepts the seed data from data-model.md §10 with every constraint enforced', () => {
    const { sqlite } = open();
    sqlite.exec(seedSql());
    const count = (table: string) =>
      (sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
    expect([count('requests'), count('steps'), count('object_refs')]).toEqual([3, 14, 7]);
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
  });

  it.each([
    [
      'a boundary step without a boundary type',
      "INSERT INTO steps (id, request_id, seq, kind, name, start_offset_ns, created_at, updated_at) VALUES ('stp_X', 'req_01JBSEED000000000000000001', 99, 'boundary', 'x', 0, 1, 1)",
    ],
    [
      'soft-deleting a request still in progress',
      "UPDATE requests SET state = 'in_progress', deleted_at = 1 WHERE id = 'req_01JBSEED000000000000000002'",
    ],
    [
      'an HTTP request without a method',
      "UPDATE requests SET method = NULL WHERE id = 'req_01JBSEED000000000000000002'",
    ],
    [
      'a duplicate seq in one request',
      "INSERT INTO steps (id, request_id, seq, kind, name, start_offset_ns, created_at, updated_at) VALUES ('stp_Y', 'req_01JBSEED000000000000000001', 1, 'function', 'x', 0, 1, 1)",
    ],
    [
      'a step for a request that does not exist',
      "INSERT INTO steps (id, request_id, seq, kind, name, start_offset_ns, created_at, updated_at) VALUES ('stp_Z', 'req_missing', 1, 'function', 'x', 0, 1, 1)",
    ],
    [
      'a request-level object ref with a step',
      "INSERT INTO object_refs (request_id, step_id, object_id, role, created_at) VALUES ('req_01JBSEED000000000000000001', 'stp_01JBSEED000000000000000001', 'obj_1', 'request', 1)",
    ],
  ])('rejects %s', (_name, statement) => {
    const { sqlite } = open();
    sqlite.exec(seedSql());
    expect(() => sqlite.exec(statement)).toThrow();
  });

  it('cascades: purging a request removes its steps and object refs', () => {
    const { sqlite } = open();
    sqlite.exec(seedSql());
    sqlite.exec("DELETE FROM requests WHERE id = 'req_01JBSEED000000000000000001'");
    expect((sqlite.prepare('SELECT count(*) AS n FROM steps').get() as { n: number }).n).toBe(5);
    expect((sqlite.prepare('SELECT count(*) AS n FROM object_refs').get() as { n: number }).n).toBe(
      0,
    );
  });

  it('reports STORE_UNAVAILABLE when the folder cannot be created', () => {
    writeFileSync(path.join(root, 'blocker'), 'a file where a folder should be');
    expect(() =>
      openStore({ projectRoot: root, dbPath: 'blocker/traces.db', version: '0.1.0' }),
    ).toThrow(StoreUnavailableError);
  });
});

describe('ensureGitignored', () => {
  it('creates .gitignore when there is none', () => {
    expect(ensureGitignored(root)).toBe(true);
    expect(readFileSync(path.join(root, '.gitignore'), 'utf8')).toContain('.pathlight-tracker/');
  });

  it('appends once, keeping the existing content', () => {
    writeFileSync(path.join(root, '.gitignore'), 'node_modules/');
    expect(ensureGitignored(root)).toBe(true);
    expect(ensureGitignored(root)).toBe(false);
    const content = readFileSync(path.join(root, '.gitignore'), 'utf8');
    expect(content.startsWith('node_modules/\n')).toBe(true);
    expect(content.match(/\.pathlight-tracker\//g)).toHaveLength(1);
  });

  it('leaves a .gitignore that already lists the folder alone', () => {
    writeFileSync(path.join(root, '.gitignore'), '.pathlight-tracker\n');
    expect(ensureGitignored(root)).toBe(false);
  });
});
