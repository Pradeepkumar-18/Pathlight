// The transport against a scripted collector (the real one is in tests/integration).
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';

import type { AgentEvent } from '@pathlight-tracker/protocol';

import { createAgentLogger } from '../safety/logger';
import { createSafety } from '../safety/safety';
import { buildHello } from './hello';
import { createTransport } from './transport';
import type { Transport } from './transport';

interface Received {
  type: string;
  seq?: number;
  events?: AgentEvent[];
}

const servers: WebSocketServer[] = [];
const transports: Transport[] = [];

afterEach(async () => {
  transports.splice(0).forEach((transport) => transport.close());
  for (const server of servers.splice(0)) await new Promise((resolve) => server.close(resolve));
});

async function scriptedCollector(
  onConnection: (socket: WebSocket, received: Received[]) => void,
): Promise<{ url: string; received: Received[]; protocols: string[][] }> {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  servers.push(server);
  const received: Received[] = [];
  const protocols: string[][] = [];
  server.on('connection', (socket, request) => {
    protocols.push(String(request.headers['sec-websocket-protocol']).split(/,\s*/));
    socket.on('message', (data) => received.push(JSON.parse(String(data)) as Received));
    onConnection(socket, received);
  });
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `ws://127.0.0.1:${port}/agent`, received, protocols };
}

const welcome = (socket: WebSocket) =>
  socket.send(
    JSON.stringify({
      type: 'welcome',
      v: 1,
      sessionId: 'ses_01JBSEED000000000000000001',
      limits: { maxBatchEvents: 2, maxBatchBytes: 1_048_576 },
    }),
  );

function transportTo(url: string, logs: string[] = []): Transport {
  const logger = createAgentLogger('debug', (text) => logs.push(text));
  const transport = createTransport({
    url,
    token: 'k'.repeat(43),
    safety: createSafety({ logger }),
    logger,
    hello: () => buildHello(process.cwd()),
    flushMs: 5,
    backoff: { initialMs: 10, maxMs: 20 },
  });
  transports.push(transport);
  return transport;
}

const warning = (n: number): AgentEvent => ({
  e: 'warning',
  traceId: null,
  ts: String(n),
  code: 'W',
  message: `m${n}`,
});

async function until(check: () => boolean): Promise<void> {
  for (let i = 0; i < 250 && !check(); i += 1) await new Promise((r) => setTimeout(r, 20));
  expect(check()).toBe(true);
}

const batches = (received: Received[]) => received.filter((message) => message.type === 'batch');

describe('transport', () => {
  it('says hello with the token as a subprotocol, then sends batches within the welcome limits', async () => {
    const collector = await scriptedCollector((socket) => {
      socket.once('message', () => welcome(socket));
    });
    const transport = transportTo(collector.url);
    for (let n = 1; n <= 5; n += 1) transport.send(warning(n));
    await until(() => batches(collector.received).length === 3);
    expect(collector.protocols[0]).toEqual(['pathlight-tracker.v1', `bearer.${'k'.repeat(43)}`]);
    expect(collector.received[0]).toMatchObject({ type: 'hello', framework: 'unknown' });
    expect(batches(collector.received).map((batch) => batch.events?.length)).toEqual([2, 2, 1]);
  });

  it('keeps one batch in flight while asked to slow down, and resends what was never acknowledged', async () => {
    let connections = 0;
    const collector = await scriptedCollector((socket) => {
      connections += 1;
      socket.once('message', () => {
        welcome(socket);
        if (connections === 1) socket.send('{"type":"slow_down","v":1,"reason":"ingest_backlog"}');
      });
    });
    const transport = transportTo(collector.url);
    await until(() => transport.connected && transport.slowedDown);
    for (let n = 1; n <= 6; n += 1) transport.send(warning(n));
    await new Promise((resolve) => setTimeout(resolve, 150));
    // Never acknowledged, so only the first batch went out.
    expect(batches(collector.received)).toHaveLength(1);

    // The connection drops: everything comes again on the next one, in order, without slow down.
    for (const client of servers[0]?.clients ?? []) client.terminate();
    await until(() => batches(collector.received).length >= 4);
    const resent = batches(collector.received)
      .slice(1)
      .flatMap((batch) => batch.events ?? [])
      .map((event) => event.ts);
    expect(resent).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('stops for good, with one clear warning, when the collector rejects the token', async () => {
    let connections = 0;
    const collector = await scriptedCollector((socket) => {
      connections += 1;
      socket.close(4001, 'invalid token');
    });
    const logs: string[] = [];
    transportTo(collector.url, logs);
    await until(() => logs.some((line) => line.includes('COLLECTOR_CLOSED')));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(connections).toBe(1);
    expect(logs.join('')).toContain('rejected the token');
    expect(logs.join('')).not.toContain('k'.repeat(43));
  });

  it('retries with backoff while nobody is listening, and warns only once', async () => {
    const collector = await scriptedCollector(() => undefined);
    const url = collector.url;
    await new Promise((resolve) => servers.pop()?.close(resolve));
    const logs: string[] = [];
    transportTo(url, logs);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(logs.filter((line) => line.includes('COLLECTOR_UNREACHABLE'))).toHaveLength(1);
  });
});
