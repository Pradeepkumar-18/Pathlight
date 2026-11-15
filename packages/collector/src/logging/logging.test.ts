import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { startCollector } from '../collector';
import type { RunningCollector } from '../collector';
import { loadConfig } from '../config/load';
import { STORE_DIR } from '../store/open';
import { formatConsoleLine, LOG_DIR } from './logger';

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
const recorded = JSON.parse(readFileSync(RECORDED, 'utf8')) as unknown[];
const REQUEST = 'req_01JBSEED000000000000000001';

/** Every captured value preview in the recorded events: none may reach a log. */
const CAPTURED = [...JSON.stringify(recorded).matchAll(/"preview":"((?:[^"\\]|\\.)*)"/g)]
  .map((match) => JSON.parse(`"${match[1] ?? ''}"`) as string)
  .filter((preview) => preview.length >= 6);

let root: string;
let collector: RunningCollector;
let consoleLines: string[];

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createNetServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

beforeEach(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'pt-log-'));
  consoleLines = [];
  const { config } = loadConfig({
    projectRoot: root,
    env: {},
    flags: { port: String(await freePort()) },
    readFile: () => '{}',
  });
  collector = await startCollector({
    projectRoot: root,
    config,
    version: '0.1.0',
    logConsole: (text) => consoleLines.push(text),
  });
});

afterEach(async () => {
  await collector.stop();
  rmSync(root, { recursive: true, force: true });
});

/** The log files' text; stop the collector first so everything is flushed. */
function logText(): string {
  const dir = path.join(root, STORE_DIR, LOG_DIR);
  return readdirSync(dir)
    .map((name) => readFileSync(path.join(dir, name), 'utf8'))
    .join('');
}

function entries(): Record<string, unknown>[] {
  return logText()
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function runAgent(): Promise<void> {
  const agent = new WebSocket(collector.agentUrl, [
    'pathlight-tracker.v1',
    `bearer.${collector.token}`,
  ]);
  let acks = 0;
  agent.addEventListener('message', (event) => {
    if ((JSON.parse(String(event.data)) as { type: string }).type === 'ack') acks += 1;
  });
  await new Promise((resolve) => agent.addEventListener('open', resolve));
  for (const message of recorded) agent.send(JSON.stringify(message));
  while (acks < 2) await new Promise((resolve) => setTimeout(resolve, 20));
  agent.close();
}

const api = (method: string, url: string) =>
  fetch(`${collector.url}/api/v1${url}`, {
    method,
    headers: { authorization: `Bearer ${collector.token}` },
  });

/** Holds the database's write lock from a second connection, like another process would. */
function lockDatabase(): () => void {
  const other = new Database(collector.store.sqlite.name);
  other.exec('BEGIN IMMEDIATE');
  // Fail fast instead of waiting the default 5 s for the lock.
  collector.store.sqlite.pragma('busy_timeout = 50');
  return () => {
    other.exec('ROLLBACK');
    other.close();
  };
}

/** Emits an uncaught error to the collector's handler only (Vitest would fail the run on its own). */
function emitUncaught(error: Error): void {
  const listeners = process.listeners('uncaughtException');
  const ours = listeners.at(-1);
  const others = listeners.slice(0, -1);
  others.forEach((listener) => process.off('uncaughtException', listener));
  try {
    ours?.(error, 'uncaughtException');
  } finally {
    others.forEach((listener) => process.on('uncaughtException', listener));
  }
}

describe('collector logging', () => {
  it('a locked database returns 503 STORE_UNAVAILABLE and logs an entry with the same logId', async () => {
    await runAgent();
    const unlock = lockDatabase();
    const response = await api('DELETE', `/requests/${REQUEST}`);
    unlock();
    expect(response.status).toBe(503);
    const body = (await response.json()) as {
      error: { code: string; details?: { logId?: string } };
    };
    expect(body.error.code).toBe('STORE_UNAVAILABLE');
    const logId = body.error.details?.logId;
    expect(logId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);

    // The collector keeps working once the lock is gone.
    expect((await api('DELETE', `/requests/${REQUEST}`)).status).toBe(200);

    await collector.stop();
    expect(entries()).toContainEqual(
      expect.objectContaining({ code: 'STORE_UNAVAILABLE', logId, level: 50 }),
    );
    expect(consoleLines.join('')).toContain(
      `STORE_UNAVAILABLE database locked or unreadable (logId ${logId})`,
    );
  });

  it('logs an uncaught error and keeps serving', async () => {
    emitUncaught(new Error('boom from a timer'));
    expect((await api('GET', '/health')).status).toBe(200);
    await collector.stop();
    expect(entries()).toContainEqual(expect.objectContaining({ code: 'UNCAUGHT_ERROR' }));
  });

  it('never writes the token or captured values to the logs', async () => {
    expect(CAPTURED.length).toBeGreaterThan(5);
    await runAgent();
    // Things that log: a failed batch while the database is locked, a 503, an uncaught error.
    const unlock = lockDatabase();
    const agent = new WebSocket(collector.agentUrl, [
      'pathlight-tracker.v1',
      `bearer.${collector.token}`,
    ]);
    await new Promise((resolve) => agent.addEventListener('open', resolve));
    for (const message of recorded) agent.send(JSON.stringify(message));
    await new Promise((resolve) => setTimeout(resolve, 200));
    agent.close();
    await api('DELETE', `/requests/${REQUEST}`);
    unlock();
    emitUncaught(new Error('boom'));
    await collector.stop();

    const text = logText() + consoleLines.join('');
    expect(text).toContain('STORE_UNAVAILABLE');
    expect(text).not.toContain(collector.token);
    for (const value of CAPTURED) expect(text).not.toContain(value);
  });
});

describe('console lines', () => {
  it('reads as one line per entry with the code and logId, and skips uncoded info', () => {
    expect(
      formatConsoleLine('{"level":50,"code":"INGEST_FAILED","msg":"batch 3: locked","logId":"X"}'),
    ).toBe('[pathlight-tracker] ERROR INGEST_FAILED batch 3: locked (logId X)\n');
    expect(formatConsoleLine('{"level":30,"code":"PURGED","msg":"3 requests"}')).toBe(
      '[pathlight-tracker] PURGED 3 requests\n',
    );
    // Library chatter stays in the file.
    expect(formatConsoleLine('{"level":30,"msg":"listening on http://127.0.0.1:4777"}')).toBe('');
    expect(formatConsoleLine('not json')).toBe('not json\n');
  });
});
