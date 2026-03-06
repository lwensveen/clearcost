import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withIdempotencyMock: vi.fn(),
  getOrgHeaderMock: vi.fn(),
  ensureOrgSettingsMock: vi.fn(),
  updateOrgAndSettingsMock: vi.fn(),
  rotateOrgWebhookSecretMock: vi.fn(),
}));

vi.mock('../../lib/idempotency.js', () => ({
  withIdempotency: mocks.withIdempotencyMock,
}));

vi.mock('./services.js', () => ({
  getOrgHeader: mocks.getOrgHeaderMock,
  ensureOrgSettings: mocks.ensureOrgSettingsMock,
  updateOrgAndSettings: mocks.updateOrgAndSettingsMock,
  rotateOrgWebhookSecret: mocks.rotateOrgWebhookSecretMock,
}));

import orgSettingsRoutes from './routes.js';

const sampleOrg = { id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', name: 'Test Org' };
const sampleSettings = {
  id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  orgId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  defaultCurrency: 'USD',
  webhookUrl: null,
  webhookSecret: null,
  billingEmail: null,
  taxId: null,
  address: null,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async (req: any) => {
    req.apiKey = { id: 'api_1', ownerId: 'owner_1' };
  });
  await app.register(orgSettingsRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getOrgHeaderMock.mockResolvedValue(sampleOrg);
  mocks.ensureOrgSettingsMock.mockResolvedValue(sampleSettings);
  mocks.updateOrgAndSettingsMock.mockResolvedValue(sampleSettings);
  mocks.rotateOrgWebhookSecretMock.mockResolvedValue('whsec_new_secret_123');
  mocks.withIdempotencyMock.mockImplementation(async (_ns, _key, _body, compute) => compute());
});

describe('org-settings routes', () => {
  describe('GET /self/settings', () => {
    it('returns org header and settings', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/self/settings' });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.org).toMatchObject({ id: sampleOrg.id, name: 'Test Org' });
      expect(body.settings).toMatchObject({ defaultCurrency: 'USD' });
      expect(mocks.getOrgHeaderMock).toHaveBeenCalledWith('owner_1');
      expect(mocks.ensureOrgSettingsMock).toHaveBeenCalledWith('owner_1');
      await app.close();
    });
  });

  describe('PUT /self/settings', () => {
    it('updates org settings via idempotency', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'PUT',
        url: '/self/settings',
        headers: { 'idempotency-key': 'idem_put_1' },
        payload: {
          name: 'Updated Org',
          defaultCurrency: 'eur',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(mocks.withIdempotencyMock).toHaveBeenCalledWith(
        'orgs:self:settings:update:owner_1',
        'idem_put_1',
        expect.any(Object),
        expect.any(Function)
      );
      expect(mocks.updateOrgAndSettingsMock).toHaveBeenCalledWith(
        'owner_1',
        expect.objectContaining({
          name: 'Updated Org',
          defaultCurrency: 'EUR',
        })
      );
      await app.close();
    });

    it('returns 400 when name is missing', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'PUT',
        url: '/self/settings',
        headers: { 'idempotency-key': 'idem_bad' },
        payload: { defaultCurrency: 'USD' },
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });

  describe('POST /self/settings/rotate-webhook', () => {
    it('rotates webhook secret via idempotency', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/self/settings/rotate-webhook',
        headers: { 'idempotency-key': 'idem_rotate' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.ok).toBe(true);
      expect(body.secret).toBe('whsec_new_secret_123');
      expect(mocks.rotateOrgWebhookSecretMock).toHaveBeenCalledWith('owner_1');
      await app.close();
    });
  });
});
