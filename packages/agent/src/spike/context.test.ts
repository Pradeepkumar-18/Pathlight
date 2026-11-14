import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { currentTrace, resetTraces, traceIncomingRequests } from './context';
import * as runtime from './runtime';

const lines: string[] = [];
let server: http.Server;
let url = '';

beforeAll(async () => {
  resetTraces();
  traceIncomingRequests();
  runtime.setWriter((text) => lines.push(text));
  // A handler shaped like the PRD flow: nested steps with awaits in between.
  server = http.createServer((request, response) => {
    void (async () => {
      const outer = runtime.enter('Controller.handle', 'src/c.ts', 1);
      await sleep(Math.random() * 10);
      const inner = runtime.enter('Service.work', 'src/s.ts', 2);
      await sleep(Math.random() * 10);
      runtime.exit(inner);
      runtime.exit(outer);
      response.end(currentTrace().id);
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
  runtime.setWriter(() => undefined);
  resetTraces();
});

describe('traceIncomingRequests', () => {
  it('gives each concurrent request its own trace and indentation', async () => {
    const ids = await Promise.all(
      Array.from({ length: 10 }, async () => (await fetch(url)).text()),
    );
    expect(new Set(ids).size).toBe(10);
    for (const id of ids) {
      const own = lines.filter((line) => line.startsWith(`[pt ${id}] `));
      expect(own.map((line) => line.slice(`[pt ${id}] `.length).replace(/ \(.*\)\n$/, ''))).toEqual(
        ['→ Controller.handle', '  → Service.work', '  ← Service.work', '← Controller.handle'],
      );
    }
  });
});
