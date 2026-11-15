import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';

import { SETTING_DEFAULTS, agentEventSchema } from '@pathlight-tracker/protocol';
import type { CapturedValue } from '@pathlight-tracker/protocol';

import { createAgentLogger } from '../safety/logger';
import { createSafety } from '../safety/safety';
import { buildHello } from '../transport/hello';
import { createTransport } from '../transport/transport';
import type { Transport } from '../transport/transport';
import { createCapturer } from './capturer';
import { createRedactor } from './redact';

const capturer = createCapturer({ ...SETTING_DEFAULTS, redactKeys: ['ssn'] });
const child = (value: CapturedValue, key: string) =>
  (value.children as Record<string, CapturedValue>)[key];

describe('secret keys', () => {
  const { isSecretKey } = createRedactor(['ssn', 'X-Internal_Key']);

  it.each([
    'password',
    'Password',
    'authorization',
    'Authorization',
    'apiKey',
    'api_key',
    'accessToken',
    'refresh_token',
    'x-api-key',
    'set-cookie',
    'cookie',
    'clientSecret',
    'privateKey',
    'credentials',
    'sessionId',
    'passwd',
    'jwt',
    'awsAccessKeyId',
    'otp',
    'OTP',
    'pin',
    'cvv',
    // User-added keys, matched the same way.
    'ssn',
    'customerSSN',
    'xInternalKey',
  ])('%s is secret', (key) => {
    expect(isSecretKey(key)).toBe(true);
  });

  it.each(['name', 'email', 'tier', 'notPaid', 'footprint', 'shipping', 'spinner', 'author', 'id'])(
    '%s is not',
    (key) => {
      expect(isSecretKey(key)).toBe(false);
    },
  );
});

describe('redacting captured values', () => {
  it('replaces secret values at any depth, in objects, headers and query params', () => {
    const body = capturer.value({
      email: 'ravi@example.com',
      password: 'hunter2',
      profile: { settings: { apiKey: 'ak_live_123' } },
    });
    expect(child(body, 'password')).toEqual({
      type: 'string',
      preview: '[REDACTED]',
      redacted: true,
    });
    const settings = child(child(body, 'profile') as CapturedValue, 'settings') as CapturedValue;
    expect(child(settings, 'apiKey')?.redacted).toBe(true);
    expect(child(body, 'email')?.preview).toBe('ravi@example.com');
    expect(body.preview).toContain('password: [REDACTED]');

    const headers = capturer.value({
      authorization: 'Bearer eyJhbGciOi',
      'x-api-key': 'k-123',
      'set-cookie': ['sid=abc; HttpOnly'],
      'content-type': 'application/json',
    });
    expect(headers.preview).toBe(
      '{ authorization: [REDACTED], x-api-key: [REDACTED], set-cookie: [REDACTED], content-type: "application/json" }',
    );
  });

  it('redacts secrets in a Map too', () => {
    const map = capturer.value(new Map([['accessToken', 'tok']]));
    expect(child(map, 'accessToken')?.redacted).toBe(true);
  });

  it('redacts query parameters inside URLs', () => {
    expect(capturer.redactUrl('https://api.example.com/cb?code=1&access_token=abc&page=2#x')).toBe(
      'https://api.example.com/cb?code=1&access_token=[REDACTED]&page=2#x',
    );
    expect(capturer.redactUrl('/orders?apiKey=k&q=shoes')).toBe(
      '/orders?apiKey=[REDACTED]&q=shoes',
    );
    expect(capturer.redactUrl('/orders')).toBe('/orders');
    expect(capturer.redactUrl('/x?%E0%A4%A=1&token=t')).toBe('/x?%E0%A4%A=1&token=[REDACTED]');
  });
});

describe('nothing secret reaches the transport', () => {
  const servers: WebSocketServer[] = [];
  const transports: Transport[] = [];
  afterEach(async () => {
    transports.splice(0).forEach((transport) => transport.close());
    for (const server of servers.splice(0)) await new Promise((resolve) => server.close(resolve));
  });

  it('a request full of secrets is sent without any of them', async () => {
    const SECRETS = [
      'hunter2',
      'eyJhbGciOi',
      'sid=abc',
      'k-123',
      'ak_live_123',
      'tok_999',
      '123-45-6789',
    ];
    const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
    servers.push(server);
    const received: string[] = [];
    server.on('connection', (socket) => {
      socket.on('message', (data) => {
        received.push(String(data));
        if (received.length === 1)
          socket.send(
            '{"type":"welcome","v":1,"sessionId":"ses_01JBSEED000000000000000001","limits":{"maxBatchEvents":2000,"maxBatchBytes":1048576}}',
          );
      });
    });
    await new Promise((resolve) => server.once('listening', resolve));
    const logger = createAgentLogger('silent');
    const transport = createTransport({
      url: `ws://127.0.0.1:${(server.address() as AddressInfo).port}/agent`,
      token: 't'.repeat(43),
      safety: createSafety({ logger }),
      logger,
      hello: () => buildHello(process.cwd()),
      flushMs: 5,
    });
    transports.push(transport);

    transport.send(
      agentEventSchema.parse({
        e: 'request.start',
        traceId: 'req_01JBSEED000000000000000001',
        ts: '1',
        framework: 'express',
        method: 'POST',
        path: capturer.redactUrl('/login?token=tok_999'),
        route: '/login',
        params: null,
        query: capturer.value({ token: 'tok_999' }),
        body: capturer.value({ user: { password: 'hunter2', ssn: '123-45-6789' } }),
        headers: capturer.value({
          authorization: 'Bearer eyJhbGciOi',
          cookie: 'sid=abc',
          'x-api-key': 'k-123',
          extra: { nested: { apiKey: 'ak_live_123' } },
        }),
      }),
    );
    for (let i = 0; i < 100 && received.length < 2; i += 1)
      await new Promise((resolve) => setTimeout(resolve, 20));
    const sent = received.join('\n');
    expect(sent).toContain('"e":"request.start"');
    expect(sent).toContain('[REDACTED]');
    for (const secret of SECRETS) expect(sent).not.toContain(secret);
  });
});
