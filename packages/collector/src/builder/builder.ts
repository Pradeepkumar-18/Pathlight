// The trace builder (task 2.9): turns validated agent events into request and step rows.
// `seq` follows arrival order (the collector assigns it), depth follows the parent, and a
// request's errors are classified when it ends. Returns what changed for the live hub (2.11).
import { eq } from 'drizzle-orm';

import type { AgentEvent } from '@pathlight-tracker/protocol';

import type { Db } from '../store/open';
import { sessions, steps } from '../store/schema';
import {
  insertObjectRefs,
  insertRequest,
  insertSteps,
  updateRequest,
  updateStep,
  writeBatch,
} from '../store/writes';
import type { Tx } from '../store/writes';
import { finalize } from './finalize';
import { argRefs, refsFor } from './refs';
import { boundaryRow, decisionRow, enterRow, json } from './rows';
import type { StepFields } from './rows';
import { applySessionEvent } from './session-events';

export interface Changes {
  startedRequests: string[];
  /** requestId → step IDs added in this batch, in `seq` order. */
  appendedSteps: Map<string, string[]>;
  updatedSteps: Map<string, string[]>;
  completedRequests: string[];
}

interface OpenRequest {
  startNs: bigint;
  nextSeq: number;
  /** stepId → depth */
  depths: Map<string, number>;
  truncated: boolean;
}

export interface BuilderOptions {
  maxSteps: number;
  now?: () => number;
}

const NS_PER_MS = 1_000_000n;

const emptyChanges = (): Changes => ({
  startedRequests: [],
  appendedSteps: new Map(),
  updatedSteps: new Map(),
  completedRequests: [],
});

function push(map: Map<string, string[]>, key: string, value: string): void {
  map.set(key, [...(map.get(key) ?? []), value]);
}

