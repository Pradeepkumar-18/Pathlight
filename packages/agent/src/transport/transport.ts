// Sends events to the collector over `WS /agent` (`api-spec.md` §11.1). Never blocks or crashes
// the app: events are queued and sent in batches (~50 ms, or as soon as a batch is full), kept
// until acknowledged and resent after a reconnect; when the collector is gone the agent retries
// with backoff and the bounded buffer drops whole requests. The socket and timers never keep
// the app's process alive.
import type { IncomingMessage } from 'node:http';

import WebSocket from 'ws';

import {
  PROTOCOL_SUBPROTOCOL,
  PROTOCOL_VERSION,
  collectorToAgentMessageSchema,
} from '@pathlight-tracker/protocol';
import type { AgentEvent, HelloMessage } from '@pathlight-tracker/protocol';

import type { EventSink } from '../agent';
import type { AgentLogger } from '../safety/logger';
import type { Safety } from '../safety/safety';
import { EventBuffer } from './buffer';
import type { BufferLimits, Entry } from './buffer';

export const FLUSH_MS = 50;
/** Batches sent but not yet acknowledged; one while the collector asks to slow down. */
const MAX_IN_FLIGHT = 8;
/** Leave the socket alone while this much is still waiting in its own send buffer. */
const MAX_SOCKET_BUFFER = 4 * 1024 * 1024;
export const BACKOFF_INITIAL_MS = 250;
export const BACKOFF_MAX_MS = 5_000;
/** The collector closed for a reason a retry can't fix (`api-spec.md` §8 close codes). */
const FINAL_CLOSE: Record<number, string> = {
  4001: 'The collector rejected the token: restart through `pathlight-tracker dev`.',
  4003: 'The collector refused this connection.',
  4009: 'The agent and the collector speak different protocol versions: update both.',
};

export interface TransportOptions {
  url: string;
  token: string;
  safety: Safety;
  logger: AgentLogger;
  hello: () => HelloMessage;
  bufferLimits?: BufferLimits;
  flushMs?: number;
  backoff?: { initialMs: number; maxMs: number };
  /** For tests: how a socket is opened. */
  createSocket?: (url: string, protocols: string[]) => WebSocket;
}

export interface Transport extends EventSink {
  /** True between `slow_down` and `resume`; capture uses it to record less (task 3.15). */
  readonly slowedDown: boolean;
  readonly connected: boolean;
  readonly droppedRequests: number;
  /** Stops for good (tests, shutdown). */
  close: () => void;
}

interface Batch {
  entries: Entry[];
  bytes: number;
}

