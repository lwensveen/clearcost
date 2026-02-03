import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { db, surchargesTable } from '@clearcost/db';
import { and, desc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import {
  ErrorResponseSchema,
  NoContentResponseSchema,
  SurchargeByIdSchema,
  SurchargeInsertSchema,
  SurchargesAdminImportBodySchema,
  SurchargeSelectCoercedSchema,
  SurchargesAdminImportResponseSchema,
  SurchargesAdminListQuerySchema,
  SurchargesAdminListResponseSchema,
  SurchargeUpdateSchema,
} from '@clearcost/types';
import { importSurcharges } from '../services/import-surcharges.js';
import { errorResponseForStatus } from '../../../lib/errors.js';

export default function surchargesAdminRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // GET /v1/surcharges
  r.get(
    '/',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        querystring: SurchargesAdminListQuerySchema,
        response: { 200: SurchargesAdminListResponseSchema },
      },
      config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
    },
    async (req) => {
      const { dest, surchargeCode, activeOn, limit = 50, offset = 0 } = req.query;

      const where = and(
        dest ? eq(surchargesTable.dest, dest.toUpperCase()) : sql`TRUE`,
        surchargeCode ? eq(surchargesTable.surchargeCode, surchargeCode) : sql`TRUE`,
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

      return SurchargesAdminListResponseSchema.parse(rows);
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
        response: { 200: SurchargeSelectCoercedSchema, 404: ErrorResponseSchema },
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

      if (!updated) return reply.code(404).send(errorResponseForStatus(404, 'Not found'));
      return SurchargeSelectCoercedSchema.parse(updated);
    }
  );

  // DELETE /v1/surcharges/:id
  r.delete(
    '/:id',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        params: SurchargeByIdSchema,
        response: { 204: NoContentResponseSchema, 404: ErrorResponseSchema },
      },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { id } = req.params;
      const [deleted] = await db
        .delete(surchargesTable)
        .where(eq(surchargesTable.id, id))
        .returning();

      if (!deleted) return reply.code(404).send(errorResponseForStatus(404, 'Not found'));
      return reply.code(204).send();
    }
  );

  // POST /v1/surcharges/import  (batch upsert)
  r.post(
    '/import',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        body: SurchargesAdminImportBodySchema,
        response: { 200: SurchargesAdminImportResponseSchema },
      },
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (req) => SurchargesAdminImportResponseSchema.parse(await importSurcharges(req.body))
  );
}
