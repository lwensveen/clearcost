import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { db, webhookDeliveriesTable, webhookEndpointsTable } from '@clearcost/db';
import { desc, eq } from 'drizzle-orm';
import crypto from 'node:crypto';

const CreateBody = z.object({
  ownerId: z.string().uuid(),
  url: z.string().url(),
  events: z.array(z.string()).default([]),
});
const RotateBody = z.object({});

export default function webhookRoutes(app: FastifyInstance) {
  // LIST endpoints (admin)
  app.get<{ Querystring: { ownerId: string } }>(
    '/endpoints',
    {
      preHandler: app.requireApiKey(['admin:webhooks']),
      schema: {
        querystring: z.object({ ownerId: z.string().uuid() }),
        response: {
          200: z.array(
            z.object({
              id: z.string().uuid(),
              ownerId: z.string().uuid(),
              url: z.string(),
              events: z.array(z.string()),
              isActive: z.boolean(),
              createdAt: z.any().nullable(),
              updatedAt: z.any().nullable(),
            })
          ),
        },
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

  // CREATE endpoint (admin)
  app.post<{ Body: z.infer<typeof CreateBody> }>(
    '/endpoints',
    {
      preHandler: app.requireApiKey(['admin:webhooks']),
      schema: {
        body: CreateBody,
        response: {
          201: z.object({
            id: z.string().uuid(),
            ownerId: z.string().uuid(),
            url: z.string(),
            events: z.array(z.string()),
            isActive: z.boolean(),
            secret: z.string(), // return plaintext once
          }),
        },
      },
    },
    async (req, reply) => {
      const body = CreateBody.parse(req.body);
      const secret = 'whsec_' + crypto.randomBytes(24).toString('base64url');
      const [row] = await db
        .insert(webhookEndpointsTable)
        .values({
          ownerId: body.ownerId,
          url: body.url,
          events: body.events,
          isActive: true,
          secret,
        })
        .returning({
          id: webhookEndpointsTable.id,
          ownerId: webhookEndpointsTable.ownerId,
          url: webhookEndpointsTable.url,
          events: webhookEndpointsTable.events,
          isActive: webhookEndpointsTable.isActive,
        });
      return reply.code(201).send({ ...row, secret });
    }
  );

  // ROTATE secret (admin)
  app.post<{ Params: { id: string }; Body: z.infer<typeof RotateBody> }>(
    '/endpoints/:id/rotate',
    {
      preHandler: app.requireApiKey(['admin:webhooks']),
      schema: { params: z.object({ id: z.string().uuid() }), body: RotateBody },
    },
    async (req, reply) => {
      const { id } = req.params;
      const secret = 'whsec_' + crypto.randomBytes(24).toString('base64url');
      const [row] = await db
        .update(webhookEndpointsTable)
        .set({ secret, updatedAt: new Date() })
        .where(eq(webhookEndpointsTable.id, id))
        .returning({ id: webhookEndpointsTable.id, secret: webhookEndpointsTable.secret });
      if (!row) return reply.notFound('Not found');
      return reply.send(row);
    }
  );

  // ACTIVATE/DEACTIVATE (admin)
  app.patch<{ Params: { id: string }; Body: { isActive: boolean } }>(
    '/endpoints/:id',
    {
      preHandler: app.requireApiKey(['admin:webhooks']),
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ isActive: z.boolean() }),
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { isActive } = req.body;
      const [row] = await db
        .update(webhookEndpointsTable)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(webhookEndpointsTable.id, id))
        .returning({ id: webhookEndpointsTable.id, isActive: webhookEndpointsTable.isActive });
      if (!row) return reply.notFound();
      return reply.send(row);
    }
  );

  // DELIVERY LOG (admin)
  app.get<{ Querystring: { endpointId: string } }>(
    '/deliveries',
    {
      preHandler: app.requireApiKey(['admin:webhooks']),
      schema: {
        querystring: z.object({ endpointId: z.string().uuid() }),
      },
    },
    async (req) => {
      const { endpointId } = req.query;
      return db
        .select()
        .from(webhookDeliveriesTable)
        .where(eq(webhookDeliveriesTable.endpointId, endpointId))
        .orderBy(desc(webhookDeliveriesTable.createdAt))
        .limit(200);
    }
  );
}
