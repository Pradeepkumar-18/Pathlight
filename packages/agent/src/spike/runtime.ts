import { writeSync } from 'node:fs';
import { types } from 'node:util';

/** One running call, returned by `enter` and handed back to `exit` / `throw`. */
export interface Probe {
  name: string;
  file: string;
  line: number;
  depth: number;
  startedAt: bigint;
  error: string | null;
  /** True while a returned promise is still running; it ends the step when it settles. */
  pending: boolean;
}

export type Write = (text: string) => void;

// Spike only: prints straight to stdout. Task 3.2 replaces this with batched events.
let write: Write = (text) => {
  writeSync(1, text);
};
let depth = 0;

export function setWriter(next: Write): void {
  write = next;
}

export function resetDepth(): void {
  depth = 0;
}

function safely(action: () => void): void {
  try {
    action();
  } catch {
    // The user's app always wins: a failed trace line must never reach user code.
  }
}

function indent(level: number): string {
  return '  '.repeat(level);
}

/** Own data property only: reading a getter on a user object could run user code. */
function ownValue(target: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}

function errorText(error: unknown): string {
  if (!types.isNativeError(error)) return typeof error;
  const message = ownValue(error, 'message');
  const prototype = Object.getPrototypeOf(error) as object | null;
  const name = ownValue(error, 'name') ?? (prototype ? ownValue(prototype, 'name') : undefined);
  return `${typeof name === 'string' ? name : 'Error'}: ${typeof message === 'string' ? message : ''}`;
}

const DISABLED: Probe = {
  name: '',
  file: '',
  line: 0,
  depth: 0,
  startedAt: 0n,
  error: null,
  pending: true,
};

export function enter(name: string, file: string, line: number): Probe {
  try {
    const probe: Probe = {
      name,
      file,
      line,
      depth,
      startedAt: process.hrtime.bigint(),
      error: null,
      pending: false,
    };
    safely(() => write(`${indent(depth)}→ ${name} (${file}:${line})\n`));
    depth += 1;
    return probe;
  } catch {
    // `pending: true` makes `exit` a no-op for a probe that never really started.
    return DISABLED;
  }
}

// Named `throw` in the generated code, which is a reserved word here.
function recordThrow(probe: Probe, error: unknown): void {
  safely(() => {
    if (probe !== DISABLED) probe.error = errorText(error);
  });
}
export { recordThrow as throw };

function finish(probe: Probe): void {
  safely(() => {
    depth = probe.depth;
    const ms = Number(process.hrtime.bigint() - probe.startedAt) / 1e6;
    const result =
      probe.error === null ? `← ${probe.name}` : `✕ ${probe.name} threw ${probe.error}`;
    write(`${indent(probe.depth)}${result} (${ms.toFixed(1)} ms)\n`);
  });
}

/**
 * A step that returns a native promise ends when the promise settles. The caller gets a
 * follow-on promise that settles the same way, so an unhandled rejection stays unhandled
 * (the same approach as OpenTelemetry); the cost is that it is a different promise object.
 * `types.isPromise` and `Promise.prototype.then` avoid running user code (Proxy traps or an
 * overridden `then`).
 */
export function ret<T>(probe: Probe, value: T): T {
  try {
    if (probe === DISABLED || !types.isPromise(value)) return value;
    const followOn = Promise.prototype.then.call(
      value,
      (result: unknown) => {
        finish(probe);
        return result;
      },
      (error: unknown) => {
        recordThrow(probe, error);
        finish(probe);
        throw error;
      },
    ) as T;
    probe.pending = true;
    return followOn;
  } catch {
    return value;
  }
}

export function exit(probe: Probe): void {
  safely(() => {
    if (!probe.pending) finish(probe);
  });
}
