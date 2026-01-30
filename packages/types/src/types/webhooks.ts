import { z } from 'zod/v4';
import {
  WebhookDeliveriesListQuerySchema,
  WebhookDeliveriesListResponseSchema,
  WebhookDeliveryCoercedSchema,
  WebhookEndpointCreateBodySchema,
  WebhookEndpointCreateResponseSchema,
  WebhookEndpointPublicCoercedSchema,
  WebhookEndpointRotateParamsSchema,
  WebhookEndpointRotateResponseSchema,
  WebhookEndpointUpdateBodySchema,
  WebhookEndpointUpdateParamsSchema,
  WebhookEndpointUpdateResponseSchema,
  WebhookEndpointsListQuerySchema,
  WebhookEndpointsListResponseSchema,
} from '../schemas/index.js';

export type WebhookEndpointCreateBody = z.infer<typeof WebhookEndpointCreateBodySchema>;
export type WebhookEndpointsListQuery = z.infer<typeof WebhookEndpointsListQuerySchema>;
export type WebhookEndpointsListResponse = z.infer<typeof WebhookEndpointsListResponseSchema>;
export type WebhookEndpointPublic = z.infer<typeof WebhookEndpointPublicCoercedSchema>;
export type WebhookEndpointCreateResponse = z.infer<typeof WebhookEndpointCreateResponseSchema>;
export type WebhookEndpointRotateParams = z.infer<typeof WebhookEndpointRotateParamsSchema>;
export type WebhookEndpointRotateResponse = z.infer<typeof WebhookEndpointRotateResponseSchema>;
export type WebhookEndpointUpdateParams = z.infer<typeof WebhookEndpointUpdateParamsSchema>;
export type WebhookEndpointUpdateBody = z.infer<typeof WebhookEndpointUpdateBodySchema>;
export type WebhookEndpointUpdateResponse = z.infer<typeof WebhookEndpointUpdateResponseSchema>;
export type WebhookDeliveriesListQuery = z.infer<typeof WebhookDeliveriesListQuerySchema>;
export type WebhookDelivery = z.infer<typeof WebhookDeliveryCoercedSchema>;
export type WebhookDeliveriesListResponse = z.infer<typeof WebhookDeliveriesListResponseSchema>;
