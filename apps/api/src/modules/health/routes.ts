import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { checkHealth, HealthSchema } from './services.js';
import { db, provenanceTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';

const QS = z.object({ thresholdHours: z.coerce.number().int().positive().default(36) });

const ImportHealthSchema = z.object({
  now: z.coerce.date(),
  thresholdHours: z.number(),
  imports: z.array(
    z.object({
      id: z.string(),
      lastAt: z.coerce.date().nullable(),
      ok: z.boolean(),
      rows24h: z.number(),
      total: z.number(),
    })
  ),
});

export default function healthRoutes(app: FastifyInstance) {
  app.get(
    '/healthz',
    { schema: { response: { 200: HealthSchema, 503: HealthSchema } } },
    async (_req, reply) => {
      const report = await checkHealth();
      return reply.code(report.ok ? 200 : 503).send(report);
    }
  );

  app.head('/healthz', async (_req, reply) => {
    const report = await checkHealth();
    return reply.code(report.ok ? 200 : 503).send();
  });

  app.get(
    '/health',
    { schema: { response: { 200: HealthSchema, 503: HealthSchema } } },
    async (_req, reply) => {
      const report = await checkHealth();
      return reply.code(report.ok ? 200 : 503).send(report);
    }
  );

  app.get<{ Querystring: z.infer<typeof QS> }>(
    '/health/imports',
    {
      // preHandler: app.requireApiKey(['admin:rates']),
      schema: { querystring: QS, response: { 200: ImportHealthSchema } },
    },
    async (req) => {
      const { thresholdHours } = QS.parse(req.query);

      // 👇 Type the row shape here; db.execute() will return this type.
      const q = sql<{
        import_id: string | null;
        last_at: Date | string | null;
        rows_24h: number | string;
        total_rows: number | string;
      }>`
        SELECT
          import_id,
          MAX(created_at) AS last_at,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS rows_24h,
          COUNT(*) AS total_rows
        FROM ${provenanceTable}
        WHERE import_id IS NOT NULL
        GROUP BY import_id
        ORDER BY import_id ASC
      `;

      const rows = await db.execute(q);

      const now = new Date();
      const threshold = new Date(now.getTime() - thresholdHours * 3600_000);

      const imports = rows.map((r) => {
        const id = String(r.import_id ?? 'unknown');
        const lastAt = r.last_at ? new Date(r.last_at as any) : null;
        return {
          id,
          lastAt,
          ok: lastAt ? lastAt >= threshold : false,
          rows24h: Number(r.rows_24h ?? 0),
          total: Number(r.total_rows ?? 0),
        };
      });

      imports.sort(
        (a, b) =>
          Number(a.ok) - Number(b.ok) || (a.lastAt?.getTime() ?? 0) - (b.lastAt?.getTime() ?? 0)
      );

      return { now, thresholdHours, imports };
    }
  );
}
