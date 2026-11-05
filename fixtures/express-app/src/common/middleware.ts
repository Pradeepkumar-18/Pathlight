import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import { HttpError } from './http-error';

// A fixed key keeps the fixture self-contained; the middleware exists so the
// map shows a chain of middleware before the route handler.
export const FIXTURE_API_KEY = 'fixture-key';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = req.header('x-request-id') ?? randomUUID();
  res.setHeader('x-request-id', id);
  next();
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  next();
}

export function requireApiKey(req: Request, _res: Response, next: NextFunction): void {
  if (req.header('x-api-key') !== FIXTURE_API_KEY) {
    next(new HttpError(401, 'Missing or wrong API key'));
    return;
  }
  next();
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  // Unexpected errors are logged with their stack (source-mapped to `.ts`)
  // and hidden from the client.
  console.error(`${req.method} ${req.originalUrl} failed`);
  console.error(error instanceof Error ? error.stack : error);
  res.status(500).json({ error: 'Internal server error' });
}
