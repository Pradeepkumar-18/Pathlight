import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CartItem } from './cart/cart-item.entity';
import { CartModule } from './cart/cart.module';
import { HealthController } from './common/health.controller';
import { SeedService } from './common/seed.service';
import { Order } from './orders/order.entity';
import { OrdersModule } from './orders/orders.module';
import { UsersModule } from './users/users.module';

@Module({})
export class AppModule {
  // The MongoDB URI is only known once the in-memory server has started.
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: AppModule,
      imports: [
        MongooseModule.forRoot(mongoUri),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [CartItem, Order],
          synchronize: true,
        }),
        UsersModule,
        CartModule,
        OrdersModule,
      ],
      controllers: [HealthController],
      providers: [SeedService],
    };
  }
}
