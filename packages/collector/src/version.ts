// Version of the collector package (written to `meta.created_by_version`).
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** `<package>/package.json`, from `src/` and `dist/` alike. */
const manifest = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')) as {
  version: string;
};

export const COLLECTOR_VERSION = manifest.version;
