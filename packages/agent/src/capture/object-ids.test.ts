import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { SETTING_DEFAULTS } from '@pathlight-tracker/protocol';
import type { CapturedValue } from '@pathlight-tracker/protocol';

import { createCapturer } from './capturer';
import { createObjectIds } from './object-ids';

setFlagsFromString('--expose-gc');
const gc = runInNewContext('gc') as () => void;

async function collectGarbage(): Promise<void> {
  // Let pending microtasks drop their references, then collect twice (weak maps clear in two passes).
  await new Promise((resolve) => setImmediate(resolve));
  gc();
  gc();
}

const child = (value: CapturedValue, key: string) =>
  (value.children as Record<string, CapturedValue>)[key];

describe('object IDs', () => {
  it('the same object passed to two functions gets the same objectId', () => {
    const capturer = createCapturer(SETTING_DEFAULTS);
    const user = { id: 7, tier: undefined };
    // As the runtime will capture them: the arguments of two different steps.
    const findById = capturer.value([user]);
    const calculateDiscount = capturer.value([user, 1200]);
    const first = (findById.children as CapturedValue[])[0]?.objectId;
    const second = (calculateDiscount.children as CapturedValue[])[0]?.objectId;
    expect(first).toMatch(/^obj_\d+$/);
    expect(second).toBe(first);
    // A different object with the same contents is a different object.
    expect(capturer.value({ id: 7, tier: undefined }).objectId).not.toBe(first);
  });

  it('nested objects get their own IDs, and a shared one is recognised wherever it appears', () => {
    const capturer = createCapturer(SETTING_DEFAULTS);
    const items = [2];
    const body = capturer.value({ userId: 7, items });
    const later = capturer.value({ cart: { items } });
    expect(child(body, 'items')?.objectId).toBe(
      child(child(later, 'cart') as CapturedValue, 'items')?.objectId,
    );
    expect(body.objectId).not.toBe(child(body, 'items')?.objectId);
  });

  it('only objects the data journey can follow get an ID', () => {
    const capturer = createCapturer(SETTING_DEFAULTS);
    const value = capturer.value({
      date: new Date(0),
      buffer: Buffer.from('x'),
      promise: Promise.resolve(),
      map: new Map(),
      error: new Error('x'),
    });
    expect(value.objectId).toBeDefined();
    expect(child(value, 'date')?.objectId).toBeUndefined();
    expect(child(value, 'buffer')?.objectId).toBeUndefined();
    expect(child(value, 'promise')?.objectId).toBeUndefined();
    expect(child(value, 'map')?.objectId).toBeDefined();
    expect(child(value, 'error')?.objectId).toBeDefined();
  });

  it('never keeps an object alive', async () => {
    const ids = createObjectIds();
    let target: object | null = { big: new Array(1000).fill('x') };
    ids.idOf(target);
    const ref = new WeakRef(target);
    target = null;
    await collectGarbage();
    expect(ref.deref()).toBeUndefined();
  });

  it('no memory growth after 10,000 requests', async () => {
    const capturer = createCapturer(SETTING_DEFAULTS);
    const request = (n: number) => {
      // What one request's captures look like: a body, a user, a list, each new per request.
      const user = { id: n, name: `user${n}`, tags: ['a', 'b'], profile: { since: new Date() } };
      const body = { userId: n, items: Array.from({ length: 5 }, (_, i) => ({ sku: i })) };
      capturer.value(body);
      capturer.value([user, body]);
      capturer.value({ user });
    };
    for (let n = 0; n < 1000; n += 1) request(n); // warm-up: JIT, caches
    await collectGarbage();
    const before = process.memoryUsage().heapUsed;
    for (let n = 0; n < 10_000; n += 1) request(n);
    await collectGarbage();
    const growth = process.memoryUsage().heapUsed - before;
    // 10,000 requests × ~13 objects: retaining them would cost several MB.
    expect(growth).toBeLessThan(1024 * 1024);
  });
});
