import type { PrismaClient, User } from '../../generated/prisma/client';
import { HttpError } from '../common/http-error';
import { findUser } from './users.repository';

export async function getUserById(prisma: PrismaClient, id: number): Promise<User> {
  const user = await findUser(prisma, id);
  if (!user) {
    throw new HttpError(404, `User ${id} not found`);
  }
  return user;
}
