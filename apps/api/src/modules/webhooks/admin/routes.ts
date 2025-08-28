import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
import { db, webhookDeliveriesTable, webhookEndpointsTable } from '@clearcost/db';
import { desc, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { encryptSecret } from '../utils.js';

const CreateBody = z.object({
  ownerId: z.string().uuid(),
  url: z.string().url(),
  events: z.array(z.string()).default([]),
});

const EndpointRowSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  url: z.string().url(),
  events: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.any().nullable(),
  updatedAt: z.any().nullable(),
});

const DeliveryRowSchema = z.object({
  id: z.string().uuid(),
  endpointId: z.string().uuid(),
  event: z.string(),
  status: z.number(),
  attempt: z.number().int(),
  requestId: z.string().nullable().optional(),
  createdAt: z.any(),
  payload: z.unknown().optional(), // if you store it
  error: z.string().nullable().optional(),
});

export default function webhookAdminRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // LIST endpoints (admin)
  r.get(
    '/endpoints',
    {
      preHandler: app.requireApiKey(['admin:webhooks']),
      schema: {
        querystring: z.object({ ownerId: z.string().uuid() }),
        response: { 200: z.array(EndpointRowSchema) },
      },
    },
    async (req) => {
      const { ownerId } = req.query;
      return db
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
    }
  );

  // CREATE — returns plaintext secret once
  r.post(
    '/endpoints',
    {
      preHandler: app.requireApiKey(['admin:webhooks']),
      schema: {
        body: CreateBody,
        response: { 201: EndpointRowSchema.extend({ secret: z.string() }) },
      },
    },
    async (req, reply) => {
      const plaintext = 'whsec_' + randomBytes(32).toString('base64url');
      const { encB64u, ivB64u, tagB64u } = encryptSecret(plaintext);

      const [row] = await db
        .insert(webhookEndpointsTable)
        .values({
          ownerId: req.body.ownerId,
          url: req.body.url,
          events: req.body.events,
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

      if (!row) return reply.internalServerError('Insert failed');
      return reply.code(201).send({ ...row, secret: plaintext });
    }
  );

  // ROTATE — returns new plaintext once
  r.post(
    '/endpoints/:id/rotate',
    {
      preHandler: app.requireApiKey(['admin:webhooks']),
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: z.object({ id: z.string().uuid(), secret: z.string() }) },
      },
    },
    async (req, reply) => {
      const plaintext = 'whsec_' + randomBytes(32).toString('base64url');
      const { encB64u, ivB64u, tagB64u } = encryptSecret(plaintext);

      const [row] = await db
        .update(webhookEndpointsTable)
        .set({ secretEnc: encB64u, secretIv: ivB64u, secretTag: tagB64u, updatedAt: new Date() })
        .where(eq(webhookEndpointsTable.id, req.params.id))
        .returning({ id: webhookEndpointsTable.id });

      if (!row) return reply.notFound('Not found');
      return reply.send({ id: row.id, secret: plaintext });
    }
  );

  // ACTIVATE/DEACTIVATE (admin)
  r.patch(
    '/endpoints/:id',
    {
      preHandler: app.requireApiKey(['admin:webhooks']),
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ isActive: z.boolean() }),
        response: { 200: z.object({ id: z.string().uuid(), isActive: z.boolean() }) },
      },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { isActive } = req.body;

      const [row] = await db
        .update(webhookEndpointsTable)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(webhookEndpointsTable.id, id))
        .returning({ id: webhookEndpointsTable.id, isActive: webhookEndpointsTable.isActive });

      if (!row) return reply.notFound('Not found');
      return reply.send(row);
    }
  );

  // DELIVERY LOG (admin)
  r.get(
    '/deliveries',
    {
      preHandler: app.requireApiKey(['admin:webhooks']),
      schema: {
        querystring: z.object({ endpointId: z.string().uuid() }),
        response: { 200: z.array(DeliveryRowSchema) },
      },
      config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
    },
    async (req) => {
      const { endpointId } = req.query;
      const rows = await db
        .select()
        .from(webhookDeliveriesTable)
        .where(eq(webhookDeliveriesTable.endpointId, endpointId))
        .orderBy(desc(webhookDeliveriesTable.createdAt))
        .limit(200);
      return z.array(DeliveryRowSchema).parse(rows);
    }
  );
}
