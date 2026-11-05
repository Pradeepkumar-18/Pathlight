import { Router } from 'express';

import type { PrismaClient } from '../../generated/prisma/client';
import { HttpError } from '../common/http-error';
import { badgeFor } from './badge.service';
import { fetchProfile } from './profile.client';
import { getUserById } from './users.service';

function parseId(raw: string | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'User id must be a positive integer');
  }
  return id;
}

// Express 5 forwards rejected promises from async handlers to the error middleware.
export function usersRouter(prisma: PrismaClient, profileServiceUrl: string): Router {
  const router = Router();

  router.get('/:id', async (req, res) => {
    res.json(await getUserById(prisma, parseId(req.params.id)));
  });

  router.get('/:id/profile', async (req, res) => {
    const user = await getUserById(prisma, parseId(req.params.id));
    const profile = await fetchProfile(profileServiceUrl, user.id);
    res.json({ ...user, profile });
  });

  router.get('/:id/badge', async (req, res) => {
    const user = await getUserById(prisma, parseId(req.params.id));
    res.json(badgeFor(user));
  });

  return router;
}
