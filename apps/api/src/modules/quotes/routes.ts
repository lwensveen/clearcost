import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { quoteInputSchema, QuoteResponseSchema } from './schemas.js';
import { withIdempotency } from '../../lib/idempotency.js';
import { quoteLandedCost } from './services.js';

const IdemHeaderSchema = z.object({
  'idempotency-key': z.string().min(1).optional(),
  'x-idempotency-key': z.string().min(1).optional(),
});

function getIdemKey(h: unknown) {
  const hdrs = IdemHeaderSchema.parse(h ?? {});
  return hdrs['idempotency-key'] ?? hdrs['x-idempotency-key'] ?? null;
}

export default function quoteRoutes(app: FastifyInstance) {
  app.post<{
    Body: z.infer<typeof quoteInputSchema>;
    Reply: z.infer<typeof QuoteResponseSchema> | { error: unknown };
  }>(
    '/',
    {
      preHandler: app.requireApiKey?.(['quotes:write']),
      schema: {
        body: quoteInputSchema,
        response: {
          200: QuoteResponseSchema,
          400: z.object({ error: z.unknown() }),
          409: z.object({ error: z.unknown() }),
          500: z.object({ error: z.unknown() }),
        },
      },
    },
    async (req, reply) => {
      const idemKey = getIdemKey(req.headers);
      if (!idemKey) {
        return reply
          .code(400)
          .send({ error: 'Idempotency-Key (or X-Idempotency-Key) header required' });
      }

      try {
        const result = await withIdempotency(
          'quotes',
          idemKey,
          req.body,
          async () => {
            return await quoteLandedCost(req.body);
          },
          {
            maxAgeMs: 24 * 60 * 60 * 1000,
            onReplay: async (cached) => cached,
          }
        );

        reply.header('Idempotency-Key', idemKey);
        reply.header('Cache-Control', 'no-store');

        return reply.code(200).send(result);
      } catch (err: any) {
        const status = Number(err?.statusCode) || 500;
        return reply.code(status).send({ error: err?.message ?? 'quote failed' });
      }
    }
  );
}
