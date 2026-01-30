import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { db, importsTable, provenanceTable } from '@clearcost/db';
import { lt } from 'drizzle-orm';
import { TasksPruneImportsBodySchema } from '@clearcost/types';

export default function importsPruneRoutes(app: FastifyInstance) {
  const Body = TasksPruneImportsBodySchema;

  app.post<{ Body: z.infer<typeof Body> }>(
    '/cron/imports/prune',
    {
      preHandler: app.requireApiKey(['tasks:ops:prune']),
      config: { importMeta: { importSource: 'MANUAL', job: 'ops:prune' } },
      schema: { body: Body },
    },
    async (req, reply) => {
      const { days } = Body.parse(req.body ?? {});
      const cutoff = new Date(Date.now() - days * 24 * 3600_000);

      const provRows = await db
        .delete(provenanceTable)
        .where(lt(provenanceTable.createdAt, cutoff))
        .returning({ id: provenanceTable.id });

      const importRows = await db
        .delete(importsTable)
        .where(lt(importsTable.finishedAt, cutoff))
        .returning({ id: importsTable.id });

      return reply.send({
        ok: true as const,
        days,
        cutoff,
        deleted: {
          provenance: provRows.length,
          imports: importRows.length,
        },
      });
    }
  );
}
