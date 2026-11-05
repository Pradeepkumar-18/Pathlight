import { describe, expect, it } from 'vitest';

import { PricingService } from './pricing.service';

describe('PricingService.calculateDiscount', () => {
  const pricing = new PricingService();

  it('gives gold users the gold rate', () => {
    expect(pricing.calculateDiscount({ id: 8, name: 'Grace', tier: 'gold' }, 1200)).toBe(240);
  });

  it('uses the tier table for other tiers', () => {
    expect(pricing.calculateDiscount({ id: 9, name: 'Linus', tier: 'silver' }, 1200)).toBe(120);
  });

  // The deliberate PRD bug. The seed data and later tasks (1.1, 3.7, 3.14)
  // expect this exact error at pricing.service.ts line 27.
  it('throws the PRD TypeError on line 27 for a user without tier', () => {
    let thrown: unknown;
    try {
      pricing.calculateDiscount({ id: 7, name: 'Ada' }, 1200);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(TypeError);
    const error = thrown as TypeError;
    expect(error.message).toBe("Cannot read properties of undefined (reading 'rate')");
    expect(error.stack).toMatch(/pricing\.service\.ts:27:\d+/);
  });
});
