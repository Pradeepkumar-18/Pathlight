// `pathlight-tracker dev -- <command>` (`architecture.md` §3a, `user-flows.md` T1): starts the
// collector, then the user's app with the agent preloaded, and mirrors the app's lifetime.
import { spawn as nodeSpawn } from 'node:child_process';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import path from 'node:path';

import { startCollector } from '../collector';
import type { RunningCollector } from '../collector';
import { values } from '../config/load';
import type { CliIo, DevRequest } from './program';

export interface DevDeps {
  spawn: (command: string, args: string[], options: SpawnOptions) => ChildProcess;
  openBrowser: (url: string) => Promise<void>;
  /** Calls `handler` on Ctrl+C / SIGTERM; returns a function that stops listening. */
  onInterrupt: (handler: (signal: NodeJS.Signals) => void) => () => void;
  /** Where the agent's `--require` entry is, or null when it isn't installed next to the CLI. */
  agentEntry: () => string | null;
  /** Pass the first Ctrl+C on to the app. Off on Windows, where the console already sends it to the whole group. */
  forwardInterrupt: boolean;
  version: string;
}

const defaultDeps = (version: string): DevDeps => ({
  spawn: nodeSpawn,
  openBrowser: async (url) => {
    // `open` is ESM-only; a dynamic import works from this CommonJS build.
    const { default: open } = await import('open');
    await open(url);
  },
  onInterrupt: (handler) => {
    process.on('SIGINT', handler);
    process.on('SIGTERM', handler);
    return () => {
      process.off('SIGINT', handler);
      process.off('SIGTERM', handler);
    };
  },
  agentEntry: () => {
    try {
      return require.resolve('@pathlight-tracker/agent', { paths: [__dirname, process.cwd()] });
    } catch {
      return null;
    }
  },
  forwardInterrupt: process.platform !== 'win32',
  version,
});

/** Appends to the user's own NODE_OPTIONS; quotes the path so spaces in it survive. */
export function withAgent(existing: string | undefined, entry: string): string {
  const preload = `--require ${JSON.stringify(entry)}`;
  return existing && existing.trim() !== '' ? `${existing} ${preload}` : preload;
}

/** Quotes one word for cmd.exe when it has spaces or characters cmd treats specially. */
export function quoteForWindowsShell(word: string): string {
  return /[\s"&|<>^()]/.test(word) ? `"${word.replace(/"/g, '\\"')}"` : word;
}

/** Exit code to report: the app's own, or 128 + signal number when a signal ended it. */
export function exitCodeOf(code: number | null, signal: NodeJS.Signals | null): number {
  if (code !== null) return code;
  const numbers: Partial<Record<NodeJS.Signals, number>> = { SIGINT: 2, SIGTERM: 15, SIGKILL: 9 };
  return signal ? 128 + (numbers[signal] ?? 1) : 1;
}

export function createDevHandler(io: CliIo, deps?: Partial<DevDeps>) {
  return async (request: DevRequest): Promise<number> => {
    const d = { ...defaultDeps(deps?.version ?? '0.0.0'), ...deps };
    const settings = values(request.config);
    const projectRoot = io.cwd();
    let collector: RunningCollector;
    try {
      collector = await startCollector({
        projectRoot,
        config: request.config,
        version: d.version,
        onError: (code, context) => io.err(`[pathlight-tracker] ${code} ${context}\n`),
      });
    } catch (error) {
      const code = (error as { code?: unknown }).code;
      io.err(
        `[pathlight-tracker] ${typeof code === 'string' ? code : 'START_FAILED'} ${error instanceof Error ? error.message : 'unknown'}\n`,
      );
      return 1;
    }

    const link = `${collector.url}/#token=${collector.token}`;
    if (collector.addedGitignore)
      io.out(
        '[pathlight-tracker] Added .pathlight-tracker/ to .gitignore (recordings stay on this machine).\n',
      );
    io.out(`[pathlight-tracker] ${d.version} · map: ${link}\n`);

    const env: NodeJS.ProcessEnv = {
      ...io.env,
      PATHLIGHT_TRACKER_COLLECTOR_URL: collector.agentUrl,
      PATHLIGHT_TRACKER_TOKEN: collector.token,
    };
    const agent = d.agentEntry();
    if (agent) env.NODE_OPTIONS = withAgent(io.env.NODE_OPTIONS, agent);
    else
      io.err(
        '[pathlight-tracker] AGENT_NOT_FOUND The agent is not installed next to the CLI; your app runs untraced.\n',
      );

    const [command = '', ...args] = request.command;
    // npm, npx and other `.cmd` shims need a shell on Windows. A shell joins the words without
    // quoting, so each one is quoted here (paths with spaces, e.g. "C:\Program Files\…").
    const useShell = process.platform === 'win32';
    const child = useShell
      ? d.spawn(request.command.map(quoteForWindowsShell).join(' '), [], {
          cwd: projectRoot,
          env,
          stdio: 'inherit',
          shell: true,
        })
      : d.spawn(command, args, { cwd: projectRoot, env, stdio: 'inherit' });

    let interrupts = 0;
    let stoppedWith: NodeJS.Signals | null = null;
    const stop = (signal: NodeJS.Signals) => {
      stoppedWith = signal;
      // On Windows the app runs under cmd.exe: killing only the shell would leave the app running.
      if (useShell && child.pid !== undefined)
        nodeSpawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }).on(
          'error',
          (error) => io.err(`[pathlight-tracker] APP_STOP_FAILED ${error.message}\n`),
        );
      else child.kill(signal);
    };
    const stopListening = d.onInterrupt((signal) => {
      interrupts += 1;
      // First Ctrl+C: let the app shut down (Windows already sent it to the whole console group).
      // Second: stop waiting.
      if (interrupts === 1 && d.forwardInterrupt) stop(signal);
      else if (interrupts > 1) stop('SIGKILL');
    });

    if (settings.openBrowser) {
      d.openBrowser(link).catch(() =>
        io.err(`[pathlight-tracker] BROWSER_NOT_OPENED Open ${collector.url} yourself.\n`),
      );
    }

    const exitCode = await new Promise<number>((resolve) => {
      child.once('error', (error) => {
        io.err(`[pathlight-tracker] APP_START_FAILED ${error.message}\n`);
        resolve(127);
      });
      child.once('exit', (code, signal) =>
        // taskkill makes cmd.exe exit with 1; report the Ctrl+C the way a POSIX shell would.
        resolve(
          useShell && stoppedWith && code !== 0
            ? exitCodeOf(null, stoppedWith)
            : exitCodeOf(code, signal),
        ),
      );
    });
    stopListening();
    await collector.stop();
    io.out(
      `[pathlight-tracker] Your app exited with code ${exitCode}. Recordings are kept in ${path.join('.pathlight-tracker', path.basename(settings.dbPath))}.\n`,
    );
    return exitCode;
  };
}
