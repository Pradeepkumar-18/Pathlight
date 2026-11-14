// Loads the seed data (`fixtures/seed/sample.sql`, from `data-model.md` §10) into a store,
// so the UI can be built and tested without a traced app (task 2.4).
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Store } from './open';

/** `<repo>/fixtures/seed/sample.sql`, from `src/store` or `dist/store` alike. */
export const SEED_FILE = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'fixtures',
  'seed',
  'sample.sql',
);

export interface SeedCounts {
  requests: number;
  steps: number;
  objectRefs: number;
}

/**
 * Replaces everything in the store with the seed, in one transaction: either the whole
 * example loads or nothing changes.
 */
export function loadSeed(store: Store, sql: string = readFileSync(SEED_FILE, 'utf8')): SeedCounts {
  const { sqlite } = store;
  sqlite.transaction(() => {
    // Cascades remove requests, steps and object refs too.
    sqlite.exec('DELETE FROM sessions');
    sqlite.exec(sql);
  })();
  const count = (table: string): number =>
    (sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
  return { requests: count('requests'), steps: count('steps'), objectRefs: count('object_refs') };
}
