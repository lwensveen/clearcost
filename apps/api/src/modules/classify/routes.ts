import type { FastifyInstance } from 'fastify';
import z from 'zod/v4';
import { ClassifyInputSchema, ClassifyResponseSchema } from './schemas.js';
import { withIdempotency } from '../../lib/idempotency.js';
import { classifyHS6 } from './service.js';

export default function classifyRoutes(app: FastifyInstance) {
  app.post<{
    Body: z.infer<typeof ClassifyInputSchema>;
    Reply: z.infer<typeof ClassifyResponseSchema>;
  }>(
    '/',
    {
      preHandler: app.requireApiKey(['classify:write']),
      schema: { body: ClassifyInputSchema, response: { 200: ClassifyResponseSchema } },
    },
    async (req, reply) => {
      const idem =
        (req.headers['idempotency-key'] as string) ||
        (req.headers['x-idempotency-key'] as string) ||
        null;
      if (!idem) return reply.badRequest('Idempotency-Key header required');
      const out = await withIdempotency('classify', idem, req.body, async () =>
        classifyHS6(req.body)
      );
      return reply.send(out);
    }
  );
}
