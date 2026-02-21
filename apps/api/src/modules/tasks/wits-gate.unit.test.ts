import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { afterEach, describe, expect, it } from 'vitest';
import taskRoutes from './index.js';

const ORIGINAL_ENABLE_WITS_IMPORTS = process.env.ENABLE_WITS_IMPORTS;
const ORIGINAL_ENABLE_WITS_BACKFILL = process.env.ENABLE_WITS_BACKFILL;

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async () => undefined);
  taskRoutes(app);
  return app;
}

afterEach(() => {
  if (ORIGINAL_ENABLE_WITS_IMPORTS === undefined) delete process.env.ENABLE_WITS_IMPORTS;
  else process.env.ENABLE_WITS_IMPORTS = ORIGINAL_ENABLE_WITS_IMPORTS;

  if (ORIGINAL_ENABLE_WITS_BACKFILL === undefined) delete process.env.ENABLE_WITS_BACKFILL;
  else process.env.ENABLE_WITS_BACKFILL = ORIGINAL_ENABLE_WITS_BACKFILL;
});

describe('wits route gate', () => {
  it('returns 403 for wits routes when wits imports are disabled', async () => {
    delete process.env.ENABLE_WITS_IMPORTS;
    delete process.env.ENABLE_WITS_BACKFILL;

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/wits',
      payload: { dests: ['JP'] },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({
      error: {
        code: 'ERR_FORBIDDEN',
      },
    });

    await app.close();
  });
});
