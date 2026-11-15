// Opens (and on first run creates) the SQLite store (`data-model.md` §2, §8, §9, §11).
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from './schema';

export const STORE_DIR = '.pathlight-tracker';
export const SCHEMA_VERSION = '1';
/** Next to `dist/` and `src/` alike: `<package>/drizzle`. */
const MIGRATIONS = path.resolve(__dirname, '..', '..', 'drizzle');

export type Db = BetterSQLite3Database<typeof schema>;

export interface Store {
  db: Db;
  sqlite: Database.Database;
  file: string;
  close: () => void;
}

/** The store cannot be used; the CLI prints the message and does not start the app. */
export class StoreUnavailableError extends Error {
  readonly code = 'STORE_UNAVAILABLE';
  constructor(
    message: string,
    readonly file: string,
  ) {
    super(message);
    this.name = 'StoreUnavailableError';
  }
}

export interface OpenOptions {
  projectRoot: string;
  /** From config `dbPath`, relative to the project root. */
  dbPath: string;
  /** Collector version written to `meta.created_by_version` on first run. */
  version: string;
  now?: () => number;
}

export function openStore(options: OpenOptions): Store {
  // `:memory:` builds a throwaway store (the built-in sample, `api-spec.md` §6.10).
  const inMemory = options.dbPath === ':memory:';
  const file = inMemory ? ':memory:' : path.resolve(options.projectRoot, options.dbPath);
  const now = options.now ?? Date.now;
  let sqlite: Database.Database;
  try {
    if (inMemory) {
      sqlite = new Database(':memory:');
    } else {
      // Owner-only: captured values are private (data-model.md §8). Ignored on Windows.
      mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
      const isNew = !existsSync(file);
      sqlite = new Database(file);
      if (isNew) chmodSync(file, 0o600);
    }
  } catch (error) {
    throw new StoreUnavailableError(
      `Cannot create or open ${file}: ${error instanceof Error ? error.message : 'unknown error'}`,
      file,
    );
  }
  try {
    // auto_vacuum only takes effect before the first table exists, so it comes first.
    sqlite.pragma('auto_vacuum = INCREMENTAL');
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: MIGRATIONS });
    const insertMeta = sqlite.prepare(
      'INSERT OR IGNORE INTO meta (key, value, updated_at) VALUES (?, ?, ?)',
    );
    insertMeta.run('schema_version', SCHEMA_VERSION, now());
    insertMeta.run('created_by_version', options.version, now());
    return { db, sqlite, file, close: () => sqlite.close() };
  } catch (error) {
    sqlite.close();
    throw new StoreUnavailableError(
      `Cannot prepare ${file}: ${error instanceof Error ? error.message : 'unknown error'}`,
      file,
    );
  }
}

/**
 * Adds `.pathlight-tracker/` to the project's `.gitignore` (creating it if needed), so traces
 * are never committed. Returns true when it changed the file, so the CLI can print a notice.
 */
export function ensureGitignored(projectRoot: string): boolean {
  const gitignore = path.join(projectRoot, '.gitignore');
  const entry = `${STORE_DIR}/`;
  if (!existsSync(gitignore)) {
    writeFileSync(gitignore, `# Pathlight Tracker recordings (local only)\n${entry}\n`);
    return true;
  }
  const lines = readFileSync(gitignore, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim());
  if (lines.includes(entry) || lines.includes(STORE_DIR) || lines.includes(`/${entry}`))
    return false;
  const current = readFileSync(gitignore, 'utf8');
  appendFileSync(
    gitignore,
    `${current.endsWith('\n') || current === '' ? '' : '\n'}\n# Pathlight Tracker recordings (local only)\n${entry}\n`,
  );
  return true;
}
