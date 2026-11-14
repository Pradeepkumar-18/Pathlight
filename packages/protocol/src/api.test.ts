import { describe, expect, it } from 'vitest';

import {
  apiErrorSchema,
  pageSchema,
  requestDetailSchema,
  requestSummarySchema,
  sessionSchema,
  stepDetailSchema,
  stepSummarySchema,
} from './api';
import { requestDetail, requestSummary, session, stepDetail, stepSummary } from './spec-examples';

describe('REST schemas accept the api-spec examples', () => {
  it.each([
    ['Session', sessionSchema, session],
    ['RequestSummary', requestSummarySchema, requestSummary],
    ['RequestDetail', requestDetailSchema, requestDetail],
    ['StepSummary', stepSummarySchema, stepSummary],
    ['StepDetail', stepDetailSchema, stepDetail],
  ])('%s', (_name, schema, example) => {
    expect(schema.safeParse(example).error).toBeUndefined();
  });

  it('Page<RequestSummary> (§6.1)', () => {
    const page = { data: [requestSummary], page: { limit: 50, nextCursor: null, total: 2 } };
    expect(pageSchema(requestSummarySchema).safeParse(page).success).toBe(true);
  });

  it('the error envelope (§8)', () => {
    const error = {
      error: {
        code: 'REQUEST_IN_PROGRESS',
        message: 'Wait until the request finishes before deleting it.',
        details: { requestId: requestSummary.id },
      },
    };
    expect(apiErrorSchema.safeParse(error).success).toBe(true);
  });
});

describe('REST schemas reject invalid data', () => {
  it.each([
    [
      'a request ID with the wrong prefix',
      { ...requestSummary, id: 'stp_01JBSEED000000000000000001' },
    ],
    [
      'a 24-character ULID (the old seed format)',
      { ...requestSummary, id: 'req_01JBSEED0000000000000001' },
    ],
    ['durations as numbers instead of strings', { ...requestSummary, durationNs: 84000000 }],
    ['a time that is not ISO 8601', { ...requestSummary, startedAt: '30/10/2026' }],
    ['an unknown method', { ...requestSummary, method: 'TRACE' }],
    ['an unknown field', { ...requestSummary, extra: true }],
  ])('RequestSummary with %s', (_name, value) => {
    expect(requestSummarySchema.safeParse(value).success).toBe(false);
  });

  it('a StepSummary with an unknown kind', () => {
    expect(stepSummarySchema.safeParse({ ...stepSummary, kind: 'span' }).success).toBe(false);
  });

  it('an error envelope with a made-up code', () => {
    expect(
      apiErrorSchema.safeParse({ error: { code: 'COLLECTOR_ERROR', message: 'x' } }).success,
    ).toBe(false);
  });
});
