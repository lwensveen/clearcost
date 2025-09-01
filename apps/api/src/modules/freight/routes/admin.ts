import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { db, freightRateCardsTable, freightRateStepsTable } from '@clearcost/db';
import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { withIdempotency } from '../../../lib/idempotency.js';
import { FreightCard, importFreightCards } from '../services/import-cards.js';
import { HeaderSchema } from '@clearcost/types';

const ModeEnum = z.enum(['air', 'sea']);
const UnitEnum = z.enum(['kg', 'm3']);

const CardCreate = z
  .object({
    origin: z.string().length(3),
    dest: z.string().length(3),
    freightMode: ModeEnum,
    freightUnit: UnitEnum,
    carrier: z.string().min(1).optional().nullable(),
    service: z.string().min(1).optional().nullable(),
    notes: z.string().optional().nullable(),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().optional().nullable(),
  })
  .refine((b) => !b.effectiveTo || b.effectiveTo >= b.effectiveFrom, {
    message: 'effectiveTo must be >= effectiveFrom',
    path: ['effectiveTo'],
  });

const CardUpdate = CardCreate.partial().refine(
  (b) =>
    Object.keys(b).some((k) => (b as any)[k] !== undefined) &&
    (!b.effectiveTo || !b.effectiveFrom || b.effectiveTo >= b.effectiveFrom),
  { message: 'At least one field required and effectiveTo>=effectiveFrom when both provided' }
);

const StepCreate = z.object({
  uptoQty: z.number().positive(), // threshold (in unit)
  pricePerUnit: z.number().nonnegative(),
});
const StepUpdate = StepCreate.partial().refine(
  (b) => Object.keys(b).some((k) => (b as any)[k] !== undefined),
  { message: 'At least one field required' }
);

const CardsQuery = z
  .object({
    q: z.string().optional(),
    origin: z.string().length(3).optional(),
    dest: z.string().length(3).optional(),
    freightMode: ModeEnum.optional(),
    freightUnit: UnitEnum.optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    limit: z.coerce.number().int().positive().max(200).default(50),
    offset: z.coerce.number().int().nonnegative().default(0),
  })
  .refine((q) => !(q.from && q.to) || q.to >= q.from, {
    message: '`to` must be >= `from`',
    path: ['to'],
  });

export const FreightCardsPayload = z.object({
  cards: z.array(FreightCard),
});

