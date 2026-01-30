import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import {
  IdempotencyHeaderSchema,
  OrgSettingsBodySchema,
  OrgSettingsResponseSchema,
  OrgSettingsRotateWebhookResponseSchema,
} from '@clearcost/types';
import {
  ensureOrgSettings,
  getOrgHeader,
  rotateOrgWebhookSecret,
  updateOrgAndSettings,
} from './services.js';
import { withIdempotency } from '../../lib/idempotency.js';

function idemFrom(headers: z.infer<typeof IdempotencyHeaderSchema>) {
  return headers['idempotency-key'] ?? headers['x-idempotency-key']!;
}

export default function orgSelfSettingsRoutes(app: FastifyInstance) {
  // GET /v1/orgs/self/settings
  app.get(
    '/self/settings',
    {
      preHandler: app.requireApiKey(['self:read']),
      schema: { response: { 200: OrgSettingsResponseSchema } },
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
    Body: z.infer<typeof OrgSettingsBodySchema>;
    Headers: z.infer<typeof IdempotencyHeaderSchema>;
  }>(
    '/self/settings',
    {
      preHandler: app.requireApiKey(['self:write']),
      schema: {
        body: OrgSettingsBodySchema,
        headers: IdempotencyHeaderSchema,
        response: { 200: OrgSettingsResponseSchema },
      },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const headers = IdempotencyHeaderSchema.parse(req.headers);
      const body = OrgSettingsBodySchema.parse(req.body);
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
    Headers: z.infer<typeof IdempotencyHeaderSchema>;
  }>(
    '/self/settings/rotate-webhook',
    {
      preHandler: app.requireApiKey(['self:write']),
      schema: {
        headers: IdempotencyHeaderSchema,
        response: { 200: OrgSettingsRotateWebhookResponseSchema },
      },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const headers = IdempotencyHeaderSchema.parse(req.headers);
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
