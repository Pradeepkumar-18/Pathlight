import { loadSourceInfo } from './source-map';
import type { ReadFile } from './source-map';
import { wrapFunctions } from './wrap';

export type Warn = (code: string, context: string) => void;

/** A failing warning (e.g. a closed stderr) must not stop the file from loading. */
function safeWarn(warn: Warn, code: string, context: string): void {
  try {
    warn(code, context);
  } catch {
    // Nothing left to report to; the app keeps loading.
  }
}

/** Default include `src/**` minus tests (`architecture.md` §8 defaults). */
export function shouldInstrument(originalFile: string): boolean {
  if (!originalFile.startsWith('src/')) return false;
  return !/\.(spec|test)\.[cm]?[jt]sx?$/.test(originalFile);
}

/**
 * Returns the code to load for `filename`: wrapped when its original source is user code,
 * otherwise (or on any failure) the original code, so the app always loads.
 */
export function instrument(
  code: string,
  filename: string,
  options: { projectRoot: string; runtimePath: string; warn: Warn; readFile?: ReadFile },
): string {
  try {
    const info = loadSourceInfo(code, filename, options.projectRoot, options.readFile);
    if (!shouldInstrument(info.originalFile)) return code;
    if (!info.hasSourceMap) safeWarn(options.warn, 'NO_SOURCE_MAP', info.originalFile);
    const wrapped = wrapFunctions(code, {
      runtimePath: options.runtimePath,
      file: info.originalFile,
      originFor: info.originFor,
    });
    if (wrapped === null) {
      safeWarn(options.warn, 'TRANSFORM_FAILED', info.originalFile);
      return code;
    }
    return wrapped;
  } catch (error) {
    safeWarn(
      options.warn,
      'INSTRUMENT_ERROR',
      `${filename}: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    return code;
  }
}
