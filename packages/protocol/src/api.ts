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
