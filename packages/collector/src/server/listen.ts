// Fixed default port, so saved links keep working (decision 0015); next free one if it's busy.
// Also writes `.pathlight-tracker/collector.json` so other commands (`clear`) can find it.
import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { CollectorServer } from './app';

export const DEFAULT_PORT = 4777;
const PORTS_TO_TRY = 20;
export const COLLECTOR_FILE = 'collector.json';

export interface CollectorInfo {
  pid: number;
  port: number;
  version: string;
  startedAt: string;
}

function isAddressInUse(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'EADDRINUSE'
  );
}

/** Listens on 127.0.0.1 only: `preferred` if given (no fallback), else 4777, 4778, … */
export async function listen(server: CollectorServer, preferred: number | null): Promise<number> {
  const candidates =
    preferred !== null
      ? [preferred]
      : Array.from({ length: PORTS_TO_TRY }, (_, i) => DEFAULT_PORT + i);
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      server.setPort(candidate);
      await server.app.listen({
        host: '127.0.0.1',
        port: candidate,
        // Kept in the log file; the launcher's banner already shows the address on the console.
        listenTextResolver: (address) => `listening on ${address}`,
      });
      return candidate;
    } catch (error) {
      lastError = error;
      if (!isAddressInUse(error)) throw error;
    }
  }
  throw new Error(
    preferred !== null
      ? `Port ${preferred} is busy. Choose another with --port or PATHLIGHT_TRACKER_PORT.`
      : `Ports ${DEFAULT_PORT}–${DEFAULT_PORT + PORTS_TO_TRY - 1} are all busy (${String(lastError)}).`,
  );
}

export function writeCollectorFile(storeDir: string, info: CollectorInfo): () => void {
  const file = path.join(storeDir, COLLECTOR_FILE);
  // The token is not in here: it has its own 0600 file.
  writeFileSync(file, `${JSON.stringify(info, null, 2)}\n`, { mode: 0o600 });
  return () => rmSync(file, { force: true });
}
