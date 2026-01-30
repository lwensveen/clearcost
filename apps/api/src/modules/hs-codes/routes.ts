import type { FastifyInstance } from 'fastify';
import { db, hsCodeAliasesTable, hsCodesTable } from '@clearcost/db';
import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod/v4';
import { errorResponseForStatus } from '../../lib/errors.js';
import {
  ErrorResponseSchema,
  HsCodesLookupQuerySchema,
  HsCodesLookupResponseSchema,
  HsCodesSearchQuerySchema,
  HsCodesSearchResponseSchema,
} from '@clearcost/types';

export default function hsRoutes(app: FastifyInstance) {
  // GET /v1/hs
  app.get<{
    Querystring: z.infer<typeof HsCodesSearchQuerySchema>;
    Reply: z.infer<typeof HsCodesSearchResponseSchema>;
  }>(
    '/',
    {
      preHandler: app.requireApiKey(['hs:read']),
      schema: {
        querystring: HsCodesSearchQuerySchema,
        response: { 200: HsCodesSearchResponseSchema },
      },
      config: { rateLimit: { max: 300, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { q, hs6, limit } = HsCodesSearchQuerySchema.parse(req.query);

      // Fast path: exact HS6 lookup
      if (hs6) {
        const rows = await db
          .select({
            hs6: hsCodesTable.hs6,
            title: hsCodesTable.title,
            ahtn8: sql<string | null>`
              (SELECT ${hsCodeAliasesTable.code}
               FROM ${hsCodeAliasesTable}
               WHERE ${hsCodeAliasesTable.hs6} = ${hsCodesTable.hs6}
                 AND ${hsCodeAliasesTable.system} = 'AHTN8'
               ORDER BY ${hsCodeAliasesTable.code}
               LIMIT 1)
            `,
            cn8: sql<string | null>`
              (SELECT ${hsCodeAliasesTable.code}
               FROM ${hsCodeAliasesTable}
               WHERE ${hsCodeAliasesTable.hs6} = ${hsCodesTable.hs6}
                 AND ${hsCodeAliasesTable.system} = 'CN8'
               ORDER BY ${hsCodeAliasesTable.code}
               LIMIT 1)
            `,
            hts10: sql<string | null>`
              (SELECT ${hsCodeAliasesTable.code}
               FROM ${hsCodeAliasesTable}
               WHERE ${hsCodeAliasesTable.hs6} = ${hsCodesTable.hs6}
                 AND ${hsCodeAliasesTable.system} = 'HTS10'
               ORDER BY ${hsCodeAliasesTable.code}
               LIMIT 1)
            `,
          })
          .from(hsCodesTable)
          .where(eq(hsCodesTable.hs6, hs6))
          .limit(1);

        reply.header('cache-control', 'public, max-age=300, stale-while-revalidate=600');
        return rows;
      }

      const query = (q ?? '').trim();
      const digits = query.replace(/\D/g, '');

      // Title contains OR numeric digits align to HS6 substring
      const rows = await db
        .select({
          hs6: hsCodesTable.hs6,
          title: hsCodesTable.title,
          ahtn8: sql<string | null>`
            (SELECT ${hsCodeAliasesTable.code}
             FROM ${hsCodeAliasesTable}
             WHERE ${hsCodeAliasesTable.hs6} = ${hsCodesTable.hs6}
               AND ${hsCodeAliasesTable.system} = 'AHTN8'
             ORDER BY ${hsCodeAliasesTable.code}
             LIMIT 1)
          `,
          cn8: sql<string | null>`
            (SELECT ${hsCodeAliasesTable.code}
             FROM ${hsCodeAliasesTable}
             WHERE ${hsCodeAliasesTable.hs6} = ${hsCodesTable.hs6}
               AND ${hsCodeAliasesTable.system} = 'CN8'
             ORDER BY ${hsCodeAliasesTable.code}
             LIMIT 1)
          `,
          hts10: sql<string | null>`
            (SELECT ${hsCodeAliasesTable.code}
             FROM ${hsCodeAliasesTable}
             WHERE ${hsCodeAliasesTable.hs6} = ${hsCodesTable.hs6}
               AND ${hsCodeAliasesTable.system} = 'HTS10'
             ORDER BY ${hsCodeAliasesTable.code}
             LIMIT 1)
          `,
          // cheap relevance hint: exact title prefix first, then contains, then HS6 numeric match
          _rank: sql<number>`
            (CASE
               WHEN ${hsCodesTable.title} ILIKE ${query + '%'} THEN 1
               WHEN ${hsCodesTable.title} ILIKE ${'%' + query + '%'} THEN 2
               ${digits ? sql`WHEN ${hsCodesTable.hs6} ILIKE ${'%' + digits + '%'} THEN 3` : sql`ELSE 99`}
             END)
          `,
        })
        .from(hsCodesTable)
        .where(
          or(
            ilike(hsCodesTable.title, `%${query}%`),
            digits ? ilike(hsCodesTable.hs6, `%${digits}%`) : sql`FALSE`
          )
        )
        .orderBy(sql`_rank ASC`, hsCodesTable.hs6)
        .limit(limit);

      reply.header('cache-control', 'public, max-age=120, stale-while-revalidate=600');
      // strip _rank before returning (TS-wise we typed it as part of select)
      return rows.map(({ _rank, ...r }) => r);
    }
  );

  // GET /v1/hs/lookup?system=HTS10&code=8517620090
  app.get<{
    Querystring: z.infer<typeof HsCodesLookupQuerySchema>;
    Reply: z.infer<typeof HsCodesLookupResponseSchema> | z.infer<typeof ErrorResponseSchema>;
  }>(
    '/lookup',
    {
      preHandler: app.requireApiKey(['hs:read']),
      schema: {
        querystring: HsCodesLookupQuerySchema,
        response: { 200: HsCodesLookupResponseSchema, 404: ErrorResponseSchema },
      },
      config: { rateLimit: { max: 300, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { system, code } = HsCodesLookupQuerySchema.parse(req.query);

      const [row] = await db
        .select({
          hs6: hsCodeAliasesTable.hs6,
          aliasTitle: hsCodeAliasesTable.title,
          system: hsCodeAliasesTable.system,
          code: hsCodeAliasesTable.code,
          title: hsCodesTable.title,
        })
        .from(hsCodeAliasesTable)
        .innerJoin(hsCodesTable, eq(hsCodeAliasesTable.hs6, hsCodesTable.hs6))
        .where(and(eq(hsCodeAliasesTable.system, system), eq(hsCodeAliasesTable.code, code)))
        .limit(1);

      if (!row || !row.hs6) {
        return reply.code(404).send(errorResponseForStatus(404, 'Alias not found'));
      }

      reply.header('cache-control', 'public, max-age=300, stale-while-revalidate=600');
      return {
        hs6: row.hs6,
        title: row.title,
        aliasTitle: row.aliasTitle ?? null,
        system: row.system as 'CN8' | 'HTS10' | 'UK10' | 'AHTN8',
        code: row.code,
      };
    }
  );
}
