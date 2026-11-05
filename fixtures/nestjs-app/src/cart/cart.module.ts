import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CartItem } from './cart-item.entity';
import { CartRepository } from './cart.repository';
import { CartService } from './cart.service';

@Module({
  imports: [TypeOrmModule.forFeature([CartItem])],
  providers: [CartRepository, CartService],
  exports: [CartRepository, CartService],
})
export class CartModule {}
