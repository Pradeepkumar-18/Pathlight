// Shared building blocks (`api-spec.md` §4.1, §4.2): IDs, times, enums and captured values.
import { z } from 'zod';

/** Crockford base32, as used by ULIDs (no I, L, O, U). */
const ULID = '[0-9A-HJKMNP-TV-Z]{26}';

export const sessionIdSchema = z
  .string()
  .regex(new RegExp(`^ses_${ULID}$`), 'expected a ses_ ULID');
export const requestIdSchema = z
  .string()
  .regex(new RegExp(`^req_${ULID}$`), 'expected a req_ ULID');
export const stepIdSchema = z.string().regex(new RegExp(`^stp_${ULID}$`), 'expected a stp_ ULID');
/** Object IDs are agent-issued counters per session, not ULIDs (`data-model.md` §2). */
export const objectIdSchema = z.string().regex(/^obj_\d+$/, 'expected obj_<number>');

/** Nanoseconds as a string, so JavaScript numbers never lose precision. */
export const nanosSchema = z.string().regex(/^\d+$/, 'expected nanoseconds as a digit string');
/** Wall-clock time as an ISO 8601 UTC string. */
export const isoTimeSchema = z.iso.datetime();

export const httpMethodSchema = z.enum([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]);
export const requestStateSchema = z.enum(['in_progress', 'completed', 'incomplete']);
export const stepKindSchema = z.enum([
  // MVP (decision: if / switch only)
  'function',
  'method',
  'middleware',
  'guard',
  'interceptor',
  'pipe',
  'handler',
  'filter',
  'boundary',
  'decision',
  // v1
  'constructor',
  'callback',
  'loop',
]);
export const stepStatusSchema = z.enum(['running', 'returned', 'threw']);
export const errorHandlingSchema = z.enum(['propagated', 'swallowed', 'converted', 'unhandled']);
/** `console.*` output is a log entry (v1), not a boundary. */
export const boundaryTypeSchema = z.enum(['db', 'http', 'redis', 'queue', 'fs']);
export const decisionTypeSchema = z.enum(['if', 'switch', 'ternary', 'logical', 'optional']);
export const loopTypeSchema = z.enum([
  'for',
  'for_of',
  'for_in',
  'while',
  'do_while',
  'array_method',
]);
export const entryTypeSchema = z.enum(['http', 'test', 'queue', 'cron']);
export const layerSchema = z.enum(['controller', 'service', 'repository', 'fn']);
export const frameworkSchema = z.enum(['nestjs', 'express', 'unknown']);
export const sessionStatusSchema = z.enum(['connected', 'disconnected', 'disabled']);
export const logLevelSchema = z.enum(['log', 'info', 'warn', 'error', 'debug']);

export type HttpMethod = z.infer<typeof httpMethodSchema>;
export type RequestState = z.infer<typeof requestStateSchema>;
export type StepKind = z.infer<typeof stepKindSchema>;
export type StepStatus = z.infer<typeof stepStatusSchema>;
export type ErrorHandling = z.infer<typeof errorHandlingSchema>;
export type BoundaryType = z.infer<typeof boundaryTypeSchema>;
export type DecisionType = z.infer<typeof decisionTypeSchema>;
export type LoopType = z.infer<typeof loopTypeSchema>;
export type EntryType = z.infer<typeof entryTypeSchema>;
export type Layer = z.infer<typeof layerSchema>;
export type Framework = z.infer<typeof frameworkSchema>;
export type SessionStatus = z.infer<typeof sessionStatusSchema>;
export type LogLevel = z.infer<typeof logLevelSchema>;

export const capturedValueTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'null',
  'undefined',
  'bigint',
  'symbol',
  'function',
  'object',
  'array',
  'map',
  'set',
  'date',
  'error',
  'buffer',
  'promise',
  'circular',
]);

/** A captured value, already redacted and size-limited by the agent (`api-spec.md` §4.1). */
export interface CapturedValue {
  type: z.infer<typeof capturedValueTypeSchema>;
  preview: string;
  className?: string;
  objectId?: string;
  size?: number;
  truncated?: boolean;
  redacted?: boolean;
  /** `undefined` or `NaN` where a value was expected (decision 0016). */
  suspicious?: boolean;
  children?: Record<string, CapturedValue> | CapturedValue[];
}

export const capturedValueSchema: z.ZodType<CapturedValue> = z.lazy(() =>
  z.strictObject({
    type: capturedValueTypeSchema,
    preview: z.string(),
    className: z.string().optional(),
    objectId: objectIdSchema.optional(),
    size: z.int().nonnegative().optional(),
    truncated: z.boolean().optional(),
    redacted: z.boolean().optional(),
    suspicious: z.boolean().optional(),
    children: z
      .union([z.record(z.string(), capturedValueSchema), z.array(capturedValueSchema)])
      .optional(),
  }),
);
