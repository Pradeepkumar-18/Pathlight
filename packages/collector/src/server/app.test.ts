import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createServer, MAX_BODY_BYTES } from './app';
import type { CollectorServer } from './app';
import { DEFAULT_PORT, listen } from './listen';
import { loadOrCreateToken } from './token';

const TOKEN = 'a'.repeat(43);
const PORT = 4777;
const HOST = `127.0.0.1:${PORT}`;
const ok = { host: HOST, authorization: `Bearer ${TOKEN}` };

let server: CollectorServer;

async function build(uiDir?: string): Promise<CollectorServer> {
  const built = await createServer({ token: TOKEN, version: '0.1.0', uiDir });
  // A protected route standing in for the real API (task 2.10).
  built.app.get('/api/v1/ping', async () => ({ data: 'pong' }));
  built.app.post('/api/v1/echo', async (request) => ({ data: request.body }));
  built.app.get('/live', { websocket: true }, (socket, request) => {
    if (built.admitSocket(socket, request.headers, 'live')) socket.send('admitted');
  });
  built.app.get('/agent', { websocket: true }, (socket, request) => {
    if (built.admitSocket(socket, request.headers, 'agent')) socket.send('admitted');
  });
  built.setPort(PORT);
  return built;
}

beforeEach(async () => {
  server = await build();
});

afterEach(async () => {
  await server.app.close();
});

const get = (url: string, headers: Record<string, string>) =>
  server.app.inject({ method: 'GET', url, headers });

describe('REST auth and checks', () => {
  it('accepts a request with the token, the right host and no origin', async () => {
    const response = await get('/api/v1/ping', ok);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: 'pong' });
    expect(response.headers['x-pathlight-tracker-version']).toBe('0.1.0');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it.each([
    ['a missing token', { host: HOST }, 401, 'MISSING_TOKEN'],
    [
      'a wrong token',
      { host: HOST, authorization: `Bearer ${'b'.repeat(43)}` },
      401,
      'INVALID_TOKEN',
    ],
    ['a foreign origin', { ...ok, origin: 'https://evil.example' }, 403, 'ORIGIN_NOT_ALLOWED'],
    [
      'a wrong host (DNS rebinding)',
      { ...ok, host: `evil.example:${PORT}` },
      403,
      'HOST_NOT_ALLOWED',
    ],
  ])('rejects %s', async (_name, headers, status, code) => {
    const response = await get('/api/v1/ping', headers);
    expect(response.statusCode).toBe(status);
    expect(response.json()).toMatchObject({ error: { code } });
  });

  it('accepts the collector UI origin on localhost too', async () => {
    const response = await get('/api/v1/ping', {
      ...ok,
      host: `localhost:${PORT}`,
      origin: `http://localhost:${PORT}`,
    });
    expect(response.statusCode).toBe(200);
  });

  it('answers a burst with 429 and rate-limit headers', async () => {
    let last = await get('/api/v1/ping', ok);
    for (let i = 0; i < 200 && last.statusCode !== 429; i += 1)
      last = await get('/api/v1/ping', ok);
    expect(last.statusCode).toBe(429);
    expect(last.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
    expect(last.headers['retry-after']).toBeDefined();
    expect(last.headers['ratelimit-limit']).toBe('200');
    expect(last.headers['ratelimit-remaining']).toBe('0');
    expect(last.headers['ratelimit-reset']).toBeDefined();
  });

  it('limits writes more tightly than reads', async () => {
    let status = 0;
    let count = 0;
    while (status !== 429 && count < 50) {
      count += 1;
      status = (
        await server.app.inject({
          method: 'POST',
          url: '/api/v1/echo',
          headers: ok,
          payload: { a: 1 },
        })
      ).statusCode;
    }
    expect(count).toBe(21);
  });

  it('rejects a body over 64 KB with PAYLOAD_TOO_LARGE', async () => {
    const response = await server.app.inject({
      method: 'POST',
      url: '/api/v1/echo',
      headers: { ...ok, 'content-type': 'application/json' },
      payload: JSON.stringify({ big: 'x'.repeat(MAX_BODY_BYTES) }),
    });
    expect(response.statusCode).toBe(413);
    expect(response.json()).toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' } });
  });

  it('answers unknown endpoints with the error envelope', async () => {
    const response = await get('/api/v1/nope', ok);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'ROUTE_NOT_FOUND' } });
  });
});

