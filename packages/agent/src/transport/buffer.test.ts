import { describe, expect, it } from 'vitest';

import type { AgentEvent } from '@pathlight-tracker/protocol';

import { EventBuffer } from './buffer';

const NOTHING_IN_FLIGHT = { events: 0, bytes: 0 };
const trace = (n: number) => `req_01JBBUFFER${String(n).padStart(16, '0')}`;

function enter(n: number, step: number): AgentEvent {
  return {
    e: 'step.enter',
    traceId: trace(n),
    ts: String(step),
    stepId: `stp_01JBBUFFER${String(step).padStart(16, '0')}`,
    parentStepId: null,
    kind: 'function',
    name: `f${step}`,
  };
}

function end(n: number): AgentEvent {
  return { e: 'request.end', traceId: trace(n), ts: '9', status: 200, durationNs: '1' };
}

const traces = (buffer: EventBuffer) =>
  buffer
    .take(1000, Number.MAX_SAFE_INTEGER, 0)
    .map((entry) => (JSON.parse(entry.json) as { traceId: string }).traceId);

describe('event buffer', () => {
  it('drops whole requests, oldest first, when full', () => {
    const buffer = new EventBuffer({ maxEvents: 5, maxBytes: 1_000_000 });
    for (const n of [1, 1, 2, 2, 3]) buffer.push(enter(n, buffer.size + n * 10), NOTHING_IN_FLIGHT);
    buffer.push(enter(3, 99), NOTHING_IN_FLIGHT);
    expect(buffer.droppedRequests).toBe(1);
    expect(traces(buffer)).toEqual([trace(2), trace(2), trace(3), trace(3)]);
  });

  it('never keeps part of a dropped request: its later events are discarded until it ends', () => {
    const buffer = new EventBuffer({ maxEvents: 2, maxBytes: 1_000_000 });
    buffer.push(enter(1, 1), NOTHING_IN_FLIGHT);
    buffer.push(enter(2, 2), NOTHING_IN_FLIGHT);
    buffer.push(enter(2, 3), NOTHING_IN_FLIGHT); // drops request 1
    expect(buffer.push(enter(1, 4), NOTHING_IN_FLIGHT)).toBe(false);
    expect(buffer.push(end(1), NOTHING_IN_FLIGHT)).toBe(false);
    expect(traces(buffer)).toEqual([trace(2), trace(2)]);
    // After its end, the ID is forgotten (the set of dropped requests doesn't grow forever).
    expect(buffer.push(enter(1, 5), NOTHING_IN_FLIGHT)).toBe(true);
  });

  it('counts events sent but not acknowledged against the limit', () => {
    const buffer = new EventBuffer({ maxEvents: 3, maxBytes: 1_000_000 });
    buffer.push(enter(1, 1), { events: 2, bytes: 0 });
    buffer.push(enter(2, 2), { events: 2, bytes: 0 });
    expect(buffer.droppedRequests).toBe(1);
    expect(traces(buffer)).toEqual([trace(2)]);
  });

  it('limits by bytes too', () => {
    const one = Buffer.byteLength(JSON.stringify(enter(1, 1)));
    const buffer = new EventBuffer({ maxEvents: 100, maxBytes: one * 2 + 10 });
    buffer.push(enter(1, 1), NOTHING_IN_FLIGHT);
    buffer.push(enter(2, 2), NOTHING_IN_FLIGHT);
    buffer.push(enter(3, 3), NOTHING_IN_FLIGHT);
    expect(traces(buffer)).toEqual([trace(2), trace(3)]);
  });

  it('keeps process-level events (no request) when dropping', () => {
    const buffer = new EventBuffer({ maxEvents: 2, maxBytes: 1_000_000 });
    buffer.push(
      { e: 'warning', traceId: null, ts: '1', code: 'X', message: 'm' },
      NOTHING_IN_FLIGHT,
    );
    buffer.push(enter(1, 1), NOTHING_IN_FLIGHT);
    buffer.push(enter(2, 2), NOTHING_IN_FLIGHT);
    expect(traces(buffer)).toEqual([null, trace(2)]);
  });

  it('takes batches within the event and byte limits, in order', () => {
    const buffer = new EventBuffer();
    for (let step = 1; step <= 5; step += 1) buffer.push(enter(1, step), NOTHING_IN_FLIGHT);
    const one = buffer.take(2, Number.MAX_SAFE_INTEGER, 0);
    expect(one.map((entry) => (JSON.parse(entry.json) as { name: string }).name)).toEqual([
      'f1',
      'f2',
    ]);
    const size = (one[0]?.bytes ?? 0) + 1;
    expect(buffer.take(100, size * 2 + 10, 10)).toHaveLength(2);
    // A single event bigger than the limit still goes out on its own, never stuck forever.
    expect(buffer.take(100, 1, 0)).toHaveLength(1);
    expect(buffer.size).toBe(0);
  });

  it('puts unacknowledged events back at the front, in order', () => {
    const buffer = new EventBuffer();
    buffer.push(enter(1, 1), NOTHING_IN_FLIGHT);
    buffer.push(enter(1, 2), NOTHING_IN_FLIGHT);
    const sent = buffer.take(1, Number.MAX_SAFE_INTEGER, 0);
    buffer.push(enter(1, 3), NOTHING_IN_FLIGHT);
    buffer.requeue(sent);
    expect(
      buffer
        .take(10, Number.MAX_SAFE_INTEGER, 0)
        .map((entry) => (JSON.parse(entry.json) as { name: string }).name),
    ).toEqual(['f1', 'f2', 'f3']);
  });
});
