// Soft delete, restore, permanent delete, retention and purge (`data-model.md` §7).
// Every function returns the affected request IDs so the live hub (task 2.11) can tell open UIs.
import { and, eq, inArray, isNotNull, lt, ne, notInArray, sql } from 'drizzle-orm';

import type { Db } from './open';
import { activeRequests, trashedRequests } from './requests';
import { requests, sessions } from './schema';
import { writeBatch } from './writes';

export type DeleteResult = 'ok' | 'not_found' | 'in_progress' | 'already_in_trash';
export type RestoreResult = 'ok' | 'not_found' | 'not_in_trash';

const HOUR_MS = 60 * 60 * 1000;
const finished = ne(requests.state, 'in_progress');

function find(db: Db, id: string) {
  return db
    .select({ state: requests.state, deletedAt: requests.deletedAt })
    .from(requests)
    .where(eq(requests.id, id))
    .get();
}

/** UI "Delete": moves one finished request to the trash. */
export function softDelete(db: Db, id: string, now: number): DeleteResult {
  const row = find(db, id);
  if (!row) return 'not_found';
  if (row.deletedAt !== null) return 'already_in_trash';
  if (row.state === 'in_progress') return 'in_progress';
  db.update(requests).set({ deletedAt: now, updatedAt: now }).where(eq(requests.id, id)).run();
  return 'ok';
}

/**
 * Restores a trashed request. If that pushes the active count over the retention limit, the
 * oldest active request moves to the trash (never purged straight away).
 */
export function restore(
  db: Db,
  id: string,
  retention: number,
  now: number,
): { result: RestoreResult; trashed: string[] } {
  const row = find(db, id);
  if (!row) return { result: 'not_found', trashed: [] };
  if (row.deletedAt === null) return { result: 'not_in_trash', trashed: [] };
  return writeBatch(db, () => {
    db.update(requests).set({ deletedAt: null, updatedAt: now }).where(eq(requests.id, id)).run();
    return { result: 'ok' as const, trashed: applyRetention(db, retention, now, id) };
  });
}

/** "Delete permanently" (one request, active or trashed): cascades to steps and object refs. */
export function deletePermanently(db: Db, id: string): DeleteResult {
  const row = find(db, id);
  if (!row) return 'not_found';
  if (row.state === 'in_progress') return 'in_progress';
  db.delete(requests).where(eq(requests.id, id)).run();
  return 'ok';
}

/** UI "Clear all" and `pathlight-tracker clear`: every finished active request to the trash. */
export function clearAll(db: Db, now: number, sessionId?: string): string[] {
  return writeBatch(db, () => {
    const inSession = sessionId === undefined ? undefined : eq(requests.sessionId, sessionId);
    const ids = db
      .select({ id: requests.id })
      .from(requests)
      .where(and(activeRequests, finished, inSession))
      .all()
      .map((r) => r.id);
    if (ids.length > 0)
      db.update(requests)
        .set({ deletedAt: now, updatedAt: now })
        .where(inArray(requests.id, ids))
        .run();
    return ids;
  });
}

/** UI "Empty trash": deletes every trashed request now. */
export function emptyTrash(db: Db): string[] {
  return writeBatch(db, () => {
    const ids = db
      .select({ id: requests.id })
      .from(requests)
      .where(trashedRequests)
      .all()
      .map((r) => r.id);
    if (ids.length > 0) db.delete(requests).where(inArray(requests.id, ids)).run();
    return ids;
  });
}

/** `pathlight-tracker clear --purge`: deletes every finished request, active or trashed. */
export function purgeAll(db: Db): string[] {
  return writeBatch(db, () => {
    const ids = db
      .select({ id: requests.id })
      .from(requests)
      .where(finished)
      .all()
      .map((r) => r.id);
    if (ids.length > 0) db.delete(requests).where(inArray(requests.id, ids)).run();
    return ids;
  });
}

/** Counts for the `clear --purge` confirmation prompt. */
export function counts(db: Db): { active: number; trashed: number; inProgress: number } {
  const row = db
    .select({
      active: sql<number>`sum(CASE WHEN ${requests.deletedAt} IS NULL AND ${requests.state} <> 'in_progress' THEN 1 ELSE 0 END)`,
      trashed: sql<number>`sum(CASE WHEN ${requests.deletedAt} IS NOT NULL THEN 1 ELSE 0 END)`,
      inProgress: sql<number>`sum(CASE WHEN ${requests.state} = 'in_progress' THEN 1 ELSE 0 END)`,
    })
    .from(requests)
    .get();
  return { active: row?.active ?? 0, trashed: row?.trashed ?? 0, inProgress: row?.inProgress ?? 0 };
}

/**
 * Keeps at most `limit` active requests: the oldest finished ones beyond it move to the trash
 * (soft, never purged directly). In-progress requests are never moved. `keep` is exempt (the
 * request just restored).
 */
export function applyRetention(db: Db, limit: number, now: number, keep?: string): string[] {
  const active = db
    .select({ id: requests.id, state: requests.state })
    .from(requests)
    .where(activeRequests)
    .orderBy(sql`${requests.startedAt} DESC`, sql`${requests.id} DESC`)
    .all();
  if (active.length <= limit) return [];
  const excess = active.length - limit;
  const candidates = active
    .slice()
    .reverse()
    .filter((row) => row.state !== 'in_progress' && row.id !== keep)
    .slice(0, excess)
    .map((row) => row.id);
  if (candidates.length > 0) {
    db.update(requests)
      .set({ deletedAt: now, updatedAt: now })
      .where(inArray(requests.id, candidates))
      .run();
  }
  return candidates;
}

/** Purge job: trashed requests older than the TTL, then empty disconnected sessions, then vacuum. */
export function purgeExpired(
  db: Db,
  vacuum: () => void,
  ttlHours: number,
  now: number,
): { purged: string[]; sessionsRemoved: number } {
  const purged = writeBatch(db, () => {
    const cutoff = now - ttlHours * HOUR_MS;
    const ids = db
      .select({ id: requests.id })
      .from(requests)
      .where(and(isNotNull(requests.deletedAt), lt(requests.deletedAt, cutoff)))
      .all()
      .map((r) => r.id);
    if (ids.length > 0) db.delete(requests).where(inArray(requests.id, ids)).run();
    return ids;
  });
  const sessionsRemoved = removeEmptySessions(db);
  // Deleted values must not linger in free pages of the file (data-model.md §7 "Privacy").
  if (purged.length > 0 || sessionsRemoved > 0) vacuum();
  return { purged, sessionsRemoved };
}

/** Disconnected sessions with no requests left (active or trashed). */
export function removeEmptySessions(db: Db): number {
  const withRequests = db.selectDistinct({ id: requests.sessionId }).from(requests);
  return db
    .delete(sessions)
    .where(and(ne(sessions.status, 'connected'), notInArray(sessions.id, withRequests)))
    .run().changes;
}

/** Runs the purge on startup, then hourly; returns a stop function. */
export function startPurgeJob(options: { run: () => void; intervalMs?: number }): () => void {
  options.run();
  const timer = setInterval(options.run, options.intervalMs ?? HOUR_MS);
  // The job must never keep the CLI alive on its own.
  timer.unref();
  return () => clearInterval(timer);
}
