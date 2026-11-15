// Checkpoint 2: a recorded agent stream sent to a running collector comes out of the REST API
// exactly like the seed example (`data-model.md` §10) does, apart from IDs and times.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { startCollector } from './collector';
import type { RunningCollector } from './collector';
import { loadConfig } from './config/load';
import { loadSeed } from './store/seed';

const RECORDED = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'fixtures',
  'events',
  'post-orders.json',
);
const recorded = JSON.parse(readFileSync(RECORDED, 'utf8')) as unknown[];
const REQUEST = 'req_01JBSEED000000000000000001';
/** Session IDs are generated and every time comes from the clock: nothing else may differ. */
const IGNORED = new Set([
  'sessionId',
  'startedAt',
  'endedAt',
  'createdAt',
  'updatedAt',
  'startOffsetNs',
  'durationNs',
  'connectedAt',
]);

const roots: string[] = [];
const running: RunningCollector[] = [];

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createNetServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

async function collector(): Promise<RunningCollector> {
  const root = mkdtempSync(path.join(tmpdir(), 'pt-checkpoint-'));
  roots.push(root);
  const { config } = loadConfig({
    projectRoot: root,
    env: {},
    flags: { port: String(await freePort()) },
    readFile: () => '{}',
  });
  const started = await startCollector({
    projectRoot: root,
    config,
    version: '0.1.0',
    logConsole: () => undefined,
  });
  running.push(started);
  return started;
}

afterEach(async () => {
  for (const started of running.splice(0)) await started.stop();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** Sends the recording and waits for both acks; the agent stays connected until `close()`. */
async function replay(target: RunningCollector): Promise<() => void> {
  const agent = new WebSocket(target.agentUrl, ['pathlight-tracker.v1', `bearer.${target.token}`]);
  let acks = 0;
  agent.addEventListener('message', (event) => {
    if ((JSON.parse(String(event.data)) as { type: string }).type === 'ack') acks += 1;
  });
  await new Promise((resolve) => agent.addEventListener('open', resolve));
  for (const message of recorded) agent.send(JSON.stringify(message));
  while (acks < 2) await new Promise((resolve) => setTimeout(resolve, 20));
  return () => agent.close();
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !IGNORED.has(key))
      .map(([key, inner]) => [
        key,
        key === 'session' ? { ...(strip(inner) as object), id: 'ses_*' } : strip(inner),
      ]),
  );
}

async function get(target: RunningCollector, url: string): Promise<unknown> {
  const response = await fetch(`${target.url}/api/v1${url}`, {
    headers: { authorization: `Bearer ${target.token}` },
  });
  expect(response.status, url).toBe(200);
  // `/curl` answers plain text; everything else is JSON.
  return response.headers.get('content-type')?.startsWith('application/json')
    ? strip(await response.json())
    : response.text();
}

describe('checkpoint 2: recorded events → database → REST', () => {
  it('serves the recorded POST /orders exactly like the seed example', async () => {
    const live = await collector();
    const seeded = await collector();
    const disconnect = await replay(live);
    loadSeed(seeded.store);

    for (const url of [`/requests/${REQUEST}`, `/requests/${REQUEST}/steps`]) {
      expect(await get(live, url), url).toEqual(await get(seeded, url));
    }
    const steps = (await get(seeded, `/requests/${REQUEST}/steps`)) as { data: { id: string }[] };
    expect(steps.data.length).toBeGreaterThan(5);
    for (const { id } of steps.data) {
      expect(await get(live, `/steps/${id}`), id).toEqual(await get(seeded, `/steps/${id}`));
    }
    expect(await get(live, `/requests/${REQUEST}/curl`)).toEqual(
      await get(seeded, `/requests/${REQUEST}/curl`),
    );
    disconnect();
  });
});
