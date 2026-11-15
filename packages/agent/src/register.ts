// Entry point for `--require @pathlight-tracker/agent` (set in NODE_OPTIONS by the CLI). It must
// never throw during the app's startup: anything unexpected is reported once and the app runs
// untraced.
import path from 'node:path';

import { startAgent } from './agent';
import { installLoader } from './loader/loader';
import { setRecorder } from './runtime/runtime';
import type { Recorder } from './runtime/runtime';
import { traceLogRecorder } from './runtime/trace-log';
import { buildHello } from './transport/hello';
import { createTransport } from './transport/transport';

try {
  const cwd = process.cwd();
  startAgent({
    env: process.env,
    cwd,
    createSink: ({ logger, safety }, { url, token }) =>
      createTransport({
        url,
        token,
        safety,
        logger,
        hello: () => buildHello(cwd),
      }),
    install: (agent) => {
      // Steps become events in task 3.7; until then a call records nothing.
      const recorder: Recorder = { enter: () => null, finish: () => undefined };
      setRecorder(
        agent.config.agentLogLevel === 'trace'
          ? traceLogRecorder(agent.logger, recorder)
          : recorder,
      );
      installLoader(agent, {
        projectRoot: cwd,
        runtimePath: path.join(__dirname, 'runtime', 'runtime.js'),
      });
    },
  });
} catch (error) {
  try {
    process.stderr.write(
      `[pathlight-tracker] AGENT_START_FAILED ${error instanceof Error ? error.constructor.name : typeof error}; your app runs untraced.\n`,
    );
  } catch {
    // Nowhere left to report it.
  }
}
