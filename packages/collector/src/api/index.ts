// Mounts the MVP REST API under /api/v1 (`api-spec.md` §5–§7).
import type { FastifyInstance } from 'fastify';

import type { ApiContext } from './context';
import { registerRequestRoutes } from './requests-routes';
import { registerStatusRoutes } from './status-routes';
import { registerStepRoutes } from './steps-routes';

export type { ApiContext, ApiEvents } from './context';

export async function registerApi(app: FastifyInstance, ctx: ApiContext): Promise<void> {
  await app.register(
    async (api) => {
      registerStatusRoutes(api, ctx);
      registerRequestRoutes(api, ctx);
      registerStepRoutes(api, ctx);
    },
    { prefix: '/api/v1' },
  );
}
