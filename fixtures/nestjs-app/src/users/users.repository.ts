import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { User } from './user.schema';

@Injectable()
export class UsersRepository {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  findOne(id: number): Promise<User | null> {
    return this.userModel.findOne({ id }).lean<User>().exec();
  }

  async insertMany(users: User[]): Promise<void> {
    await this.userModel.insertMany(users);
  }
}
