import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { and, desc, eq } from 'drizzle-orm';
import { db, manifestItemsTable, manifestsTable } from '@clearcost/db';
import {
  ManifestByIdSchema,
  ManifestSelectCoercedSchema,
} from '@clearcost/types/dist/schemas/manifests.js';
import { ManifestItemSelectCoercedSchema } from '@clearcost/types/dist/schemas/manifest-items.js';

export default async function manifestsFullRoutes(app: FastifyInstance) {
  app.get(
    '/:id/full',
    {
      preHandler: app.requireApiKey(['manifests:read']),
      schema: {
        params: ManifestByIdSchema,
        response: {
          200: z.object({
            manifest: ManifestSelectCoercedSchema,
            items: z.array(ManifestItemSelectCoercedSchema),
          }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, reply) => {
      const { id } = ManifestByIdSchema.parse(req.params);
      const ownerId = req.apiKey!.ownerId;

      const [m] = await db
        .select()
        .from(manifestsTable)
        .where(and(eq(manifestsTable.id, id), eq(manifestsTable.ownerId, ownerId)))
        .limit(1);

      if (!m) return reply.notFound('Not found');

      const rows = await db
        .select()
        .from(manifestItemsTable)
        .where(eq(manifestItemsTable.manifestId, id))
        .orderBy(desc(manifestItemsTable.createdAt));

      return {
        manifest: ManifestSelectCoercedSchema.parse(m),
        items: rows.map((r) => ManifestItemSelectCoercedSchema.parse(r)),
      };
    }
  );
}
