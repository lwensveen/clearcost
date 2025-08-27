import Fastify from 'fastify';
import importPlugin from '../../src/plugins/import-instrumentation';

export async function buildMini() {
  const app = Fastify();
  await app.register(importPlugin);

  app.post(
    '/lock/me',
    {
      config: { importMeta: { source: 'TEST', job: 'route-lock' } },
    },
    async (_req, reply) => {
      // Simulate some work so the second request collides
      await new Promise((r) => setTimeout(r, 300));
      return reply.send({ ok: true, inserted: 0 });
    }
  );

  await app.ready();
  return app;
}
