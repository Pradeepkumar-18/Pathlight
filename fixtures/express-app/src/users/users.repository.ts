import type { PrismaClient, User } from '../../generated/prisma/client';

export function findUser(prisma: PrismaClient, id: number): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}
