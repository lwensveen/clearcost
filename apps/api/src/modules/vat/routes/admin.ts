import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { db, vatRulesTable } from '@clearcost/db';
import { and, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm';
import {
  ErrorResponseSchema,
  NoContentResponseSchema,
  VatAdminCreateSchema,
  VatAdminImportBodySchema,
  VatAdminIdParamSchema,
  VatAdminImportJsonBodySchema,
  VatAdminImportJsonResponseSchema,
  VatAdminImportResponseSchema,
  VatAdminListQuerySchema,
  VatAdminListResponseSchema,
  VatAdminUpdateSchema,
  VatRuleInsert,
  VatRuleInsertSchema,
  VatRuleSelectCoercedSchema,
} from '@clearcost/types';
import { importVatRules } from '../services/import-vat.js';
import { errorResponseForStatus } from '../../../lib/errors.js';

export default function vatRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // ADMIN list (paged)
  r.get(
    '/',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        querystring: VatAdminListQuerySchema,
        response: { 200: VatAdminListResponseSchema },
      },
      config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
    },
    async (req) => {
      const { q, dest, from, to, limit, offset } = VatAdminListQuerySchema.parse(req.query);

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

      return VatAdminListResponseSchema.parse(rows);
    }
  );

  // Create
  r.post(
    '/',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { body: VatAdminCreateSchema, response: { 201: VatRuleSelectCoercedSchema } },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const b = VatAdminCreateSchema.parse(req.body);
      const [row] = await db
        .insert(vatRulesTable)
        .values({
          dest: b.dest.toUpperCase(),
          source: 'manual',
          ratePct: String(b.ratePct),
          vatBase: b.vatBase,
          effectiveFrom: b.effectiveFrom,
          effectiveTo: b.effectiveTo ?? null,
          notes: b.notes ?? null,
        })
        .returning();
      return reply.code(201).send(VatRuleSelectCoercedSchema.parse(row));
    }
  );

  // Update
  r.patch(
    '/:id',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        params: VatAdminIdParamSchema,
        body: VatAdminUpdateSchema,
        response: { 200: VatRuleSelectCoercedSchema, 404: ErrorResponseSchema },
      },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { id } = VatAdminIdParamSchema.parse(req.params);
      const b = VatAdminUpdateSchema.parse(req.body);

      const [row] = await db
        .update(vatRulesTable)
        .set({
          ...(b.dest ? { dest: b.dest.toUpperCase() } : {}),
          source: 'manual',
          ...(b.ratePct !== undefined ? { ratePct: String(b.ratePct) } : {}),
          ...(b.vatBase ? { vatBase: b.vatBase } : {}),
          ...(b.effectiveFrom ? { effectiveFrom: b.effectiveFrom } : {}),
          ...(b.effectiveTo !== undefined ? { effectiveTo: b.effectiveTo ?? null } : {}),
          ...(b.notes !== undefined ? { notes: b.notes ?? null } : {}),
          updatedAt: new Date(),
        })
        .where(eq(vatRulesTable.id, id))
        .returning();

      if (!row) return reply.code(404).send(errorResponseForStatus(404, 'Not found'));
      return VatRuleSelectCoercedSchema.parse(row);
    }
  );

  // Delete
  r.delete(
    '/:id',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        params: VatAdminIdParamSchema,
        response: { 204: NoContentResponseSchema, 404: ErrorResponseSchema },
      },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const [row] = await db
        .delete(vatRulesTable)
        .where(eq(vatRulesTable.id, req.params.id))
        .returning();
      if (!row) return reply.code(404).send(errorResponseForStatus(404, 'Not found'));
      return reply.code(204).send();
    }
  );

  // Bulk import (JSON array of objects)
  r.post(
    '/import-json',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        body: VatAdminImportJsonBodySchema,
        response: { 200: VatAdminImportJsonResponseSchema },
      },
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (req) => {
      let inserted = 0;
      const body = VatAdminImportJsonBodySchema.parse(req.body);
      for (const r0 of body.rows) {
        await db
          .insert(vatRulesTable)
          .values({
            dest: r0.dest.toUpperCase(),
            source: 'manual',
            ratePct: String(r0.ratePct),
            vatBase: r0.vatBase,
            effectiveFrom: r0.effectiveFrom,
            effectiveTo: r0.effectiveTo ?? null,
            notes: r0.notes ?? null,
          })
          .onConflictDoNothing();
        inserted++;
      }
      return VatAdminImportJsonResponseSchema.parse({ inserted });
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
        body: VatAdminImportBodySchema,
        response: { 200: VatAdminImportResponseSchema },
      },
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (req) => {
      const res = await importVatRules(req.body, { source: 'manual' });
      return VatAdminImportResponseSchema.parse({ ok: true as const, count: res.count });
    }
  );
}
