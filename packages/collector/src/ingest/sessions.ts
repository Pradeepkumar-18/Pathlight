// Session rows for `WS /agent` connections (`data-model.md` §3.1, §8 "Collector ingest").
import { and, eq } from 'drizzle-orm';

import type { HelloMessage } from '@pathlight-tracker/protocol';

import { newSessionId } from '../ids';
import type { Db } from '../store/open';
import { requests } from '../store/schema';
import { insertSession, updateSession, writeBatch } from '../store/writes';

export function openSession(db: Db, hello: HelloMessage, now: number): string {
  const id = newSessionId(now);
  insertSession(db, {
    id,
    pid: hello.pid,
    command: hello.command ?? null,
    cwd: hello.cwd,
    nodeVersion: hello.nodeVersion,
    agentVersion: hello.agentVersion,
    protocolVersion: hello.v,
    framework: hello.framework,
    status: 'connected',
    connectedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/**
 * The app process went away. Its requests still running can never finish, so they become
 * `incomplete` (`architecture.md` §10). Returns their IDs for the live hub.
 */
export function closeSession(db: Db, sessionId: string, now: number): string[] {
  return writeBatch(db, (tx) => {
    updateSession(tx, sessionId, { status: 'disconnected', disconnectedAt: now }, now);
    const running = and(eq(requests.sessionId, sessionId), eq(requests.state, 'in_progress'));
    const ids = tx
      .select({ id: requests.id })
      .from(requests)
      .where(running)
      .all()
      .map((row) => row.id);
    tx.update(requests).set({ state: 'incomplete', updatedAt: now }).where(running).run();
    return ids;
  });
}
