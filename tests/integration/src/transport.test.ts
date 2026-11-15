// Task 3.2: the agent's transport against a real collector.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { monitorEventLoopDelay } from 'node:perf_hooks';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createAgentLogger } from '@pathlight-tracker/agent/src/safety/logger';
import { createSafety } from '@pathlight-tracker/agent/src/safety/safety';
import { buildHello } from '@pathlight-tracker/agent/src/transport/hello';
import { createTransport } from '@pathlight-tracker/agent/src/transport/transport';
import type { Transport } from '@pathlight-tracker/agent/src/transport/transport';
import { startCollector } from '@pathlight-tracker/collector/src/collector';
import type { RunningCollector } from '@pathlight-tracker/collector/src/collector';
import { loadConfig } from '@pathlight-tracker/collector/src/config/load';
import { agentEventSchema } from '@pathlight-tracker/protocol';
import type { AgentEvent } from '@pathlight-tracker/protocol';

const REPO = path.resolve(__dirname, '..', '..', '..');
const RECORDED = JSON.parse(
  readFileSync(path.join(REPO, 'fixtures', 'events', 'post-orders.json'), 'utf8'),
) as { type: string; events?: unknown[] }[];
const RECORDED_EVENTS = RECORDED.flatMap((message) => message.events ?? []).map((event) =>
  agentEventSchema.parse(event),
);
const REQUEST = 'req_01JBSEED000000000000000001';

const roots: string[] = [];
const collectors: RunningCollector[] = [];
const transports: Transport[] = [];

afterEach(async () => {
  transports.splice(0).forEach((transport) => transport.close());
  for (const collector of collectors.splice(0)) await collector.stop();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createNetServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

function projectRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'pt-transport-'));
  roots.push(root);
  return root;
}

async function collectorAt(root: string, port: number): Promise<RunningCollector> {
  const { config } = loadConfig({
    projectRoot: root,
    env: {},
    flags: { port: String(port) },
    readFile: () => '{}',
  });
  const collector = await startCollector({
    projectRoot: root,
    config,
    version: '0.1.0',
    logConsole: () => undefined,
  });
  collectors.push(collector);
  return collector;
}

function transportTo(collector: RunningCollector, logs: string[] = []): Transport {
  const logger = createAgentLogger('debug', (text) => logs.push(text));
  const transport = createTransport({
    url: collector.agentUrl,
    token: collector.token,
    safety: createSafety({ logger }),
    logger,
    hello: () => buildHello(process.cwd()),
    backoff: { initialMs: 20, maxMs: 100 },
  });
  transports.push(transport);
  return transport;
}

