// `pathlight-tracker clear [--purge] [--yes]` (`user-flows.md` T3). Works on the database
// directly; going through a running collector (so open tabs update) is added with the REST API
// in task 2.10.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';

import { values } from '../config/load';
import type { ResolvedConfig } from '../config/load';
import { clearAll, counts, purgeAll } from '../store/lifecycle';
import { openStore, StoreUnavailableError } from '../store/open';
import { COLLECTOR_VERSION } from '../version';
import type { CliIo } from './program';

export type Confirm = (question: string) => Promise<boolean>;

export const askOnTerminal: Confirm = async (question) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await rl.question(question)).trim());
  } finally {
    rl.close();
  }
};

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

export function createClearHandler(io: CliIo, confirm: Confirm = askOnTerminal) {
  return async (options: {
    purge: boolean;
    yes: boolean;
    config: ResolvedConfig;
  }): Promise<number> => {
    const settings = values(options.config);
    const projectRoot = io.cwd();
    if (!existsSync(path.resolve(projectRoot, settings.dbPath))) {
      io.out('Nothing to clear: there are no recordings in this project yet.\n');
      return 0;
    }
    let store;
    try {
      store = openStore({ projectRoot, dbPath: settings.dbPath, version: COLLECTOR_VERSION });
    } catch (error) {
      if (!(error instanceof StoreUnavailableError)) throw error;
      io.err(`[pathlight-tracker] ${error.code} ${error.message}\n`);
      return 1;
    }
    try {
      if (!options.purge) {
        const moved = clearAll(store.db, Date.now());
        io.out(
          `Moved ${plural(moved.length, 'request')} to the trash (restorable for ${settings.trashTtlHours} h).\n`,
        );
        return 0;
      }
      const { active, trashed, inProgress } = counts(store.db);
      if (active + trashed === 0) {
        io.out('Nothing to delete.\n');
        return 0;
      }
      if (!options.yes) {
        const question = `Delete ${plural(active, 'active request')} and ${plural(trashed, 'trashed request')} permanently? This cannot be undone. [y/N] `;
        if (!(await confirm(question))) {
          io.out('Nothing was deleted.\n');
          return 0;
        }
      }
      const deleted = purgeAll(store.db);
      store.sqlite.pragma('incremental_vacuum');
      const skipped =
        inProgress > 0
          ? ` (${plural(inProgress, 'request')} still running ${inProgress === 1 ? 'was' : 'were'} kept)`
          : '';
      io.out(`Deleted ${plural(deleted.length, 'request')} permanently${skipped}.\n`);
      return 0;
    } finally {
      store.close();
    }
  };
}
