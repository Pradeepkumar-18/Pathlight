// Collector ↔ UI protocol over `WS /live` (`api-spec.md` §11.2).
import { z } from 'zod';

import { requestSummarySchema, sessionSchema, stepSummarySchema } from './api';
import { isoTimeSchema, requestIdSchema, sessionIdSchema, stepIdSchema } from './values';

const versioned = { v: z.int().positive() };

/** `requests` (list updates) or `request:<id>` (streamed steps of one request). */
export const liveTopicSchema = z.union([
  z.literal('requests'),
  z.templateLiteral(['request:', requestIdSchema]),
]);
export type LiveTopic = z.infer<typeof liveTopicSchema>;

export const uiToCollectorMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('subscribe'),
    ...versioned,
    topics: z.array(liveTopicSchema).min(1),
  }),
  z.strictObject({
    type: z.literal('unsubscribe'),
    ...versioned,
    topics: z.array(liveTopicSchema).min(1),
  }),
  z.strictObject({ type: z.literal('ping'), ...versioned }),
]);
export type UiToCollectorMessage = z.infer<typeof uiToCollectorMessageSchema>;

export const liveMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('live.request.started'),
    ...versioned,
    request: requestSummarySchema,
  }),
  z.strictObject({
    type: z.literal('live.steps.appended'),
    ...versioned,
    requestId: requestIdSchema,
    steps: z.array(stepSummarySchema),
  }),
  z.strictObject({
    type: z.literal('live.steps.updated'),
    ...versioned,
    requestId: requestIdSchema,
    // Exit / throw fill duration and status; `id` says which step.
    steps: z.array(stepSummarySchema.partial().required({ id: true })),
  }),
  z.strictObject({
    type: z.literal('live.request.completed'),
    ...versioned,
    request: requestSummarySchema,
    errorPath: z.array(stepIdSchema),
  }),
  z.strictObject({
    type: z.literal('live.request.deleted'),
    ...versioned,
    requestId: requestIdSchema,
    deletedAt: isoTimeSchema,
    purgeAt: isoTimeSchema,
  }),
  z.strictObject({
    type: z.literal('live.request.restored'),
    ...versioned,
    request: requestSummarySchema,
  }),
  z.strictObject({
    type: z.literal('live.request.purged'),
    ...versioned,
    requestIds: z.array(requestIdSchema),
  }),
  z.strictObject({ type: z.literal('live.agent.connected'), ...versioned, session: sessionSchema }),
  z.strictObject({
    type: z.literal('live.agent.disconnected'),
    ...versioned,
    sessionId: sessionIdSchema,
    reason: z.enum(['exit', 'restart', 'crash']),
    exitCode: z.int().nullable(),
  }),
  z.strictObject({
    type: z.literal('live.agent.disabled'),
    ...versioned,
    sessionId: sessionIdSchema,
    reason: z.string(),
  }),
  z.strictObject({ type: z.literal('pong'), ...versioned }),
  z.strictObject({ type: z.literal('error'), ...versioned, code: z.string(), message: z.string() }),
]);
export type LiveMessage = z.infer<typeof liveMessageSchema>;
