// Loads settings from defaults → pathlight-tracker.config.json → env → CLI flags, remembering
// where each value came from (`architecture.md` §8, `api-spec.md` §5.2 `GET /config`).
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  CONFIG_FILE,
  SETTING_DEFAULTS,
  SETTING_KEYS,
  SETTING_SCHEMAS,
  envName,
  fromText,
} from '@pathlight-tracker/protocol';
import type { SettingKey, Settings } from '@pathlight-tracker/protocol';

export type Source = 'default' | 'config-file' | 'env' | 'cli';

export type ResolvedConfig = { [K in SettingKey]: { value: Settings[K]; source: Source } };

/** Something the user should fix; the collector still starts (`user-flows.md` §7). */
export interface ConfigWarning {
  code: 'CONFIG_FILE_INVALID' | 'CONFIG_UNKNOWN_KEY' | 'CONFIG_INVALID_VALUE';
  message: string;
}

export interface LoadOptions {
  projectRoot: string;
  env?: Record<string, string | undefined>;
  /** Flag values as text, keyed by setting (`--port 4000` → `{ port: '4000' }`). */
  flags?: Partial<Record<SettingKey, string>>;
  readFile?: (file: string) => string;
}

export { CONFIG_FILE };

/** "Unexpected token } in JSON at position 42" → the line containing position 42. */
function lineOf(text: string, error: unknown): number | null {
  const position = /position (\d+)/.exec(error instanceof Error ? error.message : '')?.[1];
  if (position === undefined) return null;
  return text.slice(0, Number(position)).split('\n').length;
}

function readConfigFile(
  file: string,
  read: (file: string) => string,
  warnings: ConfigWarning[],
): Record<string, unknown> {
  let text: string;
  try {
    text = read(file);
  } catch {
    return {}; // the file is optional
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('the top level must be an object');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    const line = lineOf(text, error);
    warnings.push({
      code: 'CONFIG_FILE_INVALID',
      message: `${file}${line === null ? '' : `:${line}`}: ${error instanceof Error ? error.message : 'invalid JSON'}; using defaults for this file`,
    });
    return {};
  }
}

export function loadConfig(options: LoadOptions): {
  config: ResolvedConfig;
  warnings: ConfigWarning[];
} {
  const warnings: ConfigWarning[] = [];
  const read = options.readFile ?? ((file: string) => readFileSync(file, 'utf8'));
  const file = path.join(options.projectRoot, CONFIG_FILE);
  const fileValues = readConfigFile(file, read, warnings);
  for (const key of Object.keys(fileValues)) {
    if (!(SETTING_KEYS as string[]).includes(key)) {
      warnings.push({
        code: 'CONFIG_UNKNOWN_KEY',
        message: `${CONFIG_FILE}: unknown key "${key}" ignored`,
      });
    }
  }

  const env = options.env ?? process.env;
  const config = {} as Record<SettingKey, { value: unknown; source: Source }>;
  for (const key of SETTING_KEYS) {
    let resolved: { value: unknown; source: Source } = {
      value: SETTING_DEFAULTS[key],
      source: 'default',
    };
    const candidates: { source: Source; raw: unknown; label: string }[] = [];
    if (key in fileValues)
      candidates.push({
        source: 'config-file',
        raw: fileValues[key],
        label: `${CONFIG_FILE} "${key}"`,
      });
    const fromEnv = env[envName(key)];
    if (fromEnv !== undefined)
      candidates.push({ source: 'env', raw: fromText(key, fromEnv), label: envName(key) });
    const fromFlag = options.flags?.[key];
    if (fromFlag !== undefined)
      candidates.push({ source: 'cli', raw: fromText(key, fromFlag), label: `--${key}` });

    // Higher-precedence sources come later; an invalid one is skipped with a warning.
    for (const candidate of candidates) {
      const result = SETTING_SCHEMAS[key].safeParse(candidate.raw);
      if (result.success) {
        resolved = { value: result.data, source: candidate.source };
      } else {
        warnings.push({
          code: 'CONFIG_INVALID_VALUE',
          message: `${candidate.label}: invalid value (${result.error.issues[0]?.message ?? 'invalid'}); using the ${resolved.source} value instead`,
        });
      }
    }
    config[key] = resolved;
  }
  return { config: config as ResolvedConfig, warnings };
}

/** Just the values, for code that doesn't care where they came from. */
export function values(config: ResolvedConfig): Settings {
  const plain = {} as Record<SettingKey, unknown>;
  for (const key of SETTING_KEYS) plain[key] = config[key].value;
  return plain as Settings;
}