async function until(check: () => boolean, ms = 10_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

let ts = 1_793_342_105_000_000_000n;
const nextTs = () => (ts += 1000n).toString();
const stepId = (n: number) => `stp_01JBTRANSP${String(n).padStart(16, '0')}`;
const requestId = (n: number) => `req_01JBTRANSP${String(n).padStart(16, '0')}`;

/** One request with `steps` root steps, as the agent would send it. */
function syntheticRequest(n: number, steps: number): AgentEvent[] {
  const traceId = requestId(n);
  const events: AgentEvent[] = [
    {
      e: 'request.start',
      traceId,
      ts: nextTs(),
      framework: 'express',
      method: 'GET',
      path: `/items/${n}`,
      route: '/items/:id',
      params: null,
      query: null,
      body: null,
      headers: null,
    },
  ];
  for (let i = 1; i <= steps; i += 1) {
    const id = stepId(n * 100_000 + i);
    events.push(
      {
        e: 'step.enter',
        traceId,
        ts: nextTs(),
        stepId: id,
        parentStepId: null,
        kind: 'function',
        name: `step${i}`,
      },
      { e: 'step.exit', traceId, ts: nextTs(), stepId: id, durationNs: '1000' },
    );
  }
  events.push({ e: 'request.end', traceId, ts: nextTs(), status: 200, durationNs: '5000' });
  return events.map((event) => agentEventSchema.parse(event));
}

function stepNames(collector: RunningCollector, traceId: string): string[] {
  return (
    collector.store.sqlite
      .prepare('SELECT name FROM steps WHERE request_id = ? ORDER BY seq')
      .all(traceId) as { name: string }[]
  ).map((row) => row.name);
}

function requestState(collector: RunningCollector, traceId: string): string | undefined {
  return (
    collector.store.sqlite.prepare('SELECT state FROM requests WHERE id = ?').get(traceId) as
      { state: string } | undefined
  )?.state;
}

describe('transport → real collector', () => {
  it('delivers the recorded request, in order', async () => {
    const collector = await collectorAt(projectRoot(), await freePort());
    const transport = transportTo(collector);
    RECORDED_EVENTS.forEach((event) => transport.send(event));
    await until(() => requestState(collector, REQUEST) === 'completed');
    // Every event that opens a step (calls, DB / HTTP boundaries, `if` decisions), in send order.
    const sent = RECORDED_EVENTS.flatMap((event) =>
      event.e === 'step.enter' || event.e === 'boundary' || event.e === 'decision'
        ? [event.stepId]
        : [],
    );
    const stored = (
      collector.store.sqlite
        .prepare('SELECT id FROM steps WHERE request_id = ? ORDER BY seq')
        .all(REQUEST) as { id: string }[]
    ).map((row) => row.id);
    expect(stored).toEqual(sent);
  });

  it('splits more than one batch of events and keeps their order', async () => {
    const collector = await collectorAt(projectRoot(), await freePort());
    const transport = transportTo(collector);
    // 3,002 events: more than the 2,000-event batch limit.
    const events = syntheticRequest(1, 1500);
    events.forEach((event) => transport.send(event));
    await until(() => requestState(collector, requestId(1)) === 'completed');
    expect(stepNames(collector, requestId(1))).toEqual(
      Array.from({ length: 1500 }, (_, i) => `step${i + 1}`),
    );
  });

  it('killing the collector never blocks or crashes the app; it reconnects when the collector is back', async () => {
    const root = projectRoot();
    const port = await freePort();
    const first = await collectorAt(root, port);
    const logs: string[] = [];
    const transport = transportTo(first, logs);
    await until(() => transport.connected);

    await first.stop();
    collectors.splice(collectors.indexOf(first), 1);
    await until(() => !transport.connected);

    // The app keeps producing events while the collector is gone: 30 requests × 801 events,
    // more than the 10,000-event buffer.
    const delay = monitorEventLoopDelay({ resolution: 10 });
    delay.enable();
    const started = performance.now();
    for (let n = 1; n <= 30; n += 1) syntheticRequest(n, 400).forEach((e) => transport.send(e));
    const sendMs = performance.now() - started;
    await new Promise((resolve) => setTimeout(resolve, 300));
    delay.disable();
    expect(sendMs).toBeLessThan(2000);
    expect(delay.max / 1e6).toBeLessThan(250);
    expect(transport.droppedRequests).toBeGreaterThan(0);
    expect(logs.join('')).toContain('COLLECTOR_UNREACHABLE');

    // Same project, same port and token: the agent finds it again by itself.
    const second = await collectorAt(root, port);
    await until(() => transport.connected);
    await until(() => requestState(second, requestId(30)) === 'completed');
    // The oldest requests were dropped whole; the newest arrive complete.
    expect(requestState(second, requestId(1))).toBeUndefined();
    expect(stepNames(second, requestId(30))).toHaveLength(400);
  });
});

describe('a preloaded app', () => {
  const AGENT = path.join(REPO, 'packages', 'agent');
  const REGISTER = path.join(AGENT, 'dist', 'register.js');

  beforeAll(() => {
    // The child process loads the built agent, so build it from the current source first.
    execFileSync(
      process.execPath,
      [require.resolve('typescript/bin/tsc'), '-p', path.join(AGENT, 'tsconfig.build.json')],
      { stdio: 'pipe' },
    );
  }, 120_000);

  async function runApp(env: NodeJS.ProcessEnv): Promise<{ code: number | null; ms: number }> {
    const started = Date.now();
    const child = spawn(
      process.execPath,
      ['--require', REGISTER, '-e', 'setTimeout(() => {}, 200)'],
      { env: { ...process.env, ...env }, stdio: 'ignore' },
    );
    const code = await new Promise<number | null>((resolve) => child.on('exit', resolve));
    return { code, ms: Date.now() - started };
  }

  it('connects, and still exits on its own (the connection never keeps it alive)', async () => {
    const collector = await collectorAt(projectRoot(), await freePort());
    const result = await runApp({
      PATHLIGHT_TRACKER_COLLECTOR_URL: collector.agentUrl,
      PATHLIGHT_TRACKER_TOKEN: collector.token,
    });
    expect(result.code).toBe(0);
    expect(result.ms).toBeLessThan(5000);
    const sessions = collector.store.sqlite.prepare('SELECT pid FROM sessions').all();
    expect(sessions).toHaveLength(1);
  });

  it('exits on its own when the collector is not there (retries never keep it alive)', async () => {
    const result = await runApp({
      PATHLIGHT_TRACKER_COLLECTOR_URL: `ws://127.0.0.1:${await freePort()}/agent`,
      PATHLIGHT_TRACKER_TOKEN: 'x'.repeat(43),
    });
    expect(result.code).toBe(0);
    expect(result.ms).toBeLessThan(5000);
  });
});
