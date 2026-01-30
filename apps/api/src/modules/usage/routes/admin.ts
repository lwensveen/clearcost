import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { apiUsageTable, db } from '@clearcost/db';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { normalizeRange, QueryRange, UsageResponseSchema } from '../services/usage-range.js';
import { UsageByKeyParamsSchema } from '@clearcost/types';

export default function usageRoutes(app: FastifyInstance) {
  // GET /v1/usage/by-key/:apiKeyId — admin view (same range behavior)
  app.get<{ Params: z.infer<typeof UsageByKeyParamsSchema> }>(
    '/by-key/:apiKeyId',
    {
      preHandler: app.requireApiKey(['admin:usage']),
      schema: {
        params: UsageByKeyParamsSchema,
        querystring: QueryRange,
        response: { 200: UsageResponseSchema },
      },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { from, to } = QueryRange.parse(req.query ?? {});
      const { fromDate, toDate } = normalizeRange(from, to);

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
            eq(apiUsageTable.apiKeyId, req.params.apiKeyId),
            gte(apiUsageTable.day, fromDate),
            lte(apiUsageTable.day, toDate)
          )
        )
        .orderBy(desc(apiUsageTable.day));

      reply.header('cache-control', 'private, max-age=10, stale-while-revalidate=60');
      return UsageResponseSchema.parse(rows);
    }
  );
}
