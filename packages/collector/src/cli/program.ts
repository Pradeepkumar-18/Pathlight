// `pathlight-tracker` commands (`user-flows.md` T1–T3). The commands are stubs until the
// tasks that build them: dev (2.12), clear (2.6), doctor (5.3).
import { Command } from 'commander';

import { loadConfig } from '../config/load';
import type { ConfigWarning, ResolvedConfig } from '../config/load';
import type { SettingKey } from '../config/settings';

export interface CliIo {
  out: (text: string) => void;
  err: (text: string) => void;
  cwd: () => string;
  env: Record<string, string | undefined>;
}

export interface DevRequest {
  command: string[];
  config: ResolvedConfig;
}

export interface CliHandlers {
  dev: (request: DevRequest) => Promise<number> | number;
  clear: (options: {
    purge: boolean;
    yes: boolean;
    config: ResolvedConfig;
  }) => Promise<number> | number;
  doctor: (options: { config: ResolvedConfig }) => Promise<number> | number;
}

const NOT_YET = (command: string, task: string): number => {
  process.stderr.write(`[pathlight-tracker] "${command}" is not built yet (task ${task}).\n`);
  return 1;
};

export const STUB_HANDLERS: CliHandlers = {
  dev: () => NOT_YET('dev', '2.12'),
  clear: () => NOT_YET('clear', '2.6'),
  doctor: () => NOT_YET('doctor', '5.3'),
};

function printWarnings(io: CliIo, warnings: ConfigWarning[]): void {
  for (const warning of warnings)
    io.err(`[pathlight-tracker] ${warning.code} ${warning.message}\n`);
}

/** Builds the program; `run` resolves to the process exit code. */
export function createProgram(io: CliIo, handlers: CliHandlers = STUB_HANDLERS) {
  let exitCode = 0;
  const program = new Command()
    .name('pathlight-tracker')
    .description(
      'See what your Node.js backend did: a live map of every request, with real values.',
    )
    .configureOutput({ writeOut: io.out, writeErr: io.err })
    .exitOverride();

  const configFor = (flags: Partial<Record<SettingKey, string>> = {}): ResolvedConfig => {
    const { config, warnings } = loadConfig({ projectRoot: io.cwd(), env: io.env, flags });
    printWarnings(io, warnings);
    return config;
  };

  program
    .command('dev')
    .description('Start your app with Pathlight Tracker attached and open the map')
    .usage('[options] -- <command...>')
    .argument('<command...>', 'how you normally start your app, e.g. npm run start:dev')
    .option('--port <n>', 'port for the Pathlight Tracker UI (default: a fixed port)')
    .option('--no-open', 'do not open the browser')
    .action(async (command: string[], options: { port?: string; open: boolean }) => {
      const flags: Partial<Record<SettingKey, string>> = {};
      if (options.port !== undefined) flags.port = options.port;
      if (!options.open) flags.openBrowser = 'false';
      exitCode = await handlers.dev({ command, config: configFor(flags) });
    });

  program
    .command('clear')
    .description('Move all finished requests to the trash (--purge deletes everything permanently)')
    .option('--purge', 'permanently delete every request, active and trashed')
    .option('-y, --yes', 'skip the confirmation prompt')
    .action(async (options: { purge?: boolean; yes?: boolean }) => {
      exitCode = await handlers.clear({
        purge: options.purge === true,
        yes: options.yes === true,
        config: configFor(),
      });
    });

  program
    .command('doctor')
    .description('Check your project setup and print a fix for each problem')
    .action(async () => {
      exitCode = await handlers.doctor({ config: configFor() });
    });

  return {
    program,
    async run(argv: string[]): Promise<number> {
      try {
        await program.parseAsync(argv, { from: 'user' });
        return exitCode;
      } catch (error) {
        // commander throws on --help / --version (code 0) and on usage errors (code 1).
        const code = (error as { exitCode?: unknown }).exitCode;
        return typeof code === 'number' ? code : 1;
      }
    },
  };
}
