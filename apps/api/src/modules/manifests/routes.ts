import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { computePool } from './services/compute-pool.js';
import { db, manifestItemQuotesTable, manifestQuotesTable, manifestsTable } from '@clearcost/db';
import { and, eq } from 'drizzle-orm';

const Params = z.object({ manifestId: z.string().uuid() });

// Non-optional schema; fields have defaults
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
  // POST /v1/manifests/:manifestId/compute
  app.post<{
    Params: z.infer<typeof Params>;
    Body: ComputeBody | undefined; // Fastify typing can allow undefined
    Reply: z.infer<typeof ComputeResponse> | { error: string };
  }>(
    '/v1/manifests/:manifestId/compute',
    {
      preHandler: app.requireApiKey(['manifests:write']),
      // Allow missing body from the client, but we parse with defaults
      schema: {
        params: Params,
        body: ComputeBodySchema.optional(),
        response: { 200: ComputeResponse, 403: z.object({ error: z.string() }) },
      },
    },
    async (req, reply) => {
      const { manifestId } = Params.parse(req.params);
      const { allocation, dryRun } = ComputeBodySchema.parse(req.body ?? {});

      const ownerId = req.apiKey?.ownerId;
      const ok = await assertOwnsManifest(manifestId, ownerId);
      if (!ok) return reply.forbidden('Not your manifest');

      const res = await computePool(manifestId, { allocation, dryRun });

      return reply.send({
        ok: true,
        manifestId,
        allocation, // echo the requested allocation (always defined)
        dryRun, // echo the requested flag
        summary: res.totals ?? null, // map totals -> summary
        items: res.items ?? [],
      });
    }
  );

  // GET /v1/manifests/:manifestId/quotes
  app.get<{
    Params: z.infer<typeof Params>;
    Reply: z.infer<typeof QuotesResponse> | { error: string };
  }>(
    '/v1/manifests/:manifestId/quotes',
    {
      preHandler: app.requireApiKey(['manifests:read']),
      schema: {
        params: Params,
        response: { 200: QuotesResponse, 403: z.object({ error: z.string() }) },
      },
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

      return reply.send({
        ok: true as const,
        manifestId,
        summary: summary ?? null,
        items,
      });
    }
  );
}