describe('static UI', () => {
  it('serves the UI without a token, with a Content-Security-Policy', async () => {
    const response = await get('/', { host: HOST });
    expect(response.statusCode).toBe(200);
    const csp = String(response.headers['content-security-policy']);
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain(`connect-src 'self' http://127.0.0.1:${PORT}`);
    expect(csp).toContain(`ws://localhost:${PORT}`);
    expect(csp).not.toContain('unsafe-inline');
  });

  it('serves built UI files from the UI folder', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pt-ui-'));
    writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Map</title>');
    writeFileSync(path.join(dir, 'app.js'), 'console.log(1)');
    const withUi = await build(dir);
    expect((await withUi.app.inject({ url: '/', headers: { host: HOST } })).body).toContain(
      '<title>Map</title>',
    );
    expect((await withUi.app.inject({ url: '/app.js', headers: { host: HOST } })).statusCode).toBe(
      200,
    );
    await withUi.app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('still checks the host on static files', async () => {
    expect((await get('/', { host: 'evil.example' })).statusCode).toBe(403);
  });
});

describe('WebSocket checks (subprotocol token)', () => {
  let port: number;

  beforeEach(async () => {
    await server.app.listen({ host: '127.0.0.1', port: 0 });
    port = (server.app.server.address() as { port: number }).port;
    server.setPort(port);
  });

  /** Opens a socket and resolves with the first message or the close code. */
  function open(
    channel: string,
    protocols: string[],
    headers: Record<string, string> = {},
  ): Promise<string | number> {
    return new Promise((resolve) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/${channel}`, {
        protocols,
        headers,
      } as unknown as string[]);
      socket.addEventListener('message', (event) => {
        resolve(String(event.data));
        socket.close();
      });
      socket.addEventListener('close', (event) => resolve(event.code));
      socket.addEventListener('error', () => undefined);
    });
  }

  it('admits /agent with the token and no origin, answering with the protocol', async () => {
    expect(await open('agent', ['pathlight-tracker.v1', `bearer.${TOKEN}`])).toBe('admitted');
  });

  it('closes with 4001 when the token is wrong or missing', async () => {
    expect(await open('agent', ['pathlight-tracker.v1', `bearer.${'b'.repeat(43)}`])).toBe(4001);
    expect(await open('agent', ['pathlight-tracker.v1'])).toBe(4001);
  });

  it('closes /live with 4003 when the browser origin is foreign or missing', async () => {
    const protocols = ['pathlight-tracker.v1', `bearer.${TOKEN}`];
    expect(await open('live', protocols, { origin: `http://127.0.0.1:${port}` })).toBe('admitted');
    expect(await open('live', protocols, { origin: 'https://evil.example' })).toBe(4003);
    expect(await open('live', protocols)).toBe(4003);
  });

  it('closes /agent with 4003 when a browser origin is present', async () => {
    expect(
      await open('agent', ['pathlight-tracker.v1', `bearer.${TOKEN}`], {
        origin: 'https://evil.example',
      }),
    ).toBe(4003);
  });
});

describe('token and port', () => {
  it('creates the token once and keeps it across restarts; deleting the file rotates it', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pt-token-'));
    const first = loadOrCreateToken(dir);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(loadOrCreateToken(dir)).toBe(first);
    rmSync(path.join(dir, 'token'));
    expect(loadOrCreateToken(dir)).not.toBe(first);
    rmSync(dir, { recursive: true, force: true });
  });

  it('uses the next port when the default one is busy', async () => {
    const blocker = createNetServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once('error', reject);
      blocker.listen(DEFAULT_PORT, '127.0.0.1', resolve);
    }).catch(() => undefined); // already busy on this machine is fine too
    const other = await build();
    const port = await listen(other, null);
    expect(port).toBeGreaterThan(DEFAULT_PORT);
    expect(other.port()).toBe(port);
    await other.app.close();
    blocker.close();
  });
});
