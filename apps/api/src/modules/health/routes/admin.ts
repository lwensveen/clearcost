import type { FastifyInstance } from 'fastify';
import { db, provenanceTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { z } from 'zod/v4';
import {
  HealthFreshnessResponseSchema,
  HealthImportsQuerySchema,
  HealthImportsResponseSchema,
} from '@clearcost/types';
import { getDatasetFreshnessSnapshot } from '../services.js';

function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

type Row = {
  import_id: string | null;
  last_at: Date | string | null;
  rows_24h: number | string | null;
  total_rows: number | string | null;
};

export default function healthAdminRoutes(app: FastifyInstance) {
  // Import health (admin/ops only)
  app.get<{ Querystring: z.infer<typeof HealthImportsQuerySchema> }>(
    '/imports',
    {
      preHandler: app.requireApiKey(['ops:health']),
      schema: {
        querystring: HealthImportsQuerySchema,
        response: { 200: HealthImportsResponseSchema },
      },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { thresholdHours } = HealthImportsQuerySchema.parse(req.query);

      const q = sql<Row>`
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

      const { rows } = await db.execute(q);
      const now = new Date();
      const threshold = new Date(now.getTime() - thresholdHours * 3600_000);

      const imports = rows.map((r) => {
        const id = String(r.import_id ?? 'unknown');
        const lastAt = toDate(r.last_at);
        return {
          id,
          lastAt,
          ok: lastAt ? lastAt >= threshold : false,
          rows24h: Number(r.rows_24h ?? 0),
          total: Number(r.total_rows ?? 0),
        };
      });

      // Sort: show problems first, then oldest activity first
      imports.sort(
        (a, b) =>
          Number(a.ok) - Number(b.ok) || (a.lastAt?.getTime() ?? 0) - (b.lastAt?.getTime() ?? 0)
      );

      reply.header('cache-control', 'public, max-age=15, stale-while-revalidate=60');
      return HealthImportsResponseSchema.parse({ now, thresholdHours, imports });
    }
  );

  // Dataset freshness snapshot (admin/ops only)
  app.get(
    '/freshness',
    {
      preHandler: app.requireApiKey(['ops:health']),
      schema: {
        response: { 200: HealthFreshnessResponseSchema },
      },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const snapshot = await getDatasetFreshnessSnapshot();
      reply.header('cache-control', 'public, max-age=30, stale-while-revalidate=120');
      return HealthFreshnessResponseSchema.parse(snapshot);
    }
  );
}