// Require Idempotency-Key on write endpoints
function getIdem(headers: z.infer<typeof HeaderSchema>) {
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
  app.get<{ Querystring: z.infer<typeof CardsQuery> }>(
    '/cards',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { querystring: CardsQuery },
      config: { rateLimit: { max: 180, timeWindow: '1 minute' } },
    },
    async (req) => {
      const q = CardsQuery.parse(req.query);
      const where = and(
        q.origin ? eq(freightRateCardsTable.origin, q.origin) : sql`TRUE`,
        q.dest ? eq(freightRateCardsTable.dest, q.dest) : sql`TRUE`,
        q.freightMode ? eq(freightRateCardsTable.freightMode, q.freightMode) : sql`TRUE`,
        q.freightUnit ? eq(freightRateCardsTable.freightUnit, q.freightUnit) : sql`TRUE`,
        q.q ? ilike(freightRateCardsTable.carrier, `%${q.q}%`) : sql`TRUE`,
        overlapWhere({ from: q.from, to: q.to })
      );

      return db
        .select()
        .from(freightRateCardsTable)
        .where(where)
        .orderBy(desc(freightRateCardsTable.effectiveFrom), desc(freightRateCardsTable.createdAt))
        .limit(q.limit)
        .offset(q.offset);
    }
  );

  // Create card
  app.post<{ Body: z.infer<typeof CardCreate>; Headers: z.infer<typeof HeaderSchema> }>(
    '/cards',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { body: CardCreate, headers: HeaderSchema },
      config: {
        rateLimit: { max: 60, timeWindow: '1 minute' },
        importMeta: { importSource: 'MANUAL', job: 'freight:card-create' },
      },
    },
    async (req, reply) => {
      const headers = HeaderSchema.parse(req.headers);
      const body = CardCreate.parse(req.body);
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

      return reply.code(201).send(out);
    }
  );

  // Patch card
  app.patch<{
    Params: { id: string };
    Body: z.infer<typeof CardUpdate>;
    Headers: z.infer<typeof HeaderSchema>;
  }>(
    '/cards/:id',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { params: z.object({ id: z.string() }), body: CardUpdate, headers: HeaderSchema },
      config: {
        rateLimit: { max: 120, timeWindow: '1 minute' },
        importMeta: { importSource: 'MANUAL', job: 'freight:card-update' },
      },
    },
    async (req, reply) => {
      const headers = HeaderSchema.parse(req.headers);
      const b = CardUpdate.parse(req.body);
      const ns = `freight:cards:update:${req.apiKey!.ownerId}`;
      const idem = getIdem(headers);

      const out = await withIdempotency(ns, idem, { id: req.params.id, ...b }, async () => {
        const [row] = await db
          .update(freightRateCardsTable)
          .set({
            ...(b.origin ? { origin: b.origin } : {}),
            ...(b.dest ? { dest: b.dest } : {}),
            ...(b.freightMode ? { mode: b.freightMode } : {}),
            ...(b.freightUnit ? { unit: b.freightUnit } : {}),
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
        if (String(e?.message) === 'NOT_FOUND') return reply.notFound('Not found');
        throw e;
      });

      // If we already replied above due to NOT_FOUND, stop here
      if (reply.sent) return;
      return out;
    }
  );

  // Delete card
  app.delete<{ Params: { id: string }; Headers: z.infer<typeof HeaderSchema> }>(
    '/cards/:id',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { params: z.object({ id: z.string() }), headers: HeaderSchema },
      config: {
        rateLimit: { max: 60, timeWindow: '1 minute' },
        importMeta: { importSource: 'MANUAL', job: 'freight:card-delete' },
      },
    },
    async (req, reply) => {
      const headers = HeaderSchema.parse(req.headers);
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
        if (String(e?.message) === 'NOT_FOUND') return reply.notFound('Not found');
        throw e;
      });

      if (reply.sent) return;
      return reply.code(204).send();
    }
  );

  // List steps for a card
  app.get<{ Params: { id: string } }>(
    '/cards/:id/steps',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { params: z.object({ id: z.string() }) },
      config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const rows = await db
        .select()
        .from(freightRateStepsTable)
        .where(eq(freightRateStepsTable.cardId, req.params.id))
        .orderBy(freightRateStepsTable.uptoQty);
      return reply.send(rows);
    }
  );

  // Create step
  app.post<{
    Params: { id: string };
    Body: z.infer<typeof StepCreate>;
    Headers: z.infer<typeof HeaderSchema>;
  }>(
    '/cards/:id/steps',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { params: z.object({ id: z.string() }), body: StepCreate, headers: HeaderSchema },
      config: {
        rateLimit: { max: 120, timeWindow: '1 minute' },
        importMeta: { importSource: 'MANUAL', job: 'freight:step-create' },
      },
    },
    async (req, reply) => {
      const headers = HeaderSchema.parse(req.headers);
      const b = StepCreate.parse(req.body);
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

      return reply.code(201).send(out);
    }
  );

  // Patch step
  app.patch<{
    Params: { id: string; stepId: string };
    Body: z.infer<typeof StepUpdate>;
    Headers: z.infer<typeof HeaderSchema>;
  }>(
    '/cards/:id/steps/:stepId',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        params: z.object({ id: z.string(), stepId: z.string() }),
        body: StepUpdate,
        headers: HeaderSchema,
      },
      config: {
        rateLimit: { max: 180, timeWindow: '1 minute' },
        importMeta: { importSource: 'MANUAL', job: 'freight:step-update' },
      },
    },
    async (req, reply) => {
      const headers = HeaderSchema.parse(req.headers);
      const b = StepUpdate.parse(req.body);
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
        if (String(e?.message) === 'NOT_FOUND') return reply.notFound('Not found');
        throw e;
      });

      if (reply.sent) return;
      return out;
    }
  );

  // Delete step
  app.delete<{
    Params: { id: string; stepId: string };
    Headers: z.infer<typeof HeaderSchema>;
  }>(
    '/cards/:id/steps/:stepId',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { params: z.object({ id: z.string(), stepId: z.string() }), headers: HeaderSchema },
      config: {
        rateLimit: { max: 120, timeWindow: '1 minute' },
        importMeta: { importSource: 'MANUAL', job: 'freight:step-delete' },
      },
    },
    async (req, reply) => {
      const headers = HeaderSchema.parse(req.headers);
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
        if (String(e?.message) === 'NOT_FOUND') return reply.notFound('Not found');
        throw e;
      });

      if (reply.sent) return;
      return reply.code(204).send();
    }
  );

  // Bulk JSON import (cards + nested steps) — transactional, idempotent
  app.post<{
    Body: {
      cards: Array<z.infer<typeof CardCreate> & { steps?: Array<z.infer<typeof StepCreate>> }>;
    };
    Headers: z.infer<typeof HeaderSchema>;
  }>(
    '/import-json',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        headers: HeaderSchema,
        body: z.object({
          cards: z.array(CardCreate.safeExtend({ steps: z.array(StepCreate).optional() })).min(1),
        }),
        response: { 200: z.object({ insertedCards: z.number(), insertedSteps: z.number() }) },
      },
      config: {
        rateLimit: { max: 12, timeWindow: '1 minute' },
        importMeta: { importSource: 'MANUAL', job: 'freight:import-json' },
      },
    },
    async (req) => {
      const headers = HeaderSchema.parse(req.headers);
      const body = req.body;
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
    Body: z.infer<typeof FreightCardsPayload>;
    Headers: z.infer<typeof HeaderSchema>;
  }>(
    '/cards/import',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        headers: HeaderSchema,
        body: FreightCardsPayload,
        response: { 200: z.object({ ok: z.literal(true), count: z.number() }) },
      },
      config: {
        rateLimit: { max: 12, timeWindow: '1 minute' },
        importMeta: { importSource: 'MANUAL', job: 'freight:cards-json' },
      },
    },
    async (req, reply) => {
      const headers = HeaderSchema.parse(req.headers);
      const idem = getIdem(headers);
      if (!idem) return reply.badRequest('Idempotency-Key header required');

      const ns = `freight:cards:service-import:${req.apiKey!.ownerId}`;

      return withIdempotency(ns, idem, req.body, async () => {
        return importFreightCards(req.body.cards);
      });
    }
  );
}
