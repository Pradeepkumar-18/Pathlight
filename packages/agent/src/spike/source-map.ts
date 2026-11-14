import fs from 'node:fs';
import path from 'node:path';

import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping';

import type { Origin } from './wrap';

export interface SourceInfo {
  /** Original file relative to the project root, with `/` separators. */
  originalFile: string;
  hasSourceMap: boolean;
  originFor: (line: number, column: number) => Origin | null;
}

export type ReadFile = (file: string) => string;

const readUtf8: ReadFile = (file) => fs.readFileSync(file, 'utf8');
const MAP_COMMENT = /\/\/[#@] sourceMappingURL=([^\s'"]+)\s*$/;

function toProjectPath(file: string, projectRoot: string): string {
  return path.relative(projectRoot, file).split(path.sep).join('/');
}

function readMap(
  code: string,
  filename: string,
  readFile: ReadFile,
): { json: string; mapFile: string } | null {
  const url = MAP_COMMENT.exec(code.trimEnd())?.[1];
  if (!url) return null;
  const inline = /^data:application\/json[^,]*;base64,(.*)$/.exec(url);
  if (inline?.[1])
    return { json: Buffer.from(inline[1], 'base64').toString('utf8'), mapFile: filename };
  const mapFile = path.resolve(path.dirname(filename), decodeURIComponent(url));
  return { json: readFile(mapFile), mapFile };
}

/**
 * Finds the original file (through the source map, decision 0009) and a lookup from compiled
 * positions to original lines. Without a map, the compiled file stands in for the original.
 */
export function loadSourceInfo(
  code: string,
  filename: string,
  projectRoot: string,
  readFile: ReadFile = readUtf8,
): SourceInfo {
  const fallback: SourceInfo = {
    originalFile: toProjectPath(filename, projectRoot),
    hasSourceMap: false,
    originFor: (line) => ({ line }),
  };
  const found = readMap(code, filename, readFile);
  if (!found) return fallback;
  const raw = JSON.parse(found.json) as { sources?: string[]; sourceRoot?: string };
  const source = raw.sources?.[0];
  if (!source) return fallback;
  const map = new TraceMap(found.json);
  const original = path.resolve(path.dirname(found.mapFile), raw.sourceRoot ?? '', source);
  return {
    originalFile: toProjectPath(original, projectRoot),
    hasSourceMap: true,
    originFor: (line, column) => {
      const position = originalPositionFor(map, { line, column });
      return position.line === null ? null : { line: position.line };
    },
  };
}
