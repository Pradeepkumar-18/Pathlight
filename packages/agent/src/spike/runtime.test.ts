import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as runtime from './runtime';

let lines: string[] = [];

beforeEach(() => {
  lines = [];
  runtime.resetDepth();
  runtime.setWriter((text) => lines.push(text.replace(/ \(\d+\.\d ms\)/, '')));
});

afterEach(() => {
  runtime.setWriter(() => undefined);
});

describe('runtime', () => {
  it('prints an indented tree with ✕ for a throw', () => {
    const outer = runtime.enter('Orders.create', 'src/orders.ts', 19);
    const inner = runtime.enter('Pricing.discount', 'src/pricing.ts', 22);
    runtime.throw(inner, new TypeError('boom'));
    runtime.exit(inner);
    runtime.exit(outer);
    expect(lines).toEqual([
      '→ Orders.create (src/orders.ts:19)\n',
      '  → Pricing.discount (src/pricing.ts:22)\n',
      '  ✕ Pricing.discount threw TypeError: boom\n',
      '← Orders.create\n',
    ]);
  });

  it('ends a step that returned a promise when the promise settles, keeping rejections', async () => {
    const probe = runtime.enter('Orders.create', 'src/orders.ts', 19);
    const failure = new Error('later');
    const returned = runtime.ret(probe, Promise.reject(failure));
    runtime.exit(probe);
    expect(lines).toHaveLength(1);
    await expect(returned).rejects.toBe(failure);
    expect(lines[1]).toBe('✕ Orders.create threw Error: later\n');
  });

  it('never runs user code: Proxy values, overridden then and error getters', () => {
    const trap = (): never => {
      throw new Error('user code ran');
    };
    const probe = runtime.enter('a', 'src/a.ts', 1);
    const proxy = new Proxy({}, { getPrototypeOf: trap, get: trap });
    expect(runtime.ret(probe, proxy)).toBe(proxy);

    const promise = Promise.resolve(1);
    Object.defineProperty(promise, 'then', { get: trap });
    expect(() => runtime.ret(probe, promise)).not.toThrow();

    const error = new Error('x');
    Object.defineProperty(error, 'message', { get: trap });
    expect(() => runtime.throw(probe, error)).not.toThrow();
  });

  it('never throws into user code when writing fails', () => {
    runtime.setWriter(() => {
      throw new Error('stdout closed');
    });
    expect(() => runtime.exit(runtime.enter('a', 'src/a.ts', 1))).not.toThrow();
  });
});
