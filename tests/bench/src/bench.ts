// Performance spike (task 1.4): the NestJS fixture with and without the agent spike hook,
// under the same load. Run with `pnpm bench` (builds the agent and the fixture first).
// Trace output goes to the null device in both modes, so the numbers measure capture
// (wrapping, timing, formatting), not how fast a terminal can scroll.
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import autocannon from 'autocannon';
import type { Result } from 'autocannon';

interface Scenario {
  name: string;
  path: string;
  method: 'GET' | 'POST';
  body?: string;
  /** Steps the traced app records for one request (counted with the spike), for context. */
  steps: string;
}

interface Measured {
  scenario: string;
  mode: 'untraced' | 'traced';
  requestsPerSecond: number;
  p50: number;
  p99: number;
  non2xx: number;
  errors: number;
}

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const NEST_DIR = path.join(REPO, 'fixtures', 'nestjs-app');
const HOOK = path.join(REPO, 'packages', 'agent', 'dist', 'spike', 'register.js');
const DURATION_S = Number(process.env.BENCH_DURATION ?? 10);
const CONNECTIONS = 10;
const WARMUP_S = 2;
const STARTUP_ROUNDS = 5;
const AUTH = { authorization: 'Bearer fixture-token', 'content-type': 'application/json' };

const SCENARIOS: Scenario[] = [
  { name: 'GET /health', path: '/health', method: 'GET', steps: '3' },
  { name: 'GET /orders/42', path: '/orders/42', method: 'GET', steps: '6' },
  {
    name: 'POST /orders (gold user)',
    path: '/orders',
    method: 'POST',
    body: '{"userId":8}',
    steps: '12',
  },
];

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(typeof address === 'object' && address ? address.port : 0));
    });
  });
}

async function startApp(
  traced: boolean,
): Promise<{ child: ChildProcess; url: string; readyMs: number }> {
  const port = await freePort();
  const startedAt = performance.now();
  const child = spawn(
    process.execPath,
    [...(traced ? ['--require', HOOK] : []), path.join(NEST_DIR, 'dist', 'main.js')],
    {
      cwd: NEST_DIR,
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'ignore', 'ignore'],
    },
  );
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 600; attempt += 1) {
    try {
      if ((await fetch(`${url}/health`)).ok)
        return { child, url, readyMs: performance.now() - startedAt };
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill();
  throw new Error(`fixture did not start (${traced ? 'traced' : 'untraced'})`);
}

async function load(url: string, scenario: Scenario, duration: number): Promise<Result> {
  return autocannon({
    url: `${url}${scenario.path}`,
    method: scenario.method,
    headers: AUTH,
    body: scenario.body,
    connections: CONNECTIONS,
    duration,
  });
}

async function measure(traced: boolean): Promise<{ results: Measured[]; readyMs: number }> {
  const app = await startApp(traced);
  const results: Measured[] = [];
  try {
    for (const scenario of SCENARIOS) {
      await load(app.url, scenario, WARMUP_S);
      const result = await load(app.url, scenario, DURATION_S);
      results.push({
        scenario: scenario.name,
        mode: traced ? 'traced' : 'untraced',
        requestsPerSecond: result.requests.average,
        p50: result.latency.p50,
        p99: result.latency.p99,
        non2xx: result.non2xx,
        errors: result.errors + result.timeouts,
      });
    }
  } finally {
    app.child.kill();
  }
  return { results, readyMs: app.readyMs };
}

async function main(): Promise<void> {
  console.log(
    `NestJS fixture, ${CONNECTIONS} connections, ${DURATION_S}s per scenario after ${WARMUP_S}s warm-up\n`,
  );
  const untraced = await measure(false);
  const traced = await measure(true);
  const rows = SCENARIOS.map((scenario, index) => {
    const before = untraced.results[index];
    const after = traced.results[index];
    if (!before || !after) throw new Error('missing result');
    return {
      scenario: scenario.name,
      steps: scenario.steps,
      'untraced req/s': Math.round(before.requestsPerSecond),
      'traced req/s': Math.round(after.requestsPerSecond),
      slowdown: `${(before.requestsPerSecond / after.requestsPerSecond).toFixed(2)}×`,
      'p50 ms (untraced → traced)': `${before.p50} → ${after.p50}`,
      'p99 ms (untraced → traced)': `${before.p99} → ${after.p99}`,
      'errors / non-2xx': `${before.errors + after.errors} / ${before.non2xx + after.non2xx}`,
    };
  });
  console.table(rows);

  // One start-up is noise (the in-memory MongoDB start dominates), so alternate and take medians.
  const samples: Record<'untraced' | 'traced', number[]> = { untraced: [], traced: [] };
  for (let round = 0; round < STARTUP_ROUNDS; round += 1) {
    for (const traced of [false, true]) {
      const app = await startApp(traced);
      app.child.kill();
      samples[traced ? 'traced' : 'untraced'].push(app.readyMs);
    }
  }
  const median = (values: number[]): number =>
    [...values].sort((a, b) => a - b)[values.length >> 1] ?? 0;
  console.log(
    `Start-up to first /health (median of ${STARTUP_ROUNDS}): untraced ${Math.round(median(samples.untraced))} ms, ` +
      `traced ${Math.round(median(samples.traced))} ms`,
  );
  const failed = rows.some((row) => row['errors / non-2xx'] !== '0 / 0');
  if (failed) {
    console.log('FAIL: some requests errored or did not return 2xx');
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
