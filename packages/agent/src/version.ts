// Version of the agent package (sent in `hello`).
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** `<package>/package.json`, from `src/` and `dist/` alike. */
const manifest = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')) as {
  version: string;
};

export const AGENT_VERSION = manifest.version;
