import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { db, hsCodesTable } from '@clearcost/db';
import { ilike, or } from 'drizzle-orm';

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

export default function hsRoutes(app: FastifyInstance) {
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
            ahtn8: hsCodesTable.ahtn8,
            cn8: hsCodesTable.cn8,
            hts10: hsCodesTable.hts10,
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
          ahtn8: hsCodesTable.ahtn8,
          cn8: hsCodesTable.cn8,
          hts10: hsCodesTable.hts10,
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
}
