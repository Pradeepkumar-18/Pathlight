// Collector logging (`architecture.md` §10): pino to the console and to
// `.pathlight-tracker/logs/collector.<n>.log`, rotated by size. Entries carry a code and context
// (`requestId`, `pid`, `logId`), never captured values or tokens.
import path from 'node:path';

import pino from 'pino';
import type { DestinationStream, Logger, LevelWithSilent } from 'pino';
import pinoRoll from 'pino-roll';

export const LOG_DIR = 'logs';
export const LOG_FILE_SIZE = '10m';
/** Rotated files kept besides the current one. */
export const LOG_FILES_KEPT = 4;

/** Belt and braces: the code never logs these, and pino blanks them if a future change does. */
const REDACT_PATHS = [
  'token',
  '*.token',
  'authorization',
  '*.authorization',
  'headers',
  '*.headers',
  'req.headers',
];

export interface CollectorLogger {
  logger: Logger;
  /** Absolute path of the log folder, or null when only the console is used. */
  dir: string | null;
  close: () => Promise<void>;
}

export interface LoggerOptions {
  /** `.pathlight-tracker/` of the project. */
  storeDir: string;
  level: LevelWithSilent;
  /** Where console lines go; defaults to stderr so the app's stdout stays untouched. */
  console?: (text: string) => void;
}

interface Entry {
  level?: number;
  msg?: string;
  code?: string;
  logId?: string;
}

/**
 * One readable line per entry instead of JSON (pino-pretty isn't a dependency). Library chatter
 * (info without a code, e.g. Fastify's "listening") stays in the file only: the terminal shows
 * the app's output and Pathlight Tracker's own messages (`user-flows.md` §5).
 */
export function formatConsoleLine(line: string): string {
  let entry: Entry;
  try {
    entry = JSON.parse(line) as Entry;
  } catch {
    return line.endsWith('\n') ? line : `${line}\n`;
  }
  const level = entry.level ?? 30;
  if (level < 40 && entry.code === undefined) return '';
  const label = level >= 50 ? 'ERROR ' : level >= 40 ? 'WARN ' : '';
  const parts = [entry.code, entry.msg].filter((part) => part !== undefined && part !== '');
  const logId = entry.logId ? ` (logId ${entry.logId})` : '';
  return `[pathlight-tracker] ${label}${parts.join(' ')}${logId}\n`;
}

function consoleStream(write: (text: string) => void): DestinationStream {
  return {
    write: (line: string) => {
      const text = formatConsoleLine(line);
      if (text !== '') write(text);
    },
  };
}

export async function createLogger(options: LoggerOptions): Promise<CollectorLogger> {
  const write = options.console ?? ((text: string) => void process.stderr.write(text));
  const level = options.level === 'silent' ? 'info' : options.level;
  const dir = path.join(options.storeDir, LOG_DIR);
  const streams: pino.StreamEntry[] = [{ level, stream: consoleStream(write) }];
  let file: Awaited<ReturnType<typeof pinoRoll>> | null = null;
  let fileError: string | null = null;
  try {
    file = await pinoRoll({
      file: path.join(dir, 'collector'),
      extension: '.log',
      size: LOG_FILE_SIZE,
      limit: { count: LOG_FILES_KEPT },
      mkdir: true,
    });
    streams.push({ level, stream: file });
  } catch (error) {
    fileError = error instanceof Error ? error.message : 'unknown';
  }

  const logger = pino(
    {
      level: options.level,
      base: { pid: process.pid },
      redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    },
    pino.multistream(streams),
  );
  if (fileError !== null)
    logger.warn({ code: 'LOG_FILE_UNAVAILABLE' }, `Logging to the console only: ${fileError}`);

  return {
    logger,
    dir: file ? dir : null,
    close: async () => {
      if (!file) return;
      const stream = file;
      file = null;
      await new Promise<void>((resolve) => {
        stream.once('close', resolve);
        stream.once('error', resolve);
        stream.end();
      });
    },
  };
}
