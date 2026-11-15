import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AgentEvent } from '@pathlight-tracker/protocol';

import { startAgent, stopAgentForTests } from '../agent';
import type { Agent } from '../agent';
import type { WrapOptions } from '../transform/wrap';
import { createInstrumenter, installLoader } from './loader';

let root: string;
let agent: Agent;
let sent: AgentEvent[];
const removers: (() => void)[] = [];

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'pt-loader-'));
  sent = [];
  agent = startAgent({
    env: { PATHLIGHT_TRACKER_COLLECTOR_URL: 'ws://x', PATHLIGHT_TRACKER_TOKEN: 't' },
    cwd: root,
    readFile: () => null,
    write: () => undefined,
    createSink: () => ({ send: (event) => sent.push(event) }),
  }) as Agent;
});

afterEach(() => {
  removers.splice(0).forEach((remove) => remove());
  stopAgentForTests();
  rmSync(root, { recursive: true, force: true });
});

/** A stand-in transform: marks the file so the test can see it was transformed. */
const marking = (code: string, options: WrapOptions) =>
  `${code}\nmodule.exports.tracedAs = ${JSON.stringify(options.file)};`;

/** Compiled code with an inline source map pointing at `src/<name>.ts`. */
function compiled(name: string, body: string): string {
  const map = {
    version: 3,
    file: `${name}.js`,
    sources: [`../../src/${name}.ts`],
    names: [],
    mappings: 'AAAA',
  };
  return `${body}\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(map)).toString('base64')}`;
}

describe('which files are instrumented', () => {
  const instrument = () =>
    createInstrumenter(agent, { projectRoot: root, runtimePath: 'rt', transform: marking });

  it('matches the original .ts path from the source map, not the compiled path', () => {
    const code = compiled('orders', 'module.exports = {};');
    const out = instrument()(code, path.join(root, 'dist', 'src', 'orders.js'));
    expect(out).toContain('tracedAs = "src/orders.ts"');
    expect(sent).toEqual([]);
  });

  it('leaves excluded and non-included files alone', () => {
    const spec = compiled('orders.spec', 'module.exports = {};');
    expect(instrument()(spec, path.join(root, 'dist', 'src', 'orders.spec.js'))).toBe(spec);
    const outside = 'module.exports = {};';
    expect(instrument()(outside, path.join(root, 'scripts', 'seed.js'))).toBe(outside);
  });

  it('without a source map: matches on the compiled path and warns once per file', () => {
    const out = instrument()('module.exports = {};', path.join(root, 'src', 'plain.js'));
    expect(out).toContain('tracedAs = "src/plain.js"');
    expect(sent).toEqual([
      expect.objectContaining({
        e: 'warning',
        code: 'NO_SOURCE_MAP',
        file: 'src/plain.js',
        traceId: null,
      }),
    ]);
  });

  it('a file the transform gives up on loads as it is, with a warning', () => {
    const instrumenter = createInstrumenter(agent, {
      projectRoot: root,
      runtimePath: 'rt',
      transform: () => null,
    });
    const code = compiled('weird', 'module.exports = 1;');
    expect(instrumenter(code, path.join(root, 'dist', 'src', 'weird.js'))).toBe(code);
    expect(sent).toEqual([
      expect.objectContaining({ code: 'FILE_NOT_TRACED', file: 'src/weird.ts' }),
    ]);
  });
});

describe('the module hook', () => {
  function write(file: string, code: string): string {
    const full = path.join(root, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, code);
    return full;
  }

  it('wraps user files in memory and loads a file whose transform fails exactly as it is', () => {
    const good = write('src/good.js', 'module.exports = { value: 1 };');
    const broken = write('src/broken.js', 'module.exports = { value: 2 };');
    const library = write('node_modules/lib/index.js', 'module.exports = { value: 3 };');
    removers.push(
      installLoader(agent, {
        projectRoot: root,
        runtimePath: 'rt',
        transform: (code, options) => {
          if (options.file === 'src/broken.js') throw new Error('transform crashed');
          return marking(code, options);
        },
      }),
    );
    const load = createRequire(path.join(root, 'index.js'));
    expect(load(good)).toEqual({ value: 1, tracedAs: 'src/good.js' });
    // The deliberately broken transform: the file still loads, untouched, and the app goes on.
    expect(load(broken)).toEqual({ value: 2 });
    expect(agent.safety.internalErrorCount).toBe(1);
    // Libraries are never wrapped.
    expect(load(library)).toEqual({ value: 3 });
  });

  it('a file with a real syntax error fails exactly as it would without the agent', () => {
    const broken = write('src/syntax.js', 'module.exports = {;');
    let plain: unknown;
    try {
      createRequire(path.join(root, 'index.js'))(broken);
    } catch (error) {
      plain = error;
    }
    delete createRequire(path.join(root, 'index.js')).cache[broken];
    removers.push(installLoader(agent, { projectRoot: root, runtimePath: 'rt' }));
    let traced: unknown;
    try {
      createRequire(path.join(root, 'index.js'))(broken);
    } catch (error) {
      traced = error;
    }
    expect(traced).toBeInstanceOf(SyntaxError);
    expect((traced as Error).message).toBe((plain as Error).message);
  });
});
