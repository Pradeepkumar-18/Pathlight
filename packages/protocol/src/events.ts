// Agent ↔ collector protocol over `WS /agent` (`api-spec.md` §11.1, the master copy).
import { z } from 'zod';

import {
  boundaryTypeSchema,
  capturedValueSchema,
  decisionTypeSchema,
  frameworkSchema,
  httpMethodSchema,
  logLevelSchema,
  loopTypeSchema,
  nanosSchema,
  requestIdSchema,
  sessionIdSchema,
  stepIdSchema,
  stepKindSchema,
} from './values';

const versioned = { v: z.int().positive() };
/** Every event carries its type, the request it belongs to and a wall-clock time in ns. */
const eventBase = { traceId: requestIdSchema, ts: nanosSchema };
const sourceLocation = {
  file: z.string().nullable().optional(),
  line: z.int().positive().nullable().optional(),
  column: z.int().positive().nullable().optional(),
};

/** An error as the agent sends it; `stack` is already mapped to `.ts` locations. */
export const eventErrorSchema = z.strictObject({
  type: z.string(),
  message: z.string(),
  stack: z.string().optional(),
  ...sourceLocation,
});

export const requestStartEventSchema = z.strictObject({
  e: z.literal('request.start'),
  ...eventBase,
  framework: frameworkSchema,
  method: httpMethodSchema,
  path: z.string(),
  route: z.string().nullable(),
  params: capturedValueSchema.nullable(),
  query: capturedValueSchema.nullable(),
  body: capturedValueSchema.nullable(),
  headers: capturedValueSchema.nullable(),
});

export const stepEnterEventSchema = z.strictObject({
  e: z.literal('step.enter'),
  ...eventBase,
  stepId: stepIdSchema,
  parentStepId: stepIdSchema.nullable().optional(),
  kind: stepKindSchema,
  name: z.string(),
  ...sourceLocation,
  args: z.array(capturedValueSchema).optional(),
  argNames: z.array(z.string()).optional(),
  thisClass: z.string().nullable().optional(),
  isAsync: z.boolean().optional(),
});

export const stepExitEventSchema = z.strictObject({
  e: z.literal('step.exit'),
  ...eventBase,
  stepId: stepIdSchema,
  returnValue: capturedValueSchema.nullable().optional(),
  durationNs: nanosSchema,
  detail: z.record(z.string(), z.unknown()).optional(),
});

export const stepThrowEventSchema = z.strictObject({
  e: z.literal('step.throw'),
  ...eventBase,
  stepId: stepIdSchema,
  error: eventErrorSchema,
  durationNs: nanosSchema,
});

export const boundaryEventSchema = z.strictObject({
  e: z.literal('boundary'),
  ...eventBase,
  stepId: stepIdSchema,
  parentStepId: stepIdSchema.nullable().optional(),
  boundaryType: boundaryTypeSchema,
  request: z.record(z.string(), z.unknown()),
  response: z.record(z.string(), z.unknown()).nullable().optional(),
  durationNs: nanosSchema,
  error: eventErrorSchema.nullable().optional(),
});

export const decisionEventSchema = z.strictObject({
  e: z.literal('decision'),
  ...eventBase,
  stepId: stepIdSchema,
  parentStepId: stepIdSchema.nullable().optional(),
  decisionType: decisionTypeSchema,
  expression: z.string(),
  values: z.record(z.string(), capturedValueSchema),
  result: z.unknown(),
  branch: z.string(),
  ...sourceLocation,
});

/** v1 */
export const loopEventSchema = z.strictObject({
  e: z.literal('loop'),
  ...eventBase,
  stepId: stepIdSchema,
  parentStepId: stepIdSchema.nullable().optional(),
  loopType: loopTypeSchema,
  iterations: z.int().nonnegative(),
  durationNs: nanosSchema,
  samples: z.strictObject({
    first: capturedValueSchema.optional(),
    last: capturedValueSchema.optional(),
    failing: capturedValueSchema.optional(),
  }),
});

/** v1: stored in `logs`, not as a step. */
export const logEventSchema = z.strictObject({
  e: z.literal('log'),
  ...eventBase,
  stepId: stepIdSchema.nullable().optional(),
  level: logLevelSchema,
  args: z.array(capturedValueSchema),
});

/** A setup warning or a file that couldn't be recorded (stored in `sessions.warnings_json`). */
export const warningEventSchema = z.strictObject({
  e: z.literal('warning'),
  ...eventBase,
  code: z.string(),
  message: z.string(),
  file: z.string().optional(),
});

export const requestEndEventSchema = z.strictObject({
  e: z.literal('request.end'),
  ...eventBase,
  status: z.int().min(100).max(599),
  responseHeaders: capturedValueSchema.nullable().optional(),
  responseBody: capturedValueSchema.nullable().optional(),
  durationNs: nanosSchema,
  unhandledError: eventErrorSchema.nullable().optional(),
});

export const agentDisabledEventSchema = z.strictObject({
  e: z.literal('agent.disabled'),
  ...eventBase,
  reason: z.string(),
  internalErrorCount: z.int().nonnegative(),
});

export const agentEventSchema = z.discriminatedUnion('e', [
  requestStartEventSchema,
  stepEnterEventSchema,
  stepExitEventSchema,
  stepThrowEventSchema,
  boundaryEventSchema,
  decisionEventSchema,
  loopEventSchema,
  logEventSchema,
  warningEventSchema,
  requestEndEventSchema,
  agentDisabledEventSchema,
]);
export type AgentEvent = z.infer<typeof agentEventSchema>;

/** First message on `/agent`; `framework` is usually `unknown` here (the app hasn't loaded yet). */
export const helloMessageSchema = z.strictObject({
  type: z.literal('hello'),
  ...versioned,
  pid: z.int().positive(),
  nodeVersion: z.string(),
  agentVersion: z.string(),
  framework: frameworkSchema,
  command: z.string().nullable().optional(),
  cwd: z.string(),
});

/**
 * A batch of events. Each event is validated on its own by the collector, so one bad event
 * is dropped without losing the rest (`api-spec.md` §11.1 `error`).
 */
export const batchMessageSchema = z.strictObject({
  type: z.literal('batch'),
  ...versioned,
  pid: z.int().positive(),
  seq: z.int().nonnegative(),
  events: z.array(z.unknown()),
});

export const agentMessageSchema = z.discriminatedUnion('type', [
  helloMessageSchema,
  batchMessageSchema,
]);
export type AgentMessage = z.infer<typeof agentMessageSchema>;
export type HelloMessage = z.infer<typeof helloMessageSchema>;
export type BatchMessage = z.infer<typeof batchMessageSchema>;

export const agentErrorCodeSchema = z.enum([
  'INVALID_EVENT',
  'INVALID_MESSAGE',
  'PROTOCOL_MISMATCH',
]);

export const collectorToAgentMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('welcome'),
    ...versioned,
    sessionId: sessionIdSchema,
    limits: z.strictObject({
      maxBatchBytes: z.int().positive(),
      maxBatchEvents: z.int().positive(),
    }),
  }),
  z.strictObject({ type: z.literal('ack'), ...versioned, seq: z.int().nonnegative() }),
  z.strictObject({ type: z.literal('slow_down'), ...versioned, reason: z.string() }),
  z.strictObject({ type: z.literal('resume'), ...versioned }),
  z.strictObject({
    type: z.literal('error'),
    ...versioned,
    code: agentErrorCodeSchema,
    message: z.string(),
    seq: z.int().nonnegative().optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
]);
export type CollectorToAgentMessage = z.infer<typeof collectorToAgentMessageSchema>;
