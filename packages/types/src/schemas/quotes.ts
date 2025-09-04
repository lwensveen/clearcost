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
  origin: z.string().min(2), // ISO-2 (relaxed)
  dest: z.string().min(2), // ISO-2 (relaxed)
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
});
