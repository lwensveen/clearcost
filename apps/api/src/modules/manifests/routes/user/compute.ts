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
import { withIdempotency } from '../../../../lib/idempotency.js';
import { computePool } from '../../services/compute-pool.js';
import { errorResponseForStatus } from '../../../../lib/errors.js';
import {
  IdempotencyHeaderSchema,
  ManifestComputeBodySchema,
  ManifestComputeResponseSchema,
  ManifestErrorResponseSchema,
  ManifestIdParamSchema,
  ManifestQuotesByKeyParamsSchema,
  ManifestQuotesHistoryResponseSchema,
  ManifestQuotesResponseSchema,
} from '@clearcost/types';

function idemKeyFrom(h: unknown) {
  const hdrs = IdempotencyHeaderSchema.parse(h ?? {});
  return hdrs['idempotency-key'] ?? hdrs['x-idempotency-key'] ?? null;
}

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
    Params: z.infer<typeof ManifestIdParamSchema>;
    Body: z.infer<typeof ManifestComputeBodySchema> | undefined;
    Headers: z.infer<typeof IdempotencyHeaderSchema>;
    Reply:
      | z.infer<typeof ManifestComputeResponseSchema>
      | z.infer<typeof ManifestErrorResponseSchema>;
  }>(
    '/:manifestId/compute',
    {
      preHandler: app.requireApiKey(['manifests:write']),
      schema: {
        params: ManifestIdParamSchema,
        headers: IdempotencyHeaderSchema,
        body: ManifestComputeBodySchema.optional(),
        response: {
          200: ManifestComputeResponseSchema,
          400: ManifestErrorResponseSchema,
          402: ManifestErrorResponseSchema,
          403: ManifestErrorResponseSchema,
          409: ManifestErrorResponseSchema,
        },
      },
      config: {
        rateLimit: { max: 60, timeWindow: '1 minute' },
      },
    },
    async (req, reply) => {
      const gate = await (req.server as any).enforceComputeLimit?.(req);
      if (gate && gate.allowed === false) {
        const msg =
          typeof gate.limit === 'number' && typeof gate.used === 'number'
            ? `Plan limit exceeded (${gate.used}/${gate.limit} compute calls today on plan "${gate.plan ?? 'unknown'}")`
            : 'Plan limit exceeded';
        return reply.code(402).send(errorResponseForStatus(402, msg));
      }

      const { manifestId } = ManifestIdParamSchema.parse(req.params);
      const { allocation, dryRun } = ManifestComputeBodySchema.parse(req.body ?? {});
      const ownerId = req.apiKey?.ownerId;
      const ok = await assertOwnsManifest(manifestId, ownerId);
      if (!ok) return reply.code(403).send(errorResponseForStatus(403, 'Not your manifest'));

      const idemKey = idemKeyFrom(req.headers);
      if (!idemKey)
        return reply.code(400).send(errorResponseForStatus(400, 'Idempotency-Key header required'));

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
      return reply.send(ManifestComputeResponseSchema.parse(result));
    }
  );

  // GET /v1/manifests/:manifestId/quotes — latest snapshot (unchanged from your version)
  app.get<{
    Params: z.infer<typeof ManifestIdParamSchema>;
    Reply:
      | z.infer<typeof ManifestQuotesResponseSchema>
      | z.infer<typeof ManifestErrorResponseSchema>;
  }>(
    '/:manifestId/quotes',
    {
      preHandler: app.requireApiKey(['manifests:read']),
      schema: {
        params: ManifestIdParamSchema,
        response: { 200: ManifestQuotesResponseSchema, 403: ManifestErrorResponseSchema },
      },
      config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { manifestId } = ManifestIdParamSchema.parse(req.params);
      const ownerId = req.apiKey?.ownerId;
      const ok = await assertOwnsManifest(manifestId, ownerId);
      if (!ok) return reply.code(403).send(errorResponseForStatus(403, 'Not your manifest'));

      const summary = await db.query.manifestQuotesTable.findFirst({
        where: eq(manifestQuotesTable.manifestId, manifestId),
      });

      const items = await db
        .select()
        .from(manifestItemQuotesTable)
        .where(eq(manifestItemQuotesTable.manifestId, manifestId));

      reply.header('cache-control', 'private, max-age=10, stale-while-revalidate=60');
      return reply.send(
        ManifestQuotesResponseSchema.parse({
          ok: true as const,
          manifestId,
          summary: summary ?? null,
          items,
        })
      );
    }
  );

  // GET /v1/manifests/:manifestId/quotes/by-key/:key — tenant-scoped replay from idempotency store
  app.get<{
    Params: z.infer<typeof ManifestQuotesByKeyParamsSchema>;
    Reply:
      | z.infer<typeof ManifestComputeResponseSchema>
      | z.infer<typeof ManifestErrorResponseSchema>;
  }>(
    '/:manifestId/quotes/by-key/:key',
    {
      preHandler: app.requireApiKey(['manifests:read']),
      schema: {
        params: ManifestQuotesByKeyParamsSchema,
        response: { 200: ManifestComputeResponseSchema, 404: ManifestErrorResponseSchema },
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
      if (!row || !row.response)
        return reply.code(404).send(errorResponseForStatus(404, 'Not found'));

      const parsed = ManifestComputeResponseSchema.safeParse(row.response);
      if (!parsed.success) return reply.code(404).send(errorResponseForStatus(404, 'Not found'));

      reply.header('Idempotency-Key', req.params.key).header('Cache-Control', 'no-store');
      return reply.send(parsed.data);
    }
  );

  // GET /v1/manifests/:manifestId/quotes/history — recent snapshots for UI debugging
  app.get<{
    Params: z.infer<typeof ManifestIdParamSchema>;
    Reply: z.infer<typeof ManifestQuotesHistoryResponseSchema>;
  }>(
    '/:manifestId/quotes/history',
    {
      preHandler: app.requireApiKey(['manifests:read']),
      schema: {
        params: ManifestIdParamSchema,
        response: { 200: ManifestQuotesHistoryResponseSchema },
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
      return ManifestQuotesHistoryResponseSchema.parse({ items: rows });
    }
  );
}
