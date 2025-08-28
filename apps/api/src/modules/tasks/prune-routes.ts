import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { db, importsTable, provenanceTable } from '@clearcost/db';
import { lt } from 'drizzle-orm';

export default function importsPruneRoutes(app: FastifyInstance) {
  const Body = z.object({
    days: z.coerce.number().int().min(1).max(3650).default(90),
  });

  app.post<{ Body: z.infer<typeof Body> }>(
    '/internal/cron/imports/prune',
    {
      preHandler: app.requireApiKey(['tasks:ops:prune']),
      config: { importMeta: { source: 'MANUAL', job: 'ops:prune' } },
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
