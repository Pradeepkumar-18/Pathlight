// Collector entry points; the CLI itself is `src/cli/main.ts` (bin `pathlight-tracker`).
export { createProgram } from './cli/program';
export { loadConfig, values } from './config/load';
export type { ConfigWarning, ResolvedConfig, Source } from './config/load';
