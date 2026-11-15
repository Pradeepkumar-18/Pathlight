import { inspect } from 'node:util';

import { describe, expect, it } from 'vitest';

import { capturedValueSchema } from '@pathlight-tracker/protocol';
import type { CapturedValue } from '@pathlight-tracker/protocol';

import { capture, MAX_KEYS } from './capture';
import type { CaptureOptions } from './capture';

const LIMITS: CaptureOptions = { maxDepth: 3, maxArray: 10, maxString: 200 };

/** Captures and checks the result is a valid protocol value. */
function cap(value: unknown, options: Partial<CaptureOptions> = {}): CapturedValue {
  const result = capture(value, { ...LIMITS, ...options });
  capturedValueSchema.parse(result);
  return result;
}

describe('primitives', () => {
  it.each([
    ['a string', 'hello', { type: 'string', preview: 'hello' }],
    ['a number', 42, { type: 'number', preview: '42' }],
    ['a boolean', true, { type: 'boolean', preview: 'true' }],
    ['null', null, { type: 'null', preview: 'null' }],
    ['undefined', undefined, { type: 'undefined', preview: 'undefined' }],
    ['a BigInt', 12345678901234567890n, { type: 'bigint', preview: '12345678901234567890n' }],
    ['a Symbol', Symbol('token'), { type: 'symbol', preview: 'Symbol(token)' }],
    ['NaN (suspicious)', Number.NaN, { type: 'number', preview: 'NaN', suspicious: true }],
  ])('%s', (_name, value, expected) => {
    expect(cap(value)).toEqual(expected);
  });

  it('caps long strings and keeps their full length', () => {
    const result = cap('x'.repeat(5000), { maxString: 10 });
    expect(result).toEqual({ type: 'string', preview: 'xxxxxxxxxx…', size: 5000, truncated: true });
  });

  it('flags a top-level undefined only when asked (arguments, decision 0016)', () => {
    expect(cap(undefined, { flagUndefined: true }).suspicious).toBe(true);
  });

  it('functions and classes', () => {
    function named() {}
    expect(cap(named)).toEqual({ type: 'function', preview: '[Function named]' });
    expect(cap(() => 1).preview).toBe('[Function (anonymous)]');
    expect(cap(class Order {}).preview).toBe('[Function Order]');
  });
});

describe('objects and arrays', () => {
  it('a plain object, with a short preview and children', () => {
    const result = cap({ id: 7, name: 'Ravi', tier: undefined });
    expect(result).toMatchObject({
      type: 'object',
      preview: '{ id: 7, name: "Ravi", tier: undefined }',
      size: 3,
      children: {
        id: { type: 'number', preview: '7' },
        name: { type: 'string', preview: 'Ravi' },
        // A missing value inside an object is what the developer is usually hunting for.
        tier: { type: 'undefined', preview: 'undefined', suspicious: true },
      },
    });
  });

  it('a class instance keeps its class name', () => {
    class User {
      constructor(
        public id: number,
        public name: string,
      ) {}
    }
    expect(cap(new User(7, 'Ravi'))).toMatchObject({
      type: 'object',
      className: 'User',
      preview: 'User { id: 7, name: "Ravi" }',
    });
  });

  it('matches the seed preview for a DTO with a nested array', () => {
    class CreateOrderDto {
      userId = 7;
      items = [2];
    }
    expect(cap(new CreateOrderDto()).preview).toBe('CreateOrderDto { userId: 7, items: [2] }');
    expect(cap([2, 3]).preview).toBe('[2 items]');
  });

  it('arrays are capped at maxArray and marked truncated', () => {
    const result = cap(
      Array.from({ length: 50 }, (_, i) => i),
      { maxArray: 3 },
    );
    expect(result).toMatchObject({ type: 'array', size: 50, truncated: true });
    expect(result.children).toHaveLength(3);
  });

  it(`objects show at most ${MAX_KEYS} keys`, () => {
    const big = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`k${i}`, i]));
    const result = cap(big);
    expect(Object.keys(result.children ?? {})).toHaveLength(MAX_KEYS);
    expect(result.truncated).toBe(true);
    expect(result.preview.length).toBeLessThan(140);
  });

  it('stops at maxDepth and marks the cut', () => {
    const result = cap({ a: { b: { c: { d: 1 } } } }, { maxDepth: 2 });
    const a = (result.children as Record<string, CapturedValue>).a;
    const b = (a?.children as Record<string, CapturedValue>).b;
    expect(b).toMatchObject({ type: 'object', truncated: true });
    expect(b?.children).toBeUndefined();
  });

  it('marks circular references instead of following them', () => {
    const node: Record<string, unknown> = { name: 'root' };
    node.self = node;
    node.list = [node];
    const result = cap(node);
    const children = result.children as Record<string, CapturedValue>;
    expect(children.self).toEqual({ type: 'circular', preview: '[Circular]' });
    expect((children.list?.children as CapturedValue[])[0]?.type).toBe('circular');
  });

  it('the same object twice (not a cycle) is captured both times', () => {
    const shared = { id: 1 };
    const children = cap({ a: shared, b: shared }).children as Record<string, CapturedValue>;
    expect(children.a?.type).toBe('object');
    expect(children.b?.type).toBe('object');
  });
});

