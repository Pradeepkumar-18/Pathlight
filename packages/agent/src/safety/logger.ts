// The agent's own diagnostics (`architecture.md` §10): stderr, prefixed `[pathlight-tracker]`,
// no dependencies. Messages carry a code and context, never captured values or the token.
import type { Settings } from '@pathlight-tracker/protocol';

type Level = Settings['agentLogLevel'];

const ORDER: Record<Level, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: Number.POSITIVE_INFINITY,
};

export interface AgentLogger {
  debug: (code: string, message: string) => void;
  info: (code: string, message: string) => void;
  warn: (code: string, message: string) => void;
  error: (code: string, message: string) => void;
}

export function createAgentLogger(
  level: Level,
  write: (text: string) => void = (text) => void process.stderr.write(text),
): AgentLogger {
  const at =
    (lineLevel: Exclude<Level, 'silent'>) =>
    (code: string, message: string): void => {
      if (ORDER[lineLevel] < ORDER[level]) return;
      try {
        write(`[pathlight-tracker] ${code} ${message}\n`);
      } catch {
        // stderr closed or broken: there is nowhere left to report it, and the app must go on.
      }
    };
  return { debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') };
}
