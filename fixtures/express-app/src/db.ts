import path from 'node:path';

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

import { PrismaClient } from '../generated/prisma/client';

// Compiled to dist/src/db.js; the database file sits in prisma/ (see prisma.config.ts).
const DATABASE_FILE = path.resolve(__dirname, '..', '..', 'prisma', 'fixture.db');

export function createPrismaClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: `file:${DATABASE_FILE}` });
  return new PrismaClient({ adapter });
}

// Fixed data so every run reproduces the same requests: user 7 has no tier
// (the deliberate 500), user 8 is gold (the working path).
export async function seed(prisma: PrismaClient): Promise<void> {
  await prisma.user.deleteMany();
  await prisma.user.createMany({
    data: [
      { id: 7, name: 'Ada' },
      { id: 8, name: 'Grace', tier: 'gold' },
    ],
  });
}
