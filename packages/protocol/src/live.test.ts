import { describe, expect, it } from 'vitest';

import { liveMessageSchema, uiToCollectorMessageSchema } from './live';
import { REQUEST_ID, SESSION_ID, STEP, requestSummary, stepsAppended } from './spec-examples';

describe('/live protocol (§11.2)', () => {
  it('accepts the live.steps.appended example', () => {
    expect(liveMessageSchema.safeParse(stepsAppended).error).toBeUndefined();
  });

  it('accepts the other collector → UI messages', () => {
    for (const message of [
      {
        type: 'live.request.started',
        v: 1,
        request: { ...requestSummary, state: 'in_progress', httpStatus: null, durationNs: null },
      },
      {
        type: 'live.steps.updated',
        v: 1,
        requestId: REQUEST_ID,
        steps: [{ id: STEP(5), status: 'returned', durationNs: '41000000' }],
      },
      {
        type: 'live.request.completed',
        v: 1,
        request: requestSummary,
        errorPath: [STEP(3), STEP(4), STEP(8)],
      },
      {
        type: 'live.request.deleted',
        v: 1,
        requestId: REQUEST_ID,
        deletedAt: '2026-10-30T06:40:00.000Z',
        purgeAt: '2026-11-02T06:40:00.000Z',
      },
      { type: 'live.request.purged', v: 1, requestIds: [REQUEST_ID] },
      {
        type: 'live.agent.disconnected',
        v: 1,
        sessionId: SESSION_ID,
        reason: 'restart',
        exitCode: null,
      },
      {
        type: 'live.agent.disabled',
        v: 1,
        sessionId: SESSION_ID,
        reason: 'too many internal errors',
      },
      { type: 'pong', v: 1 },
    ]) {
      expect(liveMessageSchema.safeParse(message).error).toBeUndefined();
    }
  });

  it('accepts subscriptions to the list and to one request', () => {
    expect(
      uiToCollectorMessageSchema.safeParse({
        type: 'subscribe',
        v: 1,
        topics: ['requests', `request:${REQUEST_ID}`],
      }).success,
    ).toBe(true);
    expect(uiToCollectorMessageSchema.safeParse({ type: 'ping', v: 1 }).success).toBe(true);
  });

  it('rejects bad topics, unknown messages and steps updates without an id', () => {
    expect(
      uiToCollectorMessageSchema.safeParse({ type: 'subscribe', v: 1, topics: ['request:nope'] })
        .success,
    ).toBe(false);
    expect(
      uiToCollectorMessageSchema.safeParse({ type: 'subscribe', v: 1, topics: [] }).success,
    ).toBe(false);
    expect(liveMessageSchema.safeParse({ type: 'live.request.exploded', v: 1 }).success).toBe(
      false,
    );
    expect(
      liveMessageSchema.safeParse({
        type: 'live.steps.updated',
        v: 1,
        requestId: REQUEST_ID,
        steps: [{ status: 'returned' }],
      }).success,
    ).toBe(false);
  });
});
