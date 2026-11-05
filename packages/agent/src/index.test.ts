import { describe, it, expect } from 'vitest';
import { AGENT_VERSION } from './index';

describe('agent package', () => {
  it('should define AGENT_VERSION', () => {
    expect(AGENT_VERSION).toBe('0.0.1');
  });
});
