// Request queries: the default (active) list with filters, sorting and cursor pagination
// (`api-spec.md` §6.1, §9) and the trash list (§7). Every read goes through `activeRequests`
// or `trashedRequests`, so no query can forget the soft-delete rule (`data-model.md` §7).
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import type { HttpMethod, RequestState } from '@pathlight-tracker/protocol';

import { decodeCursor, encodeCursor } from './cursor';
import type { Db } from './open';
import { requests } from './schema';

export type RequestRow = typeof requests.$inferSelect;

export const REQUEST_SORTS = ['-startedAt', 'startedAt', '-durationNs', 'durationNs'] as const;
export type RequestSort = (typeof REQUEST_SORTS)[number];

export interface RequestFilters {
  method?: HttpMethod[];
  /** Exact codes (`500`) or classes (`'4xx'`), combined with OR. */
  status?: (number | '2xx' | '3xx' | '4xx' | '5xx')[];
  hasError?: boolean;
  state?: RequestState[];
  /** Case-insensitive substring, treated as plain text. */
  path?: string;
  route?: string;
  sessionId?: string;
  /** Epoch ms, inclusive. */
  since?: number;
  until?: number;
  minDurationMs?: number;
}

export interface ListOptions<S extends string> {
  limit: number;
  sort: S;
  cursor?: string;
}

export interface ListResult<T> {
  data: T[];
  page: { limit: number; nextCursor: string | null; total: number };
}

/** Rows that are not in the trash: the default for every request read. */
export const activeRequests = isNull(requests.deletedAt);
export const trashedRequests = isNotNull(requests.deletedAt);

/** `%` and `_` in user text are literal, not wildcards. */
function likeContains(text: string): string {
  return `%${text.toLowerCase().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

function statusCondition(status: NonNullable<RequestFilters['status']>): SQL | undefined {
  const parts = status.map((value) => {
    if (typeof value === 'number') return eq(requests.httpStatus, value);
    const base = Number(value[0]) * 100;
    return and(gte(requests.httpStatus, base), lte(requests.httpStatus, base + 99));
  });
  return or(...parts);
}

export function filterConditions(filters: RequestFilters): SQL[] {
  const conditions: (SQL | undefined)[] = [];
  if (filters.method?.length) conditions.push(inArray(requests.method, filters.method));
  if (filters.status?.length) conditions.push(statusCondition(filters.status));
  if (filters.hasError !== undefined)
    conditions.push(eq(requests.hasError, filters.hasError ? 1 : 0));
  if (filters.state?.length) conditions.push(inArray(requests.state, filters.state));
  if (filters.path !== undefined) {
    conditions.push(sql`lower(${requests.path}) LIKE ${likeContains(filters.path)} ESCAPE '\\'`);
  }
  if (filters.route !== undefined) conditions.push(eq(requests.route, filters.route));
  if (filters.sessionId !== undefined) conditions.push(eq(requests.sessionId, filters.sessionId));
  if (filters.since !== undefined) conditions.push(gte(requests.startedAt, filters.since));
  if (filters.until !== undefined) conditions.push(lte(requests.startedAt, filters.until));
  if (filters.minDurationMs !== undefined) {
    conditions.push(gte(requests.durationNs, Math.round(filters.minDurationMs * 1_000_000)));
  }
  return conditions.filter((condition): condition is SQL => condition !== undefined);
}

/** In-progress requests have no duration yet; they sort as -1 (last when descending). */
const durationKey = sql<number>`coalesce(${requests.durationNs}, -1)`;

function sortSpec(sort: RequestSort | '-deletedAt' | 'deletedAt') {
  const descending = sort.startsWith('-');
  const field = sort.replace('-', '');
  const key: SQL<number> =
    field === 'durationNs'
      ? durationKey
      : field === 'deletedAt'
        ? sql<number>`${requests.deletedAt}`
        : sql<number>`${requests.startedAt}`;
  const keyOf = (row: RequestRow): number =>
    field === 'durationNs'
      ? (row.durationNs ?? -1)
      : field === 'deletedAt'
        ? (row.deletedAt ?? 0)
        : row.startedAt;
  return { descending, key, keyOf };
}

function listPage(
  db: Db,
  base: SQL,
  filters: object,
  conditions: SQL[],
  options: ListOptions<string>,
): ListResult<RequestRow> {
  const { descending, key, keyOf } = sortSpec(options.sort as RequestSort);
  const where = and(base, ...conditions);
  const pageConditions = [where];
  if (options.cursor !== undefined) {
    const position = decodeCursor(options.cursor, options.sort, filters);
    const beyond = descending ? lt : gt;
    // Keyset pagination: rows strictly after the last one, with the ID breaking ties.
    pageConditions.push(
      or(beyond(key, position.key), and(eq(key, position.key), beyond(requests.id, position.id))),
    );
  }
  const direction = descending ? desc : asc;
  const rows = db
    .select()
    .from(requests)
    .where(and(...pageConditions))
    .orderBy(direction(key), direction(requests.id))
    .limit(options.limit + 1)
    .all();
  const data = rows.slice(0, options.limit);
  const last = data.at(-1);
  const nextCursor =
    rows.length > options.limit && last
      ? encodeCursor(options.sort, filters, { key: keyOf(last), id: last.id })
      : null;
  const total = db.select({ n: count() }).from(requests).where(where).get()?.n ?? 0;
  return { data, page: { limit: options.limit, nextCursor, total } };
}

/** `GET /requests`: active requests only. */
export function listRequests(
  db: Db,
  filters: RequestFilters,
  options: ListOptions<RequestSort>,
): ListResult<RequestRow> {
  return listPage(db, activeRequests, filters, filterConditions(filters), options);
}

/** `GET /trash`: trashed requests only, newest deletion first by default. */
export function listTrash(
  db: Db,
  options: ListOptions<'-deletedAt' | 'deletedAt'>,
): ListResult<RequestRow> {
  return listPage(db, trashedRequests, {}, [], options);
}

/** One request; trashed ones only when asked (trash preview). */
export function getRequest(db: Db, id: string, includeDeleted = false): RequestRow | undefined {
  const where = includeDeleted ? eq(requests.id, id) : and(eq(requests.id, id), activeRequests);
  return db.select().from(requests).where(where).get();
}
