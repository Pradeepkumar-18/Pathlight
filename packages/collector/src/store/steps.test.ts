import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { InvalidCursorError } from './cursor';
import { openStore } from './open';
import type { Store } from './open';
import { loadSeed } from './seed';
import { childCounts, getStep, listSteps } from './steps';
import { insertSteps, writeBatch } from './writes';

const REQUEST = 'req_01JBSEED000000000000000001';
const OTHER = 'req_01JBSEED000000000000000002';
const STEP = (n: number): string => `stp_01JBSEED0000000000000000${String(n).padStart(2, '0')}`;

let root: string;
let store: Store;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'pt-steps-'));
  store = openStore({ projectRoot: root, dbPath: 'traces.db', version: '0.1.0' });
  loadSeed(store);
});

afterEach(() => {
  store.close();
  rmSync(root, { recursive: true, force: true });
});

const seqs = (rows: { seq: number }[]): number[] => rows.map((row) => row.seq);

describe('listSteps', () => {
  it('returns the whole tree in entry order', () => {
    const result = listSteps(store.db, REQUEST, {}, { limit: 500 });
    expect(seqs(result.data)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(result.page).toEqual({ limit: 500, nextCursor: null, total: 9 });
  });

  it('filters by parent, root, kind and error path', () => {
    expect(seqs(listSteps(store.db, REQUEST, { parentId: 'root' }, { limit: 500 }).data)).toEqual([
      1, 2, 3,
    ]);
    expect(seqs(listSteps(store.db, REQUEST, { parentId: STEP(4) }, { limit: 500 }).data)).toEqual([
      5, 7, 8,
    ]);
    expect(
      seqs(listSteps(store.db, REQUEST, { kind: ['boundary', 'decision'] }, { limit: 500 }).data),
    ).toEqual([6, 9]);
    expect(seqs(listSteps(store.db, REQUEST, { onErrorPath: true }, { limit: 500 }).data)).toEqual([
      3, 4, 8,
    ]);
  });

  it('pages by seq with cursors, and the cursor only works for the same request', () => {
    const first = listSteps(store.db, REQUEST, {}, { limit: 4 });
    const second = listSteps(
      store.db,
      REQUEST,
      {},
      { limit: 4, cursor: first.page.nextCursor ?? undefined },
    );
    const third = listSteps(
      store.db,
      REQUEST,
      {},
      { limit: 4, cursor: second.page.nextCursor ?? undefined },
    );
    expect([...seqs(first.data), ...seqs(second.data), ...seqs(third.data)]).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(third.page.nextCursor).toBeNull();
    expect(() =>
      listSteps(store.db, OTHER, {}, { limit: 4, cursor: first.page.nextCursor ?? '' }),
    ).toThrow(InvalidCursorError);
  });

  it('finds one step only within its own request', () => {
    expect(getStep(store.db, REQUEST, STEP(8))?.name).toBe('PricingService.calculateDiscount');
    expect(getStep(store.db, OTHER, STEP(8))).toBeUndefined();
  });

  it('counts children per step', () => {
    const counts = childCounts(store.db, REQUEST);
    expect(counts.get(STEP(4))).toBe(3);
    expect(counts.get(STEP(8))).toBe(1);
    expect(counts.get(STEP(9))).toBeUndefined();
  });
});

describe('writes', () => {
  it('skips a step that already exists, so a re-sent event never duplicates', () => {
    const step = {
      id: STEP(50),
      requestId: REQUEST,
      seq: 50,
      kind: 'function' as const,
      name: 'again',
      startOffsetNs: 0,
      createdAt: 1,
      updatedAt: 1,
    };
    expect(writeBatch(store.db, (tx) => insertSteps(tx, [step]))).toBe(1);
    expect(writeBatch(store.db, (tx) => insertSteps(tx, [step]))).toBe(0);
    expect(listSteps(store.db, REQUEST, {}, { limit: 500 }).page.total).toBe(10);
  });

  it('rolls back the whole batch when one write fails', () => {
    const good = {
      id: STEP(60),
      requestId: REQUEST,
      seq: 60,
      kind: 'function' as const,
      name: 'good',
      startOffsetNs: 0,
      createdAt: 1,
      updatedAt: 1,
    };
    const badSeq = { ...good, id: STEP(61), seq: 1 }; // seq 1 is taken in this request
    expect(() => writeBatch(store.db, (tx) => insertSteps(tx, [good, badSeq]))).toThrow();
    expect(getStep(store.db, REQUEST, STEP(60))).toBeUndefined();
  });
});
