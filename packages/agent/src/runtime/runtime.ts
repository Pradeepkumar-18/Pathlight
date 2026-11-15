// The helpers wrapped code calls (`architecture.md` §5 `runtime`): `sites`, `enter`, `exit`,
// `throw` and `ret`. They must never throw into user code and never change what the code does:
// every failure is counted by the safety net and the call goes on untraced. What a step records
// is up to the recorder (events for the collector, task 3.7).
import { types } from 'node:util';

import { runningAgent } from '../agent';
import type { Site } from '../transform/sites';

export interface Probe {
  site: Site;
  /** The recorder's own data for this call. */
  data: unknown;
  threw: boolean;
  error: unknown;
  /** What a `return` handed back (set by `ret`; `undefined` when the function ran off its end). */
  returned: unknown;
  /** True while a returned promise is still running; it ends the step when it settles. */
  pending: boolean;
  done: boolean;
}

export interface Recorder {
  enter: (site: Site, self: unknown, args: ArrayLike<unknown> | undefined) => unknown;
  /** Called once per call, when it returned, threw, or its returned promise settled. */
  finish: (probe: Probe, returned: unknown) => void;
}

const NOOP: Recorder = { enter: () => null, finish: () => undefined };
let recorder: Recorder = NOOP;

export function setRecorder(next: Recorder | null): void {
  recorder = next ?? NOOP;
}

const UNTRACED: Probe = {
  site: { name: '', kind: 'function', file: '', line: 1, column: 1, isAsync: false },
  data: null,
  threw: false,
  error: undefined,
  returned: undefined,
  pending: false,
  done: true,
};

function report(code: string, error: unknown): void {
  try {
    runningAgent()?.safety.report(code, error);
  } catch {
    // Nothing left to report to.
  }
}

/** The file's site table, registered once when the file loads. */
export function sites(list: Site[]): Site[] {
  return list;
}

export function enter(site: Site, self: unknown, args: ArrayLike<unknown> | undefined): Probe {
  try {
    if (runningAgent()?.safety.disabled !== false) return UNTRACED;
    return {
      site,
      data: recorder.enter(site, self, args),
      threw: false,
      error: undefined,
      returned: undefined,
      pending: false,
      done: false,
    };
  } catch (error) {
    report('RUNTIME_ENTER_FAILED', error);
    return UNTRACED;
  }
}

function finish(probe: Probe, returned: unknown): void {
  if (probe.done) return;
  probe.done = true;
  try {
    recorder.finish(probe, returned);
  } catch (error) {
    report('RUNTIME_EXIT_FAILED', error);
  }
}

// Named `throw` in the generated code, which is a reserved word here.
function recordThrow(probe: Probe, error: unknown): void {
  if (probe.done) return;
  probe.threw = true;
  probe.error = error;
}
export { recordThrow as throw };

/**
 * A returned value passes through here. A step that returns a native promise ends when the
 * promise settles; the caller gets a follow-on promise that settles the same way, so an
 * unhandled rejection stays unhandled (decision 0002). `types.isPromise` and
 * `Promise.prototype.then` never run user code (a Proxy trap or an overridden `then`).
 */
export function ret<T>(probe: Probe, value: T): T {
  if (probe.done) return value;
  try {
    probe.returned = value;
    if (!types.isPromise(value)) return value;
    const followOn = Promise.prototype.then.call(
      value,
      (result: unknown) => {
        finish(probe, result);
        return result;
      },
      (error: unknown) => {
        recordThrow(probe, error);
        finish(probe, undefined);
        throw error;
      },
    ) as T;
    probe.pending = true;
    return followOn;
  } catch (error) {
    report('RUNTIME_RETURN_FAILED', error);
    return value;
  }
}

export function exit(probe: Probe): void {
  if (probe.done || probe.pending) return;
  finish(probe, probe.threw ? undefined : probe.returned);
}
