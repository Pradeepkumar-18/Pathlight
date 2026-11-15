// REST shapes (`api-spec.md` §4.3–§4.9) and error codes (§8).
import { z } from 'zod';

import {
  boundaryTypeSchema,
  capturedValueSchema,
  errorHandlingSchema,
  frameworkSchema,
  httpMethodSchema,
  isoTimeSchema,
  layerSchema,
  nanosSchema,
  requestIdSchema,
  requestStateSchema,
  sessionIdSchema,
  sessionStatusSchema,
  stepIdSchema,
  stepKindSchema,
  stepStatusSchema,
} from './values';

export const sessionSchema = z.strictObject({
  id: sessionIdSchema,
  pid: z.int().positive(),
  command: z.string().nullable(),
  framework: frameworkSchema,
  nodeVersion: z.string(),
  agentVersion: z.string(),
  status: sessionStatusSchema,
  disabledReason: z.string().nullable(),
  connectedAt: isoTimeSchema,
  disconnectedAt: isoTimeSchema.nullable(),
});
export type Session = z.infer<typeof sessionSchema>;

export const requestSummarySchema = z.strictObject({
  id: requestIdSchema,
  sessionId: sessionIdSchema,
  method: httpMethodSchema,
  path: z.string(),
  route: z.string().nullable(),
  state: requestStateSchema,
  httpStatus: z.int().min(100).max(599).nullable(),
  hasError: z.boolean(),
  stepCount: z.int().nonnegative(),
  truncated: z.boolean(),
  startedAt: isoTimeSchema,
  durationNs: nanosSchema.nullable(),
});
export type RequestSummary = z.infer<typeof requestSummarySchema>;

export const requestDetailSchema = z.strictObject({
  ...requestSummarySchema.shape,
  endedAt: isoTimeSchema.nullable(),
  request: z.strictObject({
    params: capturedValueSchema.nullable(),
    query: capturedValueSchema.nullable(),
    body: capturedValueSchema.nullable(),
    headers: capturedValueSchema.nullable(),
  }),
  response: z
    .strictObject({ headers: capturedValueSchema.nullable(), body: capturedValueSchema.nullable() })
    .nullable(),
  errorStepId: stepIdSchema.nullable(),
  /** Step IDs from the root to the error, for auto-expansion. */
  errorPath: z.array(stepIdSchema),
  deletedAt: isoTimeSchema.nullable(),
  session: sessionSchema,
});
export type RequestDetail = z.infer<typeof requestDetailSchema>;

export const stepSummarySchema = z.strictObject({
  id: stepIdSchema,
  parentId: stepIdSchema.nullable(),
  seq: z.int().positive(),
  depth: z.int().nonnegative(),
  kind: stepKindSchema,
  layer: layerSchema.nullable(),
  name: z.string(),
  file: z.string().nullable(),
  line: z.int().positive().nullable(),
  column: z.int().positive().nullable(),
  isAsync: z.boolean(),
  status: stepStatusSchema,
  errorHandling: errorHandlingSchema.nullable(),
  boundaryType: boundaryTypeSchema.nullable(),
  onErrorPath: z.boolean(),
  collapsedCount: z.int().positive(),
  childCount: z.int().nonnegative(),
  startOffsetNs: nanosSchema,
  durationNs: nanosSchema.nullable(),
  returnPreview: z.string().nullable(),
  errorMessage: z.string().nullable(),
  hasSuspiciousValue: z.boolean(),
});
export type StepSummary = z.infer<typeof stepSummarySchema>;

export const stackFrameSchema = z.strictObject({
  fn: z.string().nullable(),
  file: z.string(),
  line: z.int().positive(),
  column: z.int().positive(),
  internal: z.boolean(),
});
export type StackFrame = z.infer<typeof stackFrameSchema>;

export const stepDetailSchema = z.strictObject({
  ...stepSummarySchema.shape,
  requestId: requestIdSchema,
  className: z.string().nullable(),
  functionName: z.string().nullable(),
  thisClass: z.string().nullable(),
  args: z.array(capturedValueSchema).nullable(),
  argNames: z.array(z.string()).nullable(),
  returnValue: capturedValueSchema.nullable(),
  error: z
    .strictObject({
      type: z.string(),
      message: z.string(),
      stack: z.array(stackFrameSchema),
      file: z.string().nullable(),
      line: z.int().positive().nullable(),
      column: z.int().positive().nullable(),
    })
    .nullable(),
  /** Kind-specific detail (`data-model.md` §6). */
  detail: z.record(z.string(), z.unknown()).nullable(),
  calledBy: z.strictObject({ id: stepIdSchema, name: z.string() }).nullable(),
  /** Absolute path of `file`; the browser builds the editor link (decision 0014). */
  absolutePath: z.string().nullable(),
  fileChangedSince: z.boolean(),
});
export type StepDetail = z.infer<typeof stepDetailSchema>;

