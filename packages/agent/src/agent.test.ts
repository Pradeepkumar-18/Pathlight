import { afterEach, describe, expect, it } from 'vitest';

import { agentEventSchema } from '@pathlight-tracker/protocol';
import type { AgentEvent } from '@pathlight-tracker/protocol';

import { runningAgent, startAgent, stopAgentForTests } from './agent';
import type { Agent } from './agent';
import { INTERNAL_ERROR_LIMIT } from './safety/safety';

const CONNECTED = {
  PATHLIGHT_TRACKER_COLLECTOR_URL: 'ws://127.0.0.1:4777/agent',
  PATHLIGHT_TRACKER_TOKEN: 's'.repeat(43),
};

function start(env: NodeJS.ProcessEnv, install?: (agent: Agent) => void) {
  const lines: string[] = [];
  const sent: AgentEvent[] = [];
  const result = startAgent({
    env,
    cwd: process.cwd(),
    readFile: () => null,
    write: (text) => lines.push(text),
    createSink: () => ({ send: (event) => sent.push(event) }),
    install,
  });
  return { result, lines, sent };
}

afterEach(() => stopAgentForTests());

describe('starting the agent', () => {
  it('starts when the CLI passed the collector address and token', () => {
    const { result, lines } = start(CONNECTED);
    expect(typeof result).toBe('object');
    expect(runningAgent()).toBe(result);
    expect(lines).toEqual([]);
  });

  it('kill switch: loads but does nothing, silently', () => {
    const { result, lines } = start({ ...CONNECTED, PATHLIGHT_TRACKER_DISABLED: '1' });
    expect(result).toBe('kill-switch');
    expect(runningAgent()).toBeNull();
    expect(lines).toEqual([]);
  });

  it('production guard: refuses NODE_ENV=production and explains how to force it', () => {
    const { result, lines } = start({ ...CONNECTED, NODE_ENV: 'production' });
    expect(result).toBe('production');
    expect(lines.join('')).toContain('PRODUCTION_GUARD');
    expect(lines.join('')).toContain('PATHLIGHT_TRACKER_ALLOW_PRODUCTION=1');
  });

  it('runs in production only when forced', () => {
    const { result } = start({
      ...CONNECTED,
      NODE_ENV: 'production',
      PATHLIGHT_TRACKER_ALLOW_PRODUCTION: '1',
    });
    expect(typeof result).toBe('object');
  });

  it('stays off, with one warning, without a collector', () => {
    const { result, lines } = start({});
    expect(result).toBe('no-collector');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('NO_COLLECTOR');
  });

  it('runs once per process even when preloaded twice', () => {
    start(CONNECTED);
    expect(start(CONNECTED).result).toBe('already-running');
  });

  it('never prints the token', () => {
    const { lines } = start({ ...CONNECTED, PATHLIGHT_TRACKER_MAX_DEPTH: 'deep' });
    expect(lines.join('')).not.toContain(CONNECTED.PATHLIGHT_TRACKER_TOKEN);
  });
});

describe('internal errors', () => {
  it('a failing install never reaches the app', () => {
    const { result } = start(CONNECTED, () => {
      throw new Error('patch failed');
    });
    expect(typeof result).toBe('object');
    expect((result as Agent).safety.internalErrorCount).toBe(1);
  });

  it(`after ${INTERNAL_ERROR_LIMIT} errors the agent disables itself and sends agent.disabled`, () => {
    const { result, lines, sent } = start(CONNECTED);
    const agent = result as Agent;
    const userCode = () => {
      agent.safety.run(
        'ENTER_FAILED',
        () => {
          throw new TypeError('x');
        },
        undefined,
      );
      return 'user result';
    };
    for (let i = 0; i < INTERNAL_ERROR_LIMIT + 5; i += 1) expect(userCode()).toBe('user result');

    expect(agent.safety.disabled).toBe(true);
    expect(sent).toHaveLength(1);
    const event = agentEventSchema.parse(sent[0]);
    expect(event).toMatchObject({
      e: 'agent.disabled',
      traceId: null,
      internalErrorCount: INTERNAL_ERROR_LIMIT,
    });
    expect(lines.filter((line) => line.includes('AGENT_DISABLED'))).toHaveLength(1);
  });
});
