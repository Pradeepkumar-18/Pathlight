// Write functions used by ingest and the trace builder (tasks 2.8, 2.9). Everything a batch of
// agent events changes is written in one transaction, so readers never see half a batch.
import { eq } from 'drizzle-orm';

import type { Db } from './open';
import { objectRefs, requests, sessions, steps } from './schema';

export type NewSession = typeof sessions.$inferInsert;
export type NewRequest = typeof requests.$inferInsert;
export type NewStep = typeof steps.$inferInsert;
export type NewObjectRef = typeof objectRefs.$inferInsert;

/** The transaction handle has the same query API as the database. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Runs `work` in one transaction (better-sqlite3 transactions are synchronous). */
export function writeBatch<T>(db: Db, work: (tx: Tx) => T): T {
  return db.transaction((tx) => work(tx));
}

export function insertSession(tx: Tx | Db, row: NewSession): void {
  tx.insert(sessions).values(row).run();
}

export function updateSession(
  tx: Tx | Db,
  id: string,
  changes: Partial<NewSession>,
  now: number,
): void {
  tx.update(sessions)
    .set({ ...changes, updatedAt: now })
    .where(eq(sessions.id, id))
    .run();
}

export function insertRequest(tx: Tx | Db, row: NewRequest): void {
  tx.insert(requests).values(row).run();
}

export function updateRequest(
  tx: Tx | Db,
  id: string,
  changes: Partial<NewRequest>,
  now: number,
): void {
  tx.update(requests)
    .set({ ...changes, updatedAt: now })
    .where(eq(requests.id, id))
    .run();
}

/**
 * Inserts steps; a step whose ID already exists is skipped, so a re-sent event never creates
 * a duplicate (`data-model.md` §3.3). Returns how many were new.
 */
export function insertSteps(tx: Tx | Db, rows: NewStep[]): number {
  if (rows.length === 0) return 0;
  return tx.insert(steps).values(rows).onConflictDoNothing({ target: steps.id }).run().changes;
}

export function updateStep(tx: Tx | Db, id: string, changes: Partial<NewStep>, now: number): void {
  tx.update(steps)
    .set({ ...changes, updatedAt: now })
    .where(eq(steps.id, id))
    .run();
}

export function insertObjectRefs(tx: Tx | Db, rows: NewObjectRef[]): void {
  if (rows.length === 0) return;
  tx.insert(objectRefs).values(rows).onConflictDoNothing().run();
}
