// `/api/v1/requests…` (`api-spec.md` §6.1, §6.2, §6.5, §7.1–§7.4).
import type { FastifyInstance, FastifyReply } from 'fastify';

import { sendError } from '../server/errors';
import { InvalidCursorError } from '../store/cursor';
import { clearAll, deletePermanently, restore, softDelete } from '../store/lifecycle';
import { getRequest, listRequests } from '../store/requests';
import type { RequestRow } from '../store/requests';
import { errorPath, getSession, inProgressCount } from '../store/sessions';
import type { ApiContext } from './context';
import { param, validate } from './context';
import { toCurl } from './curl';
import { iso, toRequestDetail, toRequestSummary } from './mappers';
import {
  clearAllQuery,
  deleteQuery,
  emptyQuery,
  ids,
  includeDeletedQuery,
  requestListQuery,
} from './params';

const HOUR_MS = 60 * 60 * 1000;

/** Looks a request up and answers 404 (gone) / 404 REQUEST_IN_TRASH itself; undefined = replied. */
export function findRequest(
  ctx: ApiContext,
  reply: FastifyReply,
  id: string,
  includeDeleted: boolean,
): RequestRow | undefined {
  const row = getRequest(ctx.db, id, true);
  if (!row) {
    void sendError(reply, 404, 'REQUEST_NOT_FOUND', 'This request no longer exists.', {
      requestId: id,
    });
    return undefined;
  }
  if (row.deletedAt !== null && !includeDeleted) {
    void sendError(reply, 404, 'REQUEST_IN_TRASH', 'This request is in the trash.', {
      requestId: id,
      deletedAt: iso(row.deletedAt),
    });
    return undefined;
  }
  return row;
}

export function registerRequestRoutes(app: FastifyInstance, ctx: ApiContext): void {
  app.get('/requests', async (request, reply) => {
    const query = validate(requestListQuery, request.query, reply);
    if (!query) return reply;
    const { limit, cursor, sort, ...filters } = query;
    try {
      const page = listRequests(ctx.db, filters, { limit, cursor, sort });
      return { data: page.data.map(toRequestSummary), page: page.page };
    } catch (error) {
      if (error instanceof InvalidCursorError)
        return sendError(reply, 400, 'INVALID_CURSOR', error.message);
      throw error;
    }
  });

  app.get('/requests/:requestId', async (request, reply) => {
    const id = validate(ids.request, param(request, 'requestId'), reply, 'INVALID_ID');
    const query = id && validate(includeDeletedQuery, request.query, reply);
    if (!id || !query) return reply;
    const row = findRequest(ctx, reply, id, query.includeDeleted);
    const session = row && getSession(ctx.db, row.sessionId);
    if (!row || !session) return reply;
    return { data: toRequestDetail(row, session, errorPath(ctx.db, id)) };
  });

  app.get('/requests/:requestId/curl', async (request, reply) => {
    const id = validate(ids.request, param(request, 'requestId'), reply, 'INVALID_ID');
    if (!id || !validate(emptyQuery, request.query, reply)) return reply;
    const row = findRequest(ctx, reply, id, false);
    if (!row) return reply;
    if (row.state === 'in_progress')
      return sendError(reply, 409, 'REQUEST_IN_PROGRESS', 'Wait until the request finishes.', {
        requestId: id,
      });
    const detail = toRequestDetail(row, getSession(ctx.db, row.sessionId)!, []);
    const curl = toCurl({ method: detail.method, path: detail.path, request: detail.request });
    return reply.type('text/plain; charset=utf-8').send(curl.command);
  });

  app.delete('/requests/:requestId', async (request, reply) => {
    const id = validate(ids.request, param(request, 'requestId'), reply, 'INVALID_ID');
    const query = id && validate(deleteQuery, request.query, reply);
    if (!id || !query) return reply;
    if (query.permanent) {
      const result = deletePermanently(ctx.db, id);
      if (result === 'not_found')
        return sendError(reply, 404, 'REQUEST_NOT_FOUND', 'This request no longer exists.', {
          requestId: id,
        });
      if (result === 'in_progress')
        return sendError(
          reply,
          409,
          'REQUEST_IN_PROGRESS',
          'Wait until the request finishes before deleting it.',
          { requestId: id },
        );
      ctx.events.purged?.([id]);
      return reply.code(204).send();
    }
    const now = ctx.now();
    const result = softDelete(ctx.db, id, now);
    if (result === 'not_found')
      return sendError(reply, 404, 'REQUEST_NOT_FOUND', 'This request no longer exists.', {
        requestId: id,
      });
    if (result === 'in_progress')
      return sendError(
        reply,
        409,
        'REQUEST_IN_PROGRESS',
        'Wait until the request finishes before deleting it.',
        { requestId: id },
      );
    // Deleting a request already in the trash answers the same way (idempotent, §7.1).
    const deletedAt = result === 'ok' ? now : (getRequest(ctx.db, id, true)?.deletedAt ?? now);
    if (result === 'ok') ctx.events.deleted?.([id], deletedAt);
    return {
      data: {
        id,
        deletedAt: iso(deletedAt),
        purgeAt: iso(deletedAt + ctx.settings().trashTtlHours * HOUR_MS),
      },
    };
  });

  app.delete('/requests', async (request, reply) => {
    const query = validate(clearAllQuery, request.query, reply);
    if (!query) return reply;
    const now = ctx.now();
    const moved = clearAll(ctx.db, now, query.sessionId);
    if (moved.length > 0) ctx.events.deleted?.(moved, now);
    return {
      data: {
        moved: moved.length,
        skippedInProgress: inProgressCount(ctx.db, query.sessionId),
        purgeAt: iso(now + ctx.settings().trashTtlHours * HOUR_MS),
      },
    };
  });

  app.post('/requests/:requestId/restore', async (request, reply) => {
    const id = validate(ids.request, param(request, 'requestId'), reply, 'INVALID_ID');
    if (!id || !validate(emptyQuery, request.query, reply)) return reply;
    const now = ctx.now();
    const { result, trashed } = restore(ctx.db, id, ctx.settings().retention, now);
    if (result === 'not_found')
      return sendError(reply, 404, 'REQUEST_NOT_FOUND', 'This request was permanently deleted.', {
        requestId: id,
      });
    if (result === 'not_in_trash')
      return sendError(reply, 409, 'REQUEST_NOT_IN_TRASH', 'This request is not in the trash.', {
        requestId: id,
      });
    ctx.events.restored?.(id);
    if (trashed.length > 0) ctx.events.deleted?.(trashed, now);
    return { data: { request: toRequestSummary(getRequest(ctx.db, id)!), movedToTrash: trashed } };
  });
}
