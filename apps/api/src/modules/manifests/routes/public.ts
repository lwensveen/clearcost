import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { db, manifestItemQuotesTable, manifestQuotesTable, manifestsTable } from '@clearcost/db';
import { and, eq } from 'drizzle-orm';
import { HeaderSchema } from '@clearcost/types';
import { withIdempotency } from '../../../lib/idempotency.js';
import { computePool } from '../services/compute-pool.js';

const Params = z.object({ manifestId: z.string().uuid() });

const ComputeBodySchema = z.object({
  allocation: z.enum(['chargeable', 'volumetric', 'weight']).default('chargeable'),
  dryRun: z.coerce.boolean().default(false),
});
type ComputeBody = z.infer<typeof ComputeBodySchema>;

const ComputeResponse = z.object({
  ok: z.literal(true),
  manifestId: z.string().uuid(),
  allocation: z.enum(['chargeable', 'volumetric', 'weight']),
  dryRun: z.boolean(),
  summary: z.unknown().nullable(),
  items: z.array(z.unknown()),
});

const QuotesResponse = z.object({
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
  // POST /v1/manifests/:manifestId/compute  (module is mounted at /v1/manifests)
  app.post<{
    Params: z.infer<typeof Params>;
    Body: ComputeBody | undefined;
    Headers: z.infer<typeof HeaderSchema>;
    Reply: z.infer<typeof ComputeResponse> | { error: string };
  }>(
    '/:manifestId/compute',
    {
      preHandler: app.requireApiKey(['manifests:write']),
      schema: {
        params: Params,
        headers: HeaderSchema,
        body: ComputeBodySchema.optional(),
        response: { 200: ComputeResponse, 403: z.object({ error: z.string() }) },
      },
      config: {
        rateLimit: { max: 60, timeWindow: '1 minute' },
        importMeta: { source: 'MANIFEST', job: 'manifests:compute' },
      },
    },
    async (req, reply) => {
      const { manifestId } = Params.parse(req.params);
      const { allocation, dryRun } = ComputeBodySchema.parse(req.body ?? {});
      const headers = HeaderSchema.parse(req.headers);

      const ownerId = req.apiKey?.ownerId;
      const ok = await assertOwnsManifest(manifestId, ownerId);
      if (!ok) return reply.forbidden('Not your manifest');

      const idem = headers['idempotency-key'] ?? headers['x-idempotency-key']!;
      const ns = `manifests:compute:${ownerId}:${manifestId}`;

      const result = await withIdempotency(ns, idem, { allocation, dryRun }, async () => {
        const res = await computePool(manifestId, { allocation, dryRun });
        return {
          ok: true as const,
          manifestId,
          allocation,
          dryRun,
          summary: res.totals ?? null,
          items: res.items ?? [],
        };
      });

      // compute is a write; don’t cache
      reply.header('cache-control', 'no-store');
      return reply.send(result);
    }
  );

  // GET /v1/manifests/:manifestId/quotes
  app.get<{
    Params: z.infer<typeof Params>;
    Reply: z.infer<typeof QuotesResponse> | { error: string };
  }>(
    '/:manifestId/quotes',
    {
      preHandler: app.requireApiKey(['manifests:read']),
      schema: {
        params: Params,
        response: { 200: QuotesResponse, 403: z.object({ error: z.string() }) },
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
      return reply.send({
        ok: true as const,
        manifestId,
        summary: summary ?? null,
        items,
      });
    }
  );
}
