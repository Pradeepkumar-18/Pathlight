import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AgentEvent } from '@pathlight-tracker/protocol';

import { createServer } from '../server/app';
import type { CollectorServer } from '../server/app';
import { openStore } from '../store/open';
import type { Store } from '../store/open';
import { createIngest, MAX_BATCH_BYTES, RESUME_BELOW, SLOW_DOWN_ABOVE } from './ingest';
import type { EventSink, Ingest } from './ingest';
import { registerAgentRoute } from './route';
import { closeSession, openSession } from './sessions';

const TOKEN = 'a'.repeat(43);
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
const recorded = JSON.parse(readFileSync(RECORDED, 'utf8')) as Record<string, unknown>[];
const hello = recorded[0] as Record<string, unknown>;
const warning = (n: number) => ({
  e: 'warning',
  traceId: 'req_01JBSEED000000000000000001',
  ts: String(n),
  code: 'NO_SOURCE_MAP',
  message: 'no map',
});

let root: string;
let store: Store;
let server: CollectorServer;
let ingest: Ingest;
let stored: AgentEvent[];
let url: string;

beforeEach(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'pt-ingest-'));
  store = openStore({ projectRoot: root, dbPath: 'traces.db', version: '0.1.0' });
  stored = [];
  const sink: EventSink = {
    openSession: (message) => openSession(store.db, message, 1),
    ingest: (_session, events) => stored.push(...events),
    closeSession: (session) => closeSession(store.db, session, 2),
  };
  ingest = createIngest(sink);
  server = await createServer({ token: TOKEN, version: '0.1.0' });
  registerAgentRoute(server, ingest);
  await server.app.listen({ host: '127.0.0.1', port: 0 });
  const port = (server.app.server.address() as { port: number }).port;
  server.setPort(port);
  url = `ws://127.0.0.1:${port}/agent`;
});

afterEach(async () => {
  await server.app.close();
  store.close();
  rmSync(root, { recursive: true, force: true });
});

/** A connected agent socket that records every message and the close code. */
async function connect() {
  const socket = new WebSocket(url, ['pathlight-tracker.v1', `bearer.${TOKEN}`]);
  const received: Record<string, unknown>[] = [];
  let closeCode: number | null = null;
  const waiters: (() => void)[] = [];
  const notify = () => waiters.splice(0).forEach((resolve) => resolve());
  socket.addEventListener('message', (event) => {
    received.push(JSON.parse(String(event.data)) as Record<string, unknown>);
    notify();
  });
  socket.addEventListener('close', (event) => {
    closeCode = event.code;
    notify();
  });
  await new Promise((resolve) => socket.addEventListener('open', resolve));
  const until = async (check: () => boolean) => {
    while (!check()) await new Promise<void>((resolve) => waiters.push(resolve));
  };
  return {
    send: (message: unknown) =>
      socket.send(typeof message === 'string' ? message : JSON.stringify(message)),
    received,
    closeCode: () => closeCode,
    until,
    close: () => socket.close(),
  };
}

