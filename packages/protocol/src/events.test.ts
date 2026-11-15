import { describe, expect, it } from 'vitest';

import { agentEventSchema, agentMessageSchema, collectorToAgentMessageSchema } from './events';
import {
  REQUEST_ID,
  SESSION_ID,
  STEP,
  batch,
  hello,
  requestStart,
  stepEnter,
  stepExit,
} from './spec-examples';

describe('agent protocol accepts the api-spec examples (§11.1)', () => {
  it('hello and batch messages', () => {
    expect(agentMessageSchema.safeParse(hello).error).toBeUndefined();
    expect(agentMessageSchema.safeParse(batch).error).toBeUndefined();
  });

  it.each([
    ['request.start', requestStart],
    ['step.enter', stepEnter],
    ['step.exit', stepExit],
    [
      'step.throw',
      {
        e: 'step.throw',
        traceId: REQUEST_ID,
        ts: '1',
        stepId: STEP(8),
        error: {
          type: 'TypeError',
          message: "Cannot read properties of undefined (reading 'rate')",
          file: 'src/pricing/pricing.service.ts',
          line: 27,
          column: 31,
        },
        durationNs: '300000',
      },
    ],
    [
      'decision',
      {
        e: 'decision',
        traceId: REQUEST_ID,
        ts: '1',
        stepId: STEP(9),
        parentStepId: STEP(8),
        decisionType: 'if',
        expression: "user.tier === 'gold'",
        values: { 'user.tier': { type: 'undefined', preview: 'undefined', suspicious: true } },
        result: false,
        branch: 'else',
      },
    ],
    [
      'warning',
      {
        e: 'warning',
        traceId: REQUEST_ID,
        ts: '1',
        code: 'NO_SOURCE_MAP',
        message: 'no map',
        file: 'src/a.js',
      },
    ],
    [
      'request.end',
      {
        e: 'request.end',
        traceId: REQUEST_ID,
        ts: '1',
        status: 500,
        responseBody: { type: 'object', preview: '{}' },
        durationNs: '84000000',
      },
    ],
  ])('%s', (_name, event) => {
    expect(agentEventSchema.safeParse(event).error).toBeUndefined();
  });

  it('collector → agent messages', () => {
    for (const message of [
      {
        type: 'welcome',
        v: 1,
        sessionId: SESSION_ID,
        limits: { maxBatchBytes: 1048576, maxBatchEvents: 2000 },
      },
      { type: 'ack', v: 1, seq: 42 },
      { type: 'slow_down', v: 1, reason: 'ingest_backlog' },
      { type: 'resume', v: 1 },
      { type: 'error', v: 1, code: 'INVALID_EVENT', message: 'bad event', seq: 42 },
    ]) {
      expect(collectorToAgentMessageSchema.safeParse(message).error).toBeUndefined();
    }
  });
});

describe('agent protocol rejects invalid data', () => {
  it.each([
    ['an unknown event type', { ...stepExit, e: 'step.finish' }],
    ['a ts that is a number', { ...stepExit, ts: 1793342105121500000 }],
    ['a trace ID that is not a request ID', { ...stepExit, traceId: SESSION_ID }],
    [
      'the old reused `kind` on a boundary',
      {
        e: 'boundary',
        traceId: REQUEST_ID,
        ts: '1',
        stepId: STEP(6),
        kind: 'db',
        request: {},
        durationNs: '1',
      },
    ],
    [
      'a captured value with an unknown type',
      { ...stepExit, returnValue: { type: 'span', preview: 'x' } },
    ],
    [
      'a deep captured value with a bad child',
      {
        ...stepExit,
        returnValue: { type: 'object', preview: '{}', children: { a: { type: 'nope' } } },
      },
    ],
    ['no request ID on a step event', { ...stepExit, traceId: null }],
  ])('an event with %s', (_name, event) => {
    expect(agentEventSchema.safeParse(event).success).toBe(false);
  });

  it('accepts a null request ID only on the process-level warning and agent.disabled', () => {
    const outside = { traceId: null, ts: '1' };
    expect(
      agentEventSchema.safeParse({ e: 'warning', ...outside, code: 'X', message: 'm' }).success,
    ).toBe(true);
    expect(
      agentEventSchema.safeParse({
        e: 'agent.disabled',
        ...outside,
        reason: 'r',
        internalErrorCount: 20,
      }).success,
    ).toBe(true);
  });

  it('a WebSocket error code that does not exist', () => {
    expect(
      collectorToAgentMessageSchema.safeParse({
        type: 'error',
        v: 1,
        code: 'COLLECTOR_ERROR',
        message: 'x',
      }).success,
    ).toBe(false);
  });
});
