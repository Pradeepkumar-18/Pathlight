import { describe, expect, it } from 'vitest';

import { finalize } from './finalize';
import type { FinalizeStep } from './finalize';

const step = (
  id: string,
  parentId: string | null,
  seq: number,
  status: FinalizeStep['status'],
): FinalizeStep => ({
  id,
  parentId,
  seq,
  status,
});

describe('finalize (decision 0010)', () => {
  // handler → service → repo, the repo throws and nothing catches it: the PRD case.
  const propagatedToHandler = [
    step('h', null, 1, 'threw'),
    step('s', 'h', 2, 'threw'),
    step('r', 's', 3, 'threw'),
  ];

  it('a 500 from a filter: converted at the root, propagated below, red path down to the origin', () => {
    const result = finalize(propagatedToHandler, { status: 500, unhandled: false });
    expect(Object.fromEntries(result.handling)).toEqual({
      h: 'converted',
      s: 'propagated',
      r: 'propagated',
    });
    expect(result.errorPath).toEqual(['h', 's', 'r']);
    expect(result.errorStepId).toBe('r');
    expect(result.hasError).toBe(true);
  });

  it('an unhandled error: the root is unhandled and the path is red whatever the status', () => {
    const result = finalize(propagatedToHandler, { status: 200, unhandled: true });
    expect(result.handling.get('h')).toBe('unhandled');
    expect(result.errorPath).toEqual(['h', 's', 'r']);
  });

  it('a 404 from a thrown HttpException: converted, but no red path (it is not a server error)', () => {
    const result = finalize([step('h', null, 1, 'threw')], { status: 404, unhandled: false });
    expect(result.handling.get('h')).toBe('converted');
    expect(result.errorPath).toEqual([]);
    expect(result.errorStepId).toBeNull();
    expect(result.hasError).toBe(true);
  });

  it('a caught error: swallowed (shown as Caught), no red path on a 200', () => {
    const steps = [
      step('h', null, 1, 'returned'),
      step('s', 'h', 2, 'returned'),
      step('cache', 's', 3, 'threw'),
    ];
    const result = finalize(steps, { status: 200, unhandled: false });
    expect(Object.fromEntries(result.handling)).toEqual({ cache: 'swallowed' });
    expect(result.errorPath).toEqual([]);
    expect(result.hasError).toBe(true);
  });

  it('with several errors, red goes only to the one that reached the response', () => {
    const steps = [
      step('h', null, 1, 'threw'),
      step('first', 'h', 2, 'returned'),
      step('caught', 'first', 3, 'threw'),
      step('last', 'h', 4, 'threw'),
    ];
    const result = finalize(steps, { status: 500, unhandled: false });
    expect(result.handling.get('caught')).toBe('swallowed');
    expect(result.errorPath).toEqual(['h', 'last']);
  });

  it('no errors at all', () => {
    const result = finalize([step('h', null, 1, 'returned')], { status: 200, unhandled: false });
    expect(result).toEqual({
      handling: new Map(),
      errorPath: [],
      errorStepId: null,
      hasError: false,
    });
  });
});
