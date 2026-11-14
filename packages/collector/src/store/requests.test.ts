import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { InvalidCursorError } from './cursor';
import { openStore } from './open';
import type { Store } from './open';
import { getRequest, listRequests, listTrash } from './requests';
import type { RequestFilters, RequestRow, RequestSort } from './requests';
import { insertRequest, insertSession, writeBatch } from './writes';
import type { NewRequest } from './writes';

let root: string;
let store: Store;

const SESSION_A = 'ses_01JBTEST00000000000000000A';
const SESSION_B = 'ses_01JBTEST00000000000000000B';
const id = (n: number): string => `req_01JBTEST0000000000000000${String(n).padStart(2, '0')}`;

/** 12 requests with a spread of methods, statuses, paths, durations and sessions. */
const VARIANTS: Partial<NewRequest>[] = [
  {
    method: 'GET',
    path: '/orders/42',
    route: '/orders/:id',
    httpStatus: 200,
    durationNs: 21_000_000,
  },
  {
    method: 'POST',
    path: '/orders',
    route: '/orders',
    httpStatus: 500,
    hasError: 1,
    durationNs: 84_000_000,
  },
  { method: 'GET', path: '/health', route: '/health', httpStatus: 200, durationNs: 2_000_000 },
  {
    method: 'DELETE',
    path: '/orders/7',
    route: '/orders/:id',
    httpStatus: 404,
    durationNs: 5_000_000,
  },
  {
    method: 'GET',
    path: '/users/100%_off',
    route: '/users/:id',
    httpStatus: 200,
    durationNs: 9_000_000,
  },
  {
    method: 'PUT',
    path: '/Orders/42',
    route: '/orders/:id',
    httpStatus: 201,
    durationNs: 450_000_000,
  },
  { method: 'GET', path: '/orders', route: '/orders', httpStatus: 302, durationNs: 3_000_000 },
  { method: 'POST', path: '/login', route: '/login', httpStatus: 401, durationNs: 7_000_000 },
  {
    method: 'GET',
    path: '/slow',
    route: '/slow',
    httpStatus: 200,
    hasError: 1,
    durationNs: 1_200_000_000,
  },
  {
    method: 'GET',
    path: '/live',
    route: '/live',
    state: 'in_progress',
    httpStatus: null,
    durationNs: null,
  },
  {
    method: 'GET',
    path: '/gone',
    route: '/gone',
    httpStatus: 200,
    durationNs: 4_000_000,
    deletedAt: 9_999,
  },
  {
    method: 'PATCH',
    path: '/orders/9',
    route: '/orders/:id',
    httpStatus: 503,
    hasError: 1,
    durationNs: 30_000_000,
  },
];
const ROWS: NewRequest[] = VARIANTS.map((row, index) => ({
  id: id(index + 1),
  sessionId: index < 6 ? SESSION_A : SESSION_B,
  state: 'completed' as const,
  requestJson: '{}',
  startedAt: 1_000 + index * 100,
  createdAt: 1,
  updatedAt: 1,
  ...row,
}));

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'pt-requests-'));
  store = openStore({ projectRoot: root, dbPath: 'traces.db', version: '0.1.0' });
  writeBatch(store.db, (tx) => {
    for (const session of [SESSION_A, SESSION_B]) {
      insertSession(tx, {
        id: session,
        pid: 1,
        cwd: '/app',
        nodeVersion: 'v24',
        agentVersion: '0.1.0',
        protocolVersion: 1,
        connectedAt: 1,
        createdAt: 1,
        updatedAt: 1,
      });
    }
    for (const row of ROWS) insertRequest(tx, row);
  });
});

afterEach(() => {
  store.close();
  rmSync(root, { recursive: true, force: true });
});

const ids = (rows: RequestRow[]): number[] => rows.map((row) => Number(row.id.slice(-2)));
const list = (
  filters: RequestFilters = {},
  sort: RequestSort = '-startedAt',
  limit = 50,
  cursor?: string,
) => listRequests(store.db, filters, { sort, limit, cursor });

