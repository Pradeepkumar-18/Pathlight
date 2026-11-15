// Finds a collector already running for this project (`.pathlight-tracker/collector.json`,
// decision 0022), so `clear` can go through it and open browser tabs update.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { COLLECTOR_FILE } from '../server/listen';
import type { CollectorInfo } from '../server/listen';
import { TOKEN_FILE } from '../server/token';

export interface RunningCollector {
  call: (method: 'GET' | 'DELETE', url: string) => Promise<unknown>;
}

const TIMEOUT_MS = 1500;

export async function findRunningCollector(storeDir: string): Promise<RunningCollector | null> {
  let info: CollectorInfo;
  let token: string;
  try {
    info = JSON.parse(readFileSync(path.join(storeDir, COLLECTOR_FILE), 'utf8')) as CollectorInfo;
    token = readFileSync(path.join(storeDir, TOKEN_FILE), 'utf8').trim();
  } catch {
    return null;
  }
  const base = `http://127.0.0.1:${info.port}/api/v1`;
  const call: RunningCollector['call'] = async (method, url) => {
    const response = await fetch(`${base}${url}`, {
      method,
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`${method} ${url} answered ${response.status}`);
    return response.json();
  };
  try {
    // A stale file (the collector crashed) is common: only trust a collector that answers.
    await call('GET', '/health');
    return { call };
  } catch {
    return null;
  }
}
