import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
import { db, surchargesTable } from '@clearcost/db';
import { and, desc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import {
  SurchargeByIdSchema,
  SurchargeInsertSchema,
  SurchargeSelectCoercedSchema,
  SurchargesListQuerySchema,
  SurchargeUpdateSchema,
} from '@clearcost/types';
import { importSurcharges } from '../services/import-surcharges.js';

const ListQuerySchema = SurchargesListQuerySchema.extend({
  offset: z.coerce.number().int().nonnegative().default(0),
});

export default function surchargesAdminRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // GET /v1/surcharges
  r.get(
    '/',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        querystring: ListQuerySchema,
        response: { 200: z.array(SurchargeSelectCoercedSchema) },
      },
      config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
    },
    async (req) => {
      const { dest, code, activeOn, limit = 50, offset = 0 } = req.query;

      const where = and(
        dest ? eq(surchargesTable.dest, dest.toUpperCase()) : sql`TRUE`,
        code ? eq(surchargesTable.code, code) : sql`TRUE`,
        activeOn
          ? and(
              lte(surchargesTable.effectiveFrom, activeOn),
              or(isNull(surchargesTable.effectiveTo), gt(surchargesTable.effectiveTo, activeOn))
            )
          : sql`TRUE`
      );

      const rows = await db
        .select()
        .from(surchargesTable)
        .where(where)
        .orderBy(desc(surchargesTable.effectiveFrom))
        .limit(limit)
        .offset(offset);

      return z.array(SurchargeSelectCoercedSchema).parse(rows);
    }
  );

  // POST /v1/surcharges  (create)
  r.post(
    '/',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        body: SurchargeInsertSchema,
        response: { 201: SurchargeSelectCoercedSchema },
      },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const [inserted] = await db.insert(surchargesTable).values(req.body).returning();
      return reply.code(201).send(SurchargeSelectCoercedSchema.parse(inserted));
    }
  );

  // PATCH /v1/surcharges/:id  (partial update)
  r.patch(
    '/:id',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        params: SurchargeByIdSchema,
        body: SurchargeUpdateSchema,
        response: { 200: SurchargeSelectCoercedSchema, 404: z.any() },
      },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { id } = req.params;
      const patch = req.body;

      const [updated] = await db
        .update(surchargesTable)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(surchargesTable.id, id))
        .returning();

      if (!updated) return reply.notFound('Not found');
      return SurchargeSelectCoercedSchema.parse(updated);
    }
  );

  // DELETE /v1/surcharges/:id
  r.delete(
    '/:id',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { params: SurchargeByIdSchema },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { id } = req.params;
      const [deleted] = await db
        .delete(surchargesTable)
        .where(eq(surchargesTable.id, id))
        .returning();

      if (!deleted) return reply.notFound('Not found');
      return reply.code(204).send();
    }
  );

  // POST /v1/surcharges/import  (batch upsert)
  r.post(
    '/import',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        body: z.array(SurchargeInsertSchema),
        response: { 200: z.object({ ok: z.literal(true), count: z.number() }) },
      },
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (req) => importSurcharges(req.body)
  );
}
