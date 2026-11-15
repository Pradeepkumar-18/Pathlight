// `pathlight-tracker clear [--purge] [--yes]` (`user-flows.md` T3). Goes through the running
// collector when there is one, so open browser tabs update; otherwise works on the database.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';

import { values } from '../config/load';
import type { ResolvedConfig } from '../config/load';
import { clearAll, counts, purgeAll } from '../store/lifecycle';
import { openStore, STORE_DIR, StoreUnavailableError } from '../store/open';
import { COLLECTOR_VERSION } from '../version';
import type { CliIo } from './program';
import { findRunningCollector } from './running-collector';
import type { RunningCollector } from './running-collector';

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

interface ClearOptions {
  purge: boolean;
  yes: boolean;
}

export function createClearHandler(
  io: CliIo,
  confirm: Confirm = askOnTerminal,
  find: (storeDir: string) => Promise<RunningCollector | null> = findRunningCollector,
) {
  /** The same results as the database path, through the REST API (`api-spec.md` §7). */
  async function clearThroughCollector(
    running: RunningCollector,
    options: ClearOptions,
    ttlHours: number,
  ): Promise<number> {
    if (!options.purge) {
      const result = (await running.call('DELETE', '/requests')) as { data: { moved: number } };
      io.out(
        `Moved ${plural(result.data.moved, 'request')} to the trash (restorable for ${ttlHours} h).\n`,
      );
      return 0;
    }
    const health = (await running.call('GET', '/health')) as {
      storage: { activeRequests: number; trashedRequests: number };
    };
    const { activeRequests: active, trashedRequests: trashed } = health.storage;
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
    await running.call('DELETE', '/requests');
    const emptied = (await running.call('DELETE', '/trash')) as { data: { deleted: number } };
    io.out(`Deleted ${plural(emptied.data.deleted, 'request')} permanently.\n`);
    return 0;
  }

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
    const running = await find(path.resolve(projectRoot, STORE_DIR));
    if (running) return clearThroughCollector(running, options, settings.trashTtlHours);
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
