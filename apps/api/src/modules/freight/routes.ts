import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { db, freightRateCardsTable, freightRateStepsTable } from '@clearcost/db';
import { and, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm';
import { FreightCards, importFreightCards } from './services/import-cards.js';

const ModeEnum = z.enum(['air', 'sea']);
const UnitEnum = z.enum(['kg', 'm3']);

const CardCreate = z.object({
  origin: z.string().length(3), // airport/seaport IATA/UN/LOCODE short? (you defined earlier)
  dest: z.string().length(3),
  mode: ModeEnum,
  unit: UnitEnum,
  carrier: z.string().min(1).optional().nullable(),
  service: z.string().min(1).optional().nullable(),
  notes: z.string().optional().nullable(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
});

const CardUpdate = CardCreate.partial();

const StepCreate = z.object({
  uptoQty: z.number().positive(), // threshold in unit
  pricePerUnit: z.number().nonnegative(),
});
const StepUpdate = StepCreate.partial();

const CardsQuery = z.object({
  q: z.string().optional(),
  origin: z.string().length(3).optional(),
  dest: z.string().length(3).optional(),
  mode: ModeEnum.optional(),
  unit: UnitEnum.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export default function freightRoutes(app: FastifyInstance) {
  app.get<{ Querystring: z.infer<typeof CardsQuery> }>(
    '/cards',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { querystring: CardsQuery },
    },
    async (req) => {
      const { q, origin, dest, mode, unit, from, to, limit, offset } = CardsQuery.parse(req.query);
      const where = and(
        origin ? eq(freightRateCardsTable.origin, origin) : sql`TRUE`,
        dest ? eq(freightRateCardsTable.dest, dest) : sql`TRUE`,
        mode ? eq(freightRateCardsTable.mode as any, mode) : sql`TRUE`,
        unit ? eq(freightRateCardsTable.unit as any, unit) : sql`TRUE`,
        q ? ilike(freightRateCardsTable.carrier, `%${q}%`) : sql`TRUE`,
        from ? gte(freightRateCardsTable.effectiveFrom as any, from) : sql`TRUE`,
        to ? lte(freightRateCardsTable.effectiveFrom as any, to) : sql`TRUE`
      );
      return db
        .select()
        .from(freightRateCardsTable)
        .where(where)
        .orderBy(desc(freightRateCardsTable.effectiveFrom))
        .limit(limit)
        .offset(offset);
    }
  );

  app.post<{ Body: z.infer<typeof CardCreate> }>(
    '/cards',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { body: CardCreate },
    },
    async (req, reply) => {
      const b = CardCreate.parse(req.body);
      const [row] = await db
        .insert(freightRateCardsTable)
        .values({
          origin: b.origin,
          dest: b.dest,
          mode: b.mode as any,
          unit: b.unit as any,
          carrier: b.carrier ?? null,
          service: b.service ?? null,
          notes: b.notes ?? null,
          effectiveFrom: b.effectiveFrom as any,
          effectiveTo: (b.effectiveTo ?? null) as any,
        } as any)
        .returning();
      return reply.code(201).send(row);
    }
  );

  app.patch<{ Params: { id: string }; Body: z.infer<typeof CardUpdate> }>(
    '/cards/:id',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { params: z.object({ id: z.string() }), body: CardUpdate },
    },
    async (req, reply) => {
      const b = CardUpdate.parse(req.body);
      const [row] = await db
        .update(freightRateCardsTable)
        .set({
          ...(b.origin ? { origin: b.origin } : {}),
          ...(b.dest ? { dest: b.dest } : {}),
          ...(b.mode ? { mode: b.mode as any } : {}),
          ...(b.unit ? { unit: b.unit as any } : {}),
          ...(b.carrier !== undefined ? { carrier: b.carrier ?? null } : {}),
          ...(b.service !== undefined ? { service: b.service ?? null } : {}),
          ...(b.notes !== undefined ? { notes: b.notes ?? null } : {}),
          ...(b.effectiveFrom ? { effectiveFrom: b.effectiveFrom as any } : {}),
          ...(b.effectiveTo !== undefined ? { effectiveTo: (b.effectiveTo ?? null) as any } : {}),
          updatedAt: new Date() as any,
        } as any)
        .where(eq(freightRateCardsTable.id, req.params.id as any))
        .returning();
      if (!row) return reply.notFound('Not found');
      return row;
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/cards/:id',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { params: z.object({ id: z.string() }) },
    },
    async (req, reply) => {
      const [row] = await db
        .delete(freightRateCardsTable)
        .where(eq(freightRateCardsTable.id, req.params.id as any))
        .returning();
      if (!row) return reply.notFound('Not found');
      return reply.code(204).send();
    }
  );

  app.get<{ Params: { id: string } }>(
    '/cards/:id/steps',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { params: z.object({ id: z.string() }) },
    },
    async (req, reply) => {
      const rows = await db
        .select()
        .from(freightRateStepsTable)
        .where(eq(freightRateStepsTable.cardId, req.params.id as any))
        .orderBy(freightRateStepsTable.uptoQty as any);
      return reply.send(rows);
    }
  );

  app.post<{ Params: { id: string }; Body: z.infer<typeof StepCreate> }>(
    '/cards/:id/steps',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { params: z.object({ id: z.string() }), body: StepCreate },
    },
    async (req, reply) => {
      const b = StepCreate.parse(req.body);
      const [row] = await db
        .insert(freightRateStepsTable)
        .values({
          cardId: req.params.id as any,
          uptoQty: String(b.uptoQty),
          pricePerUnit: String(b.pricePerUnit),
        } as any)
        .returning();
      return reply.code(201).send(row);
    }
  );

  app.patch<{ Params: { id: string; stepId: string }; Body: z.infer<typeof StepUpdate> }>(
    '/cards/:id/steps/:stepId',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { params: z.object({ id: z.string(), stepId: z.string() }), body: StepUpdate },
    },
    async (req, reply) => {
      const b = StepUpdate.parse(req.body);
      const [row] = await db
        .update(freightRateStepsTable)
        .set({
          ...(b.uptoQty !== undefined ? { uptoQty: String(b.uptoQty) } : {}),
          ...(b.pricePerUnit !== undefined ? { pricePerUnit: String(b.pricePerUnit) } : {}),
          updatedAt: new Date() as any,
        } as any)
        .where(
          and(
            eq(freightRateStepsTable.cardId, req.params.id as any),
            eq(freightRateStepsTable.id, req.params.stepId as any)
          )
        )
        .returning();
      if (!row) return reply.notFound('Not found');
      return row;
    }
  );

  app.delete<{ Params: { id: string; stepId: string } }>(
    '/cards/:id/steps/:stepId',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: { params: z.object({ id: z.string(), stepId: z.string() }) },
    },
    async (req, reply) => {
      const [row] = await db
        .delete(freightRateStepsTable)
        .where(
          and(
            eq(freightRateStepsTable.cardId, req.params.id as any),
            eq(freightRateStepsTable.id, req.params.stepId as any)
          )
        )
        .returning();
      if (!row) return reply.notFound('Not found');
      return reply.code(204).send();
    }
  );

  // ---- Bulk import: array of cards with nested steps
  app.post<{
    Body: {
      cards: Array<z.infer<typeof CardCreate> & { steps?: Array<z.infer<typeof StepCreate>> }>;
    };
  }>(
    '/import-json',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        body: z.object({
          cards: z.array(CardCreate.extend({ steps: z.array(StepCreate).optional() })),
        }),
        response: { 200: z.object({ insertedCards: z.number(), insertedSteps: z.number() }) },
      },
    },
    async (req) => {
      let insertedCards = 0,
        insertedSteps = 0;
      for (const c of req.body.cards) {
        const cards = await db
          .insert(freightRateCardsTable)
          .values({
            origin: c.origin,
            dest: c.dest,
            mode: c.mode as any,
            unit: c.unit as any,
            carrier: c.carrier ?? null,
            service: c.service ?? null,
            notes: c.notes ?? null,
            effectiveFrom: c.effectiveFrom as any,
            effectiveTo: (c.effectiveTo ?? null) as any,
          } as any)
          .returning();

        const card = cards[0];
        if (!card) throw Error('Card not found');

        insertedCards++;

        if (c.steps?.length) {
          for (const s of c.steps) {
            await db
              .insert(freightRateStepsTable)
              .values({
                cardId: card.id as any,
                uptoQty: String(s.uptoQty),
                pricePerUnit: String(s.pricePerUnit),
              } as any)
              .onConflictDoNothing();
            insertedSteps++;
          }
        }
      }
      return { insertedCards, insertedSteps };
    }
  );

  app.post<{ Body: z.infer<typeof FreightCards> }>(
    '/cards/import',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        body: FreightCards,
        response: { 200: z.object({ ok: z.literal(true), count: z.number() }) },
      },
    },
    async (req) => importFreightCards(req.body)
  );
}