describe('WS /agent ingest', () => {
  it('acknowledges the recorded POST /orders batches and keeps every event', async () => {
    const agent = await connect();
    for (const message of recorded) agent.send(message);
    await agent.until(() => agent.received.filter((m) => m.type === 'ack').length === 2);
    expect(agent.received[0]).toMatchObject({
      type: 'welcome',
      v: 1,
      limits: { maxBatchBytes: 1048576, maxBatchEvents: 2000 },
    });
    expect(agent.received.filter((m) => m.type === 'ack').map((m) => m.seq)).toEqual([1, 2]);
    expect(stored).toHaveLength(18);
    const session = store.sqlite.prepare('SELECT pid, status, framework FROM sessions').get();
    expect(session).toEqual({ pid: 48213, status: 'connected', framework: 'unknown' });
    agent.close();
  });

  it('drops invalid events without losing the valid ones', async () => {
    const agent = await connect();
    agent.send(hello);
    agent.send({
      type: 'batch',
      v: 1,
      pid: 1,
      seq: 7,
      events: [warning(1), { e: 'step.finish' }, warning(2), { e: 'warning' }],
    });
    await agent.until(() => agent.received.some((m) => m.type === 'ack'));
    expect(agent.received.find((m) => m.type === 'error')).toMatchObject({
      code: 'INVALID_EVENT',
      seq: 7,
    });
    expect(agent.received.find((m) => m.type === 'ack')).toMatchObject({ seq: 7 });
    expect(stored.map((event) => event.ts)).toEqual(['1', '2']);
  });

  it('rejects a batch before hello', async () => {
    const agent = await connect();
    agent.send({ type: 'batch', v: 1, pid: 1, seq: 1, events: [warning(1)] });
    await agent.until(() => agent.received.length > 0);
    expect(agent.received[0]).toMatchObject({ type: 'error', code: 'INVALID_MESSAGE' });
    expect(stored).toEqual([]);
  });

  it('closes with 4009 after explaining a protocol version mismatch', async () => {
    const agent = await connect();
    agent.send({ ...hello, v: 2 });
    await agent.until(() => agent.closeCode() !== null);
    expect(agent.received[0]).toMatchObject({
      type: 'error',
      code: 'PROTOCOL_MISMATCH',
      details: { agentVersion: 2, collectorVersion: 1 },
    });
    expect(agent.closeCode()).toBe(4009);
  });

  it('closes with 4013 when a message is over 1 MB', async () => {
    const agent = await connect();
    agent.send(hello);
    agent.send(`{"type":"batch","pad":"${'x'.repeat(MAX_BATCH_BYTES)}"}`);
    await agent.until(() => agent.closeCode() !== null);
    expect(agent.closeCode()).toBe(4013);
  });

  it('closes with 4013 when a batch has more than 2000 events', async () => {
    const agent = await connect();
    agent.send(hello);
    agent.send({
      type: 'batch',
      v: 1,
      pid: 1,
      seq: 1,
      events: Array.from({ length: 2001 }, (_, i) => warning(i)),
    });
    await agent.until(() => agent.closeCode() !== null);
    expect(agent.closeCode()).toBe(4013);
  });

  it('closes with 4008 after 10 invalid messages in a row', async () => {
    const agent = await connect();
    for (let i = 0; i < 10; i += 1) agent.send('not json');
    await agent.until(() => agent.closeCode() !== null);
    expect(agent.received.filter((m) => m.type === 'error')).toHaveLength(10);
    expect(agent.closeCode()).toBe(4008);
  });

  it('marks the session disconnected and its running requests incomplete when the app goes away', async () => {
    const agent = await connect();
    agent.send(hello);
    await agent.until(() => agent.received.length > 0);
    const sessionId = agent.received[0]?.sessionId as string;
    store.sqlite
      .prepare(
        "INSERT INTO requests (id, session_id, method, path, state, request_json, started_at, created_at, updated_at) VALUES ('req_RUN', ?, 'GET', '/x', 'in_progress', '{}', 1, 1, 1)",
      )
      .run(sessionId);
    agent.close();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(store.sqlite.prepare('SELECT status FROM sessions').get()).toEqual({
      status: 'disconnected',
    });
    expect(store.sqlite.prepare("SELECT state FROM requests WHERE id = 'req_RUN'").get()).toEqual({
      state: 'incomplete',
    });
  });
});

describe('backpressure', () => {
  it('sends slow_down above 5000 waiting events and resume once below 1000', async () => {
    const sent: Record<string, unknown>[] = [];
    const slow = createIngest({
      openSession: () => 'ses_X',
      ingest: () => undefined,
      closeSession: () => undefined,
    });
    const connection = slow.accept({
      send: (data) => sent.push(JSON.parse(data) as Record<string, unknown>),
      close: () => undefined,
    });
    connection.onMessage(JSON.stringify(hello));
    const batch = (seq: number) =>
      JSON.stringify({
        type: 'batch',
        v: 1,
        pid: 1,
        seq,
        events: Array.from({ length: 1000 }, (_, i) => warning(i)),
      });
    // Messages arrive faster than the queue drains (one batch per event-loop turn).
    for (let seq = 1; seq <= 6; seq += 1) connection.onMessage(batch(seq));
    expect(slow.pendingEvents()).toBe(6000);
    expect(sent.some((m) => m.type === 'slow_down')).toBe(true);
    await slow.drained();
    expect(slow.pendingEvents()).toBe(0);
    const types = sent.map((m) => m.type);
    expect(types.indexOf('resume')).toBeGreaterThan(types.indexOf('slow_down'));
    expect(sent.filter((m) => m.type === 'ack')).toHaveLength(6);
    expect(SLOW_DOWN_ABOVE).toBeGreaterThan(RESUME_BELOW);
  });
});
