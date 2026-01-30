import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { auditQuotesTable, db, idempotencyKeysTable, quoteSnapshotsTable } from '@clearcost/db';
import {
  ErrorResponseSchema,
  IdempotencyHeaderSchema,
  QuoteByKeyParamsSchema,
  QuoteInputSchema,
  QuoteRecentListResponseSchema,
  QuoteRecentQuerySchema,
  QuoteRecentRowSchema,
  QuoteReplayQuerySchema,
  QuoteResponseSchema,
  QuoteStatsResponseSchema,
} from '@clearcost/types';
import { withIdempotency } from '../../lib/idempotency.js';
import { quoteLandedCost } from './services/quote-landed-cost.js';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { errorResponseForStatus } from '../../lib/errors.js';

type QuoteResponse = z.infer<typeof QuoteResponseSchema>;

function getIdemKey(h: unknown) {
  const hdrs = IdempotencyHeaderSchema.parse(h ?? {});
  return hdrs['idempotency-key'] ?? hdrs['x-idempotency-key']!;
}

export default function quoteRoutes(app: FastifyInstance) {
  // POST /v1/quotes — compute (idempotent) + audit + snapshot on fresh compute
  app.post<{
    Body: z.infer<typeof QuoteInputSchema>;
    Reply: z.infer<typeof QuoteResponseSchema> | z.infer<typeof ErrorResponseSchema>;
  }>(
    '/',
    {
      preHandler: app.requireApiKey(['quotes:write']),
      schema: {
        body: QuoteInputSchema,
        headers: IdempotencyHeaderSchema,
        response: {
          200: QuoteResponseSchema,
          400: ErrorResponseSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const started = Date.now();
      const idemKey = getIdemKey(req.headers);

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
          shippingMode: req.body.mode,
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
          return reply.code(409).send(errorResponseForStatus(409, err?.message ?? 'Processing'));
        }
        req.log.error({ err, idemKey, msg: 'quote failed' });
        return reply.code(500).send(errorResponseForStatus(500, err?.message ?? 'quote failed'));
      }
    }
  );

  // GET /v1/quotes/by-key/:key — fetch cached response (tenant-scoped)
  app.get<{
    Params: z.infer<typeof QuoteByKeyParamsSchema>;
    Reply: QuoteResponse | z.infer<typeof ErrorResponseSchema>;
  }>(
    '/by-key/:key',
    {
      preHandler: app.requireApiKey(['quotes:read']),
      schema: {
        params: QuoteByKeyParamsSchema,
        response: { 200: QuoteResponseSchema, 404: ErrorResponseSchema },
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
        return reply.code(404).send(errorResponseForStatus(404, 'Not found'));
      }

      const parsed = QuoteResponseSchema.safeParse(row.response);
      if (!parsed.success) {
        req.log.error({
          key: req.params.key,
          issues: parsed.error.issues,
          msg: 'cached quote failed schema',
        });
        return reply.code(500).send(errorResponseForStatus(500, 'Cached response invalid'));
      }

      reply
        .header('Idempotency-Key', req.params.key)
        .header('Idempotent-Replayed', 'true')
        .header('Cache-Control', 'no-store');

      return reply.send(parsed.data);
    }
  );

  // GET /v1/quotes/replay?key=...&scope=quotes — tenant-scoped replay
  app.get<{
    Querystring: z.infer<typeof QuoteReplayQuerySchema>;
    Reply: QuoteResponse | z.infer<typeof ErrorResponseSchema>;
  }>(
    '/replay',
    {
      preHandler: app.requireApiKey(['quotes:read']),
      schema: {
        querystring: QuoteReplayQuerySchema,
        response: {
          200: QuoteResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
      config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { key } = QuoteReplayQuerySchema.parse(req.query);
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

      if (!row) return reply.code(404).send(errorResponseForStatus(404, 'Unknown idempotency key'));
      if (row.status !== 'completed' || !row.response) {
        return reply.code(409).send(errorResponseForStatus(409, 'Processing or unavailable'));
      }

      const parsed = QuoteResponseSchema.safeParse(row.response);
      if (!parsed.success) {
        req.log.error({ key, issues: parsed.error.issues, msg: 'cached quote failed schema' });
        return reply.code(409).send(errorResponseForStatus(409, 'Cached response invalid'));
      }

      reply
        .header('Idempotency-Key', key)
        .header('Idempotent-Replayed', 'true')
        .header('Cache-Control', 'no-store');

      return reply.send(parsed.data);
    }
  );

  type RecentQuoteRow = z.infer<typeof QuoteRecentRowSchema>;

  app.get<{ Querystring: z.infer<typeof QuoteRecentQuerySchema> }>(
    '/recent',
    {
      preHandler: app.requireApiKey(['quotes:read']),
      schema: {
        querystring: QuoteRecentQuerySchema,
        response: { 200: QuoteRecentListResponseSchema },
      },
      config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { limit, sinceHours } = QuoteRecentQuerySchema.parse(req.query);
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

        const reqParsed = QuoteInputSchema.safeParse(r.request);
        const resParsed = QuoteResponseSchema.safeParse(r.response);
        const req = reqParsed.success ? reqParsed.data : undefined;
        const res = resParsed.success ? resParsed.data : undefined;

        return {
          createdAt: created,
          idemKey: r.idemKey,
          origin: String(req?.origin ?? ''),
          dest: String(req?.dest ?? ''),
          mode: (req?.mode as 'air' | 'sea' | undefined) ?? null,
          hs6: res?.hs6 ?? null,
          currency: req?.itemValue?.currency ?? res?.currency ?? null,
          itemValue: typeof req?.itemValue?.amount === 'number' ? req.itemValue.amount : null,
          total: Number(res?.total ?? 0),
          duty: Number(res?.components?.duty ?? 0),
          vat: res?.components?.vat != null ? Number(res.components.vat) : null,
          fees: Number(res?.components?.fees ?? 0),
        };
      });

      return reply.send(QuoteRecentListResponseSchema.parse({ rows: out }));
    }
  );

  // GET /v1/quotes/stats — simple usage counters (based on audit table; snapshots would also work)
  app.get(
    '/stats',
    {
      preHandler: app.requireApiKey(['quotes:read']),
      schema: { response: { 200: QuoteStatsResponseSchema } },
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

      return reply.send(
        QuoteStatsResponseSchema.parse({ last24h: { count: c24 }, last7d: { count: c7 } })
      );
    }
  );
}
