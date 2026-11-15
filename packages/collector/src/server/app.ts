// The collector's HTTP server (`architecture.md` §4, `api-spec.md` §3, §8, §10): 127.0.0.1 only,
// host / origin / token checks, the error envelope, rate and size limits, and the UI files.
import { existsSync } from 'node:fs';
import type { IncomingHttpHeaders } from 'node:http';

import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import type { WebSocket } from '@fastify/websocket';
import Fastify, { LogController } from 'fastify';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';

import { PROTOCOL_SUBPROTOCOL, WS_CLOSE_CODES } from '@pathlight-tracker/protocol';

import { ulid } from '../ids';
import { registerErrorHandlers, sendError } from './errors';
import {
  agentOriginAllowed,
  bearerToken,
  hostAllowed,
  liveOriginAllowed,
  offersProtocol,
  restOriginAllowed,
  subprotocolToken,
  tokensMatch,
} from './guards';

export const MAX_BODY_BYTES = 64 * 1024;
/**
 * Hard cap in the WebSocket library. Ingest enforces the real 1 MB limit itself so it can
 * close with the spec's 4013 (the library would close with 1009).
 */
export const WS_MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;
/** "100/s, burst 200" for reads and "10/s" for writes, as fixed 2-second windows. */
const RATE_WINDOW_MS = 2000;
const READS_PER_WINDOW = 200;
const WRITES_PER_WINDOW = 20;

export interface ServerOptions {
  token: string;
  version: string;
  /** Built UI files (`packages/ui/dist`); a placeholder page is served until task 4.1. */
  uiDir?: string;
  /** The collector's pino logger; nothing is logged without one. */
  logger?: FastifyBaseLogger;
}

export interface CollectorServer {
  app: FastifyInstance;
  /** Set once listening; the guards compare `Host` and `Origin` against it. */
  port: () => number;
  setPort: (port: number) => void;
  /**
   * Checks a WebSocket after the handshake. Returns false (and closes the socket with the
   * right code) when it must not be used.
   */
  admitSocket: (
    socket: WebSocket,
    headers: IncomingHttpHeaders,
    channel: 'agent' | 'live',
  ) => boolean;
}

function contentSecurityPolicy(port: number): string {
  const self = [
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
    `ws://127.0.0.1:${port}`,
    `ws://localhost:${port}`,
  ];
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${self.join(' ')}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

const PLACEHOLDER = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Pathlight Tracker</title></head>
<body><h1>Pathlight Tracker</h1><p>The collector is running. The map UI arrives in task 4.1.</p></body></html>`;

export async function createServer(options: ServerOptions): Promise<CollectorServer> {
  let port = 0;
  const app = Fastify({
    ...(options.logger ? { loggerInstance: options.logger } : { logger: false }),
    // Errors are logged by the error handler; a line per UI call would drown the app's own output.
    logController: new LogController({ disableRequestLogging: true }),
    // The request ID is the `logId` returned with 500 / 503 errors, so it must be unique across runs.
    genReqId: () => ulid(),
    bodyLimit: MAX_BODY_BYTES,
  });
  registerErrorHandlers(app);

  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Pathlight-Tracker-Version', options.version);
    if (!hostAllowed(request.headers.host, port)) {
      return sendError(reply, 403, 'HOST_NOT_ALLOWED', 'Unexpected Host header.');
    }
    if (!request.url.startsWith('/api/')) return;
    reply.header('Cache-Control', 'no-store');
    if (!restOriginAllowed(request.headers.origin, port)) {
      return sendError(
        reply,
        403,
        'ORIGIN_NOT_ALLOWED',
        'Requests from other websites are not allowed.',
      );
    }
    const given = bearerToken(request.headers);
    if (given === undefined)
      return sendError(
        reply,
        401,
        'MISSING_TOKEN',
        'Send the token as "Authorization: Bearer <token>".',
      );
    if (!tokensMatch(options.token, given)) {
      return sendError(
        reply,
        401,
        'INVALID_TOKEN',
        'The token does not match this project. Open the link printed in the terminal.',
      );
    }
  });

  await app.register(rateLimit, {
    global: true,
    timeWindow: RATE_WINDOW_MS,
    max: (request) => (request.method === 'GET' ? READS_PER_WINDOW : WRITES_PER_WINDOW),
    allowList: (request) => !request.url.startsWith('/api/'),
    keyGenerator: (request) =>
      `${bearerToken(request.headers) ?? 'anonymous'}:${request.method === 'GET' ? 'read' : 'write'}`,
    enableDraftSpec: true,
    errorResponseBuilder: (_request, context) => {
      const error = new Error(`Rate limit exceeded, retry in ${context.after}`) as Error & {
        statusCode: number;
      };
      error.statusCode = 429;
      return error;
    },
  });

  await app.register(websocket, {
    options: {
      maxPayload: WS_MAX_PAYLOAD_BYTES,
      handleProtocols: (protocols: Set<string>) =>
        protocols.has(PROTOCOL_SUBPROTOCOL) ? PROTOCOL_SUBPROTOCOL : false,
    },
  });

  // The UI shell holds no data, so it needs no token (`api-spec.md` §3).
  app.addHook('onSend', async (request, reply, payload) => {
    if (!request.url.startsWith('/api/') && reply.statusCode < 400) {
      reply.header('Content-Security-Policy', contentSecurityPolicy(port));
    }
    return payload;
  });
  if (options.uiDir !== undefined && existsSync(options.uiDir)) {
    await app.register(fastifyStatic, { root: options.uiDir, index: ['index.html'] });
  } else {
    app.get('/', async (_request, reply) =>
      reply.type('text/html; charset=utf-8').send(PLACEHOLDER),
    );
  }

  const admitSocket: CollectorServer['admitSocket'] = (socket, headers, channel) => {
    const close = (code: number, reason: string): false => {
      socket.close(code, reason);
      return false;
    };
    if (!hostAllowed(headers.host, port))
      return close(WS_CLOSE_CODES.originNotAllowed, 'host not allowed');
    const originOk =
      channel === 'agent'
        ? agentOriginAllowed(headers.origin)
        : liveOriginAllowed(headers.origin, port);
    if (!originOk) return close(WS_CLOSE_CODES.originNotAllowed, 'origin not allowed');
    if (!offersProtocol(headers) || !tokensMatch(options.token, subprotocolToken(headers))) {
      return close(WS_CLOSE_CODES.invalidToken, 'missing or invalid token');
    }
    return true;
  };

  return { app, port: () => port, setPort: (value) => (port = value), admitSocket };
}
