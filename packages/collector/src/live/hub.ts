// `WS /live` (`api-spec.md` §11.2): pushes request, step and agent changes to open UIs.
// Messages go only to subscribers of their topic and are flushed in ~100 ms batches.
import { inArray } from 'drizzle-orm';

import {
  PROTOCOL_VERSION,
  uiToCollectorMessageSchema,
  WS_CLOSE_CODES,
} from '@pathlight-tracker/protocol';
import type { LiveMessage, LiveTopic } from '@pathlight-tracker/protocol';

import { iso, toRequestSummary, toSession, toStepSummary } from '../api/mappers';
import type { Changes } from '../builder/builder';
import type { Db } from '../store/open';
import { getRequest } from '../store/requests';
import { steps } from '../store/schema';
import { errorPath, getSession } from '../store/sessions';
import { childCounts } from '../store/steps';

export const MAX_LIVE_CONNECTIONS = 10;
export const FLUSH_MS = 100;
const HOUR_MS = 60 * 60 * 1000;

export interface LiveSocket {
  send: (data: string) => void;
  close: (code: number, reason: string) => void;
}

interface Subscriber {
  socket: LiveSocket;
  topics: Set<LiveTopic>;
  queue: LiveMessage[];
}

export interface LiveHubOptions {
  db: Db;
  trashTtlHours: () => number;
  flushMs?: number;
}

export function createLiveHub(options: LiveHubOptions) {
  const { db } = options;
  const subscribers = new Set<Subscriber>();
  const v = PROTOCOL_VERSION;
  let timer: NodeJS.Timeout | null = null;

  const flush = (): void => {
    timer = null;
    for (const subscriber of subscribers) {
      if (subscriber.queue.length === 0) continue;
      const batch = subscriber.queue.splice(0);
      for (const message of batch) subscriber.socket.send(JSON.stringify(message));
    }
  };

  /** Queues a message for everyone subscribed to `topic`, merging consecutive step appends. */
  /** Each subscriber gets the message once, even when subscribed to several of the topics. */
  const publish = (topic: LiveTopic | LiveTopic[], message: LiveMessage): void => {
    const topics = Array.isArray(topic) ? topic : [topic];
    for (const subscriber of subscribers) {
      if (!topics.some((candidate) => subscriber.topics.has(candidate))) continue;
      const last = subscriber.queue.at(-1);
      if (
        last?.type === 'live.steps.appended' &&
        message.type === 'live.steps.appended' &&
        last.requestId === message.requestId
      ) {
        last.steps.push(...message.steps);
      } else {
        subscriber.queue.push(structuredClone(message));
      }
    }
    timer ??= setTimeout(flush, options.flushMs ?? FLUSH_MS);
  };

  const summaries = (requestId: string, ids: string[]) => {
    if (ids.length === 0) return [];
    const counts = childCounts(db, requestId);
    const rows = db.select().from(steps).where(inArray(steps.id, ids)).all();
    const order = new Map(ids.map((id, index) => [id, index]));
    return rows
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map((row) => toStepSummary(row, counts.get(row.id) ?? 0));
  };

  const requestTopic = (requestId: string): LiveTopic => `request:${requestId}` as LiveTopic;

  return {
    /** For each socket that passed `admitSocket` on `/live`. */
    accept(socket: LiveSocket): {
      onMessage: (data: Buffer | string) => void;
      onClose: () => void;
    } {
      if (subscribers.size >= MAX_LIVE_CONNECTIONS) {
        socket.close(WS_CLOSE_CODES.tooManyConnections, 'too many open UIs');
        return { onMessage: () => undefined, onClose: () => undefined };
      }
      const subscriber: Subscriber = { socket, topics: new Set(), queue: [] };
      subscribers.add(subscriber);
      return {
        onMessage(data) {
          let raw: unknown;
          try {
            raw = JSON.parse(data.toString());
          } catch {
            raw = undefined;
          }
          const parsed = uiToCollectorMessageSchema.safeParse(raw);
          if (!parsed.success) {
            socket.send(
              JSON.stringify({
                type: 'error',
                v,
                code: 'INVALID_MESSAGE',
                message: parsed.error.issues[0]?.message ?? 'invalid message',
              }),
            );
            return;
          }
          const message = parsed.data;
          if (message.type === 'ping') socket.send(JSON.stringify({ type: 'pong', v }));
          else if (message.type === 'subscribe')
            message.topics.forEach((topic) => subscriber.topics.add(topic));
          else message.topics.forEach((topic) => subscriber.topics.delete(topic));
        },
        onClose() {
          subscribers.delete(subscriber);
        },
      };
    },

    /** What one agent batch changed (from the trace builder). */
    changes(changes: Changes): void {
      for (const requestId of changes.startedRequests) {
        const row = getRequest(db, requestId);
        if (row)
          publish('requests', { type: 'live.request.started', v, request: toRequestSummary(row) });
      }
      for (const [requestId, ids] of changes.appendedSteps) {
        publish(requestTopic(requestId), {
          type: 'live.steps.appended',
          v,
          requestId,
          steps: summaries(requestId, ids),
        });
      }
      for (const [requestId, ids] of changes.updatedSteps) {
        publish(requestTopic(requestId), {
          type: 'live.steps.updated',
          v,
          requestId,
          steps: summaries(requestId, [...new Set(ids)]),
        });
      }
      for (const requestId of changes.completedRequests) this.completed(requestId);
    },

    /** A request finished (or became incomplete because its app went away). */
    completed(requestId: string): void {
      const row = getRequest(db, requestId, true);
      if (!row) return;
      const message: LiveMessage = {
        type: 'live.request.completed',
        v,
        request: toRequestSummary(row),
        errorPath: errorPath(db, requestId),
      };
      publish(['requests', requestTopic(requestId)], message);
    },

    deleted(requestIds: string[], deletedAt: number): void {
      for (const requestId of requestIds) {
        publish('requests', {
          type: 'live.request.deleted',
          v,
          requestId,
          deletedAt: iso(deletedAt),
          purgeAt: iso(deletedAt + options.trashTtlHours() * HOUR_MS),
        });
      }
    },

    restored(requestId: string): void {
      const row = getRequest(db, requestId);
      if (row)
        publish('requests', { type: 'live.request.restored', v, request: toRequestSummary(row) });
    },

    purged(requestIds: string[]): void {
      if (requestIds.length > 0)
        publish('requests', { type: 'live.request.purged', v, requestIds });
    },

    agentConnected(sessionId: string): void {
      const session = getSession(db, sessionId);
      if (session)
        publish('requests', { type: 'live.agent.connected', v, session: toSession(session) });
    },

    agentDisconnected(
      sessionId: string,
      reason: 'exit' | 'restart' | 'crash',
      exitCode: number | null,
    ): void {
      publish('requests', { type: 'live.agent.disconnected', v, sessionId, reason, exitCode });
    },

    agentDisabled(sessionId: string): void {
      const session = getSession(db, sessionId);
      publish('requests', {
        type: 'live.agent.disabled',
        v,
        sessionId,
        reason: session?.disabledReason ?? 'disabled',
      });
    },

    /** Sends everything queued now (tests and shutdown). */
    flush,
    connections: () => subscribers.size,
    close(): void {
      if (timer) clearTimeout(timer);
      for (const subscriber of subscribers)
        subscriber.socket.close(WS_CLOSE_CODES.goingAway, 'collector shutting down');
      subscribers.clear();
    },
  };
}

export type LiveHub = ReturnType<typeof createLiveHub>;
