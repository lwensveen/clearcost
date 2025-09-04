import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { HeaderSchema } from '@clearcost/types';
import {
  ensureOrgSettings,
  getOrgHeader,
  rotateOrgWebhookSecret,
  updateOrgAndSettings,
} from './services.js';
import { withIdempotency } from '../../lib/idempotency.js';

// Body accepted from the frontend (strings/nullable)
const OrgSettingsBody = z.object({
  name: z.string().min(1),
  billingEmail: z.string().email().nullable().optional(),
  defaultCurrency: z.string().length(3),
  taxId: z.string().max(64).nullable().optional(),
  webhookUrl: z.string().url().nullable().optional(),
});

// Shared response schema
const OrgSettingsResponse = z.object({
  org: z.object({ id: z.string(), name: z.string() }),
  settings: z.object({
    id: z.string(),
    orgId: z.string().nullable(),
    billingEmail: z.string().nullable(),
    defaultCurrency: z.string(),
    taxId: z.string().nullable(),
    webhookUrl: z.string().nullable(),
    webhookSecret: z.string().nullable(),
    address: z.any().nullable(),
    createdAt: z.coerce.date().nullable(),
    updatedAt: z.coerce.date().nullable().optional(),
  }),
});

function idemFrom(headers: z.infer<typeof HeaderSchema>) {
  return headers['idempotency-key'] ?? headers['x-idempotency-key']!;
}

export default function orgSelfSettingsRoutes(app: FastifyInstance) {
  // GET /v1/orgs/self/settings
  app.get(
    '/self/settings',
    {
      preHandler: app.requireApiKey(['self:read']),
      schema: { response: { 200: OrgSettingsResponse } },
      config: { rateLimit: { max: 300, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const orgId = req.apiKey!.ownerId; // same usage as your freight routes
      const [org, settings] = await Promise.all([getOrgHeader(orgId), ensureOrgSettings(orgId)]);
      return reply.send({ org, settings });
    }
  );

  // PUT /v1/orgs/self/settings
  app.put<{
    Body: z.infer<typeof OrgSettingsBody>;
    Headers: z.infer<typeof HeaderSchema>;
  }>(
    '/self/settings',
    {
      preHandler: app.requireApiKey(['self:write']),
      schema: {
        body: OrgSettingsBody,
        headers: HeaderSchema,
        response: { 200: OrgSettingsResponse },
      },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const headers = HeaderSchema.parse(req.headers);
      const body = OrgSettingsBody.parse(req.body);
      const orgId = req.apiKey!.ownerId;
      const ns = `orgs:self:settings:update:${orgId}`;
      const idem = idemFrom(headers);

      const result = await withIdempotency(ns, idem, body, async () => {
        const settings = await updateOrgAndSettings(orgId, {
          name: body.name,
          billingEmail: body.billingEmail ?? null,
          defaultCurrency: body.defaultCurrency.toUpperCase(),
          taxId: body.taxId ?? null,
          webhookUrl: body.webhookUrl ?? null,
        });
        const org = await getOrgHeader(orgId);
        return { org, settings };
      });

      return reply.send(result);
    }
  );

  // POST /v1/orgs/self/settings/rotate-webhook
  app.post<{
    Headers: z.infer<typeof HeaderSchema>;
  }>(
    '/self/settings/rotate-webhook',
    {
      preHandler: app.requireApiKey(['self:write']),
      schema: {
        headers: HeaderSchema,
        response: { 200: z.object({ ok: z.literal(true), secret: z.string() }) },
      },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const headers = HeaderSchema.parse(req.headers);
      const orgId = req.apiKey!.ownerId;
      const ns = `orgs:self:settings:rotate-webhook:${orgId}`;
      const idem = idemFrom(headers);

      const result = await withIdempotency(ns, idem, {}, async () => {
        const secret = await rotateOrgWebhookSecret(orgId);
        return { ok: true as const, secret };
      });

      return reply.send(result);
    }
  );
}
