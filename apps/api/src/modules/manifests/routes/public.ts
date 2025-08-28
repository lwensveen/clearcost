import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import {
  db,
  manifestItemQuotesTable,
  manifestQuotesTable,
  manifestSnapshotsTable,
  manifestsTable,
} from '@clearcost/db';
import { and, desc, eq } from 'drizzle-orm';
import { withIdempotency } from '../../../lib/idempotency.js';
import { computePool } from '../services/compute-pool.js';
import { HeaderSchema } from '@clearcost/types';

const Params = z.object({ manifestId: z.string().uuid() });

const ComputeBodySchema = z.object({
  allocation: z.enum(['chargeable', 'volumetric', 'weight']).default('chargeable'),
  dryRun: z.coerce.boolean().default(false),
});
type ComputeBody = z.infer<typeof ComputeBodySchema>;

const HistoryItem = z.object({
  id: z.string().uuid(),
  createdAt: z.coerce.date().nullable(), // DB column can be null
  idemKey: z.string(),
  allocation: z.string(),
  dryRun: z.boolean(),
});
const HistoryReply = z.object({
  items: z.array(HistoryItem),
});

const IdemHeaderSchema = z.object({
  'idempotency-key': z.string().min(1).optional(),
  'x-idempotency-key': z.string().min(1).optional(),
});

function idemKeyFrom(h: unknown) {
  const hdrs = IdemHeaderSchema.parse(h ?? {});
  return hdrs['idempotency-key'] ?? hdrs['x-idempotency-key'] ?? null;
}

const ComputeReply = z.object({
  ok: z.literal(true),
  manifestId: z.string().uuid(),
  allocation: z.enum(['chargeable', 'volumetric', 'weight']),
  dryRun: z.boolean(),
  summary: z.unknown().nullable(),
  items: z.array(z.unknown()),
});

const QuotesReply = z.object({
  ok: z.literal(true),
  manifestId: z.string().uuid(),
  summary: z.unknown().nullable(),
  items: z.array(z.unknown()),
});

async function assertOwnsManifest(manifestId: string, ownerId?: string) {
  if (!ownerId) return false;
  const row = await db
    .select({ id: manifestsTable.id })
    .from(manifestsTable)
    .where(and(eq(manifestsTable.id, manifestId), eq(manifestsTable.ownerId, ownerId)))
    .limit(1);
  return !!row[0];
}

