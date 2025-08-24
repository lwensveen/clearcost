import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { db } from '@clearcost/db';
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
      preHandler: app.requireApiKey(['quotes:write']),
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
          async () => await quoteLandedCost(req.body),
          { maxAgeMs: 86_400_000, onReplay: async (cached) => cached }
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

  app.get<{
    Params: { key: string };
    Reply: z.infer<typeof QuoteResponseSchema> | { error: unknown };
  }>(
    '/by-key/:key',
    {
      preHandler: app.requireApiKey(['quotes:read']),
      schema: {
        params: z.object({ key: z.string().min(1) }),
        response: {
          200: QuoteResponseSchema,
          404: z.object({ error: z.unknown() }),
        },
      },
    },
    async (req, reply) => {
      const row = await db.query.idempotencyKeysTable.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.scope, 'quotes'), eq(t.key, req.params.key), eq(t.status, 'completed')),
      });

      if (!row || !row.response) {
        return reply.code(404).send({ error: 'Not found' });
      }

      reply.header('Idempotency-Key', req.params.key);
      reply.header('Cache-Control', 'no-store');
      return reply.send(row.response as any);
    }
  );
}
