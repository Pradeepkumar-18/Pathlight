// `/api/v1/health`, `/sessions`, `/trash` and `/sample` (`api-spec.md` §5.1, §5.3, §6.10, §7.5, §7.6).
import path from 'node:path';

import type { FastifyInstance } from 'fastify';

import { PROTOCOL_VERSION } from '@pathlight-tracker/protocol';
import type { Health, Sample, StepDetail } from '@pathlight-tracker/protocol';

import { sendError } from '../server/errors';
import { InvalidCursorError } from '../store/cursor';
import { emptyTrash } from '../store/lifecycle';
import { openStore } from '../store/open';
import { getRequest, listTrash } from '../store/requests';
import { loadSeed } from '../store/seed';
import { errorPath, getSession, listSessions, requestCounts } from '../store/sessions';
import { childCounts, listSteps } from '../store/steps';
import type { ApiContext } from './context';
import { validate } from './context';
import {
  iso,
  toRequestDetail,
  toSession,
  toStepDetail,
  toStepSummary,
  toTrashItem,
} from './mappers';
import { emptyQuery, sessionListQuery, trashListQuery } from './params';

const SAMPLE_REQUEST = 'req_01JBSEED000000000000000001';

/** The seed's failing POST /orders, built once in memory; nothing touches the user's store. */
function buildSample(): Sample {
  const store = openStore({ projectRoot: '.', dbPath: ':memory:', version: '0.0.0' });
  try {
    loadSeed(store);
    const db = store.db;
    const session = getSession(db, 'ses_01JBSEED000000000000000001')!;
    const row = getRequest(db, SAMPLE_REQUEST)!;
    const counts = childCounts(db, SAMPLE_REQUEST);
    const rows = listSteps(db, SAMPLE_REQUEST, {}, { limit: 2000 }).data;
    const byId = new Map(rows.map((step) => [step.id, step]));
    const stepDetails: Record<string, StepDetail> = {};
    for (const step of rows) {
      stepDetails[step.id] = {
        ...toStepDetail(step, {
          childCount: counts.get(step.id) ?? 0,
          parent: step.parentId === null ? undefined : byId.get(step.parentId),
          cwd: session.cwd,
          startedAt: row.startedAt,
        }),
        fileChangedSince: false,
      };
    }
    return {
      request: { ...toRequestDetail(row, session, errorPath(db, SAMPLE_REQUEST)), sample: true },
      steps: rows.map((step) => toStepSummary(step, counts.get(step.id) ?? 0)),
      stepDetails,
    };
  } finally {
    store.close();
  }
}

export function registerStatusRoutes(app: FastifyInstance, ctx: ApiContext): void {
  let sample: Sample | undefined;

  app.get('/health', async (request, reply) => {
    if (!validate(emptyQuery, request.query, reply)) return reply;
    const counts = requestCounts(ctx.db);
    const health: Health = {
      status: 'ok',
      collectorVersion: ctx.version,
      protocolVersion: PROTOCOL_VERSION,
      startedAt: iso(ctx.startedAt),
      project: { name: path.basename(ctx.projectRoot), cwd: ctx.projectRoot },
      // Apps that are running now: connected, or connected but with the agent switched off.
      agents: listSessions(ctx.db)
        .filter((session) => session.status !== 'disconnected')
        .map((session) => ({
          sessionId: session.id,
          pid: session.pid,
          framework: session.framework,
          status: session.status,
          warnings: session.warningsJson
            ? (JSON.parse(session.warningsJson) as Health['agents'][number]['warnings'])
            : [],
        })),
      storage: { mode: 'sqlite', activeRequests: counts.active, trashedRequests: counts.trashed },
    };
    return health;
  });

  app.get('/sessions', async (request, reply) => {
    const query = validate(sessionListQuery, request.query, reply);
    if (!query) return reply;
    return { data: listSessions(ctx.db, query.status).map(toSession) };
  });

  app.get('/trash', async (request, reply) => {
    const query = validate(trashListQuery, request.query, reply);
    if (!query) return reply;
    try {
      const page = listTrash(ctx.db, query);
      return {
        data: page.data.map((row) => toTrashItem(row, ctx.settings().trashTtlHours)),
        page: page.page,
      };
    } catch (error) {
      if (error instanceof InvalidCursorError)
        return sendError(reply, 400, 'INVALID_CURSOR', error.message);
      throw error;
    }
  });

  app.delete('/trash', async (request, reply) => {
    if (!validate(emptyQuery, request.query, reply)) return reply;
    const deleted = emptyTrash(ctx.db);
    if (deleted.length > 0) ctx.events.purged?.(deleted);
    return { data: { deleted: deleted.length } };
  });

  app.get('/sample', async (request, reply) => {
    if (!validate(emptyQuery, request.query, reply)) return reply;
    sample ??= buildSample();
    return { data: sample };
  });
}
