import { describe, expect, it, vi } from 'vitest';

import { createAgentLogger } from './logger';
import { createSafety, INTERNAL_ERROR_LIMIT, INTERNAL_ERROR_WINDOW_MS } from './safety';

function setup(level: 'debug' | 'warn' = 'warn') {
  const lines: string[] = [];
  let clock = 1_000_000;
  const onDisable = vi.fn();
  const safety = createSafety({
    logger: createAgentLogger(level, (text) => lines.push(text)),
    onDisable,
    now: () => clock,
    pid: 4242,
  });
  return {
    safety,
    lines,
    onDisable,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

const boom = (): never => {
  throw new Error('secret value 1234');
};

describe('fail-open safety net', () => {
  it('never lets an internal error reach the caller', () => {
    const { safety } = setup();
    // What a wrapped user function looks like: agent work around the user's own code.
    const userFunction = (x: number) => x * 2;
    const traced = (x: number) => {
      safety.run('ENTER_FAILED', boom, undefined);
      const result = userFunction(x);
      safety.run('EXIT_FAILED', boom, undefined);
      return result;
    };
    expect(() => traced(21)).not.toThrow();
    expect(traced(21)).toBe(42);
    expect(safety.run('X', () => 'ok', 'fallback')).toBe('ok');
    expect(safety.run('X', boom, 'fallback')).toBe('fallback');
  });

  it('wraps agent callbacks so they cannot throw either', () => {
    const { safety } = setup();
    const callback = safety.callback('SOCKET_EVENT', (_data: string) => boom());
    expect(() => callback('x')).not.toThrow();
    expect(safety.internalErrorCount).toBe(1);
  });

  it(`turns itself off after ${INTERNAL_ERROR_LIMIT} internal errors within 60 s, once`, () => {
    const { safety, lines, onDisable } = setup();
    for (let i = 0; i < INTERNAL_ERROR_LIMIT - 1; i += 1)
      safety.run('ENTER_FAILED', boom, undefined);
    expect(safety.disabled).toBe(false);
    safety.run('EXIT_FAILED', boom, undefined);
    expect(safety.disabled).toBe(true);
    expect(onDisable).toHaveBeenCalledOnce();
    expect(onDisable).toHaveBeenCalledWith(
      `${INTERNAL_ERROR_LIMIT} internal errors within 60 s (last: EXIT_FAILED)`,
      INTERNAL_ERROR_LIMIT,
    );
    // One clear warning, and nothing more after that.
    for (let i = 0; i < 5; i += 1) safety.run('ENTER_FAILED', boom, undefined);
    expect(lines).toEqual([
      '[pathlight-tracker] AGENT_DISABLED Tracing turned off for process 4242 after internal errors. Your app is unaffected.\n',
    ]);
    expect(onDisable).toHaveBeenCalledOnce();
  });

  it('does no agent work once disabled', () => {
    const { safety } = setup();
    for (let i = 0; i < INTERNAL_ERROR_LIMIT; i += 1) safety.run('X', boom, undefined);
    const work = vi.fn(() => 'traced');
    expect(safety.run('X', work, 'untraced')).toBe('untraced');
    expect(work).not.toHaveBeenCalled();
  });

  it('only counts errors inside the 60 s window', () => {
    const { safety, advance } = setup();
    for (let i = 0; i < INTERNAL_ERROR_LIMIT * 3; i += 1) {
      safety.run('X', boom, undefined);
      advance(INTERNAL_ERROR_WINDOW_MS / (INTERNAL_ERROR_LIMIT - 2));
    }
    expect(safety.disabled).toBe(false);
    expect(safety.internalErrorCount).toBe(INTERNAL_ERROR_LIMIT * 3);
  });

  it('logs each internal error with its code and type only, never its message', () => {
    const { safety, lines } = setup('debug');
    safety.run('CAPTURE_FAILED', boom, undefined);
    expect(lines).toEqual(['[pathlight-tracker] INTERNAL_ERROR CAPTURE_FAILED (Error)\n']);
    expect(lines.join('')).not.toContain('1234');
  });
});
