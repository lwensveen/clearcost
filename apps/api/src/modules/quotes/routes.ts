import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { auditQuotesTable, db, idempotencyKeysTable, quoteSnapshotsTable } from '@clearcost/db';
import { quoteInputSchema } from './schemas.js';
import { withIdempotency } from '../../lib/idempotency.js';
import { quoteLandedCost } from './services/quote-landed-cost.js';
import { and, desc, eq, gt, sql } from 'drizzle-orm';

// Richer reply schema (keeps new fields optional for compatibility)
export const QuoteResponseSchema = z.object({
  hs6: z.string().regex(/^\d{6}$/),
  currency: z.string().optional(), // quote includes currency
  incoterm: z.enum(['DAP', 'DDP']).optional(), // quote includes incoterm
  chargeableKg: z.number(),
  freight: z.number(),
  deMinimis: z
    .object({
      duty: z
        .object({
          thresholdDest: z.number(),
          deMinimisBasis: z.enum(['CIF', 'INTRINSIC']),
          under: z.boolean(),
        })
        .nullable(),
      vat: z
        .object({
          thresholdDest: z.number(),
          deMinimisBasis: z.enum(['CIF', 'INTRINSIC']),
          under: z.boolean(),
        })
        .nullable(),
      suppressDuty: z.boolean(),
      suppressVAT: z.boolean(),
    })
    .optional(),
  components: z.object({
    CIF: z.number(),
    duty: z.number(),
    vat: z.number(),
    fees: z.number(),
    checkoutVAT: z.number().optional(),
  }),
  total: z.number(),
  guaranteedMax: z.number(),
  policy: z.string(),
});

type QuoteResponse = z.infer<typeof QuoteResponseSchema>;

