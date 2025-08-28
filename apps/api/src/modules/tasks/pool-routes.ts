import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { computePool } from '../manifests/services/compute-pool.js';
import { db, manifestItemQuotesTable, manifestQuotesTable } from '@clearcost/db';
import { eq } from 'drizzle-orm';

const Params = z.object({ manifestId: z.uuid() });

const BodySchema = z.object({
  allocation: z.enum(['chargeable', 'volumetric', 'weight']).default('chargeable').optional(),
  dryRun: z.coerce.boolean().default(false).optional(),
});

type BodyT = z.infer<typeof BodySchema>;

export default function poolRoutes(app: FastifyInstance) {
  // Kick off pooled compute for a manifest
  app.post<{ Params: z.infer<typeof Params>; Body: BodyT | undefined }>(
    '/internal/cron/pool/:manifestId/compute',
    {
      preHandler: app.requireApiKey(['tasks:pool:compute']),
      config: { importMeta: { source: 'MANUAL', job: 'pool:compute' } },
      schema: { params: Params, body: BodySchema.optional() },
    },
    async (req, reply) => {
      const { manifestId } = Params.parse(req.params);
      const { allocation = 'chargeable', dryRun = false } = BodySchema.parse(req.body ?? {});
      const res = await computePool(manifestId, { allocation, dryRun });
      return reply.send(res);
    }
  );

  // Fetch latest pooled results (summary + items) for a manifest
  app.get<{ Params: z.infer<typeof Params> }>(
    '/internal/cron/pool/:manifestId/quotes',
    {
      preHandler: app.requireApiKey(['tasks:pool:read']),
      schema: { params: Params },
    },
    async (req, reply) => {
      const { manifestId } = Params.parse(req.params);

      const summary = await db.query.manifestQuotesTable.findFirst({
        where: eq(manifestQuotesTable.manifestId, manifestId),
      });

      const items = await db
        .select()
        .from(manifestItemQuotesTable)
        .where(eq(manifestItemQuotesTable.manifestId, manifestId));

      return reply.send({ ok: true as const, manifestId, summary, items });
    }
  );
}
