import { describe, expect, it } from 'vitest';

import { layerOf } from './layer';

describe('layerOf', () => {
  it.each([
    ['OrdersController', 'controller'],
    ['UserService', 'service'],
    ['UsersRepository', 'repository'],
    ['CartRepo', 'repository'],
    ['PriceUtil', 'fn'],
  ] as const)('a method of %s is %s', (className, layer) => {
    expect(layerOf('method', className)).toBe(layer);
  });

  it('gives no layer to framework, boundary and decision steps', () => {
    expect(layerOf('guard', 'JwtAuthGuard')).toBeNull();
    expect(layerOf('boundary', null)).toBeNull();
    expect(layerOf('handler', 'OrdersController')).toBeNull();
  });

  it('treats a method without a class as fn', () => {
    expect(layerOf('method', null)).toBe('fn');
  });
});
