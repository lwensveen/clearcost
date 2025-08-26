import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { db, hsCodeAliasesTable, hsCodesTable } from '@clearcost/db';
import { and, eq, ilike, or } from 'drizzle-orm';

const HsSearchQuery = z.object({
  q: z.string().min(1).optional(),
  hs6: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

const HsSearchResponse = z.array(
  z.object({
    hs6: z.string(),
    title: z.string(),
    ahtn8: z.string().nullish(),
    cn8: z.string().nullish(),
    hts10: z.string().nullish(),
  })
);

const LookupQuerySchema = z.object({
  system: z.enum(['CN8', 'HTS10', 'UK10', 'AHTN8']),
  code: z.string().regex(/^\d{8,10}$/),
});
const LookupResponseSchema = z.object({
  hs6: z.string(),
  title: z.string(), // HS6 title
  aliasTitle: z.string().nullable().optional(),
  system: z.enum(['CN8', 'HTS10', 'UK10', 'AHTN8']),
  code: z.string(),
});

export default function hsRoutes(app: FastifyInstance) {
  // GET /v1/hs
  app.get<{ Querystring: z.infer<typeof HsSearchQuery>; Reply: z.infer<typeof HsSearchResponse> }>(
    '/',
    {
      preHandler: app.requireApiKey(['hs:read']),
      schema: { querystring: HsSearchQuery, response: { 200: HsSearchResponse } },
    },
    async (req) => {
      const { q, hs6, limit } = req.query;

      if (hs6) {
        return db
          .select({
            hs6: hsCodesTable.hs6,
            title: hsCodesTable.title,
          })
          .from(hsCodesTable)
          .where(ilike(hsCodesTable.hs6, hs6))
          .limit(1);
      }

      const query = q ?? '';

      return db
        .select({
          hs6: hsCodesTable.hs6,
          title: hsCodesTable.title,
        })
        .from(hsCodesTable)
        .where(
          or(
            ilike(hsCodesTable.title, `%${query}%`),
            ilike(hsCodesTable.hs6, `%${query.replace(/\D/g, '')}%`)
          )
        )
        .limit(limit);
    }
  );

  // GET /v1/hs/lookup?system=HTS10&code=8517620090
  app.get<{
    Querystring: z.infer<typeof LookupQuerySchema>;
    Reply: z.infer<typeof LookupResponseSchema>;
  }>(
    '/lookup',
    {
      preHandler: app.requireApiKey(['hs:read']),
      schema: { querystring: LookupQuerySchema, response: { 200: LookupResponseSchema } },
    },
    async (req, reply) => {
      const { system, code } = LookupQuerySchema.parse(req.query);

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

      if (!row) return reply.notFound('Alias not found');

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
