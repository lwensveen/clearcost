import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { db, freightRateCardsTable, freightRateStepsTable } from '@clearcost/db';
import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { withIdempotency } from '../../../lib/idempotency.js';
import { importFreightCards } from '../services/import-cards.js';
import { errorResponseForStatus } from '../../../lib/errors.js';
import {
  ErrorResponseSchema,
  FreightCardAdminCreateSchema,
  FreightCardAdminIdParamSchema,
  FreightCardAdminImportJsonBodySchema,
  FreightCardAdminImportJsonResponseSchema,
  FreightCardAdminUpdateSchema,
  FreightCardsAdminListResponseSchema,
  FreightCardsAdminQuerySchema,
  FreightCardsImportResponseSchema,
  FreightCardsImportSchema,
  FreightRateCardSelectCoercedSchema,
  FreightRateStepSelectCoercedSchema,
  FreightRateStepsListResponseSchema,
  FreightStepAdminCreateSchema,
  FreightStepAdminUpdateSchema,
  FreightStepIdParamSchema,
  IdempotencyHeaderSchema,
} from '@clearcost/types';

// Require Idempotency-Key on write endpoints
function getIdem(headers: z.infer<typeof IdempotencyHeaderSchema>) {
  return headers['idempotency-key'] ?? headers['x-idempotency-key']!;
}

/**
 * Interval-overlap predicate: card window [effectiveFrom, effectiveTo?]
 * overlaps query window [from?, to?]. If no from/to, we simply filter on EF/ET if present.
 */
function overlapWhere({ from, to }: { from?: Date; to?: Date }) {
  if (!from && !to) return sql`TRUE`;
  if (from && to) {
    // overlap: card.effective_from <= to AND (card.effective_to IS NULL OR card.effective_to >= from)
    return and(
      lte(freightRateCardsTable.effectiveFrom, to),
      or(
        sql`${freightRateCardsTable.effectiveTo} IS NULL`,
        gte(freightRateCardsTable.effectiveTo, from)
      )
    );
  }
  if (from) {
    // any card whose window ends after from
    return or(
      sql`${freightRateCardsTable.effectiveTo} IS NULL`,
      gte(freightRateCardsTable.effectiveTo, from)
    );
  }
  // only `to` provided: any card whose window starts before/equal to `to`
  return lte(freightRateCardsTable.effectiveFrom, to!);
}

