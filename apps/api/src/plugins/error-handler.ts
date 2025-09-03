import type { FastifyError, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const plugin: FastifyPluginAsync = fp(async (app) => {
  app.setErrorHandler((err: FastifyError, _req, reply) => {
    const altStatus = (err as any)?.status;
    const raw = (typeof altStatus === 'number' ? altStatus : undefined) ?? err.statusCode ?? 500;

    const status = Number.isFinite(raw) && raw >= 400 && raw <= 599 ? Number(raw) : 500;

    const code = typeof (err as any)?.code === 'string' ? (err as any).code : 'ERR_UNEXPECTED';

    const message =
      typeof err.message === 'string' && err.message ? err.message : 'Unexpected error';

    reply.status(status).send({ error: { code, message } });
  });
});

export default plugin;
