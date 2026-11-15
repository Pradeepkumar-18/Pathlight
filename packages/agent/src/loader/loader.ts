// The module hook (`architecture.md` §3b, §5 `loader`): every `.js` file the app loads passes
// through here. User files (include / exclude globs, matched on the original `.ts` path from the
// source map) are wrapped in memory, never on disk; everything else, and any file the transform
// can't handle, loads exactly as it is.
import path from 'node:path';

import { addHook } from 'pirates';

import type { Agent } from '../agent';
import { nowNsText } from '../clock';
import { wrapFunctions } from '../transform/wrap';
import { createMatcher } from './glob';
import { loadSourceInfo } from './source-map';
import type { ReadFile } from './source-map';

const NODE_MODULES = `${path.sep}node_modules${path.sep}`;
/** The agent's own files are never wrapped (it would trace itself). */
const AGENT_ROOT = path.resolve(__dirname, '..', '..');

export interface LoaderOptions {
  projectRoot: string;
  /** The runtime module wrapped code `require`s. */
  runtimePath: string;
  readFile?: ReadFile;
  /** For tests: the transform. */
  transform?: typeof wrapFunctions;
}

/** Decides and transforms one file; returns the code to load. */
export function createInstrumenter(agent: Agent, options: LoaderOptions) {
  const included = createMatcher(agent.config.include, agent.config.exclude);
  const transform = options.transform ?? wrapFunctions;
  const warn = (code: string, message: string, file: string) => {
    agent.logger.debug(code, `${file}: ${message}`);
    agent.sink.send({ e: 'warning', traceId: null, ts: nowNsText(), code, message, file });
  };

  return (code: string, filename: string): string =>
    agent.safety.run(
      'LOADER_FAILED',
      () => {
        const info = loadSourceInfo(code, filename, options.projectRoot, options.readFile);
        if (!included(info.originalFile)) return code;
        if (!info.hasSourceMap)
          warn(
            'NO_SOURCE_MAP',
            'No source map: matched and shown by its compiled path. Turn on "sourceMap" in tsconfig.json.',
            info.originalFile,
          );
        const wrapped = transform(code, {
          runtimePath: options.runtimePath,
          file: info.originalFile,
          originFor: info.originFor,
        });
        if (wrapped === null) {
          // Not an internal error: some code can't be wrapped safely, so it loads as it is.
          warn(
            'FILE_NOT_TRACED',
            'Could not be instrumented; it runs untraced.',
            info.originalFile,
          );
          return code;
        }
        agent.logger.debug('FILE_TRACED', info.originalFile);
        return wrapped;
      },
      code,
    );
}

/** Installs the hook for `.js` / `.cjs` files; returns a function that removes it. */
export function installLoader(agent: Agent, options: LoaderOptions): () => void {
  const instrument = createInstrumenter(agent, options);
  return addHook(instrument, {
    exts: ['.js', '.cjs'],
    ignoreNodeModules: true,
    matcher: (filename) => !filename.includes(NODE_MODULES) && !filename.startsWith(AGENT_ROOT),
  });
}
