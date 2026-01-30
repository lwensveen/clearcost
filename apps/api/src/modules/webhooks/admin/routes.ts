import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
import { db, webhookDeliveriesTable, webhookEndpointsTable } from '@clearcost/db';
import { desc, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { encryptSecret } from '../services/secret-kms.js';
import { errorResponseForStatus } from '../../../lib/errors.js';
import {
  ErrorResponseSchema,
  WebhookDeliveriesListQuerySchema,
  WebhookDeliveriesListResponseSchema,
  WebhookEndpointCreateBodySchema,
  WebhookEndpointCreateResponseSchema,
  WebhookEndpointRotateParamsSchema,
  WebhookEndpointRotateResponseSchema,
  WebhookEndpointUpdateBodySchema,
  WebhookEndpointUpdateParamsSchema,
  WebhookEndpointUpdateResponseSchema,
  WebhookEndpointsListQuerySchema,
  WebhookEndpointsListResponseSchema,
} from '@clearcost/types';

export default function webhookAdminRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // LIST endpoints (admin)
  r.get(
    '/endpoints',
    {
      preHandler: app.requireApiKey(['admin:webhooks']),
      schema: {
        querystring: WebhookEndpointsListQuerySchema,
        response: { 200: WebhookEndpointsListResponseSchema },
      },
    },
    async (req) => {
      const { ownerId } = WebhookEndpointsListQuerySchema.parse(req.query);
      const rows = await db
        .select({
          id: webhookEndpointsTable.id,
          ownerId: webhookEndpointsTable.ownerId,
          url: webhookEndpointsTable.url,
          events: webhookEndpointsTable.events,
          isActive: webhookEndpointsTable.isActive,
          createdAt: webhookEndpointsTable.createdAt,
          updatedAt: webhookEndpointsTable.updatedAt,
        })
        .from(webhookEndpointsTable)
        .where(eq(webhookEndpointsTable.ownerId, ownerId));
      return WebhookEndpointsListResponseSchema.parse(rows);
    }
  );

  // CREATE — returns plaintext secret once
  r.post<{
    Body: z.infer<typeof WebhookEndpointCreateBodySchema>;
    Reply:
      | z.infer<typeof WebhookEndpointCreateResponseSchema>
      | z.infer<typeof ErrorResponseSchema>;
  }>(
    '/endpoints',
    {
      preHandler: app.requireApiKey(['admin:webhooks']),
      schema: {
        body: WebhookEndpointCreateBodySchema,
        response: { 201: WebhookEndpointCreateResponseSchema, 500: ErrorResponseSchema },
      },
    },
    async (req, reply) => {
      const body = WebhookEndpointCreateBodySchema.parse(req.body);
      const plaintext = 'whsec_' + randomBytes(32).toString('base64url');
      const { encB64u, ivB64u, tagB64u } = encryptSecret(plaintext);

      const [row] = await db
        .insert(webhookEndpointsTable)
        .values({
          ownerId: body.ownerId,
          url: body.url,
          events: body.events,
          isActive: true,
          secretEnc: encB64u,
          secretIv: ivB64u,
          secretTag: tagB64u,
        })
        .returning({
          id: webhookEndpointsTable.id,
          ownerId: webhookEndpointsTable.ownerId,
          url: webhookEndpointsTable.url,
          events: webhookEndpointsTable.events,
          isActive: webhookEndpointsTable.isActive,
          createdAt: webhookEndpointsTable.createdAt,
          updatedAt: webhookEndpointsTable.updatedAt,
        });

      if (!row) return reply.code(500).send(errorResponseForStatus(500, 'Insert failed'));
      return reply
        .code(201)
        .send(WebhookEndpointCreateResponseSchema.parse({ ...row, secret: plaintext }));
    }
  );

  // ROTATE — returns new plaintext once
  r.post<{
    Params: z.infer<typeof WebhookEndpointRotateParamsSchema>;
    Reply:
      | z.infer<typeof WebhookEndpointRotateResponseSchema>
      | z.infer<typeof ErrorResponseSchema>;
  }>(
    '/endpoints/:id/rotate',
    {
      preHandler: app.requireApiKey(['admin:webhooks']),
      schema: {
        params: WebhookEndpointRotateParamsSchema,
        response: { 200: WebhookEndpointRotateResponseSchema, 404: ErrorResponseSchema },
      },
    },
    async (req, reply) => {
      const { id } = WebhookEndpointRotateParamsSchema.parse(req.params);
      const plaintext = 'whsec_' + randomBytes(32).toString('base64url');
      const { encB64u, ivB64u, tagB64u } = encryptSecret(plaintext);

      const [row] = await db
        .update(webhookEndpointsTable)
        .set({ secretEnc: encB64u, secretIv: ivB64u, secretTag: tagB64u, updatedAt: new Date() })
        .where(eq(webhookEndpointsTable.id, id))
        .returning({ id: webhookEndpointsTable.id });

      if (!row) return reply.code(404).send(errorResponseForStatus(404, 'Not found'));
      return reply.send(
        WebhookEndpointRotateResponseSchema.parse({ id: row.id, secret: plaintext })
      );
    }
  );

  // ACTIVATE/DEACTIVATE (admin)
  r.patch<{
    Params: z.infer<typeof WebhookEndpointUpdateParamsSchema>;
    Body: z.infer<typeof WebhookEndpointUpdateBodySchema>;
    Reply:
      | z.infer<typeof WebhookEndpointUpdateResponseSchema>
      | z.infer<typeof ErrorResponseSchema>;
  }>(
    '/endpoints/:id',
    {
      preHandler: app.requireApiKey(['admin:webhooks']),
      schema: {
        params: WebhookEndpointUpdateParamsSchema,
        body: WebhookEndpointUpdateBodySchema,
        response: { 200: WebhookEndpointUpdateResponseSchema, 404: ErrorResponseSchema },
      },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { id } = WebhookEndpointUpdateParamsSchema.parse(req.params);
      const { isActive } = WebhookEndpointUpdateBodySchema.parse(req.body);

      const [row] = await db
        .update(webhookEndpointsTable)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(webhookEndpointsTable.id, id))
        .returning({ id: webhookEndpointsTable.id, isActive: webhookEndpointsTable.isActive });

      if (!row) return reply.code(404).send(errorResponseForStatus(404, 'Not found'));
      return reply.send(WebhookEndpointUpdateResponseSchema.parse(row));
    }
  );

  // DELIVERY LOG (admin)
  r.get(
    '/deliveries',
    {
      preHandler: app.requireApiKey(['admin:webhooks']),
      schema: {
        querystring: WebhookDeliveriesListQuerySchema,
        response: { 200: WebhookDeliveriesListResponseSchema },
      },
      config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
    },
    async (req) => {
      const { endpointId } = WebhookDeliveriesListQuerySchema.parse(req.query);
      const rows = await db
        .select()
        .from(webhookDeliveriesTable)
        .where(eq(webhookDeliveriesTable.endpointId, endpointId))
        .orderBy(desc(webhookDeliveriesTable.createdAt))
        .limit(200);
      return WebhookDeliveriesListResponseSchema.parse(rows);
    }
  );
}
