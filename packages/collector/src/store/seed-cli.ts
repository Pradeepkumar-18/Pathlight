// `pnpm seed [projectRoot]`: loads the seed into `<projectRoot>/.pathlight-tracker/traces.db`
// (default: the current folder).
import path from 'node:path';

import { openStore } from './open';
import { loadSeed } from './seed';

const projectRoot = path.resolve(process.argv[2] ?? process.cwd());
try {
  const store = openStore({
    projectRoot,
    dbPath: '.pathlight-tracker/traces.db',
    version: '0.0.0',
  });
  try {
    const counts = loadSeed(store);
    process.stdout.write(
      `Seeded ${store.file}: ${counts.requests} requests, ${counts.steps} steps, ${counts.objectRefs} object refs\n`,
    );
  } finally {
    store.close();
  }
} catch (error) {
  process.stderr.write(
    `[pathlight-tracker] SEED_FAILED ${error instanceof Error ? error.message : 'unknown'}\n`,
  );
  process.exitCode = 1;
}
