import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { z } from 'zod';

import {
  apiErrorSchema,
  clearAllResultSchema,
  dataSchema,
  emptyTrashResultSchema,
  healthSchema,
  pageSchema,
  requestDetailSchema,
  requestSummarySchema,
  restoreResultSchema,
  sampleSchema,
  sessionSchema,
  softDeleteResultSchema,
  stepDetailSchema,
  stepSummarySchema,
  trashItemSchema,
} from '@pathlight-tracker/protocol';

import { createServer } from '../server/app';
import type { CollectorServer } from '../server/app';
import { openStore } from '../store/open';
import type { Store } from '../store/open';
import { loadSeed } from '../store/seed';
import { registerApi } from './index';

const TOKEN = 'a'.repeat(43);
const PORT = 4777;
const HEADERS = { host: `127.0.0.1:${PORT}`, authorization: `Bearer ${TOKEN}` };
const FAILED = 'req_01JBSEED000000000000000001';
const OK = 'req_01JBSEED000000000000000002';
const TRASHED = 'req_01JBSEED000000000000000003';
const STEP = (n: number): string => `stp_01JBSEED0000000000000000${String(n).padStart(2, '0')}`;
const NOW = Date.parse('2026-10-30T06:40:00.000Z');

let root: string;
let store: Store;
let server: CollectorServer;
const events: string[] = [];

beforeEach(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'pt-api-'));
  store = openStore({ projectRoot: root, dbPath: 'traces.db', version: '0.1.0' });
  loadSeed(store);
  events.length = 0;
  server = await createServer({ token: TOKEN, version: '0.1.0' });
  await registerApi(server.app, {
    db: store.db,
    version: '0.1.0',
    projectRoot: '/home/dev/shop-api',
    startedAt: Date.parse('2026-10-30T06:30:00.000Z'),
    settings: () => ({ retention: 100, trashTtlHours: 72 }),
    now: () => NOW,
    events: {
      deleted: (ids) => events.push(`deleted:${ids.join(',')}`),
      restored: (id) => events.push(`restored:${id}`),
      purged: (ids) => events.push(`purged:${ids.join(',')}`),
    },
  });
  server.setPort(PORT);
});

afterEach(async () => {
  await server.app.close();
  store.close();
  rmSync(root, { recursive: true, force: true });
});

async function call(method: 'GET' | 'POST' | 'DELETE' | 'PUT', url: string) {
  const response = await server.app.inject({ method, url, headers: HEADERS });
  return {
    status: response.statusCode,
    body: response.body,
    json: () => response.json() as unknown,
    headers: response.headers,
  };
}

/** Parses with the protocol schema, so every field and type is checked, not just a few. */
function expectShape<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  expect(result.error).toBeUndefined();
  return result.data as z.infer<T>;
}

async function expectError(
  method: 'GET' | 'POST' | 'DELETE' | 'PUT',
  url: string,
  status: number,
  code: string,
) {
  const response = await call(method, url);
  expect(response.status).toBe(status);
  expect(expectShape(apiErrorSchema, response.json()).error.code).toBe(code);
}

describe('status endpoints', () => {
  it('GET /health (§5.1)', async () => {
    const health = expectShape(healthSchema, (await call('GET', '/api/v1/health')).json());
    expect(health).toMatchObject({
      status: 'ok',
      collectorVersion: '0.1.0',
      protocolVersion: 1,
      startedAt: '2026-10-30T06:30:00.000Z',
      project: { name: 'shop-api', cwd: '/home/dev/shop-api' },
      storage: { mode: 'sqlite', activeRequests: 2, trashedRequests: 1 },
    });
    expect(health.agents).toEqual([
      {
        sessionId: 'ses_01JBSEED000000000000000001',
        pid: 48213,
        framework: 'nestjs',
        status: 'connected',
        warnings: [],
      },
    ]);
  });

  it('GET /sessions (§5.3), with the status filter', async () => {
    const all = expectShape(
      dataSchema(sessionSchema.array()),
      (await call('GET', '/api/v1/sessions')).json(),
    );
    expect(all.data.map((session) => session.id)).toEqual(['ses_01JBSEED000000000000000001']);
    const none = expectShape(
      dataSchema(sessionSchema.array()),
      (await call('GET', '/api/v1/sessions?status=disconnected')).json(),
    );
    expect(none.data).toEqual([]);
    await expectError('GET', '/api/v1/sessions?status=gone', 400, 'INVALID_PARAMS');
  });

  it('GET /sample (§6.10): the seed example, marked sample, with every step detail', async () => {
    const sample = expectShape(
      dataSchema(sampleSchema),
      (await call('GET', '/api/v1/sample')).json(),
    ).data;
    expect(sample.request).toMatchObject({
      id: FAILED,
      sample: true,
      httpStatus: 500,
      errorPath: [STEP(3), STEP(4), STEP(8)],
    });
    expect(sample.steps).toHaveLength(9);
    expect(Object.keys(sample.stepDetails)).toHaveLength(9);
    expect(sample.stepDetails[STEP(8)]?.error?.stack[0]).toEqual({
      fn: 'PricingService.calculateDiscount',
      file: 'src/pricing/pricing.service.ts',
      line: 27,
      column: 31,
      internal: false,
    });
  });
});