export function createBuilder(db: Db, options: BuilderOptions) {
  const open = new Map<string, OpenRequest>();
  const now = options.now ?? Date.now;

  /** Inserts a step under its parent; returns false when it was dropped (limit, duplicate, no request). */
  function addStep(
    tx: Tx,
    changes: Changes,
    requestId: string,
    fields: StepFields,
    ts: string,
  ): boolean {
    const request = open.get(requestId);
    if (!request) return false;
    if (request.depths.size >= options.maxSteps) {
      if (!request.truncated) {
        request.truncated = true;
        updateRequest(tx, requestId, { truncated: 1 }, now());
      }
      return false;
    }
    const parentDepth = fields.parentId ? request.depths.get(fields.parentId) : undefined;
    const depth = parentDepth === undefined ? 0 : parentDepth + 1;
    const inserted = insertSteps(tx, [
      {
        ...fields,
        parentId: parentDepth === undefined ? null : fields.parentId,
        requestId,
        seq: request.nextSeq,
        depth,
        startOffsetNs: Number(BigInt(ts) - request.startNs),
        createdAt: now(),
        updatedAt: now(),
      },
    ]);
    if (inserted === 0) return false; // a re-sent event: already stored
    request.nextSeq += 1;
    request.depths.set(fields.id, depth);
    push(changes.appendedSteps, requestId, fields.id);
    return true;
  }

  function apply(tx: Tx, sessionId: string, event: AgentEvent, changes: Changes): void {
    const requestId = event.traceId;
    const request = open.get(requestId);
    const known = (stepId: string): boolean => request?.depths.has(stepId) === true;
    switch (event.e) {
      case 'request.start': {
        const startNs = BigInt(event.ts);
        insertRequest(tx, {
          id: requestId,
          sessionId,
          method: event.method,
          path: event.path,
          route: event.route,
          state: 'in_progress',
          requestJson: JSON.stringify({
            params: event.params,
            query: event.query,
            body: event.body,
            headers: event.headers,
          }),
          startedAt: Number(startNs / NS_PER_MS),
          createdAt: now(),
          updatedAt: now(),
        });
        // The app has loaded by now: the first reliable framework (api-spec §11.1).
        tx.update(sessions)
          .set({ framework: event.framework, updatedAt: now() })
          .where(eq(sessions.id, sessionId))
          .run();
        insertObjectRefs(
          tx,
          refsFor(
            { requestId, stepId: null, createdAt: now() },
            'request',
            event.body,
            'request.body',
          ),
        );
        open.set(requestId, { startNs, nextSeq: 1, depths: new Map(), truncated: false });
        changes.startedRequests.push(requestId);
        return;
      }
      case 'step.enter':
        if (addStep(tx, changes, requestId, enterRow(event), event.ts)) {
          insertObjectRefs(
            tx,
            argRefs({ requestId, stepId: event.stepId, createdAt: now() }, event.args),
          );
        }
        return;
      case 'step.exit':
        if (!known(event.stepId)) return;
        updateStep(
          tx,
          event.stepId,
          {
            status: 'returned',
            returnJson: json(event.returnValue),
            durationNs: Number(event.durationNs),
            detailJson: json(event.detail),
          },
          now(),
        );
        insertObjectRefs(
          tx,
          refsFor(
            { requestId, stepId: event.stepId, createdAt: now() },
            'return',
            event.returnValue,
            'return',
          ),
        );
        push(changes.updatedSteps, requestId, event.stepId);
        return;
      case 'step.throw':
        if (!known(event.stepId)) return;
        updateStep(
          tx,
          event.stepId,
          {
            status: 'threw',
            errorJson: JSON.stringify(event.error),
            durationNs: Number(event.durationNs),
          },
          now(),
        );
        push(changes.updatedSteps, requestId, event.stepId);
        return;
      case 'boundary':
        addStep(tx, changes, requestId, boundaryRow(event), event.ts);
        return;
      case 'decision':
        addStep(tx, changes, requestId, decisionRow(event), event.ts);
        return;
      case 'request.end':
        if (request) end(tx, requestId, request, event, changes);
        return;
      case 'warning':
      case 'agent.disabled':
        applySessionEvent(tx, sessionId, event, now());
        return;
      case 'loop':
      case 'log':
        // v1 (tasks 6.3, 6.7): accepted by the protocol, not stored by the MVP.
        return;
    }
  }

  function end(
    tx: Tx,
    requestId: string,
    request: OpenRequest,
    event: Extract<AgentEvent, { e: 'request.end' }>,
    changes: Changes,
  ): void {
    const rows = tx
      .select({ id: steps.id, parentId: steps.parentId, seq: steps.seq, status: steps.status })
      .from(steps)
      .where(eq(steps.requestId, requestId))
      .all();
    const result = finalize(rows, {
      status: event.status,
      unhandled: Boolean(event.unhandledError),
    });
    for (const [stepId, handling] of result.handling)
      updateStep(tx, stepId, { errorHandling: handling }, now());
    for (const stepId of result.errorPath) updateStep(tx, stepId, { onErrorPath: 1 }, now());
    updateRequest(
      tx,
      requestId,
      {
        state: 'completed',
        httpStatus: event.status,
        responseJson: JSON.stringify({
          headers: event.responseHeaders ?? null,
          body: event.responseBody ?? null,
        }),
        unhandledErrorJson: json(event.unhandledError),
        endedAt: Number(BigInt(event.ts) / NS_PER_MS),
        durationNs: Number(event.durationNs),
        hasError: result.hasError ? 1 : 0,
        errorStepId: result.errorStepId,
        stepCount: request.depths.size,
        truncated: request.truncated ? 1 : 0,
      },
      now(),
    );
    open.delete(requestId);
    changes.completedRequests.push(requestId);
  }

  return {
    /** Applies one batch in one transaction. */
    apply(sessionId: string, events: AgentEvent[]): Changes {
      const changes = emptyChanges();
      writeBatch(db, (tx) => {
        for (const event of events) apply(tx, sessionId, event, changes);
      });
      return changes;
    },
    /** Requests that started but haven't ended (for tests and session close). */
    openRequests: () => [...open.keys()],
    /** Drops in-memory state, e.g. for requests marked incomplete when their app went away. */
    forget: (requestIds: string[]) => requestIds.forEach((id) => open.delete(id)),
  };
}

export type Builder = ReturnType<typeof createBuilder>;
