import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { startAgent, stopAgentForTests } from '../agent';
import * as runtime from '../runtime/runtime';
import type { Probe } from '../runtime/runtime';
import type { Site } from './sites';
import { wrapFunctions } from './wrap';
import type { WrapOptions } from './wrap';

interface Call {
  site: Site;
  self: unknown;
  args: unknown[] | undefined;
  threw?: boolean;
  error?: unknown;
  returned?: unknown;
  finished: boolean;
}

const OPTIONS: WrapOptions = {
  runtimePath: 'pathlight-runtime',
  file: 'src/sample.ts',
  originFor: (line, column) => ({ line, column }),
};

let calls: Call[];

beforeEach(() => {
  calls = [];
  startAgent({
    env: { PATHLIGHT_TRACKER_COLLECTOR_URL: 'ws://x', PATHLIGHT_TRACKER_TOKEN: 't' },
    cwd: process.cwd(),
    readFile: () => null,
    write: () => undefined,
  });
  runtime.setRecorder({
    enter: (site, self, args) => {
      const call: Call = { site, self, args: args && Array.from(args), finished: false };
      calls.push(call);
      return call;
    },
    finish: (probe: Probe, returned) => {
      const call = probe.data as Call;
      Object.assign(call, { finished: true, threw: probe.threw, error: probe.error, returned });
    },
  });
});

afterEach(() => {
  runtime.setRecorder(null);
  stopAgentForTests();
});

/** Runs wrapped CommonJS code against the real runtime and returns its exports. */
function load(code: string, options: WrapOptions = OPTIONS): Record<string, unknown> {
  const wrapped = wrapFunctions(code, options);
  if (wrapped === null) throw new Error('could not parse');
  const module = { exports: {} as Record<string, unknown> };
  // Test-only evaluation of the generated code; the agent itself never uses eval.
  new Function('require', 'module', 'exports', wrapped)(() => runtime, module, module.exports);
  return module.exports;
}

const names = () => calls.map((call) => call.site.name);

describe('what gets wrapped', () => {
  it('functions, class methods, static methods, arrows, arrow class fields, object methods', () => {
    const exports = load(
      [
        'class Pricing {',
        '  discount(total) { return total * 0.1; }',
        '  static round(n) { return Math.round(n); }',
        '  apply = (total) => total - this.discount(total);',
        '  #secret() { return 1; }',
        '  reveal() { return this.#secret(); }',
        '}',
        'function total(a, b) { return a + b; }',
        'const double = (x) => x * 2;',
        'const helpers = { triple(x) { return x * 3; }, half: function (x) { return x / 2; } };',
        'module.exports = { Pricing, total, double, helpers };',
      ].join('\n'),
    ) as {
      Pricing: { new (): { apply(n: number): number; reveal(): number }; round(n: number): number };
      total(a: number, b: number): number;
      double(x: number): number;
      helpers: { triple(x: number): number; half(x: number): number };
    };
    const pricing = new exports.Pricing();
    expect(pricing.apply(100)).toBe(90);
    expect(pricing.reveal()).toBe(1);
    expect(exports.Pricing.round(2.6)).toBe(3);
    expect(exports.total(1, 2)).toBe(3);
    expect(exports.double(4)).toBe(8);
    expect(exports.helpers.triple(2)).toBe(6);
    expect(exports.helpers.half(4)).toBe(2);
    expect(names()).toEqual([
      'Pricing.apply',
      'Pricing.discount',
      'Pricing.reveal',
      'Pricing.#secret',
      'Pricing.round',
      'total',
      'double',
      'triple',
      'half',
    ]);
    expect(calls.every((call) => call.finished)).toBe(true);
  });

  it('describes each site: kind, class, position, async, argument names', () => {
    const exports = load(
      [
        'class Orders {',
        '  async create(dto, { userId }, ...rest) { return dto; }',
        '}',
        'const plain = (a = 1, [b]) => a;',
        'module.exports = { Orders, plain };',
      ].join('\n'),
    ) as {
      Orders: new () => { create(...args: unknown[]): Promise<unknown> };
      plain(a: number, b: number[]): number;
    };
    void new exports.Orders().create({}, { userId: 7 });
    exports.plain(1, [2]);
    expect(calls[0]?.site).toEqual({
      name: 'Orders.create',
      kind: 'method',
      file: 'src/sample.ts',
      line: 2,
      column: 3,
      isAsync: true,
      thisClass: 'Orders',
      argNames: ['dto', '{…}', '...rest'],
    });
    expect(calls[1]?.site).toMatchObject({
      name: 'plain',
      kind: 'function',
      argNames: ['a', '[…]'],
    });
    expect(calls[1]?.site.thisClass).toBeUndefined();
  });

  it('leaves getters, setters, constructors and generators unwrapped, but not functions inside them', () => {
    const exports = load(
      [
        'class User {',
        '  constructor(name) { this.name = name; this.greet = () => "hi " + name; }',
        '  get upper() { return [this.name].map((n) => n.toUpperCase())[0]; }',
        '  set nick(v) { this._nick = v; }',
        '  *ids() { yield 1; }',
        '}',
        'module.exports = { User };',
      ].join('\n'),
    ) as {
      User: new (name: string) => {
        greet(): string;
        upper: string;
        nick: string;
        ids(): Iterable<number>;
      };
    };
    const user = new exports.User('ravi');
    expect(user.upper).toBe('RAVI');
    user.nick = 'r';
    expect([...user.ids()]).toEqual([1]);
    expect(user.greet()).toBe('hi ravi');
    expect(names()).toEqual(['(anonymous)', 'greet']);
  });

  it('skips compiler-generated code that has no original position', () => {
    load('function generated() {}\nfunction mine() {}\ngenerated(); mine();', {
      ...OPTIONS,
      originFor: (line, column) => (line === 1 ? null : { line, column }),
    });
    expect(names()).toEqual(['mine']);
  });
});

