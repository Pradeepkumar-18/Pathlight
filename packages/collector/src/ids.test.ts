import { describe, expect, it } from 'vitest';

import { requestIdSchema, sessionIdSchema, stepIdSchema } from '@pathlight-tracker/protocol';

import { newRequestId, newSessionId, newStepId, ulid } from './ids';

describe('ulid', () => {
  it('makes IDs the protocol accepts', () => {
    expect(sessionIdSchema.safeParse(newSessionId()).success).toBe(true);
    expect(requestIdSchema.safeParse(newRequestId()).success).toBe(true);
    expect(stepIdSchema.safeParse(newStepId()).success).toBe(true);
  });

  it('sorts by creation time', () => {
    const earlier = ulid(1_793_342_105_120);
    const later = ulid(1_793_342_105_121);
    expect(earlier < later).toBe(true);
    expect(earlier.slice(0, 10)).not.toBe(later.slice(0, 10));
  });

  it('is unique within the same millisecond', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => ulid(1)));
    expect(ids.size).toBe(1000);
  });
});
