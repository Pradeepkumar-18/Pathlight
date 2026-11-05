import type { AddressInfo } from 'node:net';

import { createApp } from './app';
import { createPrismaClient, seed } from './db';
import { startProfileServer } from './stub/profile-server';

const DEFAULT_PORT = 3002;

async function main(): Promise<void> {
  const prisma = createPrismaClient();
  await seed(prisma);
  const profileServer = await startProfileServer();
  const app = createApp(prisma, profileServer.url);

  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const server = app.listen(port, '127.0.0.1', () => {
    const address = server.address() as AddressInfo;
    console.log(`express-app listening on http://127.0.0.1:${address.port}`);
  });

  const stop = async (): Promise<void> => {
    server.close();
    profileServer.server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.once('SIGINT', () => void stop());
  process.once('SIGTERM', () => void stop());
}

main().catch((error: unknown) => {
  console.error('express-app failed to start');
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
