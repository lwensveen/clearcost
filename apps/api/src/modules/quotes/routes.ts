import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { auditQuotesTable, db } from '@clearcost/db';
import { quoteInputSchema } from './schemas.js';
import { withIdempotency } from '../../lib/idempotency.js';
import { quoteLandedCost } from './services/quote-landed-cost.js';

export const QuoteResponseSchema = z.object({
  hs6: z.string().regex(/^\d{6}$/),
  chargeableKg: z.number(),
  freight: z.number(),
  components: z.object({
    CIF: z.number(),
    duty: z.number(),
    vat: z.number(),
    fees: z.number(),
  }),
  total: z.number(),
  guaranteedMax: z.number(),
  policy: z.string(),
});

const IdemHeaderSchema = z.object({
  'idempotency-key': z.string().min(1).optional(),
  'x-idempotency-key': z.string().min(1).optional(),
});

function getIdemKey(h: unknown) {
  const hdrs = IdemHeaderSchema.parse(h ?? {});
  return hdrs['idempotency-key'] ?? hdrs['x-idempotency-key'] ?? null;
}

export default function quoteRoutes(app: FastifyInstance) {
  // POST /v1/quotes — compute (idempotent) + audit on fresh compute
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
      const started = Date.now();
      const idemKey = getIdemKey(req.headers);
      if (!idemKey) {
        req.log.warn({ msg: 'missing idempotency key' });
        return reply.badRequest('Idempotency-Key (or X-Idempotency-Key) header required');
      }

      try {
        const result = await withIdempotency(
          'quotes',
          idemKey,
          req.body,
          async () => {
            const out = await quoteLandedCost({ ...req.body, merchantId: req.apiKey?.ownerId });

            try {
              await db.insert(auditQuotesTable).values({
                laneOrigin: req.body.origin,
                laneDest: req.body.dest,
                hs6: out.hs6,
                itemValue: String(req.body.itemValue.amount),
                itemCurrency: req.body.itemValue.currency,
                dimsCm: { l: req.body.dimsCm.l, w: req.body.dimsCm.w, h: req.body.dimsCm.h } as any,
                weightKg: String(req.body.weightKg),
                chargeableKg: String(out.chargeableKg),
                freight: String(out.freight),
                dutyQuoted: String(out.components.duty),
                vatQuoted: String(out.components.vat ?? 0),
                feesQuoted: String(out.components.fees),
                totalQuoted: String(out.total),
                notes: out.components['checkoutVAT'] ? 'IOSS checkout VAT included' : null,
                lowConfidence: !req.body.userHs6,
              });
            } catch (e) {
              req.log.warn({ err: e, msg: 'audit insert failed' });
            }

            return out;
          },
          { maxAgeMs: 86_400_000, onReplay: async (cached) => cached }
        );

        req.log.info({
          msg: 'quote computed',
          idemKey,
          origin: req.body.origin,
          dest: req.body.dest,
          mode: req.body.mode,
          total: result.total,
          ms: Date.now() - started,
        });

        reply.header('Idempotency-Key', idemKey).header('Cache-Control', 'no-store');
        return reply.send(result);
      } catch (err: any) {
        const status = Number(err?.statusCode) || 500;
        if (status === 409) {
          req.log.warn({ err, idemKey, msg: 'idempotency conflict' });
          return reply.conflict(err?.message ?? 'Processing');
        }
        req.log.error({ err, idemKey, msg: 'quote failed' });
        return reply.internalServerError(err?.message ?? 'quote failed');
      }
    }
  );

  // GET /v1/quotes/by-key/:key — fetch cached response
  app.get<{
    Params: { key: string };
    Reply: z.infer<typeof QuoteResponseSchema> | { error: unknown };
  }>(
    '/by-key/:key',
    {
      preHandler: app.requireApiKey(['quotes:read']),
      schema: {
        params: z.object({ key: z.string().min(1) }),
        response: { 200: QuoteResponseSchema, 404: z.object({ error: z.unknown() }) },
      },
    },
    async (req, reply) => {
      const row = await db.query.idempotencyKeysTable.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.scope, 'quotes'), eq(t.key, req.params.key), eq(t.status, 'completed')),
      });

      if (!row || !row.response) {
        req.log.info({ key: req.params.key, msg: 'quote not found for key' });
        return reply.notFound('Not found');
      }

      req.log.info({ key: req.params.key, msg: 'quote replay served' });
      reply.header('Idempotency-Key', req.params.key).header('Cache-Control', 'no-store');
      return reply.send(row.response as any);
    }
  );
}
