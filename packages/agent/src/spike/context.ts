import { AsyncLocalStorage } from 'node:async_hooks';
import { subscribe } from 'node:diagnostics_channel';

/** The request a call belongs to; `AsyncLocalStorage` carries it across `await`. */
export interface Trace {
  id: string;
  /** Indent level of the next step in this request. */
  depth: number;
}

const storage = new AsyncLocalStorage<Trace>();
/** Calls outside any request (app start-up, timers) share this trace. */
const OUTSIDE: Trace = { id: '-', depth: 0 };
let counter = 0;

export function currentTrace(): Trace {
  return storage.getStore() ?? OUTSIDE;
}

/** Starts a new trace for the rest of the current execution and everything it schedules. */
export function startTrace(): Trace {
  counter += 1;
  const trace: Trace = { id: `t${counter}`, depth: 0 };
  storage.enterWith(trace);
  return trace;
}

/** Test helper: back to no trace and counter 0. */
export function resetTraces(): void {
  counter = 0;
  OUTSIDE.depth = 0;
  storage.disable();
}

/**
 * Node publishes `http.server.request.start` synchronously just before the server emits
 * `request`, so entering the context here puts the whole request (middleware, handler and
 * everything they await) in its own trace, with no patching of `http`.
 */
export function traceIncomingRequests(): void {
  subscribe('http.server.request.start', () => {
    try {
      startTrace();
    } catch {
      // The user's app always wins: no trace for this request.
    }
  });
}
