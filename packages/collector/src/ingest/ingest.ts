// `WS /agent` (`api-spec.md` §11.1): handshake, version check, per-event validation, acks,
// size limits and backpressure. Valid events go to the sink (the trace builder, task 2.9).
import {
  agentEventSchema,
  agentMessageSchema,
  PROTOCOL_VERSION,
  WS_CLOSE_CODES,
} from '@pathlight-tracker/protocol';
import type {
  AgentEvent,
  CollectorToAgentMessage,
  HelloMessage,
} from '@pathlight-tracker/protocol';

export const MAX_BATCH_BYTES = 1024 * 1024;
export const MAX_BATCH_EVENTS = 2000;
/** Starting values (`architecture.md` §10), tuned in task 3.15. */
export const SLOW_DOWN_ABOVE = 5000;
export const RESUME_BELOW = 1000;
export const MAX_INVALID_IN_A_ROW = 10;

export interface EventSink {
  /** A new app process connected; returns its session ID. */
  openSession: (hello: HelloMessage) => string;
  /** Stores valid events (one transaction per batch). */
  ingest: (sessionId: string, events: AgentEvent[]) => void;
  closeSession: (sessionId: string) => void;
}

/** What ingest needs from a WebSocket; the real one comes from `@fastify/websocket`. */
export interface AgentSocket {
  send: (data: string) => void;
  close: (code: number, reason: string) => void;
}

interface Pending {
  connection: Connection;
  seq: number;
  events: AgentEvent[];
}

interface Connection {
  socket: AgentSocket;
  sessionId: string | null;
  invalidInARow: number;
  slowedDown: boolean;
  closed: boolean;
}

export interface Ingest {
  /** Call for each socket that passed `admitSocket`; returns the per-message handler and a close hook. */
  accept: (socket: AgentSocket) => {
    onMessage: (data: Buffer | string) => void;
    onClose: () => void;
  };
  /** Events received but not yet stored (drives `slow_down` / `resume`). */
  pendingEvents: () => number;
  /** Resolves once everything received so far is stored (for tests and shutdown). */
  drained: () => Promise<void>;
  /**
   * Ends every connected agent's session now, while the store is still open; used on shutdown,
   * before the sockets close (their close events then have nothing left to do).
   */
  endAllSessions: () => void;
}

