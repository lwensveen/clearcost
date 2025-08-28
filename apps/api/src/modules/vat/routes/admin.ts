import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
import { db, vatRulesTable } from '@clearcost/db';
import { and, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm';
import { VatRuleInsert, VatRuleInsertSchema } from '@clearcost/types';
import { importVatRules } from '../services/import-vat.js';

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
  q: z.string().optional(), // search by dest (contains)
  dest: z.string().length(2).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

// Coerced select shape (matches DB types: numeric as string, timestamps as Date)
const VatSelectSchema = z.object({
  id: z.string().uuid(),
  dest: z.string().length(2),
  ratePct: z.string(), // stored as numeric in DB
  base: VatBaseEnum,
  effectiveFrom: z.any(),
  effectiveTo: z.any().nullable(),
  notes: z.string().nullable().optional(),
  createdAt: z.any().nullable().optional(),
  updatedAt: z.any().nullable().optional(),
});

export default function vatRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // ADMIN list (paged)
  r.get(
    '/',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { querystring: VatListQuery, response: { 200: z.array(VatSelectSchema) } },
      config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
    },
    async (req) => {
      const { q, dest, from, to, limit, offset } = req.query;

      const where = and(
        dest ? eq(vatRulesTable.dest, dest.toUpperCase()) : sql`TRUE`,
        q ? ilike(vatRulesTable.dest, `%${q}%`) : sql`TRUE`,
        from ? gte(vatRulesTable.effectiveFrom, from) : sql`TRUE`,
        to ? lte(vatRulesTable.effectiveFrom, to) : sql`TRUE`
      );

      const rows = await db
        .select()
        .from(vatRulesTable)
        .where(where)
        .orderBy(desc(vatRulesTable.effectiveFrom))
        .limit(limit)
        .offset(offset);

      return z.array(VatSelectSchema).parse(rows);
    }
  );

  // Create
  r.post(
    '/',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { body: VatCreateSchema, response: { 201: VatSelectSchema } },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const b = req.body;
      const [row] = await db
        .insert(vatRulesTable)
        .values({
          dest: b.dest.toUpperCase(),
          ratePct: String(b.ratePct),
          base: b.base,
          effectiveFrom: b.effectiveFrom,
          effectiveTo: b.effectiveTo ?? null,
          notes: b.notes ?? null,
        })
        .returning();
      return reply.code(201).send(VatSelectSchema.parse(row));
    }
  );

  // Update
  r.patch(
    '/:id',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: VatUpdateSchema,
        response: { 200: VatSelectSchema, 404: z.any() },
      },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { id } = req.params;
      const b = req.body;

      const [row] = await db
        .update(vatRulesTable)
        .set({
          ...(b.dest ? { dest: b.dest.toUpperCase() } : {}),
          ...(b.ratePct !== undefined ? { ratePct: String(b.ratePct) } : {}),
          ...(b.base ? { base: b.base } : {}),
          ...(b.effectiveFrom ? { effectiveFrom: b.effectiveFrom } : {}),
          ...(b.effectiveTo !== undefined ? { effectiveTo: b.effectiveTo ?? null } : {}),
          ...(b.notes !== undefined ? { notes: b.notes ?? null } : {}),
          updatedAt: new Date(),
        })
        .where(eq(vatRulesTable.id, id))
        .returning();

      if (!row) return reply.notFound('Not found');
      return VatSelectSchema.parse(row);
    }
  );

  // Delete
  r.delete(
    '/:id',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { params: z.object({ id: z.string().uuid() }) },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const [row] = await db
        .delete(vatRulesTable)
        .where(eq(vatRulesTable.id, req.params.id))
        .returning();
      if (!row) return reply.notFound('Not found');
      return reply.code(204).send();
    }
  );

  // Bulk import (JSON array of objects)
  r.post(
    '/import-json',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        body: z.object({ rows: z.array(VatCreateSchema) }),
        response: { 200: z.object({ inserted: z.number() }) },
      },
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (req) => {
      let inserted = 0;
      for (const r0 of req.body.rows) {
        await db
          .insert(vatRulesTable)
          .values({
            dest: r0.dest.toUpperCase(),
            ratePct: String(r0.ratePct),
            base: r0.base,
            effectiveFrom: r0.effectiveFrom,
            effectiveTo: r0.effectiveTo ?? null,
            notes: r0.notes ?? null,
          })
          .onConflictDoNothing();
        inserted++;
      }
      return { inserted };
    }
  );

  // Batch import via shared insert schema (upsert handled in service)
  r.post<{
    Body: VatRuleInsert[];
    Reply: { ok: true; count: number };
  }>(
    '/import',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        // Expect an array of rows, not a single row
        body: z.array(VatRuleInsertSchema),
        response: { 200: z.object({ ok: z.literal(true), count: z.number() }) },
      },
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (req) => {
      const res = await importVatRules(req.body);
      return { ok: true as const, count: res.count };
    }
  );
}
