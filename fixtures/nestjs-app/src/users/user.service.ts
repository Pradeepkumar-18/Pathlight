import { Injectable, NotFoundException } from '@nestjs/common';

import { User } from './user.schema';
import { UsersRepository } from './users.repository';

@Injectable()
export class UserService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findById(id: number): Promise<User> {
    const user = await this.usersRepository.findOne(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }
}