describe('requests and steps', () => {
  it('GET /requests (§6.1) matches the example list, newest first, trash excluded', async () => {
    const page = expectShape(
      pageSchema(requestSummarySchema),
      (await call('GET', '/api/v1/requests')).json(),
    );
    expect(
      page.data.map((row) => [
        row.id,
        row.method,
        row.path,
        row.httpStatus,
        row.stepCount,
        row.startedAt,
        row.durationNs,
      ]),
    ).toEqual([
      [OK, 'GET', '/orders/42', 200, 4, '2026-10-30T06:35:10.010Z', '21000000'],
      [FAILED, 'POST', '/orders', 500, 9, '2026-10-30T06:35:05.120Z', '84000000'],
    ]);
    expect(page.page).toEqual({ limit: 50, nextCursor: null, total: 2 });
  });

  it('GET /requests filters, sorts and pages (§9)', async () => {
    const failed = expectShape(
      pageSchema(requestSummarySchema),
      (await call('GET', '/api/v1/requests?status=5xx&hasError=true')).json(),
    );
    expect(failed.data.map((row) => row.id)).toEqual([FAILED]);
    const first = expectShape(
      pageSchema(requestSummarySchema),
      (await call('GET', '/api/v1/requests?limit=1&sort=startedAt')).json(),
    );
    expect(first.data[0]?.id).toBe(FAILED);
    const second = expectShape(
      pageSchema(requestSummarySchema),
      (
        await call(
          'GET',
          `/api/v1/requests?limit=1&sort=startedAt&cursor=${first.page.nextCursor ?? ''}`,
        )
      ).json(),
    );
    expect(second.data[0]?.id).toBe(OK);
    await expectError('GET', '/api/v1/requests?limit=500', 400, 'INVALID_PARAMS');
    await expectError('GET', '/api/v1/requests?colour=red', 400, 'INVALID_PARAMS');
    await expectError('GET', '/api/v1/requests?cursor=nonsense', 400, 'INVALID_CURSOR');
  });

  it('GET /requests/:id (§6.2) matches the example detail', async () => {
    const detail = expectShape(
      dataSchema(requestDetailSchema),
      (await call('GET', `/api/v1/requests/${FAILED}`)).json(),
    ).data;
    expect(detail).toMatchObject({
      id: FAILED,
      endedAt: '2026-10-30T06:35:05.204Z',
      request: {
        params: null,
        query: null,
        body: { type: 'object', preview: '{ userId: 7, items: [2] }', objectId: 'obj_1' },
      },
      response: { headers: null, body: { type: 'object' } },
      errorStepId: STEP(8),
      errorPath: [STEP(3), STEP(4), STEP(8)],
      deletedAt: null,
      session: {
        id: 'ses_01JBSEED000000000000000001',
        pid: 48213,
        framework: 'nestjs',
        connectedAt: '2026-10-30T06:35:00.000Z',
      },
    });
    await expectError('GET', '/api/v1/requests/req_nope', 400, 'INVALID_ID');
    await expectError(
      'GET',
      '/api/v1/requests/req_01JBSEED0000000000000000ZZ',
      404,
      'REQUEST_NOT_FOUND',
    );
  });

  it('GET /requests/:id answers REQUEST_IN_TRASH (with deletedAt) unless includeDeleted=true', async () => {
    const response = await call('GET', `/api/v1/requests/${TRASHED}`);
    expect(response.status).toBe(404);
    expect(response.json()).toMatchObject({
      error: { code: 'REQUEST_IN_TRASH', details: { deletedAt: '2026-10-30T06:35:20.000Z' } },
    });
    const trashed = expectShape(
      dataSchema(requestDetailSchema),
      (await call('GET', `/api/v1/requests/${TRASHED}?includeDeleted=true`)).json(),
    ).data;
    expect(trashed.deletedAt).toBe('2026-10-30T06:35:20.000Z');
  });

  it('GET /requests/:id/steps (§6.3): the tree, one level, the error path', async () => {
    const tree = expectShape(
      pageSchema(stepSummarySchema),
      (await call('GET', `/api/v1/requests/${FAILED}/steps`)).json(),
    );
    expect(tree.page.total).toBe(9);
    expect(tree.data.find((step) => step.id === STEP(5))).toMatchObject({
      parentId: STEP(4),
      seq: 5,
      depth: 2,
      kind: 'method',
      layer: 'service',
      name: 'UserService.findById',
      childCount: 1,
      returnPreview: 'User { id: 7, name: "Ravi", tier: undefined }',
    });
    const children = expectShape(
      pageSchema(stepSummarySchema),
      (await call('GET', `/api/v1/requests/${FAILED}/steps?parentId=${STEP(4)}`)).json(),
    );
    expect(children.data.map((step) => step.seq)).toEqual([5, 7, 8]);
    const red = expectShape(
      pageSchema(stepSummarySchema),
      (await call('GET', `/api/v1/requests/${FAILED}/steps?onErrorPath=true`)).json(),
    );
    expect(red.data.map((step) => step.errorMessage)).toEqual(
      Array(3).fill("TypeError: Cannot read properties of undefined (reading 'rate')"),
    );
    await expectError(
      'GET',
      `/api/v1/requests/${FAILED}/steps?parentId=${STEP(99)}`,
      404,
      'STEP_NOT_FOUND',
    );
    await expectError('GET', `/api/v1/requests/${FAILED}/steps?kind=span`, 400, 'INVALID_PARAMS');
    await expectError('GET', `/api/v1/requests/${TRASHED}/steps`, 404, 'REQUEST_IN_TRASH');
  });

  it('GET /steps/:id (§6.4) matches the example step', async () => {
    const step = expectShape(
      dataSchema(stepDetailSchema),
      (await call('GET', `/api/v1/steps/${STEP(8)}`)).json(),
    ).data;
    expect(step).toMatchObject({
      name: 'PricingService.calculateDiscount',
      requestId: FAILED,
      className: 'PricingService',
      functionName: 'calculateDiscount',
      errorHandling: 'propagated',
      error: { type: 'TypeError', file: 'src/pricing/pricing.service.ts', line: 27, column: 31 },
      calledBy: { id: STEP(4), name: 'OrdersService.create' },
      absolutePath: path.resolve('/home/dev/shop-api', 'src/pricing/pricing.service.ts'),
      // The example project folder doesn't exist here, so the file counts as changed.
      fileChangedSince: true,
    });
    await expectError('GET', '/api/v1/steps/stp_bad', 400, 'INVALID_ID');
    await expectError('GET', `/api/v1/steps/${STEP(99)}`, 404, 'STEP_NOT_FOUND');
  });

  it('GET /requests/:id/curl (§6.5)', async () => {
    const response = await call('GET', `/api/v1/requests/${FAILED}/curl`);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body.startsWith("curl -X POST 'http://localhost:<port>/orders'")).toBe(true);
    store.sqlite.exec(
      `UPDATE requests SET state = 'in_progress', deleted_at = NULL WHERE id = '${OK}'`,
    );
    await expectError('GET', `/api/v1/requests/${OK}/curl`, 409, 'REQUEST_IN_PROGRESS');
  });
});

