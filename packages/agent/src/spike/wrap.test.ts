import { describe, expect, it } from 'vitest';

import { wrapFunctions } from './wrap';
import type { WrapOptions } from './wrap';

interface Event {
  kind: 'enter' | 'exit' | 'throw';
  name: string;
  line?: number;
  error?: unknown;
}

const OPTIONS: WrapOptions = {
  runtimePath: 'fake-runtime',
  file: 'src/sample.ts',
  originFor: (line) => ({ line }),
};

/** Runs wrapped CommonJS code against a recording runtime and returns its exports and events. */
function load(
  code: string,
  options: WrapOptions = OPTIONS,
): { exports: Record<string, unknown>; events: Event[] } {
  const wrapped = wrapFunctions(code, options);
  if (wrapped === null) throw new Error('could not parse');
  const events: Event[] = [];
  const runtime = {
    enter: (name: string, _file: string, line: number) => {
      events.push({ kind: 'enter', name, line });
      return { name, pending: false };
    },
    exit: (probe: { name: string; pending: boolean }) => {
      if (!probe.pending) events.push({ kind: 'exit', name: probe.name });
    },
    throw: (probe: { name: string }, error: unknown) =>
      events.push({ kind: 'throw', name: probe.name, error }),
    ret: (probe: { name: string; pending: boolean }, value: unknown) => {
      if (!(value instanceof Promise)) return value;
      probe.pending = true;
      return value.then((result) => {
        events.push({ kind: 'exit', name: probe.name });
        return result;
      });
    },
  };
  const module = { exports: {} as Record<string, unknown> };
  // Test-only evaluation of the generated code; the agent itself never uses eval.
  new Function('require', 'module', 'exports', wrapped)(() => runtime, module, module.exports);
  return { exports: module.exports, events };
}

describe('wrapFunctions', () => {
  it('wraps function declarations, class methods, static methods and arrows', () => {
    const { exports, events } = load(
      [
        'class Pricing {',
        '  discount(total) { return total * 0.1; }',
        '  static round(n) { return Math.round(n); }',
        '}',
        'function total(a, b) { return a + b; }',
        'const double = (n) => n * 2;',
        'module.exports = { Pricing, total, double };',
      ].join('\n'),
    );
    const { Pricing, total, double } = exports as {
      Pricing: { new (): { discount: (t: number) => number }; round: (n: number) => number };
      total: (a: number, b: number) => number;
      double: (n: number) => number;
    };
    expect(new Pricing().discount(100)).toBe(10);
    expect(Pricing.round(2.4)).toBe(2);
    expect(total(1, 2)).toBe(3);
    expect(double(4)).toBe(8);
    expect(events.filter((e) => e.kind === 'enter')).toEqual([
      { kind: 'enter', name: 'Pricing.discount', line: 2 },
      { kind: 'enter', name: 'Pricing.round', line: 3 },
      { kind: 'enter', name: 'total', line: 5 },
      { kind: 'enter', name: 'double', line: 6 },
    ]);
  });

  it('records a throw and rethrows the very same error', () => {
    const { exports, events } = load(
      'module.exports = function boom() { throw new TypeError("x"); };',
    );
    const boom = exports as unknown as () => void;
    let caught: unknown;
    try {
      boom();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TypeError);
    expect(events.map((e) => e.kind)).toEqual(['enter', 'throw', 'exit']);
    expect(events[1]?.error).toBe(caught);
  });

  it('ends an async step only when its work is done', async () => {
    const { exports, events } = load(
      [
        'async function inner() { await null; return 1; }',
        'function outer() { return inner().then((n) => n + 1); }',
        'module.exports = { outer };',
      ].join('\n'),
    );
    const outer = (exports as { outer: () => Promise<number> }).outer;
    await expect(outer()).resolves.toBe(2);
    expect(events.map((e) => `${e.kind}:${e.name}`)).toEqual([
      'enter:outer',
      'enter:inner',
      'exit:inner',
      'enter:(anonymous)',
      'exit:(anonymous)',
      'exit:outer',
    ]);
  });

  it('keeps "use strict" directives in force', () => {
    const { exports } = load(
      [
        '"use strict";',
        'module.exports = function strictThis() { "use strict"; return this; };',
      ].join('\n'),
    );
    expect((exports as unknown as () => unknown)()).toBeUndefined();
  });

  it('leaves getters, setters, constructors and generators unwrapped', () => {
    const { exports, events } = load(
      [
        'class User {',
        '  constructor(name) { this._name = name; }',
        '  get name() { return this._name; }',
        '  set name(v) { this._name = v; }',
        '  *ids() { yield 1; }',
        '}',
        'module.exports = User;',
      ].join('\n'),
    );
    const User = exports as unknown as new (name: string) => {
      name: string;
      ids: () => Iterator<number>;
    };
    const user = new User('Ada');
    user.name = 'Grace';
    expect(user.name).toBe('Grace');
    expect([...{ [Symbol.iterator]: () => user.ids() }]).toEqual([1]);
    expect(events).toEqual([]);
  });

  it('skips compiler-generated code that has no original position', () => {
    const { exports, events } = load(
      [
        'var helper = function () { return 1; };',
        'module.exports = function userCode() { return helper(); };',
      ].join('\n'),
      { ...OPTIONS, originFor: (line) => (line === 1 ? null : { line }) },
    );
    expect((exports as unknown as () => number)()).toBe(1);
    expect(events.map((e) => e.name)).toEqual(['userCode', 'userCode']);
  });

  it('maps positions after multi-byte characters correctly', () => {
    const { events, exports } = load(
      ['const greeting = "héllo wörld ✓";', 'module.exports = () => greeting;'].join('\n'),
    );
    expect((exports as unknown as () => string)()).toBe('héllo wörld ✓');
    expect(events[0]).toEqual({ kind: 'enter', name: 'exports', line: 2 });
  });

  it('returns null when the code cannot be parsed', () => {
    expect(wrapFunctions('function (', OPTIONS)).toBeNull();
  });

  // Shapes from minified or hand-written code that once produced invalid output.
  it('handles a return with no space before the closing brace', () => {
    const { exports } = load('module.exports=function f(){return 1}');
    expect((exports as unknown as () => number)()).toBe(1);
  });

  it('handles directives written without a semicolon', () => {
    const { exports } = load(
      '"use strict"\nmodule.exports = function g() { "use strict"\n return this }',
    );
    expect((exports as unknown as () => unknown)()).toBeUndefined();
  });

  it('never clashes with user names that look like its own variables', () => {
    const { exports } = load(
      'module.exports = function shadowing(__pt$, __pte$) { return [__pt$, __pte$]; };',
    );
    expect((exports as unknown as (a: string, b: string) => string[])('a', 'b')).toEqual([
      'a',
      'b',
    ]);
  });

  it('keeps a shebang as the first line', () => {
    const wrapped = wrapFunctions('#!/usr/bin/env node\nfunction main() { return 1; }', OPTIONS);
    expect(wrapped?.startsWith('#!/usr/bin/env node\n')).toBe(true);
    expect(wrapped).toContain('__pathlightTracker.enter("main"');
  });
});
