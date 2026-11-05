import type { User } from '../../generated/prisma/client';

type Tier = 'gold' | 'silver' | 'bronze';

interface Badge {
  label: string;
  color: string;
}

const BADGES: Record<Tier, Badge> = {
  gold: { label: 'Gold member', color: '#d4a017' },
  silver: { label: 'Silver member', color: '#a8a9ad' },
  bronze: { label: 'Bronze member', color: '#cd7f32' },
};

// Deliberate bug, same shape as the NestJS fixture: a user without `tier`
// gets an undefined lookup, and reading `label` throws a TypeError.
export function badgeFor(user: User): { userId: number; badge: string } {
  const badge = BADGES[user.tier as Tier];
  return { userId: user.id, badge: badge.label };
}
