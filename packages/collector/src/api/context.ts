// What every route needs, and the small helpers they share.
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import type { Db } from '../store/open';
import { sendError } from '../server/errors';

/** Changes the live hub (task 2.11) pushes to open UIs. */
export interface ApiEvents {
  deleted?: (requestIds: string[], deletedAt: number) => void;
  restored?: (requestId: string) => void;
  purged?: (requestIds: string[]) => void;
}

export interface ApiContext {
  db: Db;
  version: string;
  projectRoot: string;
  startedAt: number;
  settings: () => { retention: number; trashTtlHours: number };
  now: () => number;
  events: ApiEvents;
}

/** Validates params; on failure sends `400 <code>` and returns undefined. */
export function validate<T extends z.ZodType>(
  schema: T,
  input: unknown,
  reply: FastifyReply,
  code: 'INVALID_PARAMS' | 'INVALID_ID' = 'INVALID_PARAMS',
): z.infer<T> | undefined {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const where = issue?.path.length ? `${issue.path.join('.')}: ` : '';
  void sendError(reply, 400, code, `${where}${issue?.message ?? 'invalid'}`);
  return undefined;
}

export function param(request: FastifyRequest, name: string): string {
  return (request.params as Record<string, string>)[name] ?? '';
}
