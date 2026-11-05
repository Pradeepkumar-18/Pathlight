import express from 'express';
import type { Express } from 'express';

import type { PrismaClient } from '../generated/prisma/client';
import { errorHandler, requestId, requestLogger, requireApiKey } from './common/middleware';
import { usersRouter } from './users/users.routes';

export function createApp(prisma: PrismaClient, profileServiceUrl: string): Express {
  const app = express();

  app.use(requestId);
  app.use(requestLogger);
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/users', requireApiKey, usersRouter(prisma, profileServiceUrl));

  app.use(errorHandler);
  return app;
}
