// Starts the agent for this process (`architecture.md` §5 `register`, §9 production guard):
// reads the settings, honours the kill switch and the production guard, and sets up the
// fail-open safety net that every later hook and patch runs through.
import type { AgentEvent } from '@pathlight-tracker/protocol';

import { nowNsText } from './clock';
import { loadAgentConfig } from './config';
import type { AgentConfig, LoadAgentConfigOptions } from './config';
import { createAgentLogger } from './safety/logger';
import type { AgentLogger } from './safety/logger';
import { createSafety } from './safety/safety';
import type { Safety } from './safety/safety';

/** Where events go; the WebSocket transport (task 3.2) is the real one. */
export interface EventSink {
  send: (event: AgentEvent) => void;
}

export interface Agent {
  config: AgentConfig;
  logger: AgentLogger;
  safety: Safety;
  sink: EventSink;
  /** The running request's ID, for process-level events sent inside a request (task 3.8). */
  currentTraceId: () => string | null;
}

export type NotStarted = 'kill-switch' | 'production' | 'no-collector' | 'already-running';

export interface StartOptions extends LoadAgentConfigOptions {
  /** stderr by default. */
  write?: (text: string) => void;
  /** Builds the sink once the agent knows it will run (task 3.2 passes the transport). */
  createSink?: (agent: Omit<Agent, 'sink'>) => EventSink;
  /** Installs hooks and patches (later tasks); runs inside the safety net. */
  install?: (agent: Agent) => void;
  now?: () => number;
}

const RUNNING = Symbol.for('pathlight-tracker.agent');
type Global = typeof globalThis & { [RUNNING]?: Agent };

/** The agent running in this process, if any (one per process even if preloaded twice). */
export function runningAgent(): Agent | null {
  return (globalThis as Global)[RUNNING] ?? null;
}

export function stopAgentForTests(): void {
  delete (globalThis as Global)[RUNNING];
}

const NO_SINK: EventSink = { send: () => undefined };

export function startAgent(options: StartOptions): Agent | NotStarted {
  if (runningAgent()) return 'already-running';
  const { config, problems } = loadAgentConfig(options);
  const logger = createAgentLogger(config.agentLogLevel, options.write);
  for (const problem of problems) logger.warn(problem.code, problem.message);

  // Kill switch: the agent loads but does nothing (`architecture.md` §8).
  if (config.disabled) {
    logger.debug('AGENT_KILL_SWITCH', 'PATHLIGHT_TRACKER_DISABLED is set: not tracing.');
    return 'kill-switch';
  }
  if (options.env.NODE_ENV === 'production' && !config.allowProduction) {
    logger.warn(
      'PRODUCTION_GUARD',
      'NODE_ENV=production: tracing is off. Pathlight Tracker is for local development; set PATHLIGHT_TRACKER_ALLOW_PRODUCTION=1 to force it.',
    );
    return 'production';
  }
  if (config.collectorUrl === null || config.token === null) {
    logger.warn(
      'NO_COLLECTOR',
      'No collector address or token: start your app with `pathlight-tracker dev -- <command>`.',
    );
    return 'no-collector';
  }

  let agent: Agent | null = null;
  const traceId = () => agent?.currentTraceId() ?? null;
  const safety = createSafety({
    logger,
    now: options.now,
    onDisable: (reason, internalErrorCount) =>
      agent?.sink.send({
        e: 'agent.disabled',
        traceId: traceId(),
        ts: nowNsText(),
        reason,
        internalErrorCount,
      }),
  });
  const base = { config, logger, safety, currentTraceId: () => null };
  const sink = safety.run('SINK_FAILED', () => options.createSink?.(base) ?? NO_SINK, NO_SINK);
  agent = { ...base, sink };
  (globalThis as Global)[RUNNING] = agent;
  const started = agent;
  safety.run('INSTALL_FAILED', () => options.install?.(started), undefined);
  return agent;
}
