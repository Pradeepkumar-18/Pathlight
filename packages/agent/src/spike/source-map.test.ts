import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadSourceInfo } from './source-map';

const ROOT = path.resolve('/project');
const COMPILED = path.join(ROOT, 'dist', 'orders', 'orders.service.js');
// Line 1 → line 1, line 2 → line 3, line 3 → line 7 of the original.
const MAP = JSON.stringify({
  version: 3,
  file: 'orders.service.js',
  sources: ['../../src/orders/orders.service.ts'],
  names: [],
  mappings: 'AAAA;AAEA;AAIA',
});

describe('loadSourceInfo', () => {
  it('finds the original .ts file and lines through a source map file', () => {
    const code = 'a;\nb;\nc;\n//# sourceMappingURL=orders.service.js.map';
    const info = loadSourceInfo(code, COMPILED, ROOT, (file) => {
      expect(file).toBe(`${COMPILED}.map`);
      return MAP;
    });
    expect(info.originalFile).toBe('src/orders/orders.service.ts');
    expect(info.hasSourceMap).toBe(true);
    expect(info.originFor(2, 0)).toEqual({ line: 3 });
    expect(info.originFor(3, 0)).toEqual({ line: 7 });
  });

  it('reads an inline base64 source map', () => {
    const inline = Buffer.from(MAP).toString('base64');
    const code = `a;\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${inline}`;
    const info = loadSourceInfo(code, COMPILED, ROOT, () => {
      throw new Error('should not read a file');
    });
    expect(info.originalFile).toBe('src/orders/orders.service.ts');
  });

  it('falls back to the compiled path when there is no source map', () => {
    const info = loadSourceInfo('a;', COMPILED, ROOT);
    expect(info).toMatchObject({
      originalFile: 'dist/orders/orders.service.js',
      hasSourceMap: false,
    });
    expect(info.originFor(4, 2)).toEqual({ line: 4 });
  });
});
