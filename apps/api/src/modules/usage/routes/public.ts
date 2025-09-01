import type { FastifyInstance } from 'fastify';
import { apiUsageTable, db } from '@clearcost/db';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { normalizeRange, QueryRange, UsageResponseSchema } from '../services/usage-range.js';

export default function usageRoutes(app: FastifyInstance) {
  // GET /v1/usage/my  — current key usage (default last 30 days, capped to 180)
  app.get(
    '/my',
    {
      preHandler: app.requireApiKey(['usage:read']),
      schema: {
        querystring: QueryRange,
        response: { 200: UsageResponseSchema },
      },
      config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { from, to } = QueryRange.parse(req.query ?? {});
      const { fromDate, toDate } = normalizeRange(from, to);
      const apiKeyId = req.apiKey!.id;

      const rows = await db
        .select({
          day: apiUsageTable.day,
          route: apiUsageTable.route,
          method: apiUsageTable.method,
          count: apiUsageTable.count,
          sumDurationMs: apiUsageTable.sumDurationMs,
          sumBytesIn: apiUsageTable.sumBytesIn,
          sumBytesOut: apiUsageTable.sumBytesOut,
        })
        .from(apiUsageTable)
        .where(
          and(
            eq(apiUsageTable.apiKeyId, apiKeyId),
            gte(apiUsageTable.day, fromDate),
            lte(apiUsageTable.day, toDate)
          )
        )
        .orderBy(desc(apiUsageTable.day));

      reply.header('cache-control', 'private, max-age=15, stale-while-revalidate=60');
      return UsageResponseSchema.parse(rows);
    }
  );
}
