import type { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { db, manifestItemsTable, manifestsTable } from '@clearcost/db';
import { errorResponseForStatus } from '../../../lib/errors.js';
import {
  ManifestErrorResponseSchema,
  ManifestByIdSchema,
  ManifestFullResponseSchema,
  ManifestItemSelectCoercedSchema,
  ManifestSelectCoercedSchema,
} from '@clearcost/types';

export default async function manifestsFullRoutes(app: FastifyInstance) {
  app.get(
    '/:id/full',
    {
      preHandler: app.requireApiKey(['manifests:read']),
      schema: {
        params: ManifestByIdSchema,
        response: {
          200: ManifestFullResponseSchema,
          404: ManifestErrorResponseSchema,
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

      if (!m) return reply.code(404).send(errorResponseForStatus(404, 'Not found'));

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
