import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';

import { AuthGuard } from '../common/auth.guard';
import { CreateOrderDto } from './create-order.dto';
import { Order } from './order.entity';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body(new ValidationPipe({ whitelist: true })) dto: CreateOrderDto): Promise<Order> {
    return this.ordersService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Order> {
    return this.ordersService.findOne(id);
  }
}
