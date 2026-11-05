import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Order } from './order.entity';

@Injectable()
export class OrdersRepository {
  constructor(@InjectRepository(Order) private readonly orders: Repository<Order>) {}

  findById(id: number): Promise<Order | null> {
    return this.orders.findOneBy({ id });
  }

  save(order: Omit<Order, 'id'> & { id?: number }): Promise<Order> {
    return this.orders.save(this.orders.create(order));
  }
}
