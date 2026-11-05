import { Injectable } from '@nestjs/common';

import type { Tier, User } from '../users/user.schema';

interface TierDiscount {
  rate: number;
  label: string;
}

const GOLD_RATE = 0.2;

const TIER_DISCOUNTS: Record<Tier, TierDiscount> = {
  gold: { rate: GOLD_RATE, label: 'Gold' },
  silver: { rate: 0.1, label: 'Silver' },
  bronze: { rate: 0.05, label: 'Bronze' },
};

// Deliberate PRD bug: a user without `tier` gets an undefined lookup and throws.
// Seed data (data-model.md §10) expects the method on 22, the `if` on 24, the throw on 27.
@Injectable()
export class PricingService {
  calculateDiscount(user: User, total: number): number {
    // Gold has its own rate; every other tier comes from the table.
    if (user.tier === 'gold') {
      return total * GOLD_RATE;
    }
    return total * TIER_DISCOUNTS[user.tier as Tier].rate;
  }
}