describe('listRequests', () => {
  it('never returns trashed requests, by default or with any filter', () => {
    expect(ids(list().data)).not.toContain(11);
    expect(list().page.total).toBe(11);
    expect(ids(list({ path: 'gone' }).data)).toEqual([]);
    expect(getRequest(store.db, id(11))).toBeUndefined();
    expect(getRequest(store.db, id(11), true)?.path).toBe('/gone');
  });

  it.each<[string, RequestFilters, number[]]>([
    ['method (OR within the list)', { method: ['POST', 'DELETE'] }, [8, 4, 2]],
    ['exact status', { status: [500] }, [2]],
    ['status classes', { status: ['4xx', '5xx'] }, [12, 8, 4, 2]],
    ['exact status and a class together', { status: [302, '5xx'] }, [12, 7, 2]],
    ['hasError true', { hasError: true }, [12, 9, 2]],
    ['hasError false', { hasError: false }, [10, 8, 7, 6, 5, 4, 3, 1]],
    ['state', { state: ['in_progress'] }, [10]],
    ['path is a case-insensitive substring', { path: 'ORDERS/4' }, [6, 1]],
    ['path treats % and _ as plain text', { path: '100%_' }, [5]],
    ['route is exact', { route: '/orders/:id' }, [12, 6, 4, 1]],
    ['sessionId', { sessionId: SESSION_A }, [6, 5, 4, 3, 2, 1]],
    ['since and until are inclusive', { since: 1_200, until: 1_400 }, [5, 4, 3]],
    ['minDurationMs (slow)', { minDurationMs: 100 }, [9, 6]],
    ['filters combine with AND', { method: ['GET'], route: '/orders/:id' }, [1]],
  ])('filters by %s', (_name, filters, expected) => {
    const result = list(filters);
    expect(ids(result.data)).toEqual(expected);
    expect(result.page.total).toBe(expected.length);
  });

  it.each<[RequestSort, number[]]>([
    ['-startedAt', [12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]],
    ['startedAt', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]],
    // In-progress (no duration yet) sorts last when descending, first when ascending.
    ['-durationNs', [9, 6, 2, 12, 1, 5, 8, 4, 7, 3, 10]],
    ['durationNs', [10, 3, 7, 4, 8, 5, 1, 12, 2, 6, 9]],
  ])('sorts by %s', (sort, expected) => {
    expect(ids(list({}, sort).data)).toEqual(expected);
  });

  it.each<RequestSort>(['-startedAt', 'startedAt', '-durationNs', 'durationNs'])(
    'pages through every row exactly once with cursors (%s)',
    (sort) => {
      const all = ids(list({}, sort).data);
      const seen: number[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const page = list({}, sort, 3, cursor);
        expect(page.page.total).toBe(11);
        seen.push(...ids(page.data));
        cursor = page.page.nextCursor ?? undefined;
        pages += 1;
      } while (cursor !== undefined);
      expect(seen).toEqual(all);
      expect(pages).toBe(4);
    },
  );

  it('breaks ties on equal sort keys by ID, without skipping or repeating rows', () => {
    writeBatch(store.db, (tx) => {
      for (let n = 20; n < 25; n += 1) {
        insertRequest(tx, { ...ROWS[0], id: id(n), startedAt: 5_000 } as NewRequest);
      }
    });
    const first = list({}, '-startedAt', 2);
    const second = list({}, '-startedAt', 2, first.page.nextCursor ?? undefined);
    const third = list({}, '-startedAt', 2, second.page.nextCursor ?? undefined);
    expect([...ids(first.data), ...ids(second.data), ...ids(third.data)]).toEqual([
      24, 23, 22, 21, 20, 12,
    ]);
  });

  it('keeps the filters across pages', () => {
    const first = list({ method: ['GET'] }, '-startedAt', 2);
    const second = list({ method: ['GET'] }, '-startedAt', 2, first.page.nextCursor ?? undefined);
    expect([...ids(first.data), ...ids(second.data)]).toEqual([10, 9, 7, 5]);
    // 7 GET requests, but /gone is in the trash.
    expect(first.page.total).toBe(6);
  });

  it('returns no next cursor on the last page', () => {
    expect(list({}, '-startedAt', 11).page.nextCursor).toBeNull();
  });

  it.each([
    ['malformed', () => list({}, '-startedAt', 2, 'not-a-cursor')],
    [
      'from another sort order',
      () => list({}, 'startedAt', 2, list({}, '-startedAt', 2).page.nextCursor ?? ''),
    ],
    [
      'from other filters',
      () =>
        list(
          { method: ['POST'] },
          '-startedAt',
          2,
          list({}, '-startedAt', 2).page.nextCursor ?? '',
        ),
    ],
  ])('rejects a cursor that is %s', (_name, call) => {
    expect(call).toThrow(InvalidCursorError);
  });
});

describe('listTrash', () => {
  it('lists only trashed requests', () => {
    const trash = listTrash(store.db, { sort: '-deletedAt', limit: 50 });
    expect(ids(trash.data)).toEqual([11]);
    expect(trash.page.total).toBe(1);
  });
});
