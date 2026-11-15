// `error.stack` text (already mapped to `.ts` by the agent) → `StackFrame[]` (`api-spec.md` §4.7).
import type { StackFrame } from '@pathlight-tracker/protocol';

const WITH_NAME = /^\s*at (?:async )?(.+?) \((.+):(\d+):(\d+)\)\s*$/;
const WITHOUT_NAME = /^\s*at (?:async )?(.+):(\d+):(\d+)\s*$/;

export function parseStack(stack: string | undefined): StackFrame[] {
  if (!stack) return [];
  const frames: StackFrame[] = [];
  for (const line of stack.split('\n')) {
    const named = WITH_NAME.exec(line);
    const bare = named ? null : WITHOUT_NAME.exec(line);
    const parts = named
      ? { fn: named[1] ?? null, file: named[2], line: named[3], column: named[4] }
      : bare
        ? { fn: null, file: bare[1], line: bare[2], column: bare[3] }
        : null;
    if (!parts?.file) continue;
    frames.push({
      fn: parts.fn,
      file: parts.file,
      line: Number(parts.line),
      column: Number(parts.column),
      // Node internals and libraries are collapsed in the UI.
      internal: parts.file.startsWith('node:') || parts.file.includes('node_modules'),
    });
  }
  return frames;
}
