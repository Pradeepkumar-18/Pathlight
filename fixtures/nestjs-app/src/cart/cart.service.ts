import { Injectable } from '@nestjs/common';

import { CartRepository } from './cart.repository';

@Injectable()
export class CartService {
  constructor(private readonly cartRepository: CartRepository) {}

  async total(userId: number): Promise<number> {
    const items = await this.cartRepository.findByUser(userId);
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }
}
