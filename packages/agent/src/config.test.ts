import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CONFIG_FILE, SETTING_DEFAULTS } from '@pathlight-tracker/protocol';

import { loadAgentConfig } from './config';

const CWD = path.resolve('/project');

function load(env: NodeJS.ProcessEnv, file: string | null = null) {
  return loadAgentConfig({
    env,
    cwd: CWD,
    readFile: (name) => (name === path.join(CWD, CONFIG_FILE) ? file : null),
  });
}

describe('agent config', () => {
  it('uses the shared defaults when nothing is set', () => {
    const { config, problems } = load({});
    expect(config).toMatchObject({
      disabled: SETTING_DEFAULTS.disabled,
      include: ['src/**'],
      maxDepth: 3,
      maxArray: 10,
      maxString: 200,
      maxSteps: 5000,
      agentLogLevel: 'warn',
      allowProduction: false,
      collectorUrl: null,
      token: null,
    });
    expect(problems).toEqual([]);
  });

  it('reads the config file, then lets env vars win', () => {
    const { config } = load(
      {
        PATHLIGHT_TRACKER_MAX_DEPTH: '5',
        PATHLIGHT_TRACKER_REDACT_KEYS: 'pin, ssn',
        PATHLIGHT_TRACKER_COLLECTOR_URL: 'ws://127.0.0.1:4777/agent',
        PATHLIGHT_TRACKER_TOKEN: 't'.repeat(43),
      },
      JSON.stringify({ maxDepth: 4, maxArray: 20, include: ['app/**'] }),
    );
    expect(config).toMatchObject({
      maxDepth: 5,
      maxArray: 20,
      include: ['app/**'],
      redactKeys: ['pin', 'ssn'],
      collectorUrl: 'ws://127.0.0.1:4777/agent',
      token: 't'.repeat(43),
    });
  });

  it('keeps the lower-precedence value when a value is invalid, and says so', () => {
    const { config, problems } = load(
      { PATHLIGHT_TRACKER_MAX_STRING: 'lots', PATHLIGHT_TRACKER_DISABLED: 'maybe' },
      JSON.stringify({ maxString: 50 }),
    );
    expect(config.maxString).toBe(50);
    expect(config.disabled).toBe(false);
    expect(problems.map((problem) => problem.code)).toEqual([
      'CONFIG_INVALID_VALUE',
      'CONFIG_INVALID_VALUE',
    ]);
  });

  it('reports a broken config file and carries on with env vars', () => {
    const { config, problems } = load({ PATHLIGHT_TRACKER_MAX_DEPTH: '2' }, '{ not json');
    expect(config.maxDepth).toBe(2);
    expect(problems).toEqual([expect.objectContaining({ code: 'CONFIG_FILE_INVALID' })]);
  });

  it('treats an empty collector address or token as missing', () => {
    const { config } = load({ PATHLIGHT_TRACKER_COLLECTOR_URL: ' ', PATHLIGHT_TRACKER_TOKEN: '' });
    expect(config.collectorUrl).toBeNull();
    expect(config.token).toBeNull();
  });
});
