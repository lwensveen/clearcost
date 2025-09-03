import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';

export default async function metaRoutes(app: FastifyInstance) {
  // GET /v1/_meta/healthz
  app.get('/v1/_meta/healthz', {
    schema: {
      tags: ['_meta'],
      response: { 200: z.object({ ok: z.literal(true) }) },
    },
    handler: async () => ({ ok: true }),
  });

  // GET /v1/_meta/version
  app.get('/v1/_meta/version', {
    schema: {
      tags: ['_meta'],
      response: {
        200: z.object({
          name: z.string(),
          version: z.string(),
          gitSha: z.string().optional(),
          buildTime: z.string().optional(),
        }),
      },
    },
    handler: async () => ({
      name: process.env.npm_package_name ?? 'clearcost-api',
      version: process.env.npm_package_version ?? '0.0.0',
      gitSha: process.env.GIT_SHA,
      buildTime: process.env.BUILD_TIME,
    }),
  });

  // GET /v1/_meta/openapi (serve generated spec)
  app.get('/v1/_meta/openapi', {
    schema: { tags: ['_meta'] },
    handler: async (_req, reply) => {
      const spec = app.swagger();
      reply.type('application/json').send(spec);
    },
  });
}
