// Step queries (`api-spec.md` §6.3, §6.4): always in entry order (`seq`), paginated by cursor.
import { and, asc, count, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import type { StepKind } from '@pathlight-tracker/protocol';

import { decodeCursor, encodeCursor } from './cursor';
import type { Db } from './open';
import type { ListResult } from './requests';
import { steps } from './schema';

export type StepRow = typeof steps.$inferSelect;

export interface StepFilters {
  /** Only direct children of this step; `'root'` for top-level steps. */
  parentId?: string;
  kind?: StepKind[];
  onErrorPath?: boolean;
}

const STEP_SORT = 'seq';

export function listSteps(
  db: Db,
  requestId: string,
  filters: StepFilters,
  options: { limit: number; cursor?: string },
): ListResult<StepRow> {
  const conditions: (SQL | undefined)[] = [eq(steps.requestId, requestId)];
  if (filters.parentId !== undefined) {
    conditions.push(
      filters.parentId === 'root' ? isNull(steps.parentId) : eq(steps.parentId, filters.parentId),
    );
  }
  if (filters.kind?.length) conditions.push(inArray(steps.kind, filters.kind));
  if (filters.onErrorPath !== undefined)
    conditions.push(eq(steps.onErrorPath, filters.onErrorPath ? 1 : 0));
  const where = and(...conditions);
  const pageConditions = [where];
  // The request is part of the filters, so a cursor can't be reused on another request.
  const cursorFilters = { requestId, ...filters };
  if (options.cursor !== undefined) {
    const position = decodeCursor(options.cursor, STEP_SORT, cursorFilters);
    pageConditions.push(
      or(gt(steps.seq, position.key), and(eq(steps.seq, position.key), gt(steps.id, position.id))),
    );
  }
  const rows = db
    .select()
    .from(steps)
    .where(and(...pageConditions))
    .orderBy(asc(steps.seq), asc(steps.id))
    .limit(options.limit + 1)
    .all();
  const data = rows.slice(0, options.limit);
  const last = data.at(-1);
  const nextCursor =
    rows.length > options.limit && last
      ? encodeCursor(STEP_SORT, cursorFilters, { key: last.seq, id: last.id })
      : null;
  const total = db.select({ n: count() }).from(steps).where(where).get()?.n ?? 0;
  return { data, page: { limit: options.limit, nextCursor, total } };
}

export function getStep(db: Db, requestId: string, stepId: string): StepRow | undefined {
  return db
    .select()
    .from(steps)
    .where(and(eq(steps.requestId, requestId), eq(steps.id, stepId)))
    .get();
}

/** Child counts for a set of steps (for `StepSummary.childCount`). */
export function childCounts(db: Db, requestId: string): Map<string, number> {
  const rows = db
    .select({ parentId: steps.parentId, n: count() })
    .from(steps)
    .where(eq(steps.requestId, requestId))
    .groupBy(steps.parentId)
    .all();
  const counts = new Map<string, number>();
  for (const row of rows) if (row.parentId !== null) counts.set(row.parentId, row.n);
  return counts;
}
