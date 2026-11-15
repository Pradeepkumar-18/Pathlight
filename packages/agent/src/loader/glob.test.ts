import { describe, expect, it } from 'vitest';

import { createMatcher, globToRegExp } from './glob';

describe('globs', () => {
  it.each([
    ['src/**', 'src/orders/orders.service.ts', true],
    ['src/**', 'src/main.ts', true],
    ['src/**', 'dist/src/main.js', false],
    ['**/*.spec.ts', 'src/orders/orders.spec.ts', true],
    ['**/*.spec.ts', 'orders.spec.ts', true],
    ['**/*.spec.ts', 'src/orders/orders.service.ts', false],
    ['src/*.ts', 'src/main.ts', true],
    ['src/*.ts', 'src/orders/a.ts', false],
    ['src/?.ts', 'src/a.ts', true],
    ['src/{orders,users}/**', 'src/users/user.ts', true],
    ['src/{orders,users}/**', 'src/cart/cart.ts', false],
    ['lib/a+b.(x).ts', 'lib/a+b.(x).ts', true],
  ])('%s matches %s: %s', (glob, file, expected) => {
    expect(globToRegExp(glob).test(file)).toBe(expected);
  });

  it('includes minus excludes', () => {
    const matches = createMatcher(['src/**'], ['**/*.spec.ts', '**/*.test.ts']);
    expect(matches('src/orders/orders.service.ts')).toBe(true);
    expect(matches('src/orders/orders.service.spec.ts')).toBe(false);
    expect(matches('test/e2e.ts')).toBe(false);
  });
});
