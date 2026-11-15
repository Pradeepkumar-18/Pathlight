// Query-string validation (`api-spec.md` §6, §7, §9): strict, so a typo is a 400, not silence.
import { z } from 'zod';

import {
  httpMethodSchema,
  requestIdSchema,
  requestStateSchema,
  sessionIdSchema,
  sessionStatusSchema,
  stepIdSchema,
  stepKindSchema,
} from '@pathlight-tracker/protocol';

const bool = z.enum(['true', 'false']).transform((value) => value === 'true');
/** `method=GET,POST` → `['GET', 'POST']`, each item validated. */
const csv = <T extends z.ZodType>(item: T) =>
  z.preprocess(
    (value) =>
      typeof value === 'string'
        ? value
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
        : value,
    z.array(item).min(1),
  );
const limit = (max: number, fallback: number) =>
  z.coerce.number().int().min(1).max(max).default(fallback);
const isoMs = z.iso.datetime({ offset: true }).transform((value) => Date.parse(value));
const statusFilter = z.union([
  z.enum(['2xx', '3xx', '4xx', '5xx']),
  z.coerce.number().int().min(100).max(599),
]);

/** §6.1 */
export const requestListQuery = z.strictObject({
  limit: limit(200, 50),
  cursor: z.string().min(1).optional(),
  sort: z.enum(['-startedAt', 'startedAt', '-durationNs', 'durationNs']).default('-startedAt'),
  method: csv(httpMethodSchema).optional(),
  status: csv(statusFilter).optional(),
  hasError: bool.optional(),
  state: csv(requestStateSchema).optional(),
  path: z.string().max(200).optional(),
  route: z.string().max(200).optional(),
  sessionId: sessionIdSchema.optional(),
  since: isoMs.optional(),
  until: isoMs.optional(),
  minDurationMs: z.coerce.number().nonnegative().optional(),
});

/** §6.2, §6.4 */
export const includeDeletedQuery = z.strictObject({ includeDeleted: bool.default(false) });

/** §6.3 */
export const stepListQuery = z.strictObject({
  parentId: z.union([z.literal('root'), stepIdSchema]).optional(),
  kind: csv(stepKindSchema).optional(),
  onErrorPath: bool.optional(),
  limit: limit(2000, 500),
  cursor: z.string().min(1).optional(),
  includeDeleted: bool.default(false),
});

/** §5.3 */
export const sessionListQuery = z.strictObject({ status: sessionStatusSchema.optional() });

/** §7.2 */
export const deleteQuery = z.strictObject({ permanent: bool.default(false) });

/** §7.3 */
export const clearAllQuery = z.strictObject({ sessionId: sessionIdSchema.optional() });

/** §7.5 */
export const trashListQuery = z.strictObject({
  limit: limit(200, 50),
  cursor: z.string().min(1).optional(),
  sort: z.enum(['-deletedAt', 'deletedAt']).default('-deletedAt'),
});

export const emptyQuery = z.strictObject({});

export const ids = { request: requestIdSchema, step: stepIdSchema };
