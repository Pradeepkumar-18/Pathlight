import { existsSync, mkdtempSync, rmSync } from 'node:fs';
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
