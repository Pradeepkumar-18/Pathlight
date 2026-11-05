import { describe, expect, it } from 'vitest';

import { badgeFor } from './badge.service';

describe('badgeFor', () => {
  it('returns the badge for a user with a tier', () => {
    expect(badgeFor({ id: 8, name: 'Grace', tier: 'gold' })).toEqual({
      userId: 8,
      badge: 'Gold member',
    });
  });

  // The deliberate bug behind GET /users/7/badge -> 500.
  it('throws a TypeError for a user without tier', () => {
    expect(() => badgeFor({ id: 7, name: 'Ada', tier: null })).toThrow(
      new TypeError("Cannot read properties of undefined (reading 'label')"),
    );
  });
});
