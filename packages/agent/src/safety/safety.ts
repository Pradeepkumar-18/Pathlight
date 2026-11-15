// Fail open (`architecture.md` §10): every hook, patch and helper runs through `run`, so an
// internal error is counted instead of reaching the user's app. After 20 internal errors within
// 60 s the agent turns itself off for this process, says so once and sends `agent.disabled`.
import type { AgentLogger } from './logger';

export const INTERNAL_ERROR_LIMIT = 20;
export const INTERNAL_ERROR_WINDOW_MS = 60_000;

export interface SafetyOptions {
  logger: AgentLogger;
  /** Told once when the agent turns itself off. */
  onDisable?: (reason: string, internalErrorCount: number) => void;
  now?: () => number;
  pid?: number;
}

export interface Safety {
  /** Runs agent code; on an internal error, counts it and returns `fallback`. */
  run: <T>(code: string, action: () => T, fallback: T) => T;
  /** Wraps an agent callback (timer, socket event) so it can never throw. */
  callback: <A extends unknown[]>(
    code: string,
    action: (...args: A) => void,
  ) => (...args: A) => void;
  /** Counts an internal error caught elsewhere. */
  report: (code: string, error: unknown) => void;
  readonly disabled: boolean;
  readonly internalErrorCount: number;
}

function describe(error: unknown): string {
  // The error's type only: its message could quote a captured value.
  if (error instanceof Error) return error.constructor.name;
  return typeof error;
}

export function createSafety(options: SafetyOptions): Safety {
  const now = options.now ?? Date.now;
  const pid = options.pid ?? process.pid;
  const recent: number[] = [];
  let total = 0;
  let disabled = false;

  function disable(reason: string): void {
    if (disabled) return;
    disabled = true;
    options.logger.warn(
      'AGENT_DISABLED',
      `Tracing turned off for process ${pid} after internal errors. Your app is unaffected.`,
    );
    try {
      options.onDisable?.(reason, total);
    } catch {
      // Already off: nothing else to protect.
    }
  }

  function report(code: string, error: unknown): void {
    try {
      if (disabled) return;
      total += 1;
      const at = now();
      recent.push(at);
      while (recent.length > 0 && (recent[0] ?? at) <= at - INTERNAL_ERROR_WINDOW_MS)
        recent.shift();
      options.logger.debug('INTERNAL_ERROR', `${code} (${describe(error)})`);
      if (recent.length >= INTERNAL_ERROR_LIMIT)
        disable(`${INTERNAL_ERROR_LIMIT} internal errors within 60 s (last: ${code})`);
    } catch {
      // Counting must not fail either.
    }
  }

  function run<T>(code: string, action: () => T, fallback: T): T {
    if (disabled) return fallback;
    try {
      return action();
    } catch (error) {
      report(code, error);
      return fallback;
    }
  }

  return {
    run,
    callback:
      (code, action) =>
      (...args) =>
        run(code, () => action(...args), undefined),
    report,
    get disabled() {
      return disabled;
    },
    get internalErrorCount() {
      return total;
    },
  };
}
