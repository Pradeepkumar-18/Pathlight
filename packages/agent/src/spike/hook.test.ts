import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { instrument, shouldInstrument } from './hook';

const ROOT = path.resolve('/project');

describe('shouldInstrument', () => {
  it('takes files under src/ and skips tests and everything else', () => {
    expect(shouldInstrument('src/orders/orders.service.ts')).toBe(true);
    expect(shouldInstrument('src/orders/orders.service.spec.ts')).toBe(false);
    expect(shouldInstrument('src/orders/orders.service.test.ts')).toBe(false);
    expect(shouldInstrument('dist/orders/orders.service.js')).toBe(false);
    expect(shouldInstrument('lib/util.ts')).toBe(false);
  });
});

describe('instrument', () => {
  const options = { projectRoot: ROOT, runtimePath: 'rt', warn: vi.fn() };

  it('wraps user code found through the source map', () => {
    const map = JSON.stringify({
      version: 3,
      sources: ['../src/a.ts'],
      names: [],
      mappings: 'AAAA',
    });
    const code = 'function a() { return 1; }\n//# sourceMappingURL=a.js.map';
    const result = instrument(code, path.join(ROOT, 'dist', 'a.js'), {
      ...options,
      readFile: () => map,
    });
    expect(result).toContain('__pathlightTracker.enter("a","src/a.ts",1)');
  });

  it('leaves files outside src/ untouched', () => {
    const code = 'function a() { return 1; }';
    expect(instrument(code, path.join(ROOT, 'dist', 'a.js'), options)).toBe(code);
  });

  it('loads the original code and warns when the file cannot be parsed', () => {
    const warn = vi.fn();
    const code = 'function (';
    expect(instrument(code, path.join(ROOT, 'src', 'broken.js'), { ...options, warn })).toBe(code);
    expect(warn).toHaveBeenCalledWith('TRANSFORM_FAILED', 'src/broken.js');
  });

  it('loads the original code when the source map is unreadable', () => {
    const warn = vi.fn();
    const code = 'a;\n//# sourceMappingURL=a.js.map';
    const result = instrument(code, path.join(ROOT, 'dist', 'a.js'), {
      ...options,
      warn,
      readFile: () => 'not json',
    });
    expect(result).toBe(code);
    expect(warn).toHaveBeenCalledWith('INSTRUMENT_ERROR', expect.stringContaining('a.js'));
  });
});
