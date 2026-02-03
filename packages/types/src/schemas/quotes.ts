import z from 'zod/v4';

export const MoneySchema = z.object({
  amount: z.number(),
  currency: z.string().min(3).max(3),
});

export const DimsCmSchema = z.object({
  l: z.number(),
  w: z.number(),
  h: z.number(),
});

export const QuoteInputSchema = z.object({
  origin: z.string().length(2),
  dest: z.string().length(2),
  itemValue: MoneySchema,
  dimsCm: DimsCmSchema,
  weightKg: z.number().finite(),
  categoryKey: z.string().min(1),
  hs6: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  mode: z.enum(['air', 'sea']),
});

/** ---------- Quote Response ---------- */
export const DeMinimisRuleSchema = z.object({
  thresholdDest: z.number(),
  deMinimisBasis: z.enum(['CIF', 'INTRINSIC']),
  under: z.boolean(),
});

export const QuoteComponentConfidenceSchema = z.enum(['authoritative', 'estimated', 'missing']);
export const QuoteMissingComponentSchema = z.enum(['duty', 'vat', 'surcharges', 'freight', 'fx']);

export const QuoteSourceMetadataSchema = z.object({
  provider: z.string().nullable().optional(),
  dataset: z.string().nullable().optional(),
  asOf: z.string().nullable().optional(),
  effectiveFrom: z.string().nullable().optional(),
});

export const QuoteResponseSchema = z.object({
  hs6: z.string().regex(/^\d{6}$/),

  // optional fields supported by the API
  currency: z.string().optional(),
  incoterm: z.enum(['DAP', 'DDP']).optional(),

  chargeableKg: z.number(),
  freight: z.number(),

  deMinimis: z
    .object({
      duty: DeMinimisRuleSchema.nullable(),
      vat: DeMinimisRuleSchema.nullable(),
      suppressDuty: z.boolean(),
      suppressVAT: z.boolean(),
    })
    .optional(),

  components: z.object({
    CIF: z.number(),
    duty: z.number(),
    vat: z.number(),
    fees: z.number(),
    checkoutVAT: z.number().optional(),
  }),

  total: z.number(),
  guaranteedMax: z.number(),
  policy: z.string(),

  componentConfidence: z
    .object({
      duty: QuoteComponentConfidenceSchema,
      vat: QuoteComponentConfidenceSchema,
      surcharges: QuoteComponentConfidenceSchema,
      freight: QuoteComponentConfidenceSchema,
      fx: QuoteComponentConfidenceSchema,
    })
    .optional(),
  overallConfidence: QuoteComponentConfidenceSchema.optional(),
  missingComponents: z.array(QuoteMissingComponentSchema).optional(),
  sources: z
    .object({
      duty: QuoteSourceMetadataSchema.optional(),
      vat: QuoteSourceMetadataSchema.optional(),
      surcharges: QuoteSourceMetadataSchema.optional(),
    })
    .optional(),
});

export const QuoteRecentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sinceHours: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 90)
    .optional(),
});

export const QuoteByKeyParamsSchema = z.object({
  key: z.string().min(1),
});

export const QuoteReplayQuerySchema = z.object({
  key: z.string().min(1),
  // kept for legacy, but ignored in favor of tenant-scoped lookup
  scope: z.string().default('quotes'),
});

export const QuoteRecentRowSchema = z.object({
  createdAt: z.string(),
  idemKey: z.string(),
  origin: z.string(),
  dest: z.string(),
  mode: z.enum(['air', 'sea']).nullable(),
  hs6: z.string().nullable(),
  currency: z.string().nullable(),
  itemValue: z.number().nullable(),
  total: z.number(),
  duty: z.number(),
  vat: z.number().nullable(),
  fees: z.number(),
});

export const QuoteRecentListResponseSchema = z.object({
  rows: z.array(QuoteRecentRowSchema),
});

export const QuoteStatsResponseSchema = z.object({
  last24h: z.object({ count: z.number() }),
  last7d: z.object({ count: z.number() }),
});
