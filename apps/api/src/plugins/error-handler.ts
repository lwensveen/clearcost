import type { FastifyError, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const plugin: FastifyPluginAsync = fp(async (app) => {
  app.setErrorHandler((err: FastifyError, _req, reply) => {
    const errRecord = err as unknown as Record<string, unknown>;
    const altStatus = errRecord.status;
    const raw = (typeof altStatus === 'number' ? altStatus : undefined) ?? err.statusCode ?? 500;

    const status = Number.isFinite(raw) && raw >= 400 && raw <= 599 ? Number(raw) : 500;

    // Redact internal error codes for 5xx to avoid leaking server internals.
    const code =
      status >= 500
        ? 'ERR_INTERNAL'
        : typeof errRecord.code === 'string'
          ? errRecord.code
          : 'ERR_UNEXPECTED';

    const message =
      status >= 500
        ? 'Internal server error'
        : typeof err.message === 'string' && err.message
          ? err.message
          : 'Unexpected error';

    reply.status(status).send({ error: { code, message } });
  });
});

export default plugin;
