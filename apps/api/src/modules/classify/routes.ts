import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { ClassifyInputSchema, ClassifyResponseSchema } from './schemas.js';
import { withIdempotency } from '../../lib/idempotency.js';
import { classifyHS6 } from './services/classify-hs6.js';
import { HeaderSchema } from '@clearcost/types';

export default function classifyRoutes(app: FastifyInstance) {
  app.post<{
    Body: z.infer<typeof ClassifyInputSchema>;
    Reply: z.infer<typeof ClassifyResponseSchema>;
    Headers: z.infer<typeof HeaderSchema>;
  }>(
    '/',
    {
      preHandler: app.requireApiKey(['classify:write']),
      schema: {
        body: ClassifyInputSchema,
        headers: HeaderSchema,
        response: { 200: ClassifyResponseSchema },
      },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const headers = HeaderSchema.parse(req.headers);
      const idem = headers['idempotency-key'] ?? headers['x-idempotency-key']!;
      const ns = `classify:${req.apiKey!.ownerId}`;

      const out = await withIdempotency(ns, idem, req.body, () => classifyHS6(req.body));
      return reply.send(out);
    }
  );
}
