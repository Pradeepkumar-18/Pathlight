#!/usr/bin/env node
// Entry point of the `pathlight-tracker` command.
import { createClearHandler } from './clear';
import { createDevHandler } from './dev';
import { createProgram, STUB_HANDLERS } from './program';
import type { CliIo } from './program';
import { COLLECTOR_VERSION } from '../version';

const io: CliIo = {
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
  cwd: () => process.cwd(),
  env: process.env,
};

const { run } = createProgram(io, {
  ...STUB_HANDLERS,
  dev: createDevHandler(io, { version: COLLECTOR_VERSION }),
  clear: createClearHandler(io),
});

run(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(
      `[pathlight-tracker] INTERNAL_ERROR ${error instanceof Error ? error.message : 'unknown'}\n`,
    );
    process.exitCode = 1;
  },
);
