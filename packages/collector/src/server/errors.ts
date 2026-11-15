// The error envelope (`api-spec.md` §4.9, §8): every non-2xx REST response looks the same.
import type { FastifyError, FastifyInstance, FastifyReply } from 'fastify';

import type { ApiError, ApiErrorCode } from '@pathlight-tracker/protocol';

export function sendError(
  reply: FastifyReply,
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>,
): FastifyReply {
  const body: ApiError = { error: { code, message, ...(details ? { details } : {}) } };
  return reply.code(status).type('application/json; charset=utf-8').send(body);
}

/** Fastify's own error codes → ours. Anything unknown is a 500, logged with a correlation ID. */
const FASTIFY_ERRORS: Record<string, [number, ApiErrorCode, string]> = {
  FST_ERR_CTP_BODY_TOO_LARGE: [
    413,
    'PAYLOAD_TOO_LARGE',
    'The request body is too large (64 KB max).',
  ],
  FST_ERR_CTP_INVALID_MEDIA_TYPE: [415, 'UNSUPPORTED_MEDIA_TYPE', 'Send the body as JSON.'],
  FST_ERR_CTP_EMPTY_JSON_BODY: [400, 'INVALID_BODY', 'The JSON body is empty.'],
  FST_ERR_CTP_INVALID_JSON_BODY: [400, 'INVALID_BODY', 'The body is not valid JSON.'],
};

/** SQLite result codes meaning "the database is locked or can't be read" (not a bug of ours). */
const STORE_UNAVAILABLE_CODES = /^SQLITE_(BUSY|LOCKED|CANTOPEN|IOERR|CORRUPT|NOTADB|FULL|READONLY)/;

export function isStoreUnavailable(error: { code?: unknown }): boolean {
  return (
    typeof error.code === 'string' &&
    (error.code === 'STORE_UNAVAILABLE' || STORE_UNAVAILABLE_CODES.test(error.code))
  );
}

export function registerErrorHandlers(app: FastifyInstance): void {
  // Remember every route's path pattern, so a known path with the wrong method gets 405, not 404.
  const routes: { pattern: RegExp; methods: string[] }[] = [];
  app.addHook('onRoute', (route) => {
    // Catch-all routes (static UI files) say nothing about which methods a path supports.
    if (route.url.includes('*')) return;
    const pattern = new RegExp(`^${route.url.replace(/:[^/]+/g, '[^/]+').replace(/\*/g, '.*')}/?$`);
    routes.push({ pattern, methods: ([] as string[]).concat(route.method) });
  });

  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split('?')[0] ?? '';
    const allowed = routes
      .filter((route) => route.pattern.test(path))
      .flatMap((route) => route.methods);
    if (allowed.length > 0 && !allowed.includes(request.method)) {
      void reply.header('Allow', [...new Set(allowed)].join(', '));
      return sendError(
        reply,
        405,
        'METHOD_NOT_ALLOWED',
        `${request.method} is not allowed on ${path}.`,
      );
    }
    return sendError(reply, 404, 'ROUTE_NOT_FOUND', `No endpoint ${request.method} ${path}.`);
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const known = error.code ? FASTIFY_ERRORS[error.code] : undefined;
    if (known) return sendError(reply, known[0], known[1], known[2]);
    if (error.statusCode === 429) {
      return sendError(
        reply,
        429,
        'RATE_LIMITED',
        'Too many requests. Wait a moment and try again.',
      );
    }
    if (error.code === 'FST_ERR_BAD_STATUS_CODE' || error.validation) {
      return sendError(reply, 400, 'INVALID_PARAMS', error.message);
    }
    if (isStoreUnavailable(error)) {
      request.log.error(
        { code: 'STORE_UNAVAILABLE', logId: request.id, sqliteCode: error.code },
        'database locked or unreadable',
      );
      return sendError(reply, 503, 'STORE_UNAVAILABLE', 'The database is busy. Retry shortly.', {
        logId: request.id,
      });
    }
    // Never echo internals or captured values; the log has the details.
    request.log.error(
      { code: 'INTERNAL_ERROR', logId: request.id, err: error },
      'unexpected collector error',
    );
    return sendError(reply, 500, 'INTERNAL_ERROR', 'Something went wrong in Pathlight Tracker.', {
      logId: request.id,
    });
  });
}
