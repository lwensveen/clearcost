import { z } from 'zod/v4';
import {
  BillingCheckoutBodySchema,
  BillingCheckoutResponseSchema,
  BillingComputeUsageResponseSchema,
  BillingEntitlementsResponseSchema,
  BillingPlanResponseSchema,
  BillingPortalBodySchema,
  BillingPortalResponseSchema,
  BillingWebhookResponseSchema,
} from '../schemas/index.js';

export type BillingCheckoutBody = z.infer<typeof BillingCheckoutBodySchema>;
export type BillingCheckoutResponse = z.infer<typeof BillingCheckoutResponseSchema>;
export type BillingPortalBody = z.infer<typeof BillingPortalBodySchema>;
export type BillingPortalResponse = z.infer<typeof BillingPortalResponseSchema>;
export type BillingPlanResponse = z.infer<typeof BillingPlanResponseSchema>;
export type BillingEntitlementsResponse = z.infer<typeof BillingEntitlementsResponseSchema>;
export type BillingComputeUsageResponse = z.infer<typeof BillingComputeUsageResponseSchema>;
export type BillingWebhookResponse = z.infer<typeof BillingWebhookResponseSchema>;