describe('delete, restore and trash', () => {
  it('DELETE /requests/:id (§7.1) moves it to the trash, idempotently', async () => {
    const first = expectShape(
      dataSchema(softDeleteResultSchema),
      (await call('DELETE', `/api/v1/requests/${OK}`)).json(),
    ).data;
    expect(first).toEqual({
      id: OK,
      deletedAt: '2026-10-30T06:40:00.000Z',
      purgeAt: '2026-11-02T06:40:00.000Z',
    });
    const again = expectShape(
      dataSchema(softDeleteResultSchema),
      (await call('DELETE', `/api/v1/requests/${OK}`)).json(),
    ).data;
    expect(again).toEqual(first);
    expect(events).toEqual([`deleted:${OK}`]);
  });

  it('DELETE /requests/:id refuses an in-progress request and an unknown one', async () => {
    store.sqlite.exec(`UPDATE requests SET state = 'in_progress' WHERE id = '${OK}'`);
    await expectError('DELETE', `/api/v1/requests/${OK}`, 409, 'REQUEST_IN_PROGRESS');
    await expectError(
      'DELETE',
      `/api/v1/requests/${OK}?permanent=true`,
      409,
      'REQUEST_IN_PROGRESS',
    );
    await expectError(
      'DELETE',
      '/api/v1/requests/req_01JBSEED0000000000000000ZZ',
      404,
      'REQUEST_NOT_FOUND',
    );
  });

  it('DELETE /requests/:id?permanent=true (§7.2) answers 204', async () => {
    const response = await call('DELETE', `/api/v1/requests/${FAILED}?permanent=true`);
    expect(response.status).toBe(204);
    expect(events).toEqual([`purged:${FAILED}`]);
    await expectError('GET', `/api/v1/requests/${FAILED}`, 404, 'REQUEST_NOT_FOUND');
  });

  it('DELETE /requests (§7.3) clears all finished requests', async () => {
    store.sqlite.exec(`UPDATE requests SET state = 'in_progress' WHERE id = '${OK}'`);
    const result = expectShape(
      dataSchema(clearAllResultSchema),
      (await call('DELETE', '/api/v1/requests')).json(),
    ).data;
    expect(result).toEqual({ moved: 1, skippedInProgress: 1, purgeAt: '2026-11-02T06:40:00.000Z' });
  });

  it('POST /requests/:id/restore (§7.4)', async () => {
    const result = expectShape(
      dataSchema(restoreResultSchema),
      (await call('POST', `/api/v1/requests/${TRASHED}/restore`)).json(),
    ).data;
    expect(result).toMatchObject({ request: { id: TRASHED, path: '/health' }, movedToTrash: [] });
    expect(events).toEqual([`restored:${TRASHED}`]);
    await expectError('POST', `/api/v1/requests/${OK}/restore`, 409, 'REQUEST_NOT_IN_TRASH');
    await expectError(
      'POST',
      '/api/v1/requests/req_01JBSEED0000000000000000ZZ/restore',
      404,
      'REQUEST_NOT_FOUND',
    );
  });

  it('GET /trash (§7.5) matches the example', async () => {
    const page = expectShape(
      pageSchema(trashItemSchema),
      (await call('GET', '/api/v1/trash')).json(),
    );
    expect(page.data).toEqual([
      expect.objectContaining({
        id: TRASHED,
        deletedAt: '2026-10-30T06:35:20.000Z',
        purgeAt: '2026-11-02T06:35:20.000Z',
      }),
    ]);
    await expectError('GET', '/api/v1/trash?sort=size', 400, 'INVALID_PARAMS');
  });

  it('DELETE /trash (§7.6) empties it', async () => {
    const result = expectShape(
      dataSchema(emptyTrashResultSchema),
      (await call('DELETE', '/api/v1/trash')).json(),
    ).data;
    expect(result).toEqual({ deleted: 1 });
    expect(events).toEqual([`purged:${TRASHED}`]);
  });
});

describe('routing errors (§8)', () => {
  it('answers 405 for a known path with the wrong method, 404 for an unknown one', async () => {
    const response = await call('PUT', `/api/v1/requests/${FAILED}`);
    expect(response.status).toBe(405);
    expect(response.headers.allow).toContain('GET');
    expect(expectShape(apiErrorSchema, response.json()).error.code).toBe('METHOD_NOT_ALLOWED');
    await expectError('GET', '/api/v1/nothing-here', 404, 'ROUTE_NOT_FOUND');
  });
});
