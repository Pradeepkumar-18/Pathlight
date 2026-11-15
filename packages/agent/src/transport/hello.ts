// The first message on `/agent` (`api-spec.md` §11.1). The framework is still unknown here: the
// app hasn't loaded yet (`request.start` carries it later).
import path from 'node:path';

import { PROTOCOL_VERSION } from '@pathlight-tracker/protocol';
import type { HelloMessage } from '@pathlight-tracker/protocol';

import { AGENT_VERSION } from '../version';

/** `node dist/main.js` rather than the full path of the Node binary and the script. */
function commandLine(argv: string[], cwd: string): string | null {
  const [binary, ...rest] = argv;
  if (binary === undefined) return null;
  const parts = [path.basename(binary, path.extname(binary))];
  for (const part of rest)
    parts.push(path.isAbsolute(part) ? path.relative(cwd, part) || '.' : part);
  return parts.join(' ');
}

export function buildHello(cwd: string, argv: string[] = process.argv): HelloMessage {
  return {
    type: 'hello',
    v: PROTOCOL_VERSION,
    pid: process.pid,
    nodeVersion: process.version,
    agentVersion: AGENT_VERSION,
    framework: 'unknown',
    command: commandLine(argv, cwd),
    cwd,
  };
}
