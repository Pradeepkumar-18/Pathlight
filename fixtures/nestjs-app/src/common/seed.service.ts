import { Injectable } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';

import { CartRepository } from '../cart/cart.repository';
import { OrdersRepository } from '../orders/orders.repository';
import { UsersRepository } from '../users/users.repository';

// Fixed data so every run reproduces the same requests:
// user 7 has no tier and a cart of 1200 (the failing POST /orders from the PRD),
// user 8 is gold (the working path), order 42 exists for GET /orders/42.
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly cartRepository: CartRepository,
    private readonly ordersRepository: OrdersRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.usersRepository.insertMany([
      { id: 7, name: 'Ada' },
      { id: 8, name: 'Grace', tier: 'gold' },
    ]);
    await this.cartRepository.insertMany([
      { userId: 7, product: 'Keyboard', price: 500, quantity: 2 },
      { userId: 7, product: 'Mouse', price: 200, quantity: 1 },
      { userId: 8, product: 'Monitor', price: 900, quantity: 1 },
    ]);
    await this.ordersRepository.save({
      id: 42,
      userId: 8,
      total: 900,
      discount: 180,
      status: 'shipped',
    });
  }
}
