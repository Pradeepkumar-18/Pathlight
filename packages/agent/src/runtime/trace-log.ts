// At `PATHLIGHT_TRACKER_AGENT_LOG_LEVEL=trace` every step is also written to stderr (one line on
// enter, one on finish). For debugging the agent itself; the behaviour corpus counts these lines
// to prove functions really ran through the agent.
import type { AgentLogger } from '../safety/logger';
import type { Recorder } from './runtime';

export function traceLogRecorder(logger: AgentLogger, next: Recorder): Recorder {
  return {
    enter: (site, self, args) => {
      logger.trace('STEP', `→ ${site.name} (${site.file}:${site.line})`);
      return next.enter(site, self, args);
    },
    finish: (probe, returned) => {
      logger.trace('STEP', `${probe.threw ? '✕' : '←'} ${probe.site.name}`);
      next.finish(probe, returned);
    },
  };
}
