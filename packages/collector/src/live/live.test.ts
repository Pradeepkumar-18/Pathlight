import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { liveMessageSchema } from '@pathlight-tracker/protocol';
import type { LiveMessage } from '@pathlight-tracker/protocol';

import { startCollector } from '../collector';
import type { RunningCollector } from '../collector';
import { loadConfig } from '../config/load';

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
const OTHER = 'req_01JBSEED0000000000000000ZZ';

let root: string;
let collector: RunningCollector;

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createNetServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

beforeEach(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'pt-live-'));
  const { config } = loadConfig({
    projectRoot: root,
    env: {},
    flags: { port: String(await freePort()) },
    readFile: () => '{}',
  });
  collector = await startCollector({ projectRoot: root, config, version: '0.1.0' });
});

afterEach(async () => {
  await collector.stop();
  rmSync(root, { recursive: true, force: true });
});

/** A browser tab on `/live` that records every message (validated against the protocol). */
async function openUi(topics: string[]) {
  const socket = new WebSocket(`ws://127.0.0.1:${collector.port}/live`, {
    protocols: ['pathlight-tracker.v1', `bearer.${collector.token}`],
    headers: { origin: collector.url },
  } as unknown as string[]);
  const received: LiveMessage[] = [];
  socket.addEventListener('message', (event) => {
    received.push(liveMessageSchema.parse(JSON.parse(String(event.data))));
  });
  await new Promise((resolve) => socket.addEventListener('open', resolve));
  socket.send(JSON.stringify({ type: 'subscribe', v: 1, topics }));
  socket.send(JSON.stringify({ type: 'ping', v: 1 }));
  return { received, close: () => socket.close() };
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

async function until(check: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !check(); i += 1)
    await new Promise((resolve) => setTimeout(resolve, 20));
}

describe('WS /live', () => {
  it('an agent batch produces the expected /live messages, in order', async () => {
    const ui = await openUi(['requests', `request:${REQUEST}`]);
    await runAgent();
    await until(() => ui.received.some((message) => message.type === 'live.agent.disconnected'));
    const types = ui.received.map((message) => message.type);
    expect(types).toEqual([
      'pong',
      'live.agent.connected',
      'live.request.started',
      'live.steps.appended',
      'live.steps.updated',
      'live.steps.appended',
      'live.steps.updated',
      'live.request.completed',
      'live.agent.disconnected',
    ]);
    const appended = ui.received
      .filter((m) => m.type === 'live.steps.appended')
      .flatMap((m) => (m.type === 'live.steps.appended' ? m.steps : []));
    expect(appended.map((step) => step.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const completed = ui.received.find((m) => m.type === 'live.request.completed');
    expect(completed).toMatchObject({
      request: { id: REQUEST, httpStatus: 500 },
      errorPath: [
        'stp_01JBSEED000000000000000003',
        'stp_01JBSEED000000000000000004',
        'stp_01JBSEED000000000000000008',
      ],
    });
    ui.close();
  });

  it("a UI subscribed to one request gets only that request's steps", async () => {
    const watcher = await openUi([`request:${REQUEST}`]);
    const other = await openUi([`request:${OTHER}`]);
    await runAgent();
    await until(() =>
      watcher.received.some((message) => message.type === 'live.request.completed'),
    );
    expect(watcher.received.some((message) => message.type === 'live.steps.appended')).toBe(true);
    // No list updates either: it only asked for one request.
    expect(watcher.received.some((message) => message.type === 'live.request.started')).toBe(false);
    expect(other.received.map((message) => message.type)).toEqual(['pong']);
    watcher.close();
    other.close();
  });

  it('pushes deletes made through the REST API to the request list', async () => {
    const ui = await openUi(['requests']);
    await runAgent();
    const response = await fetch(`${collector.url}/api/v1/requests/${REQUEST}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${collector.token}` },
    });
    expect(response.status).toBe(200);
    await until(() => ui.received.some((message) => message.type === 'live.request.deleted'));
    expect(ui.received.find((message) => message.type === 'live.request.deleted')).toMatchObject({
      requestId: REQUEST,
    });
    ui.close();
  });

  it('refuses an 11th open UI with 4029', async () => {
    const uis = await Promise.all(Array.from({ length: 10 }, () => openUi(['requests'])));
    const extra = new WebSocket(`ws://127.0.0.1:${collector.port}/live`, {
      protocols: ['pathlight-tracker.v1', `bearer.${collector.token}`],
      headers: { origin: collector.url },
    } as unknown as string[]);
    const code = await new Promise<number>((resolve) =>
      extra.addEventListener('close', (event) => resolve(event.code)),
    );
    expect(code).toBe(4029);
    uis.forEach((ui) => ui.close());
  });

  it('answers an invalid message with an error and keeps the socket open', async () => {
    const ui = await openUi(['requests']);
    const socket = new WebSocket(`ws://127.0.0.1:${collector.port}/live`, {
      protocols: ['pathlight-tracker.v1', `bearer.${collector.token}`],
      headers: { origin: collector.url },
    } as unknown as string[]);
    const replies: string[] = [];
    socket.addEventListener('message', (event) => replies.push(String(event.data)));
    await new Promise((resolve) => socket.addEventListener('open', resolve));
    socket.send('{"type":"subscribe","v":1,"topics":["request:nope"]}');
    socket.send('{"type":"ping","v":1}');
    await until(() => replies.length === 2);
    expect(JSON.parse(replies[0] ?? '{}')).toMatchObject({
      type: 'error',
      code: 'INVALID_MESSAGE',
    });
    expect(JSON.parse(replies[1] ?? '{}')).toMatchObject({ type: 'pong' });
    socket.close();
    ui.close();
  });
});
