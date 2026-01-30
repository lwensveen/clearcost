import { z } from 'zod/v4';

export const BillingCheckoutBodySchema = z.object({
  plan: z.enum(['starter', 'growth', 'scale']),
  returnUrl: z.string().url().optional(),
});

export const BillingCheckoutResponseSchema = z.object({ url: z.string().url() });

export const BillingPortalBodySchema = z.object({
  returnUrl: z.string().url().optional(),
});

export const BillingPortalResponseSchema = z.object({ url: z.string().url() });

export const BillingPlanResponseSchema = z.object({
  plan: z.string(),
  status: z.string().nullable(),
  priceId: z.string().nullable().optional(),
  currentPeriodEnd: z.date().nullable().optional(),
});

export const BillingEntitlementsResponseSchema = z.object({
  plan: z.string(),
  maxManifests: z.number(),
  maxItemsPerManifest: z.number(),
});

export const BillingComputeUsageResponseSchema = z.object({
  allowed: z.boolean(),
  plan: z.string(),
  limit: z.number().int(),
  used: z.number().int(),
});

export const BillingWebhookResponseSchema = z.object({ received: z.literal(true) });
