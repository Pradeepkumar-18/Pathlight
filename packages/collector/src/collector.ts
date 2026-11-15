// Starts a whole collector (`architecture.md` §3a): store, builder, `/agent`, `/live`, REST API,
// retention, purge job and the server on 127.0.0.1. Used by `pathlight-tracker dev` (task 2.12).
import path from 'node:path';

import { registerApi } from './api/index';
import { createBuilder } from './builder/builder';
import type { ResolvedConfig } from './config/load';
import { values } from './config/load';
import { createIngest } from './ingest/ingest';
import { registerAgentRoute } from './ingest/route';
import { closeSession, openSession } from './ingest/sessions';
import { createLiveHub } from './live/hub';
import type { LiveHub } from './live/hub';
import { registerLiveRoute } from './live/route';
import { createServer } from './server/app';
import { listen, writeCollectorFile } from './server/listen';
import { loadOrCreateToken } from './server/token';
import { applyRetention, purgeExpired, startPurgeJob } from './store/lifecycle';
import { ensureGitignored, openStore, STORE_DIR } from './store/open';
import type { Store } from './store/open';

export interface StartOptions {
  projectRoot: string;
  config: ResolvedConfig;
  version: string;
  uiDir?: string;
  /** Logs collector problems; never captured values or tokens (task 2.13). */
  onError?: (code: string, context: string) => void;
  now?: () => number;
}

export interface RunningCollector {
  port: number;
  token: string;
  /** `http://127.0.0.1:<port>`; the UI link adds `#token=…`. */
  url: string;
  agentUrl: string;
  addedGitignore: boolean;
  store: Store;
  hub: LiveHub;
  stop: () => Promise<void>;
}

export async function startCollector(options: StartOptions): Promise<RunningCollector> {
  const settings = values(options.config);
  const now = options.now ?? Date.now;
  const onError = options.onError ?? (() => undefined);
  const storeDir = path.resolve(options.projectRoot, STORE_DIR);
  const store = openStore({
    projectRoot: options.projectRoot,
    dbPath: settings.dbPath,
    version: options.version,
  });
  const addedGitignore = ensureGitignored(options.projectRoot);
  const token = loadOrCreateToken(storeDir);

  const hub = createLiveHub({ db: store.db, trashTtlHours: () => settings.trashTtlHours });
  const builder = createBuilder(store.db, { maxSteps: settings.maxSteps, now });

  const ingest = createIngest(
    {
      openSession: (hello) => {
        const sessionId = openSession(store.db, hello, now());
        hub.agentConnected(sessionId);
        return sessionId;
      },
      ingest: (sessionId, events) => {
        const changes = builder.apply(sessionId, events);
        hub.changes(changes);
        if (events.some((event) => event.e === 'agent.disabled')) hub.agentDisabled(sessionId);
        // Retention runs after each completed request (data-model.md §7).
        if (changes.completedRequests.length > 0) {
          const moved = applyRetention(store.db, settings.retention, now());
          if (moved.length > 0) hub.deleted(moved, now());
        }
      },
      closeSession: (sessionId) => {
        const incomplete = closeSession(store.db, sessionId, now());
        builder.forget(incomplete);
        incomplete.forEach((requestId) => hub.completed(requestId));
        hub.agentDisconnected(sessionId, 'exit', null);
      },
    },
    onError,
  );

  const server = await createServer({ token, version: options.version, uiDir: options.uiDir });
  registerAgentRoute(server, ingest);
  registerLiveRoute(server, hub);
  await registerApi(server.app, {
    db: store.db,
    version: options.version,
    projectRoot: options.projectRoot,
    startedAt: now(),
    settings: () => ({ retention: settings.retention, trashTtlHours: settings.trashTtlHours }),
    now,
    events: {
      deleted: (ids, at) => hub.deleted(ids, at),
      restored: (id) => hub.restored(id),
      purged: (ids) => hub.purged(ids),
    },
  });

  const port = await listen(server, settings.port);
  const removeCollectorFile = writeCollectorFile(storeDir, {
    pid: process.pid,
    port,
    version: options.version,
    startedAt: new Date(now()).toISOString(),
  });
  const stopPurge = startPurgeJob({
    run: () => {
      try {
        const { purged } = purgeExpired(
          store.db,
          () => store.sqlite.pragma('incremental_vacuum'),
          settings.trashTtlHours,
          now(),
        );
        hub.purged(purged);
      } catch (error) {
        onError('PURGE_FAILED', error instanceof Error ? error.message : 'unknown');
      }
    },
  });

  let stopped = false;
  return {
    port,
    token,
    url: `http://127.0.0.1:${port}`,
    agentUrl: `ws://127.0.0.1:${port}/agent`,
    addedGitignore,
    store,
    hub,
    async stop() {
      if (stopped) return;
      stopped = true;
      stopPurge();
      hub.close();
      await ingest.drained();
      await server.app.close();
      removeCollectorFile();
      store.close();
    },
  };
}
