import { describe, it, expect } from 'vitest';
import { COLLECTOR_VERSION } from './index';

describe('collector package', () => {
  it('should define COLLECTOR_VERSION', () => {
    expect(COLLECTOR_VERSION).toBe('0.0.1');
  });
});