export default function freightRoutes(app: FastifyInstance) {
  // List/search cards
  app.get<{ Querystring: z.infer<typeof FreightCardsAdminQuerySchema> }>(
    '/cards',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        querystring: FreightCardsAdminQuerySchema,
        response: { 200: FreightCardsAdminListResponseSchema },
      },
      config: { rateLimit: { max: 180, timeWindow: '1 minute' } },
    },
    async (req) => {
      const q = FreightCardsAdminQuerySchema.parse(req.query);
      const where = and(
        q.origin ? eq(freightRateCardsTable.origin, q.origin) : sql`TRUE`,
        q.dest ? eq(freightRateCardsTable.dest, q.dest) : sql`TRUE`,
        q.freightMode ? eq(freightRateCardsTable.freightMode, q.freightMode) : sql`TRUE`,
        q.freightUnit ? eq(freightRateCardsTable.freightUnit, q.freightUnit) : sql`TRUE`,
        q.q ? ilike(freightRateCardsTable.carrier, `%${q.q}%`) : sql`TRUE`,
        overlapWhere({ from: q.from, to: q.to })
      );

      const rows = await db
        .select()
        .from(freightRateCardsTable)
        .where(where)
        .orderBy(desc(freightRateCardsTable.effectiveFrom), desc(freightRateCardsTable.createdAt))
        .limit(q.limit)
        .offset(q.offset);
      return FreightCardsAdminListResponseSchema.parse(rows);
    }
  );

  // Create card
  app.post<{
    Body: z.infer<typeof FreightCardAdminCreateSchema>;
    Headers: z.infer<typeof IdempotencyHeaderSchema>;
  }>(
    '/cards',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        body: FreightCardAdminCreateSchema,
        headers: IdempotencyHeaderSchema,
        response: { 201: FreightRateCardSelectCoercedSchema },
      },
      config: {
        rateLimit: { max: 60, timeWindow: '1 minute' },
        importMeta: { importSource: 'MANUAL', job: 'freight:card-create' },
      },
    },
    async (req, reply) => {
      const headers = IdempotencyHeaderSchema.parse(req.headers);
      const body = FreightCardAdminCreateSchema.parse(req.body);
      const ns = `freight:cards:create:${req.apiKey!.ownerId}`;
      const idem = getIdem(headers);

      const out = await withIdempotency(
        ns,
        idem,
        body,
        async (): Promise<Record<string, unknown>> => {
          const [row] = await db
            .insert(freightRateCardsTable)
            .values({
              origin: body.origin,
              dest: body.dest,
              freightMode: body.freightMode,
              freightUnit: body.freightUnit,
              carrier: body.carrier ?? null,
              service: body.service ?? null,
              notes: body.notes ?? null,
              effectiveFrom: body.effectiveFrom,
              effectiveTo: body.effectiveTo ?? null,
            })
            .returning();

          if (!row) throw new Error('Insert failed');
          return row as unknown as Record<string, unknown>;
        }
      );

      return reply.code(201).send(FreightRateCardSelectCoercedSchema.parse(out));
    }
  );

  // Patch card
  app.patch<{
    Params: z.infer<typeof FreightCardAdminIdParamSchema>;
    Body: z.infer<typeof FreightCardAdminUpdateSchema>;
    Headers: z.infer<typeof IdempotencyHeaderSchema>;
  }>(
    '/cards/:id',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        params: FreightCardAdminIdParamSchema,
        body: FreightCardAdminUpdateSchema,
        headers: IdempotencyHeaderSchema,
        response: { 200: FreightRateCardSelectCoercedSchema, 404: ErrorResponseSchema },
      },
      config: {
        rateLimit: { max: 120, timeWindow: '1 minute' },
        importMeta: { importSource: 'MANUAL', job: 'freight:card-update' },
      },
    },
    async (req, reply) => {
      const headers = IdempotencyHeaderSchema.parse(req.headers);
      const b = FreightCardAdminUpdateSchema.parse(req.body);
      const ns = `freight:cards:update:${req.apiKey!.ownerId}`;
      const idem = getIdem(headers);

      const out = await withIdempotency(ns, idem, { id: req.params.id, ...b }, async () => {
        const [row] = await db
          .update(freightRateCardsTable)
          .set({
            ...(b.origin ? { origin: b.origin } : {}),
            ...(b.dest ? { dest: b.dest } : {}),
            ...(b.freightMode ? { freightMode: b.freightMode } : {}),
            ...(b.freightUnit ? { freightUnit: b.freightUnit } : {}),
            ...(b.carrier !== undefined ? { carrier: b.carrier ?? null } : {}),
            ...(b.service !== undefined ? { service: b.service ?? null } : {}),
            ...(b.notes !== undefined ? { notes: b.notes ?? null } : {}),
            ...(b.effectiveFrom ? { effectiveFrom: b.effectiveFrom } : {}),
            ...(b.effectiveTo !== undefined ? { effectiveTo: b.effectiveTo ?? null } : {}),
            updatedAt: new Date(),
          })
          .where(eq(freightRateCardsTable.id, req.params.id))
          .returning();
        if (!row) throw new Error('NOT_FOUND');
        return row;
      }).catch((e) => {
        if (String(e?.message) === 'NOT_FOUND')
          return reply.code(404).send(errorResponseForStatus(404, 'Not found'));
        throw e;
      });

      // If we already replied above due to NOT_FOUND, stop here
      if (reply.sent) return;
      return FreightRateCardSelectCoercedSchema.parse(out);
    }
  );

  // Delete card
  app.delete<{
    Params: z.infer<typeof FreightCardAdminIdParamSchema>;
    Headers: z.infer<typeof IdempotencyHeaderSchema>;
  }>(
    '/cards/:id',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        params: FreightCardAdminIdParamSchema,
        headers: IdempotencyHeaderSchema,
        response: { 204: z.any(), 404: ErrorResponseSchema },
      },
      config: {
        rateLimit: { max: 60, timeWindow: '1 minute' },
        importMeta: { importSource: 'MANUAL', job: 'freight:card-delete' },
      },
    },
    async (req, reply) => {
      const headers = IdempotencyHeaderSchema.parse(req.headers);
      const ns = `freight:cards:delete:${req.apiKey!.ownerId}`;
      const idem = getIdem(headers);

      await withIdempotency(ns, idem, { id: req.params.id }, async () => {
        const [row] = await db
          .delete(freightRateCardsTable)
          .where(eq(freightRateCardsTable.id, req.params.id))
          .returning();
        if (!row) throw new Error('NOT_FOUND');
        return { ok: true as const };
      }).catch((e) => {
        if (String(e?.message) === 'NOT_FOUND')
          return reply.code(404).send(errorResponseForStatus(404, 'Not found'));
        throw e;
      });

      if (reply.sent) return;
      return reply.code(204).send();
    }
  );

  // List steps for a card
  app.get<{ Params: z.infer<typeof FreightCardAdminIdParamSchema> }>(
    '/cards/:id/steps',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        params: FreightCardAdminIdParamSchema,
        response: { 200: FreightRateStepsListResponseSchema },
      },
      config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const rows = await db
        .select()
        .from(freightRateStepsTable)
        .where(eq(freightRateStepsTable.cardId, req.params.id))
        .orderBy(freightRateStepsTable.uptoQty);
      return reply.send(FreightRateStepsListResponseSchema.parse(rows));
    }
  );

  // Create step
  app.post<{
    Params: z.infer<typeof FreightCardAdminIdParamSchema>;
    Body: z.infer<typeof FreightStepAdminCreateSchema>;
    Headers: z.infer<typeof IdempotencyHeaderSchema>;
  }>(
    '/cards/:id/steps',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        params: FreightCardAdminIdParamSchema,
        body: FreightStepAdminCreateSchema,
        headers: IdempotencyHeaderSchema,
        response: { 201: FreightRateStepSelectCoercedSchema },
      },
      config: {
        rateLimit: { max: 120, timeWindow: '1 minute' },
        importMeta: { importSource: 'MANUAL', job: 'freight:step-create' },
      },
    },
    async (req, reply) => {
      const headers = IdempotencyHeaderSchema.parse(req.headers);
      const b = FreightStepAdminCreateSchema.parse(req.body);
      const ns = `freight:steps:create:${req.apiKey!.ownerId}`;
      const idem = getIdem(headers);

      const out = await withIdempotency(ns, idem, { cardId: req.params.id, ...b }, async () => {
        const row = await db
          .insert(freightRateStepsTable)
          .values({
            cardId: req.params.id,
            uptoQty: String(b.uptoQty),
            pricePerUnit: String(b.pricePerUnit),
          })
          .returning();
        if (!row) throw new Error('Insert failed');

        return row as unknown as Record<string, unknown>;
      });

      return reply.code(201).send(FreightRateStepSelectCoercedSchema.parse(out));
    }
  );

  // Patch step
  app.patch<{
    Params: z.infer<typeof FreightStepIdParamSchema>;
    Body: z.infer<typeof FreightStepAdminUpdateSchema>;
    Headers: z.infer<typeof IdempotencyHeaderSchema>;
  }>(
    '/cards/:id/steps/:stepId',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        params: FreightStepIdParamSchema,
        body: FreightStepAdminUpdateSchema,
        headers: IdempotencyHeaderSchema,
        response: { 200: FreightRateStepSelectCoercedSchema, 404: ErrorResponseSchema },
      },
      config: {
        rateLimit: { max: 180, timeWindow: '1 minute' },
        importMeta: { importSource: 'MANUAL', job: 'freight:step-update' },
      },
    },
    async (req, reply) => {
      const headers = IdempotencyHeaderSchema.parse(req.headers);
      const b = FreightStepAdminUpdateSchema.parse(req.body);
      const ns = `freight:steps:update:${req.apiKey!.ownerId}`;
      const idem = getIdem(headers);

      const out = await withIdempotency(
        ns,
        idem,
        { cardId: req.params.id, stepId: req.params.stepId, ...b },
        async () => {
          const [row] = await db
            .update(freightRateStepsTable)
            .set({
              ...(b.uptoQty !== undefined ? { uptoQty: String(b.uptoQty) } : {}),
              ...(b.pricePerUnit !== undefined ? { pricePerUnit: String(b.pricePerUnit) } : {}),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(freightRateStepsTable.cardId, req.params.id),
                eq(freightRateStepsTable.id, req.params.stepId)
              )
            )
            .returning();
          if (!row) throw new Error('NOT_FOUND');
          return row;
        }
      ).catch((e) => {
        if (String(e?.message) === 'NOT_FOUND')
          return reply.code(404).send(errorResponseForStatus(404, 'Not found'));
        throw e;
      });

      if (reply.sent) return;
      return FreightRateStepSelectCoercedSchema.parse(out);
    }
  );

  // Delete step
  app.delete<{
    Params: z.infer<typeof FreightStepIdParamSchema>;
    Headers: z.infer<typeof IdempotencyHeaderSchema>;
  }>(
    '/cards/:id/steps/:stepId',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        params: FreightStepIdParamSchema,
        headers: IdempotencyHeaderSchema,
        response: { 204: z.any(), 404: ErrorResponseSchema },
      },
      config: {
        rateLimit: { max: 120, timeWindow: '1 minute' },
        importMeta: { importSource: 'MANUAL', job: 'freight:step-delete' },
      },
    },
    async (req, reply) => {
      const headers = IdempotencyHeaderSchema.parse(req.headers);
      const ns = `freight:steps:delete:${req.apiKey!.ownerId}`;
      const idem = getIdem(headers);

      await withIdempotency(
        ns,
        idem,
        { cardId: req.params.id, stepId: req.params.stepId },
        async () => {
          const [row] = await db
            .delete(freightRateStepsTable)
            .where(
              and(
                eq(freightRateStepsTable.cardId, req.params.id),
                eq(freightRateStepsTable.id, req.params.stepId)
              )
            )
            .returning();
          if (!row) throw new Error('NOT_FOUND');
          return { ok: true as const };
        }
      ).catch((e) => {
        if (String(e?.message) === 'NOT_FOUND')
          return reply.code(404).send(errorResponseForStatus(404, 'Not found'));
        throw e;
      });

      if (reply.sent) return;
      return reply.code(204).send();
    }
  );

  // Bulk JSON import (cards + nested steps) — transactional, idempotent
  app.post<{
    Body: {
      cards: Array<
        z.infer<typeof FreightCardAdminCreateSchema> & {
          steps?: Array<z.infer<typeof FreightStepAdminCreateSchema>>;
        }
      >;
    };
    Headers: z.infer<typeof IdempotencyHeaderSchema>;
  }>(
    '/import-json',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        headers: IdempotencyHeaderSchema,
        body: FreightCardAdminImportJsonBodySchema,
        response: { 200: FreightCardAdminImportJsonResponseSchema },
      },
      config: {
        rateLimit: { max: 12, timeWindow: '1 minute' },
        importMeta: { importSource: 'MANUAL', job: 'freight:import-json' },
      },
    },
    async (req) => {
      const headers = IdempotencyHeaderSchema.parse(req.headers);
      const body = FreightCardAdminImportJsonBodySchema.parse(req.body);
      const ns = `freight:cards:import-json:${req.apiKey!.ownerId}`;
      const idem = getIdem(headers);

      return withIdempotency(ns, idem, { count: body.cards.length }, async () => {
        let insertedCards = 0,
          insertedSteps = 0;

        await db.transaction(async (tx) => {
          for (const c of body.cards) {
            const [card] = await tx
              .insert(freightRateCardsTable)
              .values({
                origin: c.origin,
                dest: c.dest,
                freightMode: c.freightMode,
                freightUnit: c.freightUnit,
                carrier: c.carrier ?? null,
                service: c.service ?? null,
                notes: c.notes ?? null,
                effectiveFrom: c.effectiveFrom,
                effectiveTo: c.effectiveTo ?? null,
              })
              .returning();

            if (!card) throw new Error('CARD_INSERT_FAILED');
            insertedCards++;

            if (c.steps?.length) {
              for (const s of c.steps) {
                await tx
                  .insert(freightRateStepsTable)
                  .values({
                    cardId: card.id,
                    uptoQty: String(s.uptoQty),
                    pricePerUnit: String(s.pricePerUnit),
                  })
                  .onConflictDoNothing();
                insertedSteps++;
              }
            }
          }
        });

        return { insertedCards, insertedSteps };
      });
    }
  );

  // Cards import (normalized schema via service)
  app.post<{
    Body: z.infer<typeof FreightCardsImportSchema>;
    Headers: z.infer<typeof IdempotencyHeaderSchema>;
  }>(
    '/cards/import',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        headers: IdempotencyHeaderSchema,
        body: FreightCardsImportSchema,
        response: { 200: FreightCardsImportResponseSchema, 400: ErrorResponseSchema },
      },
      config: {
        rateLimit: { max: 12, timeWindow: '1 minute' },
        importMeta: { importSource: 'MANUAL', job: 'freight:cards-json' },
      },
    },
    async (req, reply) => {
      const headers = IdempotencyHeaderSchema.parse(req.headers);
      const idem = getIdem(headers);
      if (!idem)
        return reply.code(400).send(errorResponseForStatus(400, 'Idempotency-Key header required'));

      const ns = `freight:cards:service-import:${req.apiKey!.ownerId}`;

      return withIdempotency(ns, idem, req.body, async () => {
        return importFreightCards(req.body);
      });
    }
  );
}