const ReplayQuery = z.object({
  key: z.string().min(1),
  // kept for legacy, but ignored in favor of tenant-scoped lookup
  scope: z.string().default('quotes'),
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
  // POST /v1/quotes — compute (idempotent) + audit + snapshot on fresh compute
  app.post<{
    Body: z.infer<typeof quoteInputSchema>;
    Reply: z.infer<typeof QuoteResponseSchema> | { error: unknown };
  }>(
    '/',
    {
      preHandler: app.requireApiKey(['quotes:write']),
      schema: {
        body: quoteInputSchema,
        headers: IdemHeaderSchema,
        response: {
          200: QuoteResponseSchema,
          400: z.object({ error: z.unknown() }),
          409: z.object({ error: z.unknown() }),
          500: z.object({ error: z.unknown() }),
        },
      },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const started = Date.now();
      const idemKey = getIdemKey(req.headers);
      if (!idemKey) {
        req.log.warn({ msg: 'missing idempotency key' });
        return reply
          .code(400)
          .send({ error: 'Idempotency-Key (or X-Idempotency-Key) header required' });
      }

      const ownerId = req.apiKey!.ownerId; // route requires auth; non-null
      const idemScope = `quotes:${ownerId}`;

      try {
        let replayed = false;

        const result = await withIdempotency(
          idemScope,
          idemKey,
          req.body,
          async () => {
            const { quote: out, fxAsOf } = await quoteLandedCost({
              ...req.body,
              merchantId: ownerId,
            });

            // 1) Audit (best-effort)
            db.insert(auditQuotesTable)
              .values({
                ownerId: ownerId,
                apiKeyId: req.apiKey!.id,
                laneOrigin: req.body.origin,
                laneDest: req.body.dest,
                hs6: out.hs6,
                itemValue: String(req.body.itemValue.amount),
                itemCurrency: req.body.itemValue.currency,
                dimsCm: { l: req.body.dimsCm.l, w: req.body.dimsCm.w, h: req.body.dimsCm.h },
                weightKg: String(req.body.weightKg),
                chargeableKg: String(out.chargeableKg),
                freight: String(out.freight),
                dutyQuoted: String(out.components.duty),
                vatQuoted: String(out.components.vat ?? 0),
                feesQuoted: String(out.components.fees),
                totalQuoted: String(out.total),
                notes: out.components.checkoutVAT ? 'IOSS checkout VAT included' : null,
                lowConfidence: !req.body.hs6,
              })
              .catch((e) => req.log.warn({ err: e, msg: 'audit insert failed' }));

            // 2) Snapshot (best-effort)
            db.insert(quoteSnapshotsTable)
              .values({
                scope: idemScope,
                idemKey,
                ownerId: ownerId,
                apiKeyId: req.apiKey!.id,
                request: req.body,
                response: out,
                fxAsOf,
                dataRuns: null,
              })
              .catch((e) => req.log.warn({ err: e, msg: 'snapshot insert failed' }));

            return out;
          },
          {
            maxAgeMs: 86_400_000,
            onReplay: async (cached) => {
              replayed = true;
              return cached;
            },
          }
        );

        req.log.info({
          msg: 'quote computed',
          idemScope,
          idemKey,
          origin: req.body.origin,
          dest: req.body.dest,
          shippingMode: req.body.shippingMode,
          total: result.total,
          ms: Date.now() - started,
        });

        reply.header('Idempotency-Key', idemKey).header('Cache-Control', 'no-store');

        if (replayed) reply.header('Idempotent-Replayed', 'true');

        return reply.send(result);
      } catch (err: any) {
        const status = Number(err?.statusCode) || 500;
        if (status === 409) {
          req.log.warn({ err, idemKey, msg: 'idempotency conflict' });
          return reply.code(409).send({ error: err?.message ?? 'Processing' });
        }
        req.log.error({ err, idemKey, msg: 'quote failed' });
        return reply.code(500).send({ error: err?.message ?? 'quote failed' });
      }
    }
  );

  // GET /v1/quotes/by-key/:key — fetch cached response (tenant-scoped)
  app.get<{ Params: { key: string }; Reply: QuoteResponse | { error: unknown } }>(
    '/by-key/:key',
    {
      preHandler: app.requireApiKey(['quotes:read']),
      schema: {
        params: z.object({ key: z.string().min(1) }),
        response: { 200: QuoteResponseSchema, 404: z.object({ error: z.unknown() }) },
      },
      config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const ownerId = req.apiKey!.ownerId;
      const scoped = `quotes:${ownerId}`;

      const row =
        (await db.query.idempotencyKeysTable.findFirst({
          where: (t, { and, eq }) =>
            and(eq(t.scope, scoped), eq(t.key, req.params.key), eq(t.status, 'completed')),
        })) ??
        (await db.query.idempotencyKeysTable.findFirst({
          where: (t, { and, eq }) =>
            and(eq(t.scope, 'quotes'), eq(t.key, req.params.key), eq(t.status, 'completed')),
        }));

      if (!row || !row.response) {
        req.log.info({ key: req.params.key, msg: 'quote not found for key' });
        return reply.code(404).send({ error: 'Not found' });
      }

      const parsed = QuoteResponseSchema.safeParse(row.response);
      if (!parsed.success) {
        req.log.error({
          key: req.params.key,
          issues: parsed.error.issues,
          msg: 'cached quote failed schema',
        });
        return reply.code(500).send({ error: 'Cached response invalid' });
      }

      reply
        .header('Idempotency-Key', req.params.key)
        .header('Idempotent-Replayed', 'true')
        .header('Cache-Control', 'no-store');

      return reply.send(parsed.data);
    }
  );

  // GET /v1/quotes/replay?key=...&scope=quotes — tenant-scoped replay
  app.get<{ Querystring: z.infer<typeof ReplayQuery>; Reply: QuoteResponse | { error: string } }>(
    '/replay',
    {
      preHandler: app.requireApiKey(['quotes:read']),
      schema: {
        querystring: ReplayQuery,
        response: {
          200: QuoteResponseSchema,
          404: z.object({ error: z.string() }),
          409: z.object({ error: z.string() }),
        },
      },
      config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { key } = ReplayQuery.parse(req.query);
      const ownerId = req.apiKey!.ownerId;
      const scoped = `quotes:${ownerId}`;

      const [row] = await db
        .select({
          status: idempotencyKeysTable.status,
          requestHash: idempotencyKeysTable.requestHash,
          response: idempotencyKeysTable.response,
        })
        .from(idempotencyKeysTable)
        .where(and(eq(idempotencyKeysTable.scope, scoped), eq(idempotencyKeysTable.key, key)))
        .limit(1);

      if (!row) return reply.code(404).send({ error: 'Unknown idempotency key' });
      if (row.status !== 'completed' || !row.response) {
        return reply.code(409).send({ error: 'Processing or unavailable' });
      }

      const parsed = QuoteResponseSchema.safeParse(row.response);
      if (!parsed.success) {
        req.log.error({ key, issues: parsed.error.issues, msg: 'cached quote failed schema' });
        return reply.code(409).send({ error: 'Cached response invalid' });
      }

      reply
        .header('Idempotency-Key', key)
        .header('Idempotent-Replayed', 'true')
        .header('Cache-Control', 'no-store');

      return reply.send(parsed.data);
    }
  );

  const RecentQuery = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    sinceHours: z.coerce
      .number()
      .int()
      .min(1)
      .max(24 * 90)
      .optional(), // optional time filter
  });

  // A lightweight row we can render quickly in the dashboard
  const RecentQuoteRow = z.object({
    createdAt: z.string(), // ISO
    idemKey: z.string(),
    origin: z.string(),
    dest: z.string(),
    mode: z.enum(['air', 'sea']).nullable().optional(),
    hs6: z.string().nullable().optional(),
    currency: z.string().nullable().optional(),
    itemValue: z.number().nullable().optional(),
    total: z.number(),
    duty: z.number(),
    vat: z.number().nullable().optional(),
    fees: z.number(),
  });
  type RecentQuoteRow = z.infer<typeof RecentQuoteRow>;

  const RecentQuoteList = z.object({ rows: z.array(RecentQuoteRow) });

  const QuoteStats = z.object({
    last24h: z.object({ count: z.number() }),
    last7d: z.object({ count: z.number() }),
  });

  app.get<{ Querystring: z.infer<typeof RecentQuery> }>(
    '/recent',
    {
      preHandler: app.requireApiKey(['quotes:read']),
      schema: {
        querystring: RecentQuery,
        response: { 200: RecentQuoteList },
      },
      config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { limit, sinceHours } = RecentQuery.parse(req.query);
      const ownerId = req.apiKey!.ownerId;
      const scoped = `quotes:${ownerId}`;

      const whereSince =
        sinceHours != null
          ? gt(quoteSnapshotsTable.createdAt, sql`now() - interval '${sinceHours} hours'`)
          : undefined;

      const rows = await db
        .select({
          createdAt: quoteSnapshotsTable.createdAt,
          idemKey: quoteSnapshotsTable.idemKey,
          request: quoteSnapshotsTable.request,
          response: quoteSnapshotsTable.response,
        })
        .from(quoteSnapshotsTable)
        .where(
          whereSince
            ? and(eq(quoteSnapshotsTable.scope, scoped), whereSince)
            : eq(quoteSnapshotsTable.scope, scoped)
        )
        .orderBy(desc(quoteSnapshotsTable.createdAt))
        .limit(limit);

      const out: RecentQuoteRow[] = rows.map((r) => {
        const created = r.createdAt
          ? new Date(r.createdAt as any).toISOString()
          : new Date(0).toISOString();

        const reqParsed = quoteInputSchema.safeParse(r.request);
        const resParsed = QuoteResponseSchema.safeParse(r.response);
        const req = reqParsed.success ? reqParsed.data : undefined;
        const res = resParsed.success ? resParsed.data : undefined;

        return {
          createdAt: created,
          idemKey: r.idemKey,
          origin: String(req?.origin ?? ''),
          dest: String(req?.dest ?? ''),
          shippingMode: (req?.shippingMode as 'air' | 'sea' | undefined) ?? null,
          hs6: res?.hs6 ?? null,
          currency: req?.itemValue?.currency ?? res?.currency ?? null,
          itemValue: typeof req?.itemValue?.amount === 'number' ? req.itemValue.amount : null,
          total: Number(res?.total ?? 0),
          duty: Number(res?.components?.duty ?? 0),
          vat: res?.components?.vat != null ? Number(res.components.vat) : null,
          fees: Number(res?.components?.fees ?? 0),
        };
      });

      return reply.send({ rows: out });
    }
  );

  // GET /v1/quotes/stats — simple usage counters (based on audit table; snapshots would also work)
  app.get(
    '/stats',
    {
      preHandler: app.requireApiKey(['quotes:read']),
      schema: { response: { 200: QuoteStats } },
      config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const ownerId = req.apiKey!.ownerId;

      // last 24h
      const [{ count: c24 } = { count: 0 }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditQuotesTable)
        .where(
          and(
            eq(auditQuotesTable.ownerId, ownerId),
            gt(auditQuotesTable.createdAt, sql`now() - interval '24 hours'`)
          )
        );

      // last 7d
      const [{ count: c7 } = { count: 0 }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditQuotesTable)
        .where(
          and(
            eq(auditQuotesTable.ownerId, ownerId),
            gt(auditQuotesTable.createdAt, sql`now() - interval '7 days'`)
          )
        );

      return reply.send({ last24h: { count: c24 }, last7d: { count: c7 } });
    }
  );
}
