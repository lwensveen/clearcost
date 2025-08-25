import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { db, vatRulesTable } from '@clearcost/db';
import { and, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm';
import { importVatRules, VatRows } from './services/import-vat.js';

const VatBaseEnum = z.enum(['CIF', 'CIF_PLUS_DUTY']);

const VatCreateSchema = z.object({
  dest: z.string().length(2), // ISO2
  ratePct: z.number().min(0).max(100),
  base: VatBaseEnum.default('CIF_PLUS_DUTY'),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const VatUpdateSchema = VatCreateSchema.partial();

const VatListQuery = z.object({
  q: z.string().optional(), // search by dest
  dest: z.string().length(2).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export default function vatRoutes(app: FastifyInstance) {
  // ADMIN list (paged)
  app.get<{ Querystring: z.infer<typeof VatListQuery> }>(
    '/',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { querystring: VatListQuery },
    },
    async (req) => {
      const { q, dest, from, to, limit, offset } = VatListQuery.parse(req.query);
      const where = and(
        dest ? eq(vatRulesTable.dest, dest) : sql`TRUE`,
        q ? ilike(vatRulesTable.dest, `%${q}%`) : sql`TRUE`,
        from ? gte(vatRulesTable.effectiveFrom as any, from) : sql`TRUE`,
        to ? lte(vatRulesTable.effectiveFrom as any, to) : sql`TRUE`
      );

      return db
        .select()
        .from(vatRulesTable)
        .where(where)
        .orderBy(desc(vatRulesTable.effectiveFrom))
        .limit(limit)
        .offset(offset);
    }
  );

  // Create
  app.post<{ Body: z.infer<typeof VatCreateSchema> }>(
    '/',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { body: VatCreateSchema },
    },
    async (req, reply) => {
      const body = VatCreateSchema.parse(req.body);
      const [row] = await db
        .insert(vatRulesTable)
        .values({
          dest: body.dest,
          ratePct: String(body.ratePct),
          base: body.base as any,
          effectiveFrom: body.effectiveFrom as any,
          effectiveTo: (body.effectiveTo ?? null) as any,
          notes: body.notes ?? null,
        } as any)
        .returning();
      return reply.code(201).send(row);
    }
  );

  // Update
  app.patch<{ Params: { id: string }; Body: z.infer<typeof VatUpdateSchema> }>(
    '/:id',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { params: z.object({ id: z.string().uuid() }), body: VatUpdateSchema },
    },
    async (req, reply) => {
      const patch = VatUpdateSchema.parse(req.body);
      const [row] = await db
        .update(vatRulesTable)
        .set({
          ...(patch.dest ? { dest: patch.dest } : {}),
          ...(patch.ratePct !== undefined ? { ratePct: String(patch.ratePct) } : {}),
          ...(patch.base ? { base: patch.base as any } : {}),
          ...(patch.effectiveFrom ? { effectiveFrom: patch.effectiveFrom as any } : {}),
          ...(patch.effectiveTo !== undefined
            ? { effectiveTo: (patch.effectiveTo ?? null) as any }
            : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes ?? null } : {}),
          updatedAt: new Date() as any,
        } as any)
        .where(eq(vatRulesTable.id, req.params.id as any))
        .returning();
      if (!row) return reply.notFound('Not found');
      return row;
    }
  );

  // Delete
  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { params: z.object({ id: z.string().uuid() }) },
    },
    async (req, reply) => {
      const [row] = await db
        .delete(vatRulesTable)
        .where(eq(vatRulesTable.id, req.params.id as any))
        .returning();
      if (!row) return reply.notFound('Not found');
      return reply.code(204).send();
    }
  );

  // Bulk import (JSON array of objects)
  app.post<{ Body: { rows: Array<z.infer<typeof VatCreateSchema>> } }>(
    '/import-json',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        body: z.object({ rows: z.array(VatCreateSchema) }),
        response: { 200: z.object({ inserted: z.number() }) },
      },
    },
    async (req) => {
      const rows = req.body.rows;
      let inserted = 0;
      for (const r of rows) {
        await db
          .insert(vatRulesTable)
          .values({
            dest: r.dest,
            ratePct: String(r.ratePct),
            base: r.base as any,
            effectiveFrom: r.effectiveFrom as any,
            effectiveTo: (r.effectiveTo ?? null) as any,
            notes: r.notes ?? null,
          } as any)
          .onConflictDoNothing();
        inserted++;
      }
      return { inserted };
    }
  );

  app.post<{ Body: z.infer<typeof VatRows> }>(
    '/import',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        body: VatRows,
        response: { 200: z.object({ ok: z.literal(true), count: z.number() }) },
      },
    },
    async (req) => importVatRules(req.body)
  );
}