export function createTransport(options: TransportOptions): Transport {
  const { safety, logger } = options;
  const buffer = new EventBuffer(options.bufferLimits);
  const flushMs = options.flushMs ?? FLUSH_MS;
  const backoff = options.backoff ?? { initialMs: BACKOFF_INITIAL_MS, maxMs: BACKOFF_MAX_MS };
  const open =
    options.createSocket ?? ((url: string, protocols: string[]) => new WebSocket(url, protocols));

  let socket: WebSocket | null = null;
  let ready = false; // `welcome` received on the current socket
  let stopped = false;
  let slowedDown = false;
  let attempt = 0;
  let seq = 0;
  let limits = { maxBatchEvents: 2000, maxBatchBytes: 1024 * 1024 };
  let flushTimer: NodeJS.Timeout | null = null;
  let retryTimer: NodeJS.Timeout | null = null;
  let warnedDown = false;
  const inFlight = new Map<number, Batch>();

  const inFlightSize = () => {
    let events = 0;
    let bytes = 0;
    for (const batch of inFlight.values()) {
      events += batch.entries.length;
      bytes += batch.bytes;
    }
    return { events, bytes };
  };

  function scheduleFlush(delay: number): void {
    if (flushTimer !== null || !ready) return;
    flushTimer = setTimeout(
      safety.callback('TRANSPORT_FLUSH_FAILED', () => {
        flushTimer = null;
        flush();
      }),
      delay,
    );
    flushTimer.unref();
  }

  function flush(): void {
    const current = socket;
    if (!ready || current === null) return;
    const envelope = `{"type":"batch","v":${PROTOCOL_VERSION},"pid":${process.pid},"seq":`;
    while (
      buffer.size > 0 &&
      inFlight.size < (slowedDown ? 1 : MAX_IN_FLIGHT) &&
      current.bufferedAmount < MAX_SOCKET_BUFFER
    ) {
      seq += 1;
      const head = `${envelope}${seq},"events":[`;
      const entries = buffer.take(limits.maxBatchEvents, limits.maxBatchBytes, head.length + 2);
      if (entries.length === 0) break;
      const text = `${head}${entries.map((entry) => entry.json).join(',')}]}`;
      const bytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
      inFlight.set(seq, { entries, bytes });
      current.send(text);
    }
  }

  function onMessage(data: WebSocket.RawData): void {
    const parsed = collectorToAgentMessageSchema.safeParse(JSON.parse(String(data)));
    if (!parsed.success) {
      safety.report('TRANSPORT_BAD_MESSAGE', parsed.error);
      return;
    }
    const message = parsed.data;
    switch (message.type) {
      case 'welcome':
        limits = message.limits;
        ready = true;
        attempt = 0;
        if (warnedDown) logger.info('COLLECTOR_RECONNECTED', 'Connected to the collector again.');
        warnedDown = false;
        flush();
        return;
      case 'ack':
        inFlight.delete(message.seq);
        if (buffer.size > 0) scheduleFlush(0);
        return;
      case 'slow_down':
        slowedDown = true;
        logger.debug('COLLECTOR_SLOW_DOWN', message.reason);
        return;
      case 'resume':
        slowedDown = false;
        scheduleFlush(0);
        return;
      case 'error':
        // Bad events are dropped by the collector and the rest kept; nothing to resend.
        logger.debug('COLLECTOR_ERROR', message.code);
        return;
    }
  }

  function onClose(code: number): void {
    socket = null;
    ready = false;
    slowedDown = false;
    // Batches the collector never acknowledged go out again on the next connection.
    const unacknowledged = [...inFlight.keys()]
      .sort((a, b) => a - b)
      .flatMap((key) => inFlight.get(key)?.entries ?? []);
    inFlight.clear();
    buffer.requeue(unacknowledged);
    if (stopped) return;
    const final = FINAL_CLOSE[code];
    if (final) {
      stopped = true;
      logger.warn('COLLECTOR_CLOSED', `${final} Your app runs untraced. (close ${code})`);
      return;
    }
    if (!warnedDown) {
      warnedDown = true;
      logger.warn(
        'COLLECTOR_UNREACHABLE',
        'Lost the connection to the collector; retrying in the background. Your app is unaffected.',
      );
    }
    const delay = Math.min(backoff.maxMs, backoff.initialMs * 2 ** attempt);
    attempt += 1;
    // Jitter, so several app processes don't all retry at the same moment.
    retryTimer = setTimeout(
      safety.callback('TRANSPORT_RETRY_FAILED', connect),
      delay / 2 + Math.random() * (delay / 2),
    );
    retryTimer.unref();
  }

  function connect(): void {
    retryTimer = null;
    if (stopped) return;
    const next = open(options.url, [PROTOCOL_SUBPROTOCOL, `bearer.${options.token}`]);
    socket = next;
    // The connection must never keep the app's process alive.
    next.on(
      'upgrade',
      safety.callback('TRANSPORT_UPGRADE', (response: IncomingMessage) => response.socket.unref()),
    );
    next.on(
      'open',
      safety.callback('TRANSPORT_HELLO_FAILED', () => next.send(JSON.stringify(options.hello()))),
    );
    next.on('message', safety.callback('TRANSPORT_MESSAGE_FAILED', onMessage));
    next.on(
      'close',
      safety.callback('TRANSPORT_CLOSE_FAILED', (code: number) => onClose(code)),
    );
    // A failed connection also emits `close`; this listener only stops `error` being thrown.
    next.on('error', () => undefined);
  }

  safety.run('TRANSPORT_CONNECT_FAILED', connect, undefined);

  return {
    send(event: AgentEvent) {
      safety.run(
        'TRANSPORT_SEND_FAILED',
        () => {
          if (stopped) return;
          buffer.push(event, inFlightSize());
          if (buffer.size >= limits.maxBatchEvents) scheduleFlush(0);
          else scheduleFlush(flushMs);
        },
        undefined,
      );
    },
    get slowedDown() {
      return slowedDown;
    },
    get connected() {
      return ready;
    },
    get droppedRequests() {
      return buffer.droppedRequests;
    },
    close() {
      stopped = true;
      if (flushTimer) clearTimeout(flushTimer);
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close(1000);
    },
  };
}