export default function manifestsPublicRoutes(app: FastifyInstance) {
  // POST /v1/manifests/:manifestId/compute  (idempotent + snapshot)
  app.post<{
    Params: z.infer<typeof Params>;
    Body: ComputeBody | undefined;
    Headers: z.infer<typeof HeaderSchema> & z.infer<typeof IdemHeaderSchema>;
    Reply: z.infer<typeof ComputeReply> | { error: string };
  }>(
    '/:manifestId/compute',
    {
      preHandler: app.requireApiKey(['manifests:write']),
      schema: {
        params: Params,
        headers: HeaderSchema.merge(IdemHeaderSchema),
        body: ComputeBodySchema.optional(),
        response: {
          200: ComputeReply,
          400: z.object({ error: z.string() }),
          403: z.object({ error: z.string() }),
          409: z.object({ error: z.string() }),
        },
      },
      config: {
        rateLimit: { max: 60, timeWindow: '1 minute' },
      },
    },
    async (req, reply) => {
      const { manifestId } = Params.parse(req.params);
      const { allocation, dryRun } = ComputeBodySchema.parse(req.body ?? {});
      const ownerId = req.apiKey?.ownerId;
      const ok = await assertOwnsManifest(manifestId, ownerId);
      if (!ok) return reply.forbidden('Not your manifest');

      const idemKey = idemKeyFrom(req.headers);
      if (!idemKey) return reply.badRequest('Idempotency-Key header required');

      const scope = `manifests:${ownerId}:${manifestId}`;
      const requestDoc = { allocation, dryRun };

      const result = await withIdempotency(
        scope,
        idemKey,
        requestDoc,
        async () => {
          const res = await computePool(manifestId, { allocation, dryRun });
          const out = {
            ok: true as const,
            manifestId,
            allocation,
            dryRun,
            summary: res.totals ?? null,
            items: res.items ?? [],
          };

          // Best-effort snapshot (parallel; no await)
          db.insert(manifestSnapshotsTable)
            .values({
              scope,
              idemKey,
              manifestId,
              request: requestDoc,
              response: out as unknown as Record<string, unknown>,
              allocation,
              dryRun: dryRun,
              dataRuns: null,
            })
            .catch(() => {
              /* swallow */
            });

          return out;
        },
        { onReplay: async (cached) => cached }
      );

      reply.header('Idempotency-Key', idemKey).header('Cache-Control', 'no-store');
      return reply.send(result);
    }
  );

  // GET /v1/manifests/:manifestId/quotes — latest snapshot (unchanged from your version)
  app.get<{
    Params: z.infer<typeof Params>;
    Reply: z.infer<typeof QuotesReply> | { error: string };
  }>(
    '/:manifestId/quotes',
    {
      preHandler: app.requireApiKey(['manifests:read']),
      schema: {
        params: Params,
        response: { 200: QuotesReply, 403: z.object({ error: z.string() }) },
      },
      config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { manifestId } = Params.parse(req.params);
      const ownerId = req.apiKey?.ownerId;
      const ok = await assertOwnsManifest(manifestId, ownerId);
      if (!ok) return reply.forbidden('Not your manifest');

      const summary = await db.query.manifestQuotesTable.findFirst({
        where: eq(manifestQuotesTable.manifestId, manifestId),
      });

      const items = await db
        .select()
        .from(manifestItemQuotesTable)
        .where(eq(manifestItemQuotesTable.manifestId, manifestId));

      reply.header('cache-control', 'private, max-age=10, stale-while-revalidate=60');
      return reply.send({ ok: true as const, manifestId, summary: summary ?? null, items });
    }
  );

  // GET /v1/manifests/:manifestId/quotes/by-key/:key — tenant-scoped replay from idempotency store
  app.get<{
    Params: { manifestId: string; key: string };
    Reply: z.infer<typeof ComputeReply> | { error: string };
  }>(
    '/:manifestId/quotes/by-key/:key',
    {
      preHandler: app.requireApiKey(['manifests:read']),
      schema: {
        params: z.object({ manifestId: z.string().uuid(), key: z.string().min(1) }),
        response: { 200: ComputeReply, 404: z.object({ error: z.string() }) },
      },
      config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const ownerId = req.apiKey!.ownerId;
      const scope = `manifests:${ownerId}:${req.params.manifestId}`;

      const row = await db.query.idempotencyKeysTable.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.scope, scope), eq(t.key, req.params.key), eq(t.status, 'completed')),
      });
      if (!row || !row.response) return reply.notFound('Not found');

      reply.header('Idempotency-Key', req.params.key).header('Cache-Control', 'no-store');
      return reply.send(row.response as any);
    }
  );

  // GET /v1/manifests/:manifestId/quotes/history — recent snapshots for UI debugging
  app.get<{
    Params: { manifestId: string };
    Reply: z.infer<typeof HistoryReply>;
  }>(
    '/:manifestId/quotes/history',
    {
      preHandler: app.requireApiKey(['manifests:read']),
      schema: {
        params: z.object({ manifestId: z.string().uuid() }),
        response: { 200: HistoryReply },
      },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (req) => {
      const ownerId = req.apiKey!.ownerId;
      const scope = `manifests:${ownerId}:${req.params.manifestId}`;
      const rows = await db
        .select({
          id: manifestSnapshotsTable.id,
          createdAt: manifestSnapshotsTable.createdAt,
          idemKey: manifestSnapshotsTable.idemKey,
          allocation: manifestSnapshotsTable.allocation,
          dryRun: manifestSnapshotsTable.dryRun,
        })
        .from(manifestSnapshotsTable)
        .where(eq(manifestSnapshotsTable.scope, scope))
        .orderBy(desc(manifestSnapshotsTable.createdAt))
        .limit(50);
      return { items: rows };
    }
  );
}