export function createIngest(
  sink: EventSink,
  onError: (code: string, context: string) => void = () => undefined,
): Ingest {
  const connections = new Set<Connection>();
  const queue: Pending[] = [];
  let pending = 0;
  let draining = false;
  let idle: (() => void)[] = [];

  const send = (connection: Connection, message: CollectorToAgentMessage): void => {
    if (!connection.closed) connection.socket.send(JSON.stringify(message));
  };
  const close = (connection: Connection, code: number, reason: string): void => {
    if (connection.closed) return;
    connection.closed = true;
    connection.socket.close(code, reason);
  };
  const v = PROTOCOL_VERSION;

  const updatePressure = (): void => {
    for (const connection of connections) {
      if (!connection.slowedDown && pending > SLOW_DOWN_ABOVE) {
        connection.slowedDown = true;
        send(connection, { type: 'slow_down', v, reason: 'ingest_backlog' });
      } else if (connection.slowedDown && pending < RESUME_BELOW) {
        connection.slowedDown = false;
        send(connection, { type: 'resume', v });
      }
    }
  };

  // One batch per turn of the event loop, so the server stays responsive while a backlog drains.
  const drain = (): void => {
    const next = queue.shift();
    if (!next) {
      draining = false;
      const waiting = idle;
      idle = [];
      for (const resolve of waiting) resolve();
      return;
    }
    try {
      if (next.connection.sessionId !== null) sink.ingest(next.connection.sessionId, next.events);
      send(next.connection, { type: 'ack', v, seq: next.seq });
    } catch (error) {
      // One bad batch never stops ingest; the agent sees no ack and may resend.
      onError(
        'INGEST_FAILED',
        `batch ${next.seq}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
    pending -= next.events.length;
    updatePressure();
    setImmediate(drain);
  };

  const invalid = (connection: Connection, message: string, seq?: number): void => {
    connection.invalidInARow += 1;
    send(connection, {
      type: 'error',
      v,
      code: 'INVALID_MESSAGE',
      message,
      ...(seq !== undefined ? { seq } : {}),
    });
    if (connection.invalidInARow >= MAX_INVALID_IN_A_ROW) {
      close(connection, WS_CLOSE_CODES.tooManyInvalidMessages, 'too many invalid messages');
    }
  };

  const handle = (connection: Connection, data: Buffer | string): void => {
    const size = typeof data === 'string' ? Buffer.byteLength(data) : data.byteLength;
    if (size > MAX_BATCH_BYTES)
      return close(connection, WS_CLOSE_CODES.messageTooLarge, 'message too large');
    let raw: unknown;
    try {
      raw = JSON.parse(data.toString());
    } catch {
      return invalid(connection, 'The message is not valid JSON.');
    }
    const version = (raw as { v?: unknown } | null)?.v;
    if (typeof version === 'number' && version !== PROTOCOL_VERSION) {
      send(connection, {
        type: 'error',
        v,
        code: 'PROTOCOL_MISMATCH',
        message: `This collector speaks protocol ${PROTOCOL_VERSION}; the agent sent ${version}. Update both to the same version.`,
        details: { agentVersion: version, collectorVersion: PROTOCOL_VERSION },
      });
      return close(connection, WS_CLOSE_CODES.protocolMismatch, 'protocol version mismatch');
    }
    const parsed = agentMessageSchema.safeParse(raw);
    if (!parsed.success)
      return invalid(
        connection,
        `Invalid message: ${parsed.error.issues[0]?.message ?? 'unknown'}`,
      );
    const message = parsed.data;

    if (message.type === 'hello') {
      connection.invalidInARow = 0;
      if (connection.sessionId === null) connection.sessionId = sink.openSession(message);
      send(connection, {
        type: 'welcome',
        v,
        sessionId: connection.sessionId,
        limits: { maxBatchBytes: MAX_BATCH_BYTES, maxBatchEvents: MAX_BATCH_EVENTS },
      });
      return;
    }
    if (connection.sessionId === null)
      return invalid(connection, 'Send hello before any batch.', message.seq);
    if (message.events.length > MAX_BATCH_EVENTS) {
      return close(connection, WS_CLOSE_CODES.messageTooLarge, 'too many events in one batch');
    }
    const valid: AgentEvent[] = [];
    let dropped = 0;
    for (const event of message.events) {
      const result = agentEventSchema.safeParse(event);
      if (result.success) valid.push(result.data);
      else dropped += 1;
    }
    connection.invalidInARow = 0;
    if (dropped > 0) {
      send(connection, {
        type: 'error',
        v,
        code: 'INVALID_EVENT',
        message: `${dropped} of ${message.events.length} events were invalid and dropped; the rest were kept.`,
        seq: message.seq,
      });
    }
    queue.push({ connection, seq: message.seq, events: valid });
    pending += valid.length;
    updatePressure();
    if (!draining) {
      draining = true;
      setImmediate(drain);
    }
  };

  /** Ends a connection's session once (its requests still running become incomplete). */
  function endSession(connection: Connection): void {
    const sessionId = connection.sessionId;
    if (sessionId === null) return;
    connection.sessionId = null;
    try {
      sink.closeSession(sessionId);
    } catch (error) {
      onError('SESSION_CLOSE_FAILED', error instanceof Error ? error.message : 'unknown');
    }
  }

  return {
    accept(socket) {
      const connection: Connection = {
        socket,
        sessionId: null,
        invalidInARow: 0,
        slowedDown: false,
        closed: false,
      };
      connections.add(connection);
      return {
        onMessage: (data) => {
          try {
            handle(connection, data);
          } catch (error) {
            onError('INGEST_FAILED', error instanceof Error ? error.message : 'unknown');
          }
        },
        onClose: () => {
          connection.closed = true;
          connections.delete(connection);
          endSession(connection);
        },
      };
    },
    pendingEvents: () => pending,
    endAllSessions: () => {
      for (const connection of connections) endSession(connection);
    },
    drained: () =>
      draining ? new Promise<void>((resolve) => idle.push(resolve)) : Promise.resolve(),
  };
}
