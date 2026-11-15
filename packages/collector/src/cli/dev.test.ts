import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../config/load';
import { createDevHandler, exitCodeOf, quoteForWindowsShell, withAgent } from './dev';
import type { CliIo } from './program';

let root: string;
let output: string[];
let io: CliIo;

/** A stand-in app: reports its environment, then waits for Ctrl+C or exits with a code. */
const APP = `
const fs = require('node:fs');
fs.writeFileSync('env.json', JSON.stringify({
  url: process.env.PATHLIGHT_TRACKER_COLLECTOR_URL,
  token: process.env.PATHLIGHT_TRACKER_TOKEN,
  nodeOptions: process.env.NODE_OPTIONS,
}));
console.log('app started');
if (process.argv[2]) process.exit(Number(process.argv[2]));
process.on('SIGINT', () => { console.log('app stopping'); process.exit(0); });
setInterval(() => {}, 1000);
`;

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createNetServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

beforeEach(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'pt-dev-'));
  writeFileSync(path.join(root, 'app.js'), APP);
  writeFileSync(path.join(root, 'agent.js'), '');
  output = [];
  io = {
    out: (t) => output.push(t),
    err: (t) => output.push(t),
    cwd: () => root,
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' },
  };
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

async function config() {
  return loadConfig({
    projectRoot: root,
    env: {},
    flags: { port: String(await freePort()), openBrowser: 'false' },
    readFile: () => '{}',
  }).config;
}

describe('pathlight-tracker dev', () => {
  it('starts the app with the agent and the collector address, prints the link with the token, and returns the app exit code', async () => {
    const handler = createDevHandler(io, {
      version: '0.1.0',
      agentEntry: () => path.join(root, 'agent.js'),
      forwardInterrupt: true,
    });
    const code = await handler({
      command: [process.execPath, 'app.js', '3'],
      config: await config(),
    });
    expect(code).toBe(3);
    const text = output.join('');
    expect(text).toMatch(
      /\[pathlight-tracker\] 0\.1\.0 · map: http:\/\/127\.0\.0\.1:\d+\/#token=[A-Za-z0-9_-]{43}\n/,
    );
    expect(text).toContain('Your app exited with code 3.');
    const env = JSON.parse(
      (await import('node:fs')).readFileSync(path.join(root, 'env.json'), 'utf8'),
    ) as Record<string, string>;
    expect(env.url).toMatch(/^ws:\/\/127\.0\.0\.1:\d+\/agent$/);
    expect(env.token).toHaveLength(43);
    // The user's own NODE_OPTIONS are kept; the agent is appended.
    expect(env.nodeOptions).toBe(
      `--max-old-space-size=512 --require ${JSON.stringify(path.join(root, 'agent.js'))}`,
    );
    // The collector stopped with the app.
    expect(existsSync(path.join(root, '.pathlight-tracker', 'collector.json'))).toBe(false);
  });

  it('stops the app on Ctrl+C and returns its exit code', async () => {
    let interrupt: ((signal: NodeJS.Signals) => void) | undefined;
    const handler = createDevHandler(io, {
      version: '0.1.0',
      agentEntry: () => null,
      forwardInterrupt: true,
      onInterrupt: (listener) => {
        interrupt = listener;
        return () => undefined;
      },
    });
    const running = handler({ command: [process.execPath, 'app.js'], config: await config() });
    while (!existsSync(path.join(root, 'env.json')))
      await new Promise((resolve) => setTimeout(resolve, 20));
    interrupt?.('SIGINT');
    // POSIX: the app's SIGINT handler exits 0. Windows has no SIGINT for child processes, so the
    // app is ended and reports the signal (128 + 2).
    expect(await running).toBe(process.platform === 'win32' ? 130 : 0);
    expect(output.join('')).toContain('AGENT_NOT_FOUND');
  });

  it('reports a command that cannot start', async () => {
    const handler = createDevHandler(io, {
      version: '0.1.0',
      agentEntry: () => null,
      forwardInterrupt: true,
    });
    const code = await handler({
      command: ['definitely-not-a-command-xyz'],
      config: await config(),
    });
    expect(code).not.toBe(0);
  });
});

describe('launcher helpers', () => {
  it('appends the agent to NODE_OPTIONS and quotes its path', () => {
    expect(withAgent(undefined, '/a b/agent.js')).toBe('--require "/a b/agent.js"');
    expect(withAgent('--inspect', '/x.js')).toBe('--inspect --require "/x.js"');
  });

  it('quotes words with spaces or cmd.exe metacharacters for the Windows shell', () => {
    expect(quoteForWindowsShell('node')).toBe('node');
    expect(quoteForWindowsShell('C:\\Program Files\\nodejs\\node.exe')).toBe(
      '"C:\\Program Files\\nodejs\\node.exe"',
    );
    expect(quoteForWindowsShell('a&b')).toBe('"a&b"');
    expect(quoteForWindowsShell('say "hi"')).toBe('"say \\"hi\\""');
  });

  it('maps exits to codes', () => {
    expect(exitCodeOf(0, null)).toBe(0);
    expect(exitCodeOf(null, 'SIGINT')).toBe(130);
    expect(exitCodeOf(null, 'SIGTERM')).toBe(143);
  });
});
