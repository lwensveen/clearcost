import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { freightRateCardsTable } from '@clearcost/db';

export const FreightRateCardSelectSchema = createSelectSchema(freightRateCardsTable);
export const FreightRateCardInsertSchema = createInsertSchema(freightRateCardsTable);
export const FreightRateCardUpdateSchema = createUpdateSchema(freightRateCardsTable);

export const FreightRateCardSelectCoercedSchema = FreightRateCardSelectSchema.extend({
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});

export const FreightRateCardByIdSchema = z.object({ id: z.string().uuid() });

export const FreightRateCardsListQuerySchema = z.object({
  origin: z.string().length(3).optional(),
  dest: z.string().length(3).optional(),
  mode: z.enum(['air', 'sea']).optional(),
  unit: z.enum(['kg', 'm3']).optional(),
  activeOn: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export const FreightModeSchema = z.enum(['air', 'sea']);
export const FreightUnitSchema = z.enum(['kg', 'm3']);
const FreightLaneCountryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,3}$/, 'Expected ISO2 or ISO3 country code');

const FreightCardAdminBaseSchema = z.object({
  origin: z.string().length(3),
  dest: z.string().length(3),
  freightMode: FreightModeSchema,
  freightUnit: FreightUnitSchema,
  carrier: z.string().min(1).optional().nullable(),
  service: z.string().min(1).optional().nullable(),
  notes: z.string().optional().nullable(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
});

export const FreightCardAdminCreateSchema = FreightCardAdminBaseSchema.refine(
  (b) => !b.effectiveTo || b.effectiveTo >= b.effectiveFrom,
  {
    message: 'effectiveTo must be >= effectiveFrom',
    path: ['effectiveTo'],
  }
);

export const FreightCardAdminUpdateSchema = FreightCardAdminBaseSchema.partial().refine(
  (b) =>
    Object.values(b).some((v) => v !== undefined) &&
    (!b.effectiveTo || !b.effectiveFrom || b.effectiveTo >= b.effectiveFrom),
  { message: 'At least one field required and effectiveTo>=effectiveFrom when both provided' }
);

export const FreightCardsAdminQuerySchema = z
  .object({
    q: z.string().optional(),
    origin: z.string().length(3).optional(),
    dest: z.string().length(3).optional(),
    freightMode: FreightModeSchema.optional(),
    freightUnit: FreightUnitSchema.optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    limit: z.coerce.number().int().positive().max(200).default(50),
    offset: z.coerce.number().int().nonnegative().default(0),
  })
  .refine((q) => !(q.from && q.to) || q.to >= q.from, {
    message: '`to` must be >= `from`',
    path: ['to'],
  });

export const FreightCardsAdminListResponseSchema = z.array(FreightRateCardSelectCoercedSchema);

export const FreightCardAdminIdParamSchema = z.object({ id: z.string().uuid() });

export const FreightCardAdminImportJsonCardSchema = FreightCardAdminCreateSchema.safeExtend({
  steps: z
    .array(
      z.object({
        uptoQty: z.number().positive(),
        pricePerUnit: z.number().nonnegative(),
      })
    )
    .optional(),
});

export const FreightCardAdminImportJsonBodySchema = z.object({
  cards: z.array(FreightCardAdminImportJsonCardSchema).min(1),
});

export const FreightCardAdminImportJsonResponseSchema = z.object({
  insertedCards: z.number(),
  insertedSteps: z.number(),
});

export const FreightCardImportStepSchema = z.object({
  uptoQty: z.coerce.number().positive(),
  pricePerUnit: z.coerce.number().nonnegative(),
});

export const FreightCardImportSchema = z.object({
  origin: FreightLaneCountryCodeSchema,
  dest: FreightLaneCountryCodeSchema,
  freightMode: FreightModeSchema,
  freightUnit: FreightUnitSchema,
  currency: z.string().length(3).default('USD'),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  minCharge: z.coerce.number().optional(),
  priceRounding: z.coerce.number().optional(),
  volumetricDivisor: z.coerce.number().int().positive().optional(),
  carrier: z.string().optional(),
  notes: z.string().optional(),
  steps: z.array(FreightCardImportStepSchema).min(1),
});

export const FreightCardsImportSchema = z.array(FreightCardImportSchema);

export const FreightCardsImportResponseSchema = z.object({
  ok: z.literal(true),
  count: z.number(),
});