/** Cursor-paginated list (`api-spec.md` §4.8, §9). */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.strictObject({
    data: z.array(item),
    page: z.strictObject({
      limit: z.int().positive(),
      nextCursor: z.string().nullable(),
      total: z.int().nonnegative(),
    }),
  });
}
export interface Page<T> {
  data: T[];
  page: { limit: number; nextCursor: string | null; total: number };
}

export const API_ERROR_CODES = [
  'INVALID_PARAMS',
  'INVALID_ID',
  'INVALID_CURSOR',
  'INVALID_BODY',
  'MISSING_TOKEN',
  'INVALID_TOKEN',
  'ORIGIN_NOT_ALLOWED',
  'HOST_NOT_ALLOWED',
  'ROUTE_NOT_FOUND',
  'REQUEST_NOT_FOUND',
  'REQUEST_IN_TRASH',
  'STEP_NOT_FOUND',
  'OBJECT_NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'REQUEST_IN_PROGRESS',
  'REQUEST_NOT_IN_TRASH',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'STORE_UNAVAILABLE',
] as const;
export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

/** Every non-2xx REST response (`api-spec.md` §4.9, §8). */
export const apiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: apiErrorCodeSchema,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/** WebSocket close codes (`api-spec.md` §8). */
export const WS_CLOSE_CODES = {
  normal: 1000,
  goingAway: 1001,
  invalidToken: 4001,
  originNotAllowed: 4003,
  tooManyInvalidMessages: 4008,
  protocolMismatch: 4009,
  messageTooLarge: 4013,
  tooManyConnections: 4029,
} as const;

/** Response bodies of the MVP endpoints (`api-spec.md` §5–§7), as documented there. */
const sessionWarningSchema = z.strictObject({
  code: z.string(),
  message: z.string(),
  file: z.string().optional(),
});

/** §5.1 */
export const healthSchema = z.strictObject({
  status: z.literal('ok'),
  collectorVersion: z.string(),
  protocolVersion: z.int().positive(),
  startedAt: isoTimeSchema,
  project: z.strictObject({ name: z.string(), cwd: z.string() }),
  agents: z.array(
    z.strictObject({
      sessionId: sessionIdSchema,
      pid: z.int().positive(),
      framework: frameworkSchema,
      status: sessionStatusSchema,
      warnings: z.array(sessionWarningSchema),
    }),
  ),
  storage: z.strictObject({
    mode: z.enum(['sqlite', 'memory']),
    activeRequests: z.int().nonnegative(),
    trashedRequests: z.int().nonnegative(),
  }),
});
export type Health = z.infer<typeof healthSchema>;

/** §7.5 */
export const trashItemSchema = z.strictObject({
  ...requestSummarySchema.shape,
  deletedAt: isoTimeSchema,
  purgeAt: isoTimeSchema,
});
export type TrashItem = z.infer<typeof trashItemSchema>;

/** §7.1 */
export const softDeleteResultSchema = z.strictObject({
  id: requestIdSchema,
  deletedAt: isoTimeSchema,
  purgeAt: isoTimeSchema,
});
/** §7.3 */
export const clearAllResultSchema = z.strictObject({
  moved: z.int().nonnegative(),
  skippedInProgress: z.int().nonnegative(),
  purgeAt: isoTimeSchema,
});
/** §7.4 */
export const restoreResultSchema = z.strictObject({
  request: requestSummarySchema,
  movedToTrash: z.array(requestIdSchema),
});
/** §7.6 */
export const emptyTrashResultSchema = z.strictObject({ deleted: z.int().nonnegative() });

/** §6.10: the built-in example, marked `sample: true`. */
export const sampleSchema = z.strictObject({
  request: z.strictObject({ ...requestDetailSchema.shape, sample: z.literal(true) }),
  steps: z.array(stepSummarySchema),
  stepDetails: z.record(stepIdSchema, stepDetailSchema),
});
export type Sample = z.infer<typeof sampleSchema>;

/** `{ "data": … }` wrapper of single-object responses. */
export function dataSchema<T extends z.ZodType>(item: T) {
  return z.strictObject({ data: item });
}
