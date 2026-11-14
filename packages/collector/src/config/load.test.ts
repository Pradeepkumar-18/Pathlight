import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CONFIG_FILE, loadConfig, values } from './load';
import { DEFAULTS, envName } from './settings';

const ROOT = path.resolve('/project');

function load(options: {
  file?: string;
  env?: Record<string, string>;
  flags?: Record<string, string>;
}) {
  return loadConfig({
    projectRoot: ROOT,
    env: options.env ?? {},
    flags: options.flags,
    readFile: (file) => {
      expect(file).toBe(path.join(ROOT, CONFIG_FILE));
      if (options.file === undefined) throw new Error('ENOENT');
      return options.file;
    },
  });
}

describe('loadConfig', () => {
  it('uses the defaults when nothing is set', () => {
    const { config, warnings } = load({});
    expect(values(config)).toEqual(DEFAULTS);
    expect(config.retention).toEqual({ value: 100, source: 'default' });
    expect(warnings).toEqual([]);
  });

  it('applies config file < env < CLI flags, and records where each value came from', () => {
    const { config } = load({
      file: JSON.stringify({ retention: 50, maxDepth: 4, port: 4000, include: ['app/**'] }),
      env: { PATHLIGHT_TRACKER_RETENTION: '60', PATHLIGHT_TRACKER_PORT: '4100' },
      flags: { port: '4200' },
    });
    expect(config.maxDepth).toEqual({ value: 4, source: 'config-file' });
    expect(config.include).toEqual({ value: ['app/**'], source: 'config-file' });
    expect(config.retention).toEqual({ value: 60, source: 'env' });
    expect(config.port).toEqual({ value: 4200, source: 'cli' });
    expect(config.logLevel).toEqual({ value: 'info', source: 'default' });
  });

  it('reads lists and booleans from text', () => {
    const { config } = load({
      env: {
        PATHLIGHT_TRACKER_EXCLUDE: ' **/*.spec.ts , dist/** ',
        PATHLIGHT_TRACKER_OPEN_BROWSER: '0',
        PATHLIGHT_TRACKER_DISABLED: 'true',
      },
    });
    expect(config.exclude.value).toEqual(['**/*.spec.ts', 'dist/**']);
    expect(config.openBrowser).toEqual({ value: false, source: 'env' });
    expect(config.disabled).toEqual({ value: true, source: 'env' });
  });

  it('falls back to the next value, with a warning, when a value is invalid', () => {
    const { config, warnings } = load({
      file: JSON.stringify({ retention: 50, maxDepth: 'deep' }),
      env: { PATHLIGHT_TRACKER_RETENTION: 'lots', PATHLIGHT_TRACKER_OPEN_BROWSER: 'maybe' },
      flags: { port: '70000' },
    });
    expect(config.retention).toEqual({ value: 50, source: 'config-file' });
    expect(config.maxDepth).toEqual({ value: 3, source: 'default' });
    expect(config.openBrowser).toEqual({ value: true, source: 'default' });
    expect(config.port).toEqual({ value: null, source: 'default' });
    expect(warnings.map((w) => w.code)).toEqual(Array(4).fill('CONFIG_INVALID_VALUE'));
    const about = (text: string) => warnings.find((w) => w.message.includes(text))?.message ?? '';
    expect(about('"maxDepth"')).toContain('using the default value instead');
    expect(about('PATHLIGHT_TRACKER_RETENTION')).toContain('using the config-file value instead');
    expect(about('--port')).toContain('using the default value instead');
  });

  it('keeps going with defaults for the file when it is not valid JSON, naming the line', () => {
    const { config, warnings } = load({
      file: '{\n  "retention": 50,\n}',
      env: { PATHLIGHT_TRACKER_MAX_DEPTH: '5' },
    });
    expect(config.retention).toEqual({ value: 100, source: 'default' });
    expect(config.maxDepth).toEqual({ value: 5, source: 'env' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.code).toBe('CONFIG_FILE_INVALID');
    expect(warnings[0]?.message).toMatch(/pathlight-tracker\.config\.json:3:/);
  });

  it('warns about unknown keys and ignores them', () => {
    const { config, warnings } = load({ file: JSON.stringify({ retention: 20, colour: 'blue' }) });
    expect(config.retention.value).toBe(20);
    expect(warnings).toEqual([
      { code: 'CONFIG_UNKNOWN_KEY', message: `${CONFIG_FILE}: unknown key "colour" ignored` },
    ]);
  });

  it('names env vars with the PATHLIGHT_TRACKER_ prefix', () => {
    expect(envName('maxDepth')).toBe('PATHLIGHT_TRACKER_MAX_DEPTH');
    expect(envName('trashTtlHours')).toBe('PATHLIGHT_TRACKER_TRASH_TTL_HOURS');
    expect(envName('agentLogLevel')).toBe('PATHLIGHT_TRACKER_AGENT_LOG_LEVEL');
  });
});