describe('special types', () => {
  it('Map and Set', () => {
    const map = cap(
      new Map<unknown, unknown>([
        ['a', 1],
        [{ k: 1 }, 'object key'],
      ]),
    );
    expect(map).toMatchObject({ type: 'map', preview: 'Map(2) {…}', size: 2 });
    expect(Object.keys(map.children ?? {})).toEqual(['a', '{…}']);
    expect(cap(new Set([1, 2, 3]))).toMatchObject({ type: 'set', size: 3, preview: 'Set(3) {…}' });
  });

  it('Date, including an invalid one', () => {
    expect(cap(new Date('2026-11-15T10:00:00.000Z'))).toEqual({
      type: 'date',
      preview: '2026-11-15T10:00:00.000Z',
    });
    expect(cap(new Date('nope')).preview).toBe('Invalid Date');
  });

  it('Error, with its message and extra fields', () => {
    const error = Object.assign(new TypeError('Cannot read properties of undefined'), {
      code: 'E_TIER',
    });
    expect(cap(error)).toMatchObject({
      type: 'error',
      className: 'TypeError',
      preview: 'TypeError: Cannot read properties of undefined',
      children: {
        message: { type: 'string', preview: 'Cannot read properties of undefined' },
        code: { type: 'string', preview: 'E_TIER' },
      },
    });
  });

  it('Promise', () => {
    const promise = Promise.resolve(1);
    expect(cap(promise)).toEqual({ type: 'promise', preview: 'Promise' });
  });

  it('Buffer and typed arrays: size and the first bytes only', () => {
    expect(cap(Buffer.from('hi'))).toEqual({
      type: 'buffer',
      className: 'Buffer',
      preview: '<Buffer 68 69> (2 bytes)',
      size: 2,
    });
    expect(cap(new Uint16Array(4)).preview).toBe('<Uint16Array 00 00 00 00 00 00 00 00> (8 bytes)');
  });

  it('summarises a 50 MB buffer without copying it', () => {
    const big = Buffer.alloc(50 * 1024 * 1024, 1);
    const started = performance.now();
    const result = cap({ file: big });
    expect(performance.now() - started).toBeLessThan(50);
    const file = (result.children as Record<string, CapturedValue>).file;
    expect(file).toMatchObject({ type: 'buffer', size: 50 * 1024 * 1024, truncated: true });
    expect(JSON.stringify(result).length).toBeLessThan(500);
  });

  it('a Mongoose document shows its fields under the model name, not its internals', () => {
    function User() {}
    Object.defineProperty(User, 'modelName', { value: 'User' });
    const document = Object.create(User.prototype as object) as Record<string, unknown>;
    document.$__ = { activePaths: {}, saving: undefined };
    document._doc = { name: 'Ravi', tier: undefined };
    document.isNew = false;
    expect(cap(document)).toMatchObject({
      type: 'object',
      className: 'User',
      preview: 'User { name: "Ravi", tier: undefined }',
      children: { name: { preview: 'Ravi' }, tier: { suspicious: true } },
    });
    expect(Object.keys(cap(document).children ?? {})).toEqual(['name', 'tier']);
  });

  it('a BSON ObjectId as its hex string', () => {
    class ObjectId {
      buffer = Buffer.from('65f1a2b3c4d5e6f708192a3b', 'hex');
    }
    expect(cap(new ObjectId()).preview).toBe('ObjectId("65f1a2b3c4d5e6f708192a3b")');
  });

  it('WeakMap and RegExp', () => {
    expect(cap(new WeakMap()).preview).toBe('WeakMap');
    expect(cap(/ab+c/gi)).toEqual({ type: 'object', className: 'RegExp', preview: '/ab+c/gi' });
  });
});

