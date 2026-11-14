// Every setting, its default and how to read it (`architecture.md` §8).
import { z } from 'zod';

const logLevel = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']);
const positiveInt = z.number().int().positive();

/**
 * One schema per setting, strict on purpose (no coercion: `z.coerce.boolean()` would read
 * "false" as true). Text from env vars and flags is converted by `fromText` first.
 */
export const SETTINGS = {
  // Read by the agent (passed through the environment by the CLI).
  disabled: z.boolean(),
  include: z.array(z.string().min(1)).min(1),
  exclude: z.array(z.string().min(1)),
  redactKeys: z.array(z.string().min(1)),
  maxDepth: positiveInt,
  maxArray: positiveInt,
  maxString: positiveInt,
  maxSteps: positiveInt,
  agentLogLevel: logLevel,
  allowProduction: z.boolean(),
  // Read by the collector.
  /** `null` means the fixed default port, chosen in task 2.7 (decision 0015). */
  port: z.number().int().min(1).max(65535).nullable(),
  dbPath: z.string().min(1),
  retention: positiveInt,
  trashTtlHours: positiveInt,
  openBrowser: z.boolean(),
  logLevel,
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type Settings = { [K in SettingKey]: z.infer<(typeof SETTINGS)[K]> };

export const DEFAULTS: Settings = {
  disabled: false,
  include: ['src/**'],
  exclude: ['**/*.spec.ts', '**/*.test.ts'],
  // Extra keys only: the agent always applies its built-in list (architecture.md §8).
  redactKeys: [],
  maxDepth: 3,
  maxArray: 10,
  maxString: 200,
  maxSteps: 5000,
  agentLogLevel: 'warn',
  allowProduction: false,
  port: null,
  dbPath: '.pathlight-tracker/traces.db',
  retention: 100,
  trashTtlHours: 72,
  openBrowser: true,
  logLevel: 'info',
};

export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];

const LIST_KEYS = new Set<SettingKey>(['include', 'exclude', 'redactKeys']);
const BOOLEAN_KEYS = new Set<SettingKey>(['disabled', 'allowProduction', 'openBrowser']);
const NUMBER_KEYS = new Set<SettingKey>([
  'maxDepth',
  'maxArray',
  'maxString',
  'maxSteps',
  'port',
  'retention',
  'trashTtlHours',
]);

/** `maxDepth` → `PATHLIGHT_TRACKER_MAX_DEPTH`. */
export function envName(key: SettingKey): string {
  return `PATHLIGHT_TRACKER_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`;
}

/** Turns the text of an env var or flag into the shape the schema expects. */
export function fromText(key: SettingKey, text: string): unknown {
  if (LIST_KEYS.has(key)) {
    return text
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }
  if (BOOLEAN_KEYS.has(key)) {
    const normalised = text.trim().toLowerCase();
    if (['1', 'true', 'yes'].includes(normalised)) return true;
    if (['0', 'false', 'no', ''].includes(normalised)) return false;
    return text; // fails validation below, so the lower-precedence value is kept
  }
  if (NUMBER_KEYS.has(key)) {
    // Only plain numbers convert; anything else ("", "12abc") stays text and fails validation.
    return /^\s*-?\d+(\.\d+)?\s*$/.test(text) ? Number(text) : text;
  }
  return text.trim();
}
