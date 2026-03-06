import { z } from 'zod/v4';
import { createSelectSchema } from 'drizzle-zod';
import { webhookDeliveriesTable, webhookEndpointsTable } from '@clearcost/db';

const webhookUrlSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'https:') return true;
        // Allow http only for localhost in development
        if (
          parsed.protocol === 'http:' &&
          (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
          process.env.NODE_ENV !== 'production'
        ) {
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    { message: 'Webhook URL must use HTTPS (HTTP allowed only for localhost in development)' }
  );

export const WebhookEndpointCreateBodySchema = z.object({
  ownerId: z.string().uuid(),
  url: webhookUrlSchema,
  events: z.array(z.string()).default([]),
});

export const WebhookEndpointsListQuerySchema = z.object({
  ownerId: z.string().uuid(),
});

export const WebhookEndpointSelectSchema = createSelectSchema(webhookEndpointsTable);

export const WebhookEndpointPublicSchema = WebhookEndpointSelectSchema.omit({
  secretEnc: true,
  secretIv: true,
  secretTag: true,
});

export const WebhookEndpointPublicCoercedSchema = WebhookEndpointPublicSchema.extend({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().nullable(),
});

export const WebhookEndpointsListResponseSchema = z.array(WebhookEndpointPublicCoercedSchema);

export const WebhookEndpointCreateResponseSchema = WebhookEndpointPublicCoercedSchema.extend({
  secret: z.string(),
});

export const WebhookEndpointRotateParamsSchema = z.object({
  id: z.string().uuid(),
});

export const WebhookEndpointRotateResponseSchema = z.object({
  id: z.string().uuid(),
  secret: z.string(),
});

export const WebhookEndpointUpdateParamsSchema = z.object({
  id: z.string().uuid(),
});

export const WebhookEndpointUpdateBodySchema = z.object({
  isActive: z.boolean(),
});

export const WebhookEndpointUpdateResponseSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

export const WebhookDeliveriesListQuerySchema = z.object({
  endpointId: z.string().uuid(),
});

export const WebhookDeliverySelectSchema = createSelectSchema(webhookDeliveriesTable);

export const WebhookDeliveryCoercedSchema = WebhookDeliverySelectSchema.extend({
  deliveredAt: z.coerce.date().nullable(),
  nextAttemptAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().nullable(),
});

export const WebhookDeliveriesListResponseSchema = z.array(WebhookDeliveryCoercedSchema);