describe('what the runtime is told', () => {
  it('this and arguments: own for functions and methods, the parameters for arrows', () => {
    const exports = load(
      [
        'class Cart { add = (item, qty = 1, ...more) => qty; total(a, b) { return a + b; } }',
        'function legacy() { return arguments.length; }',
        'const top = ({ id }, name) => name;',
        'module.exports = { Cart, legacy, top };',
      ].join('\n'),
    ) as {
      Cart: new () => { add(...args: unknown[]): number; total(a: number, b: number): number };
      legacy(...args: unknown[]): number;
      top(a: { id: number }, name: string): string;
    };
    const cart = new exports.Cart();
    cart.add('apple', undefined, 'x', 'y');
    cart.total(1, 2);
    expect(exports.legacy(1, 2, 3)).toBe(3);
    exports.top({ id: 1 }, 'n');
    const [add, total, legacy, top] = calls;
    expect(add?.self).toBe(cart);
    expect(add?.args).toEqual(['apple', 1, 'x', 'y']);
    expect(total?.self).toBe(cart);
    expect(total?.args).toEqual([1, 2]);
    expect(legacy?.args).toEqual([1, 2, 3]);
    expect(top?.self).toBeUndefined();
    expect(top?.args).toEqual([undefined, 'n']);
  });

  it('never touches `this` in an arrow inside a derived constructor before super()', () => {
    const exports = load(
      [
        'class Base { constructor(v) { this.v = v; } }',
        'class Child extends Base { constructor() { const f = () => 5; super(f()); } }',
        'module.exports = { Child };',
      ].join('\n'),
    ) as { Child: new () => { v: number } };
    expect(new exports.Child().v).toBe(5);
  });

  it('records the returned value, and undefined when a function runs off its end', () => {
    const exports = load(
      'function one() { return 1; }\nfunction none() { one(); }\nmodule.exports = { none };',
    ) as { none(): void };
    exports.none();
    expect(calls.map((call) => [call.site.name, call.returned])).toEqual([
      ['none', undefined],
      ['one', 1],
    ]);
  });

  it('records a throw and rethrows the very same error', () => {
    const exports = load(
      'function fail() { throw new TypeError("boom"); }\nmodule.exports = { fail };',
    ) as { fail(): void };
    let caught: unknown;
    try {
      exports.fail();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TypeError);
    expect(calls[0]).toMatchObject({ threw: true, error: caught, finished: true });
  });

  it('ends an async step only when its work is done', async () => {
    const exports = load(
      [
        'const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));',
        'async function slow() { await wait(20); return "done"; }',
        'module.exports = { slow };',
      ].join('\n'),
    ) as { slow(): Promise<string> };
    const pending = exports.slow();
    expect(calls[0]?.finished).toBe(false);
    expect(await pending).toBe('done');
    expect(calls[0]).toMatchObject({ finished: true, returned: 'done' });
  });

  it('does nothing once the agent has turned itself off', () => {
    stopAgentForTests();
    const exports = load('function f() { return 1; }\nmodule.exports = { f };') as { f(): number };
    expect(exports.f()).toBe(1);
    expect(calls).toEqual([]);
  });
});

describe('tricky code', () => {
  it('keeps "use strict" directives in force', () => {
    const exports = load(
      '"use strict";\nfunction f() { "use strict"; return this; }\nmodule.exports = { f };',
    ) as { f(): unknown };
    const { f } = exports;
    expect(f()).toBeUndefined();
  });

  it('maps positions after multi-byte characters correctly', () => {
    load('const s = "héllo 😀"; function f() {}\nf();');
    expect(calls[0]?.site).toMatchObject({ line: 1, column: 23 });
  });

  it('returns null when the code cannot be parsed', () => {
    expect(wrapFunctions('function (', OPTIONS)).toBeNull();
  });

  it('handles a return with no space before the closing brace', () => {
    const exports = load('function f(){return 1}\nmodule.exports = { f };') as { f(): number };
    expect(exports.f()).toBe(1);
  });

  it('handles directives written without a semicolon', () => {
    const exports = load(
      '"use strict"\nfunction f() { "use strict"\n return 2 }\nmodule.exports = { f };',
    ) as {
      f(): number;
    };
    expect(exports.f()).toBe(2);
  });

  it('never clashes with user names that look like its own variables', () => {
    const exports = load(
      'function f(__pt$, __pathlightTracker, __ptSites) { return __pt$ + __pathlightTracker + __ptSites; }\nmodule.exports = { f };',
    ) as { f(a: number, b: number, c: number): number };
    expect(exports.f(1, 2, 3)).toBe(6);
  });

  it('keeps a shebang as the first line', () => {
    const wrapped = wrapFunctions('#!/usr/bin/env node\nfunction f() {}', OPTIONS);
    expect(wrapped?.startsWith('#!/usr/bin/env node\n')).toBe(true);
  });
});
