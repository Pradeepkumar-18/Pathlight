import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../config/load';
import { openStore } from '../store/open';
import { loadSeed } from '../store/seed';
import { createClearHandler } from './clear';
import type { CliIo } from './program';

let root: string;
let output: string[];
let io: CliIo;

const config = () => loadConfig({ projectRoot: root, env: {}, readFile: () => '{}' }).config;
const requestsLeft = (): { active: number; total: number } => {
  const store = openStore({
    projectRoot: root,
    dbPath: '.pathlight-tracker/traces.db',
    version: '0.1.0',
  });
  const row = store.sqlite
    .prepare('SELECT sum(deleted_at IS NULL) AS active, count(*) AS total FROM requests')
    .get() as { active: number; total: number };
  store.close();
  return row;
};

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'pt-clear-'));
  output = [];
  io = { out: (t) => output.push(t), err: (t) => output.push(t), cwd: () => root, env: {} };
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function seed(): void {
  const store = openStore({
    projectRoot: root,
    dbPath: '.pathlight-tracker/traces.db',
    version: '0.1.0',
  });
  loadSeed(store);
  store.close();
}

describe('pathlight-tracker clear through a running collector', () => {
  /** A fake collector that records calls and answers like the REST API. */
  function fakeCollector() {
    const calls: string[] = [];
    const running = {
      call: async (method: 'GET' | 'DELETE', url: string): Promise<unknown> => {
        calls.push(`${method} ${url}`);
        if (url === '/health') return { storage: { activeRequests: 2, trashedRequests: 1 } };
        if (method === 'DELETE' && url === '/requests')
          return { data: { moved: 2, skippedInProgress: 0, purgeAt: '' } };
        return { data: { deleted: 3 } };
      },
    };
    return { calls, find: async () => running };
  }

  it('clears through the collector, so open tabs update', async () => {
    seed();
    const collector = fakeCollector();
    await createClearHandler(
      io,
      vi.fn(),
      collector.find,
    )({ purge: false, yes: false, config: config() });
    expect(collector.calls).toEqual(['DELETE /requests']);
    expect(output.join('')).toBe('Moved 2 requests to the trash (restorable for 72 h).\n');
    expect(requestsLeft().total).toBe(3); // the database was not touched directly
  });

  it('--purge --yes empties the trash after clearing, through the collector', async () => {
    seed();
    const collector = fakeCollector();
    await createClearHandler(
      io,
      vi.fn(),
      collector.find,
    )({ purge: true, yes: true, config: config() });
    expect(collector.calls).toEqual(['GET /health', 'DELETE /requests', 'DELETE /trash']);
    expect(output.join('')).toBe('Deleted 3 requests permanently.\n');
  });

  it('works on the database when collector.json is stale (nothing answers)', async () => {
    seed();
    writeFileSync(
      path.join(root, '.pathlight-tracker', 'collector.json'),
      JSON.stringify({ pid: 1, port: 1, version: '0', startedAt: '' }),
    );
    writeFileSync(path.join(root, '.pathlight-tracker', 'token'), `${'a'.repeat(43)}\n`);
    await createClearHandler(io)({ purge: false, yes: false, config: config() });
    expect(output.join('')).toBe('Moved 2 requests to the trash (restorable for 72 h).\n');
    expect(requestsLeft().active).toBe(0);
  });
});

describe('pathlight-tracker clear', () => {
  it('says there is nothing to clear, without creating a database', async () => {
    expect(await createClearHandler(io)({ purge: false, yes: false, config: config() })).toBe(0);
    expect(output.join('')).toContain('Nothing to clear');
    expect(existsSync(path.join(root, '.pathlight-tracker'))).toBe(false);
  });

  it('moves every finished request to the trash', async () => {
    seed();
    expect(await createClearHandler(io)({ purge: false, yes: false, config: config() })).toBe(0);
    expect(output.join('')).toBe('Moved 2 requests to the trash (restorable for 72 h).\n');
    expect(requestsLeft()).toEqual({ active: 0, total: 3 });
  });

  it('--purge asks first and deletes nothing when the answer is no', async () => {
    seed();
    const confirm = vi.fn(async () => false);
    await createClearHandler(io, confirm)({ purge: true, yes: false, config: config() });
    expect(confirm).toHaveBeenCalledWith(
      'Delete 2 active requests and 1 trashed request permanently? This cannot be undone. [y/N] ',
    );
    expect(output.join('')).toContain('Nothing was deleted.');
    expect(requestsLeft().total).toBe(3);
  });

  it('--purge --yes deletes everything permanently without asking', async () => {
    seed();
    const confirm = vi.fn(async () => true);
    await createClearHandler(io, confirm)({ purge: true, yes: true, config: config() });
    expect(confirm).not.toHaveBeenCalled();
    expect(output.join('')).toBe('Deleted 3 requests permanently.\n');
    expect(requestsLeft().total).toBe(0);
  });
});
