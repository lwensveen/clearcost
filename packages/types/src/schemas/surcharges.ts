import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { surchargesTable } from '@clearcost/db';

// Base schemas directly from the table
export const SurchargeSelectSchema = createSelectSchema(surchargesTable);
export const SurchargeInsertSchema = createInsertSchema(surchargesTable);
export const SurchargeUpdateSchema = createUpdateSchema(surchargesTable);

// Coerced "read" shape: numbers & dates as JS types; nullable where appropriate
export const SurchargeSelectCoercedSchema = SurchargeSelectSchema.extend({
  fixedAmt: z.coerce.number().nullable().optional(),
  pctAmt: z.coerce.number().nullable().optional(),
  minAmt: z.coerce.number().nullable().optional(),
  maxAmt: z.coerce.number().nullable().optional(),
  unitAmt: z.coerce.number().nullable().optional(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});

// Narrow helper for ID lookups
export const SurchargeByIdSchema = z.object({ id: z.string().uuid() });

// Keep a runtime list of surcharge codes (must match your DB enum)
export const SURCHARGE_CODES = [
  'ANTIDUMPING',
  'COUNTERVAILING',
  'CUSTOMS_PROCESSING',
  'DISBURSEMENT',
  'EXCISE',
  'FUEL',
  'HANDLING',
  'HMF',
  'MPF',
  'OTHER',
  'REMOTE',
  'SECURITY',
  'TRADE_REMEDY_232',
  'TRADE_REMEDY_301',

  // AQI / APHIS
  'AQI_VESSEL',
  'AQI_AIRCRAFT',
  'AQI_RAILCAR',
  'AQI_TRUCK_SINGLE',
  'AQI_TRUCK_TRANSPONDER',
  'AQI_BARGE',

  // FDA / FSMA
  'FDA_VQIP_USER_FEE_ANNUAL',
  'FDA_VQIP_APPLICATION_FEE',
  'FDA_FSMA_REINSPECTION_HOURLY_DOM',
  'FDA_FSMA_REINSPECTION_HOURLY_FOR',
] as const;

// Enums mirrored from your schema (used for filtering in list queries)
const APPLY_LEVELS = ['entry', 'line', 'shipment', 'program', 'arrival'] as const;
const TRANSPORT_MODES = ['ALL', 'AIR', 'OCEAN', 'TRUCK', 'RAIL'] as const;
const VALUE_BASES = ['customs', 'fob', 'cif', 'entered', 'duty', 'other'] as const;

// List query with optional filters; safe, forward-compatible defaults
export const SurchargesListQuerySchema = z.object({
  dest: z.string().length(2).optional(),
  origin: z.string().length(2).optional(),
  hs6: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  surchargeCode: z.enum(SURCHARGE_CODES).optional(),
  applyLevel: z.enum(APPLY_LEVELS).optional(),
  transportMode: z.enum(TRANSPORT_MODES).optional(),
  valueBasis: z.enum(VALUE_BASES).optional(),
  activeOn: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});
