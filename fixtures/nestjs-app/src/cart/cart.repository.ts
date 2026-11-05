import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CartItem } from './cart-item.entity';

@Injectable()
export class CartRepository {
  constructor(@InjectRepository(CartItem) private readonly items: Repository<CartItem>) {}

  findByUser(userId: number): Promise<CartItem[]> {
    return this.items.find({ where: { userId } });
  }

  async insertMany(items: Omit<CartItem, 'id'>[]): Promise<void> {
    await this.items.insert(items);
  }
}