describe('never runs user code', () => {
  it('never triggers a getter, own or inherited', () => {
    let calls = 0;
    class Account {
      get balance() {
        calls += 1;
        return 100;
      }
    }
    const account = new Account();
    Object.defineProperty(account, 'lazy', {
      enumerable: true,
      get() {
        calls += 1;
        return 'loaded';
      },
    });
    const result = cap({ account, nested: { account } });
    expect(calls).toBe(0);
    expect((result.children as Record<string, CapturedValue>).account?.children).toEqual({
      lazy: { type: 'function', preview: '[Getter]' },
    });
  });

  it('never calls toJSON, a custom inspect hook or toString', () => {
    let calls = 0;
    const value = {
      id: 1,
      toJSON() {
        calls += 1;
        return 'json';
      },
      toString() {
        calls += 1;
        return 'text';
      },
      [inspect.custom]() {
        calls += 1;
        return 'inspected';
      },
    };
    cap({ value, list: [value], map: new Map([['v', value]]) });
    expect(calls).toBe(0);
  });

  it("never touches a proxy's traps", () => {
    let traps = 0;
    const proxy = new Proxy(
      { secret: 1 },
      {
        get: () => (traps += 1),
        ownKeys: () => {
          traps += 1;
          return [];
        },
        getOwnPropertyDescriptor: () => {
          traps += 1;
          return undefined;
        },
        getPrototypeOf: () => {
          traps += 1;
          return null;
        },
      },
    );
    expect(cap({ proxy, list: [proxy] })).toMatchObject({
      children: { proxy: { type: 'object', className: 'Proxy', preview: 'Proxy' } },
    });
    expect(traps).toBe(0);
  });

  it('never calls overridden Map / Set / Date methods of a subclass', () => {
    let calls = 0;
    class Tracked extends Map<string, number> {
      override entries(): MapIterator<[string, number]> {
        calls += 1;
        return super.entries();
      }
      override get size() {
        calls += 1;
        return super.size;
      }
    }
    class Stamp extends Date {
      override toISOString() {
        calls += 1;
        return 'x';
      }
    }
    cap({ map: new Tracked([['a', 1]]), date: new Stamp(0) });
    expect(calls).toBe(0);
  });
});

describe('hooks for redaction and object IDs', () => {
  it('replaces secret keys before reading them', () => {
    let reads = 0;
    const user = { name: 'Ravi' } as Record<string, unknown>;
    Object.defineProperty(user, 'password', {
      enumerable: true,
      get() {
        reads += 1;
        return 'hunter2';
      },
    });
    const result = cap(user, { isSecretKey: (key) => key === 'password' });
    expect(result.preview).toBe('{ name: "Ravi", password: [REDACTED] }');
    expect((result.children as Record<string, CapturedValue>).password).toEqual({
      type: 'string',
      preview: '[REDACTED]',
      redacted: true,
    });
    expect(JSON.stringify(result)).not.toContain('hunter2');
    expect(reads).toBe(0);
  });

  it('asks for an object ID for objects and arrays', () => {
    const ids = new Map<object, string>();
    const objectIdOf = (value: object) => {
      if (!ids.has(value)) ids.set(value, `obj_${ids.size + 1}`);
      return ids.get(value);
    };
    const result = cap({ items: [1] }, { objectIdOf });
    expect(result.objectId).toBe('obj_1');
    expect((result.children as Record<string, CapturedValue>).items?.objectId).toBe('obj_2');
  });
});
