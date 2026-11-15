// Session and request-level reads used by the REST API.
import { and, asc, count, desc, eq, isNotNull, isNull } from 'drizzle-orm';

import type { Db } from './open';
import { requests, sessions, steps } from './schema';

export type SessionRow = typeof sessions.$inferSelect;

export function listSessions(db: Db, status?: SessionRow['status']): SessionRow[] {
  return db
    .select()
    .from(sessions)
    .where(status === undefined ? undefined : eq(sessions.status, status))
    .orderBy(desc(sessions.connectedAt), desc(sessions.id))
    .all();
}

export function getSession(db: Db, id: string): SessionRow | undefined {
  return db.select().from(sessions).where(eq(sessions.id, id)).get();
}

/** Step IDs on the red path, root first (`api-spec.md` §4.5 `errorPath`). */
export function errorPath(db: Db, requestId: string): string[] {
  return db
    .select({ id: steps.id })
    .from(steps)
    .where(and(eq(steps.requestId, requestId), eq(steps.onErrorPath, 1)))
    .orderBy(asc(steps.depth), asc(steps.seq))
    .all()
    .map((row) => row.id);
}

export function requestCounts(db: Db): { active: number; trashed: number } {
  const active =
    db.select({ n: count() }).from(requests).where(isNull(requests.deletedAt)).get()?.n ?? 0;
  const trashed =
    db.select({ n: count() }).from(requests).where(isNotNull(requests.deletedAt)).get()?.n ?? 0;
  return { active, trashed };
}

export function inProgressCount(db: Db, sessionId?: string): number {
  return (
    db
      .select({ n: count() })
      .from(requests)
      .where(
        and(
          isNull(requests.deletedAt),
          eq(requests.state, 'in_progress'),
          sessionId === undefined ? undefined : eq(requests.sessionId, sessionId),
        ),
      )
      .get()?.n ?? 0
  );
}
