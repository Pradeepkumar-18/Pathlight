// The agent's settings (`architecture.md` §8): defaults → `pathlight-tracker.config.json` → env.
// The CLI sets the collector address and token; everything else uses the shared definitions in
// `@pathlight-tracker/protocol`, so the agent reads a setting exactly like the collector does.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  CONFIG_FILE,
  SETTING_DEFAULTS,
  SETTING_SCHEMAS,
  envName,
  fromText,
} from '@pathlight-tracker/protocol';
import type { SettingKey, Settings } from '@pathlight-tracker/protocol';

export const AGENT_SETTING_KEYS = [
  'disabled',
  'include',
  'exclude',
  'redactKeys',
  'maxDepth',
  'maxArray',
  'maxString',
  'maxSteps',
  'agentLogLevel',
  'allowProduction',
] as const satisfies readonly SettingKey[];

type AgentSettingKey = (typeof AGENT_SETTING_KEYS)[number];

export type AgentConfig = Pick<Settings, AgentSettingKey> & {
  /** `PATHLIGHT_TRACKER_COLLECTOR_URL`, set by the CLI. */
  collectorUrl: string | null;
  /** `PATHLIGHT_TRACKER_TOKEN`, set by the CLI. Never logged. */
  token: string | null;
};

export interface ConfigProblem {
  code: 'CONFIG_INVALID_VALUE' | 'CONFIG_FILE_INVALID';
  message: string;
}

export interface LoadAgentConfigOptions {
  env: NodeJS.ProcessEnv;
  cwd: string;
  /** Reads the config file; returns null when there is none. */
  readFile?: (file: string) => string | null;
}

function readIfPresent(file: string): string | null {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function fileValues(
  text: string | null,
  problems: ConfigProblem[],
): Partial<Record<SettingKey, unknown>> {
  if (text === null) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed))
      return parsed as Partial<Record<SettingKey, unknown>>;
  } catch {
    // Reported below.
  }
  problems.push({
    code: 'CONFIG_FILE_INVALID',
    message: `${CONFIG_FILE} is not a JSON object; using defaults and env vars.`,
  });
  return {};
}

/**
 * Reads the settings once at startup (a single small synchronous read, before any user file
 * loads). Invalid values keep the lower-precedence value and are reported, never thrown.
 */
export function loadAgentConfig(options: LoadAgentConfigOptions): {
  config: AgentConfig;
  problems: ConfigProblem[];
} {
  const problems: ConfigProblem[] = [];
  const read = options.readFile ?? readIfPresent;
  const file = fileValues(read(path.join(options.cwd, CONFIG_FILE)), problems);
  const settings: Partial<Record<AgentSettingKey, unknown>> = {};

  for (const key of AGENT_SETTING_KEYS) {
    let value: unknown = SETTING_DEFAULTS[key];
    const candidates: [string, unknown][] = [];
    if (key in file) candidates.push([`${CONFIG_FILE} "${key}"`, file[key]]);
    const fromEnv = options.env[envName(key)];
    if (fromEnv !== undefined) candidates.push([envName(key), fromText(key, fromEnv)]);
    for (const [label, raw] of candidates) {
      const result = SETTING_SCHEMAS[key].safeParse(raw);
      if (result.success) value = result.data;
      else
        problems.push({
          code: 'CONFIG_INVALID_VALUE',
          message: `${label} is not valid; keeping ${JSON.stringify(value)}.`,
        });
    }
    settings[key] = value;
  }

  const text = (name: string): string | null => {
    const value = options.env[name]?.trim();
    return value ? value : null;
  };
  return {
    config: {
      ...(settings as Pick<Settings, AgentSettingKey>),
      collectorUrl: text('PATHLIGHT_TRACKER_COLLECTOR_URL'),
      token: text('PATHLIGHT_TRACKER_TOKEN'),
    },
    problems,
  };
}
