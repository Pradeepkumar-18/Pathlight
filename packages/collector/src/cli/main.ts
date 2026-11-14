#!/usr/bin/env node
// Entry point of the `pathlight-tracker` command.
import { createProgram } from './program';

const { run } = createProgram({
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
  cwd: () => process.cwd(),
  env: process.env,
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
