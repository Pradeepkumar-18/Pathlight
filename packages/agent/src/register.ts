// Entry point for `--require @pathlight-tracker/agent` (set in NODE_OPTIONS by the CLI). It must
// never throw during the app's startup: anything unexpected is reported once and the app runs
// untraced.
import { startAgent } from './agent';

try {
  startAgent({ env: process.env, cwd: process.cwd() });
} catch (error) {
  try {
    process.stderr.write(
      `[pathlight-tracker] AGENT_START_FAILED ${error instanceof Error ? error.constructor.name : typeof error}; your app runs untraced.\n`,
    );
  } catch {
    // Nowhere left to report it.
  }
}
