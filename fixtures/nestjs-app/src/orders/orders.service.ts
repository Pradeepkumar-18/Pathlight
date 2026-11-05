import { Injectable, NotFoundException } from '@nestjs/common';

import { CartService } from '../cart/cart.service';
import { PricingService } from '../pricing/pricing.service';
import { UserService } from '../users/user.service';
import { CreateOrderDto } from './create-order.dto';
import { Order } from './order.entity';
import { OrdersRepository } from './orders.repository';

@Injectable()
export class OrdersService {
  constructor(
    private readonly userService: UserService,
    private readonly cartService: CartService,
    private readonly pricingService: PricingService,
    private readonly ordersRepository: OrdersRepository,
  ) {}

  async create(dto: CreateOrderDto): Promise<Order> {
    const user = await this.userService.findById(dto.userId);
    const total = await this.cartService.total(user.id);
    const discount = this.pricingService.calculateDiscount(user, total);
    return this.ordersRepository.save({ userId: user.id, total, discount, status: 'placed' });
  }

  async findOne(id: number): Promise<Order> {
    const order = await this.ordersRepository.findById(id);
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }
}
