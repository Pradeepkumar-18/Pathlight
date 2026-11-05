import { describe, it, expect } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('agent package', () => {
  it('should define PACKAGE_NAME', () => {
    expect(PACKAGE_NAME).toBe('@pathlight-tracker/agent');
  });
});
