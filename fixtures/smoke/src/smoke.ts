// Starts each fixture app, hits its endpoints and checks the status codes,
// including the deliberate 500s. Run with `pnpm fixtures:smoke` (builds first).
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface Check {
  name: string;
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  status: number;
}

interface Fixture {
  name: string;
  entry: string;
  checks: Check[];
  // Text the app must log, proving the 500 came from the deliberate bug.
  expectedLog: string[];
}

interface RunningApp {
  child: ChildProcess;
  url: string;
  output: () => string;
}

const STARTUP_TIMEOUT_MS = 120_000;
const LOG_SETTLE_MS = 300;
const FIXTURES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NEST_AUTH = { authorization: 'Bearer fixture-token' };
const EXPRESS_AUTH = { 'x-api-key': 'fixture-key' };

const FIXTURES: Fixture[] = [
  {
    name: 'nestjs-app',
    entry: path.join(FIXTURES_DIR, 'nestjs-app', 'dist', 'main.js'),
    checks: [
      { name: 'health', method: 'GET', path: '/health', status: 200 },
      { name: 'get order 42', method: 'GET', path: '/orders/42', headers: NEST_AUTH, status: 200 },
      {
        name: 'create order for gold user 8',
        method: 'POST',
        path: '/orders',
        body: { userId: 8 },
        headers: NEST_AUTH,
        status: 201,
      },
      {
        name: 'create order for user 7 without tier (PRD bug)',
        method: 'POST',
        path: '/orders',
        body: { userId: 7 },
        headers: NEST_AUTH,
        status: 500,
      },
      { name: 'guard rejects missing token', method: 'GET', path: '/orders/42', status: 403 },
      {
        name: 'pipe rejects bad body',
        method: 'POST',
        path: '/orders',
        body: { userId: 'seven' },
        headers: NEST_AUTH,
        status: 400,
      },
    ],
    expectedLog: [
      "TypeError: Cannot read properties of undefined (reading 'rate')",
      'pricing.service.ts:27',
    ],
  },
  {
    name: 'express-app',
    entry: path.join(FIXTURES_DIR, 'express-app'),
    checks: [
      { name: 'health', method: 'GET', path: '/health', status: 200 },
      { name: 'get user 8', method: 'GET', path: '/users/8', headers: EXPRESS_AUTH, status: 200 },
      {
        name: 'get profile of user 8 (axios call)',
        method: 'GET',
        path: '/users/8/profile',
        headers: EXPRESS_AUTH,
        status: 200,
      },
      {
        name: 'get badge of gold user 8',
        method: 'GET',
        path: '/users/8/badge',
        headers: EXPRESS_AUTH,
        status: 200,
      },
      {
        name: 'get badge of user 7 without tier (deliberate bug)',
        method: 'GET',
        path: '/users/7/badge',
        headers: EXPRESS_AUTH,
        status: 500,
      },
      { name: 'auth middleware rejects missing key', method: 'GET', path: '/users/8', status: 401 },
      {
        name: 'unknown user',
        method: 'GET',
        path: '/users/999',
        headers: EXPRESS_AUTH,
        status: 404,
      },
    ],
    expectedLog: [
      "TypeError: Cannot read properties of undefined (reading 'label')",
      'badge.service.ts',
    ],
  },
];

function startApp(fixture: Fixture): Promise<RunningApp> {
  const child = spawn(process.execPath, ['--enable-source-maps', fixture.entry], {
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const collect = (chunk: Buffer): void => {
    output += chunk.toString();
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${fixture.name} did not start within ${STARTUP_TIMEOUT_MS}ms\n${output}`));
    }, STARTUP_TIMEOUT_MS);
    const onData = (): void => {
      const match = /listening on (http:\/\/[\w.[\]:]+)/.exec(output);
      if (match?.[1]) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        resolve({ child, url: match[1], output: () => output });
      }
    };
    child.stdout.on('data', onData);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`${fixture.name} exited early with code ${code}\n${output}`));
    });
  });
}

async function runCheck(url: string, check: Check): Promise<string | null> {
  const response = await fetch(`${url}${check.path}`, {
    method: check.method,
    headers: { 'content-type': 'application/json', ...check.headers },
    body: check.body === undefined ? undefined : JSON.stringify(check.body),
  });
  await response.arrayBuffer();
  return response.status === check.status
    ? null
    : `expected ${check.status}, got ${response.status}`;
}

async function runFixture(fixture: Fixture): Promise<number> {
  console.log(`\n${fixture.name}`);
  const app = await startApp(fixture);
  let failures = 0;
  try {
    for (const check of fixture.checks) {
      const problem = await runCheck(app.url, check);
      console.log(`  ${problem ? 'FAIL' : 'ok  '} ${check.method} ${check.path}: ${check.name}`);
      if (problem) {
        console.log(`       ${problem}`);
        failures += 1;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, LOG_SETTLE_MS));
    for (const text of fixture.expectedLog) {
      const found = app.output().includes(text);
      console.log(`  ${found ? 'ok  ' : 'FAIL'} log contains "${text}"`);
      if (!found) failures += 1;
    }
    if (failures > 0) console.log(`\n--- ${fixture.name} output ---\n${app.output()}`);
  } finally {
    app.child.removeAllListeners('exit');
    app.child.kill();
  }
  return failures;
}

async function main(): Promise<void> {
  let failures = 0;
  for (const fixture of FIXTURES) {
    failures += await runFixture(fixture);
  }
  console.log(failures === 0 ? '\nAll fixture checks passed.' : `\n${failures} check(s) failed.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
