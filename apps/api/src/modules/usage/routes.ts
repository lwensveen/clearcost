import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { apiUsageTable, db } from '@clearcost/db';
import { and, desc, eq, gte, lte } from 'drizzle-orm';

const QueryRange = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(), // YYYY-MM-DD
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const dayToUTC = (s: string) => new Date(`${s}T00:00:00.000Z`);
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function usageRoutes(app: FastifyInstance) {
  // GET /v1/usage/my  — current key usage (last 30 days by default)
  app.get(
    '/my',
    {
      preHandler: app.requireApiKey(['usage:read']),
      schema: {
        querystring: QueryRange,
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day: { type: 'string' },
                route: { type: 'string' },
                method: { type: 'string' },
                count: { type: 'number' },
                sumDurationMs: { type: 'number' },
                sumBytesIn: { type: 'number' },
                sumBytesOut: { type: 'number' },
              },
            },
          },
        },
      },
    },
    async (req) => {
      const { from, to } = QueryRange.parse(req.query ?? {});
      const apiKeyId = req.apiKey!.id;
      const toStr = to ?? todayISO();
      const fromStr = from ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

      const toDate = dayToUTC(toStr);
      const fromDate = dayToUTC(fromStr);

      return db
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
    }
  );

  // GET /v1/usage/by-key/:apiKeyId — admin view
  app.get<{ Params: { apiKeyId: string } }>(
    '/by-key/:apiKeyId',
    {
      preHandler: app.requireApiKey(['admin:usage']),
      schema: { params: z.object({ apiKeyId: z.uuid() }), querystring: QueryRange },
    },
    async (req, reply) => {
      const { from, to } = QueryRange.parse(req.query ?? {});
      const toDate = dayToUTC(to ?? todayISO());
      const fromDate = dayToUTC(
        from ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
      );

      return db
        .select()
        .from(apiUsageTable)
        .where(
          and(
            eq(apiUsageTable.apiKeyId, req.params.apiKeyId),
            gte(apiUsageTable.day, fromDate),
            lte(apiUsageTable.day, toDate)
          )
        )
        .orderBy(desc(apiUsageTable.day));
    }
  );
}
