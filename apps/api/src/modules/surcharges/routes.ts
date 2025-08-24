import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { db, surchargesTable } from '@clearcost/db';
import { and, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm';

const SurchargeCreate = z.object({
  dest: z.string().length(2), // ISO2 country
  code: z.string().min(1), // surcharge code (enum in DB)
  fixedAmt: z.number().optional(), // absolute currency amount in dest currency
  pctAmt: z.number().optional(), // percentage % of CIF
  notes: z.string().optional().nullable(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
});

const SurchargeUpdate = SurchargeCreate.partial();

const SurchargeListQuery = z.object({
  q: z.string().optional(), // fuzzy on dest/code
  dest: z.string().length(2).optional(),
  code: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export default function surchargesRoutes(app: FastifyInstance) {
  // GET /v1/surcharges
  app.get<{ Querystring: z.infer<typeof SurchargeListQuery> }>(
    '/',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { querystring: SurchargeListQuery },
    },
    async (req) => {
      const { q, dest, code, from, to, limit, offset } = SurchargeListQuery.parse(req.query);
      const where = and(
        dest ? eq(surchargesTable.dest, dest) : sql`TRUE`,
        code ? eq(surchargesTable.code as any, code) : sql`TRUE`,
        q ? ilike(surchargesTable.dest, `%${q}%`) : sql`TRUE`,
        from ? gte(surchargesTable.effectiveFrom as any, from) : sql`TRUE`,
        to ? lte(surchargesTable.effectiveFrom as any, to) : sql`TRUE`
      );
      return db
        .select()
        .from(surchargesTable)
        .where(where)
        .orderBy(desc(surchargesTable.effectiveFrom))
        .limit(limit)
        .offset(offset);
    }
  );

  // POST /v1/surcharges
  app.post<{ Body: z.infer<typeof SurchargeCreate> }>(
    '/',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { body: SurchargeCreate },
    },
    async (req, reply) => {
      const b = SurchargeCreate.parse(req.body);
      const [row] = await db
        .insert(surchargesTable)
        .values({
          dest: b.dest,
          code: b.code as any,
          fixedAmt: b.fixedAmt !== undefined ? String(b.fixedAmt) : null,
          pctAmt: b.pctAmt !== undefined ? String(b.pctAmt) : null,
          notes: b.notes ?? null,
          effectiveFrom: b.effectiveFrom as any,
          effectiveTo: (b.effectiveTo ?? null) as any,
        } as any)
        .returning();
      return reply.code(201).send(row);
    }
  );

  // PATCH /v1/surcharges/:id
  app.patch<{ Params: { id: string }; Body: z.infer<typeof SurchargeUpdate> }>(
    '/:id',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { params: z.object({ id: z.string().uuid() }), body: SurchargeUpdate },
    },
    async (req, reply) => {
      const b = SurchargeUpdate.parse(req.body);
      const [row] = await db
        .update(surchargesTable)
        .set({
          ...(b.dest ? { dest: b.dest } : {}),
          ...(b.code ? { code: b.code as any } : {}),
          ...(b.fixedAmt !== undefined ? { fixedAmt: String(b.fixedAmt) } : {}),
          ...(b.pctAmt !== undefined ? { pctAmt: String(b.pctAmt) } : {}),
          ...(b.notes !== undefined ? { notes: b.notes ?? null } : {}),
          ...(b.effectiveFrom ? { effectiveFrom: b.effectiveFrom as any } : {}),
          ...(b.effectiveTo !== undefined ? { effectiveTo: (b.effectiveTo ?? null) as any } : {}),
          updatedAt: new Date() as any,
        } as any)
        .where(eq(surchargesTable.id, req.params.id as any))
        .returning();
      if (!row) return reply.notFound('Not found');
      return row;
    }
  );

  // DELETE /v1/surcharges/:id
  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { params: z.object({ id: z.string().uuid() }) },
    },
    async (req, reply) => {
      const [row] = await db
        .delete(surchargesTable)
        .where(eq(surchargesTable.id, req.params.id as any))
        .returning();
      if (!row) return reply.notFound('Not found');
      return reply.code(204).send();
    }
  );

  // POST /v1/surcharges/import-json
  app.post<{ Body: { rows: Array<z.infer<typeof SurchargeCreate>> } }>(
    '/import-json',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        body: z.object({ rows: z.array(SurchargeCreate) }),
        response: { 200: z.object({ inserted: z.number() }) },
      },
    },
    async (req) => {
      let inserted = 0;
      for (const r of req.body.rows) {
        await db
          .insert(surchargesTable)
          .values({
            dest: r.dest,
            code: r.code as any,
            fixedAmt: r.fixedAmt !== undefined ? String(r.fixedAmt) : null,
            pctAmt: r.pctAmt !== undefined ? String(r.pctAmt) : null,
            notes: r.notes ?? null,
            effectiveFrom: r.effectiveFrom as any,
            effectiveTo: (r.effectiveTo ?? null) as any,
          } as any)
          .onConflictDoNothing();
        inserted++;
      }
      return { inserted };
    }
  );
}
