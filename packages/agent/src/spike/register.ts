// Spike entry for task 1.1: `node --require <this file> app.js` prints an indented step tree.
import path from 'node:path';

import { addHook } from 'pirates';

import { instrument } from './hook';

const AGENT_ROOT = path.resolve(__dirname, '..', '..');
const NODE_MODULES = `${path.sep}node_modules${path.sep}`;

function warn(code: string, context: string): void {
  process.stderr.write(`[pathlight-tracker] ${code} ${context}\n`);
}

try {
  addHook(
    (code, filename) =>
      instrument(code, filename, {
        projectRoot: process.cwd(),
        runtimePath: path.join(__dirname, 'runtime.js'),
        warn,
      }),
    {
      exts: ['.js'],
      matcher: (filename) => !filename.includes(NODE_MODULES) && !filename.startsWith(AGENT_ROOT),
    },
  );
} catch (error) {
  warn('HOOK_FAILED', error instanceof Error ? error.message : 'unknown');
}
