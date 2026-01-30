import { z } from 'zod/v4';
import { createSelectSchema } from 'drizzle-zod';
import { webhookDeliveriesTable, webhookEndpointsTable } from '@clearcost/db';

export const WebhookEndpointCreateBodySchema = z.object({
  ownerId: z.string().uuid(),
  url: z.string().url(),
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
