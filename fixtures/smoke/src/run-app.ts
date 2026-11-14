// Starts a fixture app on a free port and waits for its "listening on" line.
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface RunningApp {
  child: ChildProcess;
  url: string;
  output: () => string;
  stop: () => void;
}

export interface StartOptions {
  /** Extra Node flags before the entry, e.g. `--require` for the agent spike. */
  nodeArgs?: string[];
  /** Working directory; the agent spike treats it as the project root. */
  cwd?: string;
}

const STARTUP_TIMEOUT_MS = 120_000;

export const FIXTURES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REPO_DIR = path.resolve(FIXTURES_DIR, '..');

export function startApp(
  name: string,
  entry: string,
  options: StartOptions = {},
): Promise<RunningApp> {
  const child = spawn(
    process.execPath,
    ['--enable-source-maps', ...(options.nodeArgs ?? []), entry],
    {
      cwd: options.cwd,
      env: { ...process.env, PORT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  const collect = (chunk: Buffer): void => {
    output += chunk.toString();
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  const stop = (): void => {
    child.removeAllListeners('exit');
    child.kill();
  };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${name} did not start within ${STARTUP_TIMEOUT_MS}ms\n${output}`));
    }, STARTUP_TIMEOUT_MS);
    const onData = (): void => {
      const match = /listening on (http:\/\/[\w.[\]:]+)/.exec(output);
      if (match?.[1]) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        resolve({ child, url: match[1], output: () => output, stop });
      }
    };
    child.stdout.on('data', onData);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`${name} exited early with code ${code}\n${output}`));
    });
  });
}
