import { describe, it, expect } from 'vitest';
import { PROTOCOL_VERSION } from './index';

describe('protocol package', () => {
  it('should define PROTOCOL_VERSION', () => {
    expect(PROTOCOL_VERSION).toBe('0.0.1');
  });
});
