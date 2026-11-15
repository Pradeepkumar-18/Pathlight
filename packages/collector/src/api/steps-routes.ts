// `/api/v1/requests/:requestId/steps` and `/api/v1/steps/:stepId` (`api-spec.md` §6.3, §6.4).
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import { sendError } from '../server/errors';
import { InvalidCursorError } from '../store/cursor';
import { steps } from '../store/schema';
import { getSession } from '../store/sessions';
import { childCounts, getStep, listSteps } from '../store/steps';
import type { ApiContext } from './context';
import { param, validate } from './context';
import { toStepDetail, toStepSummary } from './mappers';
import { ids, includeDeletedQuery, stepListQuery } from './params';
import { findRequest } from './requests-routes';

export function registerStepRoutes(app: FastifyInstance, ctx: ApiContext): void {
  app.get('/requests/:requestId/steps', async (request, reply) => {
    const id = validate(ids.request, param(request, 'requestId'), reply, 'INVALID_ID');
    const query = id && validate(stepListQuery, request.query, reply);
    if (!id || !query) return reply;
    if (!findRequest(ctx, reply, id, query.includeDeleted)) return reply;
    const { limit, cursor, includeDeleted: _includeDeleted, ...filters } = query;
    if (
      filters.parentId !== undefined &&
      filters.parentId !== 'root' &&
      !getStep(ctx.db, id, filters.parentId)
    ) {
      return sendError(reply, 404, 'STEP_NOT_FOUND', 'No such step in this request.', {
        stepId: filters.parentId,
      });
    }
    try {
      const page = listSteps(ctx.db, id, filters, { limit, cursor });
      const counts = childCounts(ctx.db, id);
      return {
        data: page.data.map((row) => toStepSummary(row, counts.get(row.id) ?? 0)),
        page: page.page,
      };
    } catch (error) {
      if (error instanceof InvalidCursorError)
        return sendError(reply, 400, 'INVALID_CURSOR', error.message);
      throw error;
    }
  });

  app.get('/steps/:stepId', async (request, reply) => {
    const id = validate(ids.step, param(request, 'stepId'), reply, 'INVALID_ID');
    const query = id && validate(includeDeletedQuery, request.query, reply);
    if (!id || !query) return reply;
    const row = ctx.db.select().from(steps).where(eq(steps.id, id)).get();
    if (!row) return sendError(reply, 404, 'STEP_NOT_FOUND', 'No such step.', { stepId: id });
    const owner = findRequest(ctx, reply, row.requestId, query.includeDeleted);
    const session = owner && getSession(ctx.db, owner.sessionId);
    if (!owner || !session) return reply;
    const parent = row.parentId === null ? undefined : getStep(ctx.db, row.requestId, row.parentId);
    return {
      data: toStepDetail(row, {
        childCount: childCounts(ctx.db, row.requestId).get(row.id) ?? 0,
        parent,
        cwd: session.cwd,
        startedAt: owner.startedAt,
      }),
    };
  });
}
